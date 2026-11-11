import { NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getServerSession, authorizeTenantAccess } from '@/lib/auth';
import { getUserDataDir } from '@/lib/dataPaths';
import { verifyOAuthState } from '@/lib/publicTokens';
import { encryptOAuthToken } from '@/lib/tokenCrypto';

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

        const longLivedUrl =
            `https://graph.facebook.com/v20.0/oauth/access_token?` +
            `grant_type=fb_exchange_token` +
            `&client_id=${encodeURIComponent(appId)}` +
            `&client_secret=${encodeURIComponent(appSecret)}` +
            `&fb_exchange_token=${encodeURIComponent(shortData.access_token)}`;

        const longRes = await fetch(longLivedUrl);
        const longData = await longRes.json();
        if (!longRes.ok || !longData.access_token) {
            throw new Error(longData.error?.message || 'Error al obtener token de larga duración de Meta');
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

        allConnections.meta = {
            ...allConnections.meta,
            connected: true,
            pageName: 'Página de Facebook Conectada',
            instagramUsername: '@cuenta_instagram_conectada',
            accessToken: encryptOAuthToken(longData.access_token),
            connectedAt: new Date().toISOString()
        };

        await writeFile(connFilePath, JSON.stringify(allConnections, null, 2), 'utf-8');
        return NextResponse.redirect(`${appUrl}/dashboard/commentor?sync=meta`);
    } catch (error) {
        console.error('Error in Meta OAuth callback:', error);
        return NextResponse.json({ error: error.message || 'Error en autenticación Meta' }, { status: 500 });
    }
}
