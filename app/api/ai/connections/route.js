import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { getServerSession, authorizeTenantAccess } from '@/lib/auth';
import { getUserDataDir, writeJsonAtomic } from '@/lib/dataPaths';
import { decryptOAuthToken, encryptOAuthToken, isEncryptedOAuthToken } from '@/lib/tokenCrypto';
import { revokeGoogleToken, listGoogleAccounts, listGoogleLocations, refreshGoogleAccessToken } from '@/lib/commentor/googleConnector';
import { listMetaPagesAndInstagram } from '@/lib/commentor/metaConnector';

export async function GET(request) {
    try {
        const session = await getServerSession(request);
        const { searchParams } = new URL(request.url);
        const auth = authorizeTenantAccess(session, searchParams.get('userId'));
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const userDir = getUserDataDir(auth.tenantId);
        const connFilePath = join(userDir, 'connections.json');

        let connections = {
            google: { connected: false },
            meta: { connected: false }
        };

        try {
            const data = await readFile(connFilePath, 'utf-8');
            connections = JSON.parse(data);
        } catch {
            // File does not exist, return default empty connections
        }

        const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
        const metaConfigured = Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);

        const sanitized = {};
        let upgradedAtRest = false;

        // Process Google Business Profile
        const googleDetails = connections.google || {};
        let plainGoogleRefresh = '';
        if (googleDetails.refreshToken) {
            try {
                plainGoogleRefresh = decryptOAuthToken(googleDetails.refreshToken);
                if (!isEncryptedOAuthToken(googleDetails.refreshToken) && !plainGoogleRefresh.startsWith('mock_')) {
                    connections.google.refreshToken = encryptOAuthToken(plainGoogleRefresh);
                    if (googleDetails.accessToken && !isEncryptedOAuthToken(googleDetails.accessToken)) {
                        connections.google.accessToken = encryptOAuthToken(decryptOAuthToken(googleDetails.accessToken));
                    }
                    upgradedAtRest = true;
                }
            } catch {
                plainGoogleRefresh = '';
            }
        }

        const isGoogleActive = Boolean(
            googleDetails.connected === true &&
            plainGoogleRefresh &&
            !plainGoogleRefresh.startsWith('mock_') &&
            googleConfigured
        );

        if (isGoogleActive) {
            const { accessToken, refreshToken, ...rest } = googleDetails;
            const isExpired = rest.tokenExpiresAt ? Date.now() > rest.tokenExpiresAt : false;
            sanitized.google = {
                ...rest,
                connected: true,
                providerConfigured: true,
                isTokenExpired: isExpired,
                account: rest.account || null,
                availableLocations: Array.isArray(rest.availableLocations) ? rest.availableLocations : [],
                selectedLocations: Array.isArray(rest.selectedLocations) ? rest.selectedLocations : []
            };
        } else {
            sanitized.google = {
                connected: false,
                providerConfigured: googleConfigured,
                wasMockDisabled: Boolean(plainGoogleRefresh && plainGoogleRefresh.startsWith('mock_')),
                availableLocations: [],
                selectedLocations: []
            };
        }

        // Process Meta (Facebook + Instagram)
        const metaDetails = connections.meta || {};
        let plainMetaAccess = '';
        if (metaDetails.accessToken) {
            try {
                plainMetaAccess = decryptOAuthToken(metaDetails.accessToken);
                if (!isEncryptedOAuthToken(metaDetails.accessToken) && !plainMetaAccess.startsWith('mock_')) {
                    connections.meta.accessToken = encryptOAuthToken(plainMetaAccess);
                    upgradedAtRest = true;
                }
            } catch {
                plainMetaAccess = '';
            }
        }

        const isMetaActive = Boolean(
            metaDetails.connected === true &&
            plainMetaAccess &&
            !plainMetaAccess.startsWith('mock_') &&
            metaConfigured
        );

        if (isMetaActive) {
            const { accessToken, ...rest } = metaDetails;
            const isExpired = rest.tokenExpiresAt ? Date.now() > rest.tokenExpiresAt : false;

            const fbConfig = rest.facebook || {
                connected: true,
                pageName: rest.pageName || 'Página de Facebook',
                availablePages: [],
                selectedPages: []
            };

            const igConfig = rest.instagram || {
                connected: Boolean(rest.instagramUsername && rest.instagramUsername !== 'No vinculada'),
                instagramUsername: rest.instagramUsername || null,
                availableAccounts: [],
                selectedAccounts: [],
                statusReason: null
            };

            // Remove any encrypted page tokens from user-facing payload
            const sanitizedFb = {
                ...fbConfig,
                pageTokens: undefined
            };

            sanitized.meta = {
                connected: true,
                providerConfigured: true,
                isTokenExpired: isExpired,
                connectedAt: rest.connectedAt,
                pageName: rest.pageName,
                instagramUsername: rest.instagramUsername,
                facebook: sanitizedFb,
                instagram: igConfig
            };
        } else {
            sanitized.meta = {
                connected: false,
                providerConfigured: metaConfigured,
                wasMockDisabled: Boolean(plainMetaAccess && plainMetaAccess.startsWith('mock_')),
                facebook: { connected: false, availablePages: [], selectedPages: [] },
                instagram: { connected: false, availableAccounts: [], selectedAccounts: [], statusReason: null }
            };
        }

        if (upgradedAtRest) {
            await writeJsonAtomic(connFilePath, connections).catch(() => {});
        }

        return NextResponse.json({ success: true, connections: sanitized });
    } catch (error) {
        console.error('Error in GET connections:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const session = await getServerSession(request);
        const body = await request.json();
        const { userId, provider, action, locationIds, pageIds, accountIds } = body || {};

        const auth = authorizeTenantAccess(session, userId);
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const userDir = getUserDataDir(auth.tenantId);
        const connFilePath = join(userDir, 'connections.json');

        let connections = {};
        try {
            const data = await readFile(connFilePath, 'utf-8');
            connections = JSON.parse(data);
        } catch {
            connections = {};
        }

        // Action 1: Disconnect
        if (action === 'disconnect') {
            if (!provider || (provider !== 'google' && provider !== 'meta' && provider !== 'facebook' && provider !== 'instagram')) {
                return NextResponse.json({ error: "Proveedor no válido para desconectar ('google', 'meta', 'facebook', 'instagram')" }, { status: 400 });
            }

            if (provider === 'google') {
                if (connections.google?.refreshToken) {
                    try {
                        const plain = decryptOAuthToken(connections.google.refreshToken);
                        await revokeGoogleToken(plain);
                    } catch {
                        // Best effort revocation
                    }
                }
                connections.google = { connected: false };
                await writeJsonAtomic(connFilePath, connections);
                return NextResponse.json({ success: true, message: 'Cuenta de Google Business desconectada con éxito.' });
            }

            if (provider === 'meta') {
                connections.meta = { connected: false };
                await writeJsonAtomic(connFilePath, connections);
                return NextResponse.json({ success: true, message: 'Cuentas de Meta (Facebook e Instagram) desconectadas con éxito.' });
            }

            if (provider === 'facebook') {
                if (connections.meta?.facebook) {
                    connections.meta.facebook.connected = false;
                    connections.meta.facebook.selectedPages = [];
                }
                await writeJsonAtomic(connFilePath, connections);
                return NextResponse.json({ success: true, message: 'Monitoreo de Facebook pausado.' });
            }

            if (provider === 'instagram') {
                if (connections.meta?.instagram) {
                    connections.meta.instagram.connected = false;
                    connections.meta.instagram.selectedAccounts = [];
                }
                await writeJsonAtomic(connFilePath, connections);
                return NextResponse.json({ success: true, message: 'Monitoreo de Instagram pausado.' });
            }
        }

        // Action 2: Select Locations (Google Business Profile)
        if (action === 'select_locations') {
            if (!Array.isArray(locationIds)) {
                return NextResponse.json({ error: 'locationIds debe ser un array de identificadores de ubicación' }, { status: 400 });
            }
            if (!connections.google || !connections.google.connected) {
                return NextResponse.json({ error: 'Google Business Profile no está conectado' }, { status: 400 });
            }

            const available = connections.google.availableLocations || [];
            const validIds = new Set(available.map(l => l.id));
            const filtered = locationIds.filter(id => validIds.has(id));

            connections.google.selectedLocations = filtered;
            await writeJsonAtomic(connFilePath, connections);

            return NextResponse.json({
                success: true,
                message: `Se actualizaron las sucursales monitoreadas (${filtered.length} seleccionadas).`,
                selectedLocations: filtered
            });
        }

        // Action 3: Select Pages (Facebook)
        if (action === 'select_pages') {
            if (!Array.isArray(pageIds)) {
                return NextResponse.json({ error: 'pageIds debe ser un array de identificadores de página' }, { status: 400 });
            }
            if (!connections.meta || !connections.meta.connected) {
                return NextResponse.json({ error: 'Meta no está conectado' }, { status: 400 });
            }

            const available = connections.meta.facebook?.availablePages || [];
            const validIds = new Set(available.map(p => p.id));
            const filtered = pageIds.filter(id => validIds.has(id));

            if (!connections.meta.facebook) connections.meta.facebook = { connected: true };
            connections.meta.facebook.selectedPages = filtered;
            await writeJsonAtomic(connFilePath, connections);

            return NextResponse.json({
                success: true,
                message: `Se actualizaron las páginas de Facebook monitoreadas (${filtered.length} seleccionadas).`,
                selectedPages: filtered
            });
        }

        // Action 4: Select Instagram Accounts
        if (action === 'select_instagram') {
            if (!Array.isArray(accountIds)) {
                return NextResponse.json({ error: 'accountIds debe ser un array de identificadores de Instagram' }, { status: 400 });
            }
            if (!connections.meta || !connections.meta.connected) {
                return NextResponse.json({ error: 'Meta no está conectado' }, { status: 400 });
            }

            const available = connections.meta.instagram?.availableAccounts || [];
            const validIds = new Set(available.map(a => a.id));
            const filtered = accountIds.filter(id => validIds.has(id));

            if (!connections.meta.instagram) connections.meta.instagram = { connected: true };
            connections.meta.instagram.selectedAccounts = filtered;
            await writeJsonAtomic(connFilePath, connections);

            return NextResponse.json({
                success: true,
                message: `Se actualizaron las cuentas de Instagram monitoreadas (${filtered.length} seleccionadas).`,
                selectedAccounts: filtered
            });
        }

        // Action 5: Refresh Resources (re-run discovery with active token)
        if (action === 'refresh_resources') {
            if (provider === 'google') {
                if (!connections.google?.refreshToken) {
                    return NextResponse.json({ error: 'Google no está conectado' }, { status: 400 });
                }
                const plainRefresh = decryptOAuthToken(connections.google.refreshToken);
                const { accessToken, expiresIn } = await refreshGoogleAccessToken(plainRefresh);
                connections.google.accessToken = encryptOAuthToken(accessToken);
                connections.google.tokenExpiresAt = Date.now() + (expiresIn * 1000);

                const accounts = await listGoogleAccounts(accessToken);
                let locations = [];
                if (accounts.length > 0) {
                    connections.google.account = accounts[0];
                    locations = await listGoogleLocations(accessToken, accounts[0].id);
                }
                connections.google.availableLocations = locations;
                await writeJsonAtomic(connFilePath, connections);

                return NextResponse.json({
                    success: true,
                    message: 'Recursos de Google Business actualizados con éxito.',
                    account: connections.google.account,
                    availableLocations: locations
                });
            }

            if (provider === 'meta') {
                if (!connections.meta?.accessToken) {
                    return NextResponse.json({ error: 'Meta no está conectado' }, { status: 400 });
                }
                const plainAccess = decryptOAuthToken(connections.meta.accessToken);
                const discovery = await listMetaPagesAndInstagram(plainAccess);

                connections.meta.facebook = {
                    ...(connections.meta.facebook || {}),
                    connected: discovery.pages.length > 0,
                    availablePages: discovery.pages.map(p => ({ id: p.id, name: p.name, category: p.category })),
                    pageTokens: discovery.pages.reduce((acc, p) => {
                        if (p.accessToken) acc[p.id] = encryptOAuthToken(p.accessToken);
                        return acc;
                    }, {})
                };

                connections.meta.instagram = {
                    ...(connections.meta.instagram || {}),
                    connected: discovery.instagramAvailable,
                    availableAccounts: discovery.instagramAccounts,
                    statusReason: discovery.instagramReason
                };

                await writeJsonAtomic(connFilePath, connections);

                return NextResponse.json({
                    success: true,
                    message: 'Páginas y cuentas de Meta actualizadas con éxito.',
                    facebook: connections.meta.facebook,
                    instagram: connections.meta.instagram
                });
            }

            return NextResponse.json({ error: 'Proveedor no especificado para actualizar recursos' }, { status: 400 });
        }

        return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
    } catch (error) {
        console.error('Error in POST connections:', error);
        return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
    }
}
