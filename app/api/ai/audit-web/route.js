import { NextResponse } from 'next/server';
import { readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getServerSession, authorizeTenantAccess } from '@/lib/auth';
import { getUserDataDir, writeJsonAtomic } from '@/lib/dataPaths';
import { aiOperationLimiter, rateLimitResponse } from '@/lib/rateLimit';
import {
    fetchWebSearchResults,
    classifyDomain,
    calculateWebReputationMetrics,
    runAIWebAudit
} from '@/lib/commentor/webAuditEngine';
import { acquireCommentorLock } from '@/lib/commentor/commentorLocker';

export async function POST(request) {
    let releaseLock = null;
    try {
        const session = await getServerSession(request);
        const body = await request.json().catch(() => ({}));
        const { userId, query } = body || {};

        const auth =  authorizeTenantAccess(session, userId);
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const limitCheck = aiOperationLimiter.check(`commentor-audit:${auth.tenantId}`);
        if (!limitCheck.allowed) {
            return rateLimitResponse(limitCheck, 'Has alcanzado el límite temporal de auditorías web en Commentor.');
        }

        const cleanQuery = typeof query === 'string' ? query.trim() : '';
        if (cleanQuery.length < 2 || cleanQuery.length > 200) {
            return NextResponse.json({ error: 'La consulta debe tener entre 2 y 200 caracteres.' }, { status: 400 });
        }

        releaseLock = await acquireCommentorLock(auth.tenantId);

        let searchOutcome;
        try {
            searchOutcome = await fetchWebSearchResults(cleanQuery);
        } catch (err) {
            return NextResponse.json({
                success: false,
                error: `La búsqueda en la web falló: ${err.message}`,
                providerErrors: [{ provider: 'web_search', error: err.message }]
            }, { status: 502 });
        }

        const searchResults = searchOutcome.items || [];
        if (searchResults.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'No se encontraron resultados reales de búsqueda web para esa consulta.'
            }, { status: 404 });
        }

        const activeRaw = searchResults.slice(0, 10);
        const poolRaw = searchResults.slice(10);

        // Classify domains and establish metadata
        const activeSources = activeRaw.map((item, idx) => {
            const domainInfo = classifyDomain(item.link);
            return {
                id: `src_${idx + 1}`,
                title: item.title,
                url: item.link,
                snippet: item.snippet,
                domain: domainInfo.domain,
                domainWeight: domainInfo.weight,
                category: domainInfo.category,
                sentiment: 'neutro', // Baseline until AI classifies
                captureDate: new Date().toISOString(),
                inclusionReason: `Resultado orgánico #${item.position || (idx + 1)} en ${searchOutcome.provider}`
            };
        });

        // Run Gemini PR Audit
        let aiAudit;
        try {
            aiAudit = await runAIWebAudit(cleanQuery, activeRaw);
        } catch (aiErr) {
            console.warn('Advertencia en auditoría cualitativa IA web:', aiErr.message);
            aiAudit = {
                summary: `Diagnóstico automático: Se relevaron ${activeSources.length} fuentes públicas para "${cleanQuery}".`,
                sourcesAnalysis: [],
                reconciliations: [
                    'Mantener el monitoreo continuo de fuentes indexadas para detectar fluctuaciones tempranas de reputación.',
                    'Optimizar perfiles corporativos en directorios institucionales para consolidar el control sobre los primeros resultados de búsqueda.'
                ]
            };
        }

        // Merge AI sentiment classifications with verified source list
        const aiMap = new Map();
        if (Array.isArray(aiAudit.sourcesAnalysis)) {
            for (const item of aiAudit.sourcesAnalysis) {
                if (item?.url) aiMap.set(item.url, item);
            }
        }

        const finalSources = activeSources.map(s => {
            const aiData = aiMap.get(s.url);
            if (aiData) {
                return {
                    ...s,
                    category: ['prensa', 'directorio', 'foro', 'perfil_profesional', 'institucional', 'otro'].includes(aiData.category)
                        ? aiData.category
                        : s.category,
                    sentiment: ['positivo', 'neutro', 'negativo'].includes(aiData.sentiment)
                        ? aiData.sentiment
                        : s.sentiment,
                    aiJustification: aiData.justification || ''
                };
            }
            return s;
        });

        const metrics = calculateWebReputationMetrics(finalSources);

        const report = {
            id: `audit_web_${Date.now()}`,
            type: 'web_audit',
            query: cleanQuery,
            date: new Date().toISOString(),
            isSimulated: false,
            revision: 0,
            revisionHistory: [],
            coverage: {
                provider: searchOutcome.provider,
                fetchedResults: searchResults.length,
                analyzedResults: finalSources.length,
                pooledResults: poolRaw.length
            },
            metrics,
            results: {
                brandScore: metrics.calculatedScore,
                publicSentiment: {
                    positive: metrics.sentimentPercentages.positivo,
                    neutral: metrics.sentimentPercentages.neutro,
                    negative: metrics.sentimentPercentages.negativo
                },
                summary: aiAudit.summary,
                sources: finalSources,
                reconciliations: Array.isArray(aiAudit.reconciliations) ? aiAudit.reconciliations : []
            },
            poolSources: poolRaw.map((item, idx) => {
                const domainInfo = classifyDomain(item.link);
                return {
                    id: `pool_${idx + 1}`,
                    title: item.title,
                    url: item.link,
                    snippet: item.snippet,
                    domain: domainInfo.domain,
                    domainWeight: domainInfo.weight,
                    category: domainInfo.category,
                    sentiment: 'neutro',
                    captureDate: new Date().toISOString()
                };
            }),
            excludedSources: []
        };

        const userDir = getUserDataDir(auth.tenantId);
        await mkdir(userDir, { recursive: true });
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

        return NextResponse.json({ success: true, report });
    } catch (error) {
        console.error('Error general en AI web audit route:', error);
        return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
    } finally {
        if (releaseLock) {
            releaseLock();
        }
    }
}
