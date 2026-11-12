import { NextResponse } from 'next/server';
import { readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getServerSession, authorizeTenantAccess } from '@/lib/auth';
import { getUserDataDir, writeJsonAtomic } from '@/lib/dataPaths';
import { aiOperationLimiter, rateLimitResponse } from '@/lib/rateLimit';
import { decryptOAuthToken, encryptOAuthToken } from '@/lib/tokenCrypto';
import {
    refreshGoogleAccessToken,
    fetchGoogleLocationReviews,
    listGoogleAccounts,
    listGoogleLocations
} from '@/lib/commentor/googleConnector';
import {
    fetchFacebookComments,
    fetchInstagramComments
} from '@/lib/commentor/metaConnector';
import {
    normalizeAndDeduplicateComments,
    calculateReputationMetrics,
    analyzeCommentsWithAI,
    mergeAnalysisResults
} from '@/lib/commentor/reputationEngine';
import { acquireCommentorLock } from '@/lib/commentor/commentorLocker';

export async function POST(request) {
    let releaseLock = null;
    try {
        const session = await getServerSession(request);
        const body = await request.json().catch(() => ({}));
        const auth = authorizeTenantAccess(session, body?.userId);
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const limitCheck = aiOperationLimiter.check(`commentor-sync:${auth.tenantId}`);
        if (!limitCheck.allowed) {
            return rateLimitResponse(limitCheck, 'Has alcanzado el límite temporal de sincronizaciones en Commentor.');
        }

        releaseLock = await acquireCommentorLock(auth.tenantId);

        const userDir = getUserDataDir(auth.tenantId);
        await mkdir(userDir, { recursive: true });
        const connFilePath = join(userDir, 'connections.json');

        let connections = {};
        try {
            const data = await readFile(connFilePath, 'utf-8');
            connections = JSON.parse(data);
        } catch {
            connections = {};
        }

        let googleRefreshPlain = '';
        if (connections.google?.refreshToken) {
            try {
                googleRefreshPlain = decryptOAuthToken(connections.google.refreshToken);
            } catch {
                googleRefreshPlain = '';
            }
        }

        let metaAccessPlain = '';
        if (connections.meta?.accessToken) {
            try {
                metaAccessPlain = decryptOAuthToken(connections.meta.accessToken);
            } catch {
                metaAccessPlain = '';
            }
        }

        const hasValidGoogle = Boolean(
            connections.google?.connected === true &&
            googleRefreshPlain &&
            !googleRefreshPlain.startsWith('mock_')
        );

        const hasValidMeta = Boolean(
            connections.meta?.connected === true &&
            metaAccessPlain &&
            !metaAccessPlain.startsWith('mock_')
        );

        if (!hasValidGoogle && !hasValidMeta) {
            return NextResponse.json({
                error: 'No hay cuentas conectadas con autorización OAuth real en Commentor.'
            }, { status: 400 });
        }

        const rawCollected = [];
        const providerStatus = {};
        const providerErrors = [];
        let providersAttempted = 0;
        let providersSucceeded = 0;

        // 1. Fetch Google Business Profile Reviews
        if (hasValidGoogle) {
            providersAttempted++;
            try {
                const { accessToken, expiresIn } = await refreshGoogleAccessToken(googleRefreshPlain);
                connections.google.accessToken = encryptOAuthToken(accessToken);
                connections.google.tokenExpiresAt = Date.now() + (expiresIn * 1000);

                let accountName = connections.google.account?.id;
                if (!accountName) {
                    const accounts = await listGoogleAccounts(accessToken);
                    if (accounts.length > 0) {
                        accountName = accounts[0].id;
                        connections.google.account = accounts[0];
                    }
                }

                if (!accountName) {
                    throw new Error('No se encontró ninguna cuenta autorizada en Google Business Profile.');
                }

                let targetLocations = connections.google.selectedLocations || [];
                if (!Array.isArray(targetLocations) || targetLocations.length === 0) {
                    const available = await listGoogleLocations(accessToken, accountName);
                    connections.google.availableLocations = available;
                    targetLocations = available.slice(0, 5).map(l => l.id);
                    connections.google.selectedLocations = targetLocations;
                }

                if (targetLocations.length === 0) {
                    providerStatus.google = {
                        status: 'ok',
                        count: 0,
                        locationsAttempted: 0,
                        locationsSucceeded: 0,
                        note: 'La cuenta de Google Business no tiene ubicaciones configuradas.'
                    };
                    providersSucceeded++;
                } else {
                    let googleCount = 0;
                    let locationsAttempted = targetLocations.length;
                    let locationsSucceeded = 0;
                    let hasPending = false;
                    const byLocation = {};

                    for (const locId of targetLocations) {
                        try {
                            const result = await fetchGoogleLocationReviews({
                                accessToken,
                                accountName,
                                locationName: locId,
                                pageSize: 50,
                                maxPages: 3
                            });
                            rawCollected.push(...result.reviews);
                            googleCount += result.reviews.length;
                            locationsSucceeded++;
                            if (result.hasMore) hasPending = true;

                            byLocation[locId] = {
                                status: 'ok',
                                count: result.reviews.length,
                                hasMore: result.hasMore,
                                nextPageToken: result.nextPageToken,
                                pagesFetched: result.pagesFetched
                            };
                        } catch (locErr) {
                            console.warn(`Error obteniendo reseñas para ubicación Google ${locId}:`, locErr.message);
                            byLocation[locId] = {
                                status: 'error',
                                count: 0,
                                error: locErr.message
                            };
                            providerErrors.push({ provider: 'google', location: locId, error: locErr.message });
                        }
                    }

                    if (locationsAttempted > 0 && locationsSucceeded === 0) {
                        providerStatus.google = {
                            status: 'error',
                            error: 'Fallaron todas las consultas de sucursales en Google Business Profile.',
                            count: 0,
                            locationsAttempted,
                            locationsSucceeded: 0,
                            hasMore: false,
                            byLocation
                        };
                    } else if (locationsSucceeded < locationsAttempted) {
                        providersSucceeded++;
                        providerStatus.google = {
                            status: 'partial',
                            count: googleCount,
                            locationsAttempted,
                            locationsSucceeded,
                            hasMore: hasPending,
                            byLocation
                        };
                    } else {
                        providersSucceeded++;
                        providerStatus.google = {
                            status: 'ok',
                            count: googleCount,
                            locationsAttempted,
                            locationsSucceeded,
                            hasMore: hasPending,
                            byLocation
                        };
                    }
                }
            } catch (err) {
                console.error('Error sincronizando Google Business Profile:', err);
                providerStatus.google = {
                    status: 'error',
                    error: err.message,
                    count: 0,
                    locationsAttempted: 0,
                    locationsSucceeded: 0
                };
                providerErrors.push({ provider: 'google', error: err.message });
            }
        }

        // 2. Fetch Meta (Facebook Pages and Instagram Professional)
        if (hasValidMeta) {
            // Facebook Feed
            const fbConfig = connections.meta.facebook || {};
            const isFbActive = fbConfig.connected !== false;

            if (isFbActive) {
                providersAttempted++;
                try {
                    let selectedPages = fbConfig.selectedPages || [];
                    const availablePages = fbConfig.availablePages || [];

                    if (!Array.isArray(selectedPages) || selectedPages.length === 0) {
                        selectedPages = availablePages.slice(0, 5).map(p => p.id);
                    }

                    if (selectedPages.length === 0) {
                        providerStatus.facebook = {
                            status: 'ok',
                            count: 0,
                            pagesAttempted: 0,
                            pagesSucceeded: 0,
                            note: 'No hay páginas de Facebook seleccionadas.'
                        };
                        providersSucceeded++;
                    } else {
                        let fbCommentsCount = 0;
                        let pagesAttempted = selectedPages.length;
                        let pagesSucceeded = 0;
                        let hasPending = false;
                        const byPage = {};
                        const pageTokens = fbConfig.pageTokens || {};

                        for (const pageId of selectedPages) {
                            let pageToken = metaAccessPlain;
                            if (pageTokens[pageId]) {
                                try {
                                    pageToken = decryptOAuthToken(pageTokens[pageId]);
                                } catch {
                                    pageToken = metaAccessPlain;
                                }
                            }

                            try {
                                const result = await fetchFacebookComments({
                                    pageId,
                                    pageAccessToken: pageToken,
                                    postLimit: 15,
                                    commentLimit: 50,
                                    maxPages: 3
                                });
                                rawCollected.push(...result.comments);
                                fbCommentsCount += result.comments.length;
                                pagesSucceeded++;
                                if (result.hasMore) hasPending = true;

                                byPage[pageId] = {
                                    status: 'ok',
                                    count: result.comments.length,
                                    hasMore: result.hasMore,
                                    nextCursor: result.nextCursor,
                                    postsProcessed: result.postsProcessed
                                };
                            } catch (pageErr) {
                                console.warn(`Error obteniendo comentarios de página FB ${pageId}:`, pageErr.message);
                                byPage[pageId] = {
                                    status: 'error',
                                    count: 0,
                                    error: pageErr.message
                                };
                                providerErrors.push({ provider: 'facebook', pageId, error: pageErr.message });
                            }
                        }

                        if (pagesAttempted > 0 && pagesSucceeded === 0) {
                            providerStatus.facebook = {
                                status: 'error',
                                error: 'Fallaron todas las consultas de páginas de Facebook.',
                                count: 0,
                                pagesAttempted,
                                pagesSucceeded: 0,
                                hasMore: false,
                                byPage
                            };
                        } else if (pagesSucceeded < pagesAttempted) {
                            providersSucceeded++;
                            providerStatus.facebook = {
                                status: 'partial',
                                count: fbCommentsCount,
                                pagesAttempted,
                                pagesSucceeded,
                                hasMore: hasPending,
                                byPage
                            };
                        } else {
                            providersSucceeded++;
                            providerStatus.facebook = {
                                status: 'ok',
                                count: fbCommentsCount,
                                pagesAttempted,
                                pagesSucceeded,
                                hasMore: hasPending,
                                byPage
                            };
                        }
                    }
                } catch (err) {
                    console.error('Error sincronizando Facebook:', err);
                    providerStatus.facebook = {
                        status: 'error',
                        error: err.message,
                        count: 0,
                        pagesAttempted: 0,
                        pagesSucceeded: 0
                    };
                    providerErrors.push({ provider: 'facebook', error: err.message });
                }
            }

            // Instagram Professional Comments
            const igConfig = connections.meta.instagram || {};
            const isIgActive = igConfig.connected === true;

            if (isIgActive) {
                providersAttempted++;
                try {
                    let selectedAccounts = igConfig.selectedAccounts || [];
                    const availableAccounts = igConfig.availableAccounts || [];

                    if (!Array.isArray(selectedAccounts) || selectedAccounts.length === 0) {
                        selectedAccounts = availableAccounts.slice(0, 5).map(a => a.id);
                    }

                    if (selectedAccounts.length === 0) {
                        providerStatus.instagram = {
                            status: 'ok',
                            count: 0,
                            accountsAttempted: 0,
                            accountsSucceeded: 0,
                            note: 'No hay cuentas de Instagram seleccionadas.'
                        };
                        providersSucceeded++;
                    } else {
                        let igCommentsCount = 0;
                        let accountsAttempted = selectedAccounts.length;
                        let accountsSucceeded = 0;
                        let hasPending = false;
                        const byAccount = {};

                        for (const igId of selectedAccounts) {
                            const targetAccount = availableAccounts.find(a => a.id === igId);
                            const linkedPageId = targetAccount?.linkedPageId;
                            let tokenToUse = metaAccessPlain;

                            if (linkedPageId && fbConfig.pageTokens?.[linkedPageId]) {
                                try {
                                    tokenToUse = decryptOAuthToken(fbConfig.pageTokens[linkedPageId]);
                                } catch {
                                    tokenToUse = metaAccessPlain;
                                }
                            }

                            try {
                                const result = await fetchInstagramComments({
                                    igUserId: igId,
                                    pageAccessToken: tokenToUse,
                                    mediaLimit: 15,
                                    commentLimit: 50,
                                    maxPages: 3
                                });
                                rawCollected.push(...result.comments);
                                igCommentsCount += result.comments.length;
                                accountsSucceeded++;
                                if (result.hasMore) hasPending = true;

                                byAccount[igId] = {
                                    status: 'ok',
                                    count: result.comments.length,
                                    hasMore: result.hasMore,
                                    nextCursor: result.nextCursor,
                                    mediaProcessed: result.mediaProcessed
                                };
                            } catch (igErr) {
                                console.warn(`Error obteniendo comentarios de Instagram ${igId}:`, igErr.message);
                                byAccount[igId] = {
                                    status: 'error',
                                    count: 0,
                                    error: igErr.message
                                };
                                providerErrors.push({ provider: 'instagram', igUserId: igId, error: igErr.message });
                            }
                        }

                        if (accountsAttempted > 0 && accountsSucceeded === 0) {
                            providerStatus.instagram = {
                                status: 'error',
                                error: 'Fallaron todas las consultas de cuentas de Instagram.',
                                count: 0,
                                accountsAttempted,
                                accountsSucceeded: 0,
                                hasMore: false,
                                byAccount
                            };
                        } else if (accountsSucceeded < accountsAttempted) {
                            providersSucceeded++;
                            providerStatus.instagram = {
                                status: 'partial',
                                count: igCommentsCount,
                                accountsAttempted,
                                accountsSucceeded,
                                hasMore: hasPending,
                                byAccount
                            };
                        } else {
                            providersSucceeded++;
                            providerStatus.instagram = {
                                status: 'ok',
                                count: igCommentsCount,
                                accountsAttempted,
                                accountsSucceeded,
                                hasMore: hasPending,
                                byAccount
                            };
                        }
                    }
                } catch (err) {
                    console.error('Error sincronizando Instagram:', err);
                    providerStatus.instagram = {
                        status: 'error',
                        error: err.message,
                        count: 0,
                        accountsAttempted: 0,
                        accountsSucceeded: 0
                    };
                    providerErrors.push({ provider: 'instagram', error: err.message });
                }
            } else if (igConfig.statusReason) {
                providerStatus.instagram = {
                    status: 'skipped',
                    count: 0,
                    reason: igConfig.statusReason
                };
            }
        }

        // Save updated tokens atomically
        await writeJsonAtomic(connFilePath, connections).catch(err => {
            console.warn('Advertencia guardando connections.json actualizado:', err.message);
        });

        const coverage = {
            providersAttempted,
            providersSucceeded,
            isPartial: providersAttempted > 0 && providersSucceeded < providersAttempted && providersSucceeded > 0,
            providerStatus
        };

        if (providersSucceeded === 0) {
            return NextResponse.json({
                success: false,
                error: 'No se pudo obtener datos reales de ninguno de los proveedores conectados.',
                providerErrors,
                coverage
            }, { status: 502 });
        }

        // Deduplicate and normalize
        const normalizedComments = normalizeAndDeduplicateComments(rawCollected);

        if (normalizedComments.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'Los proveedores respondieron correctamente, pero no se encontraron comentarios o reseñas en las cuentas seleccionadas.',
                coverage,
                providerErrors,
                report: null
            });
        }

        // Run AI Analysis & Mathematical Reconciliation
        let enrichedComments = normalizedComments;
        let metrics = calculateReputationMetrics(normalizedComments);
        let results = {
            status: metrics.reputationIndex >= 70 ? 'MANTENER' : (metrics.reputationIndex >= 45 ? 'MONITOREAR' : 'URGENTE'),
            summary: `Se analizaron ${metrics.totalComments} comentarios reales de clientes. Reputación global estimada en ${metrics.reputationIndex ?? 50}/100.`,
            recurringThemes: [],
            praises: [],
            complaints: [],
            actionableSuggestions: []
        };

        try {
            const aiOutput = await analyzeCommentsWithAI(normalizedComments);
            const merged = mergeAnalysisResults(normalizedComments, aiOutput);
            enrichedComments = merged.enrichedComments;
            metrics = merged.metrics;
            results = merged.results;
        } catch (aiErr) {
            console.warn('Advertencia en análisis cualitativo de Gemini (usando métricas deterministas calculadas):', aiErr.message);
            results.summary += ` (Nota: Análisis cualitativo IA no disponible temporalmente: ${aiErr.message})`;
        }

        const report = {
            id: `audit_${Date.now()}`,
            type: 'social_reviews',
            date: new Date().toISOString(),
            commentCount: enrichedComments.length,
            isSimulated: false,
            coverage,
            providerErrors,
            metrics,
            results,
            commentsList: enrichedComments
        };

        // Persist report to user history atomically
        const historyPath = join(userDir, 'reviews_analysis.json');
        let history = [];
        try {
            const histData = await readFile(historyPath, 'utf-8');
            history = JSON.parse(histData);
            if (!Array.isArray(history)) history = [];
        } catch {
            history = [];
        }

        history.unshift(report);
        if (history.length > 30) history = history.slice(0, 30);

        await writeJsonAtomic(historyPath, history);

        return NextResponse.json({
            success: true,
            report,
            coverage,
            providerErrors
        });
    } catch (error) {
        console.error('Error general en AI sync route:', error);
        return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
    } finally {
        if (releaseLock) {
            releaseLock();
        }
    }
}
