import { NextResponse } from 'next/server';
import { readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getServerSession, authorizeTenantAccess } from '@/lib/auth';
import { getUserDataDir, writeJsonAtomic } from '@/lib/dataPaths';
import { verifyOAuthState } from '@/lib/publicTokens';
import { encryptOAuthToken } from '@/lib/tokenCrypto';
import { exchangeMetaToken, listMetaPagesAndInstagram } from '@/lib/commentor/metaConnector';

export async function GET(request) {
    try {
        const session = await getServerSession(request);
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        const verifiedState = verifyOAuthState(state, 'meta');
        if (!verifiedState) {
            return NextResponse.json({ error: 'Parámetro state OAuth inválido o expirado' }, { status: 403 });
        }

        const auth = authorizeTenantAccess(session, verifiedState.tenantId);
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        if (!code || code === 'mock_code' || String(code).startsWith('mock_')) {
            return NextResponse.json({ error: 'Código de autorización OAuth no válido' }, { status: 400 });
        }

        const appId = process.env.META_APP_ID;
        const appSecret = process.env.META_APP_SECRET;
        if (!appId || !appSecret) {
            return NextResponse.json({ error: 'Credenciales OAuth de Meta no configuradas en el servidor' }, { status: 501 });
        }

        const redirectUri = `${appUrl}/api/auth/meta/callback`;
        const tokenUrl =
            `https://graph.facebook.com/v20.0/oauth/access_token?` +
            `client_id=${encodeURIComponent(appId)}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&client_secret=${encodeURIComponent(appSecret)}` +
            `&code=${encodeURIComponent(code)}`;

        const shortRes = await fetch(tokenUrl);
        const shortData = await shortRes.json();
        if (!shortRes.ok || !shortData.access_token) {
            throw new Error(shortData.error?.message || 'Error al obtener token de corta duración de Meta');
        }

        // Exchange for long-lived access token
        const { accessToken: longLivedToken, expiresIn } = await exchangeMetaToken(shortData.access_token);

        // Discover real Facebook Pages and linked Instagram accounts
        let discoveryResult = {
            pages: [],
            instagramAccounts: [],
            instagramAvailable: false,
            instagramReason: 'No se ejecutó descubrimiento'
        };
        let discoveryError = null;

        try {
            discoveryResult = await listMetaPagesAndInstagram(longLivedToken);
        } catch (discErr) {
            console.warn('Advertencia en descubrimiento de páginas Meta:', discErr.message);
            discoveryError = discErr.message;
        }

        const userDir = getUserDataDir(auth.tenantId);
        await mkdir(userDir, { recursive: true });
        const connFilePath = join(userDir, 'connections.json');

        let allConnections = {};
        try {
            const fileData = await readFile(connFilePath, 'utf-8');
            allConnections = JSON.parse(fileData);
        } catch {
            // File does not exist yet
        }

        const selectedPages = discoveryResult.pages.map(p => ({
            id: p.id,
            name: p.name,
            accessToken: p.accessToken ? encryptOAuthToken(p.accessToken) : ''
        }));

        const selectedInstagram = discoveryResult.instagramAccounts.map(ig => ({
            id: ig.id,
            username: ig.username,
            name: ig.name,
            linkedPageId: ig.linkedPageId
        }));

        const firstPageName = discoveryResult.pages[0]?.name || 'Página de Facebook Conectada';
        const firstIgUsername = discoveryResult.instagramAccounts[0]?.username
            ? `@${discoveryResult.instagramAccounts[0].username}`
            : null;

        allConnections.meta = {
            ...allConnections.meta,
            connected: true,
            providerConfigured: true,
            accessToken: encryptOAuthToken(longLivedToken),
            tokenExpiresAt: Date.now() + (expiresIn * 1000),
            connectedAt: new Date().toISOString(),
            discoveryError,
            // Facebook specific configuration
            facebook: {
                connected: discoveryResult.pages.length > 0,
                pageName: firstPageName,
                availablePages: discoveryResult.pages.map(p => ({ id: p.id, name: p.name, category: p.category })),
                selectedPages: selectedPages.map(p => p.id),
                pageTokens: selectedPages.reduce((acc, p) => {
                    if (p.accessToken) acc[p.id] = p.accessToken;
                    return acc;
                }, {})
            },
            // Instagram specific configuration - STRICT: only connected if authentic linked IG accounts exist
            instagram: {
                connected: discoveryResult.instagramAvailable,
                instagramUsername: firstIgUsername,
                availableAccounts: discoveryResult.instagramAccounts,
                selectedAccounts: selectedInstagram.map(ig => ig.id),
                statusReason: discoveryResult.instagramReason
            },
            // Backwards-compatible fields for legacy UI
            pageName: firstPageName,
            instagramUsername: firstIgUsername || 'No vinculada'
        };

        await writeJsonAtomic(connFilePath, allConnections);
        return NextResponse.redirect(`${appUrl}/dashboard/commentor?sync=meta`);
    } catch (error) {
        console.error('Error in Meta OAuth callback:', error);
        return NextResponse.json({ error: error.message || 'Error en autenticación Meta' }, { status: 500 });
    }
}
