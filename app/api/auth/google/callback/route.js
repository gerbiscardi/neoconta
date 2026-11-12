import { NextResponse } from 'next/server';
import { readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getServerSession, authorizeTenantAccess } from '@/lib/auth';
import { getUserDataDir, writeJsonAtomic } from '@/lib/dataPaths';
import { verifyOAuthState } from '@/lib/publicTokens';
import { encryptOAuthToken, decryptOAuthToken } from '@/lib/tokenCrypto';
import { listGoogleAccounts, listGoogleLocations } from '@/lib/commentor/googleConnector';

export async function GET(request) {
    try {
        const session = await getServerSession(request);
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        const verifiedState = verifyOAuthState(state, 'google');
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

        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
            return NextResponse.json({ error: 'Credenciales OAuth de Google no configuradas en el servidor' }, { status: 501 });
        }

        const redirectUri = `${appUrl}/api/auth/google/callback`;
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code'
            })
        });

        const data = await response.json();
        if (!response.ok || !data.access_token) {
            throw new Error(data.error_description || data.error || 'Error al obtener tokens de Google');
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

        const existingRefreshPlain = allConnections.google?.refreshToken
            ? decryptOAuthToken(allConnections.google.refreshToken)
            : '';
        const finalRefreshToken = data.refresh_token || existingRefreshPlain || '';

        // Query real accounts and locations for initial selection
        let discoveredAccount = null;
        let availableLocations = [];
        let discoveryError = null;

        try {
            const accounts = await listGoogleAccounts(data.access_token);
            if (accounts.length > 0) {
                discoveredAccount = accounts[0];
                availableLocations = await listGoogleLocations(data.access_token, discoveredAccount.id);
            }
        } catch (discErr) {
            console.warn('Advertencia en descubrimiento inicial de Google Business:', discErr.message);
            discoveryError = discErr.message;
        }

        const selectedLocationIds = availableLocations.length > 0
            ? availableLocations.map(l => l.id)
            : [];

        allConnections.google = {
            ...allConnections.google,
            connected: true,
            providerConfigured: true,
            account: discoveredAccount,
            locationName: discoveredAccount ? (discoveredAccount.name || 'Perfil de Google Business') : 'Perfil de Google Business',
            availableLocations,
            selectedLocations: selectedLocationIds,
            discoveryError,
            refreshToken: encryptOAuthToken(finalRefreshToken),
            accessToken: encryptOAuthToken(data.access_token),
            tokenExpiresAt: Date.now() + ((data.expires_in || 3600) * 1000),
            connectedAt: new Date().toISOString()
        };

        await writeJsonAtomic(connFilePath, allConnections);
        return NextResponse.redirect(`${appUrl}/dashboard/commentor?sync=google`);
    } catch (error) {
        console.error('Error in Google OAuth callback:', error);
        return NextResponse.json({ error: error.message || 'Error en autenticación Google' }, { status: 500 });
    }
}
