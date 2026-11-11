import { NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { getServerSession, authorizeTenantAccess } from '@/lib/auth';
import { decryptOAuthToken, encryptOAuthToken, isEncryptedOAuthToken } from '@/lib/tokenCrypto';

export async function GET(request) {
    try {
        const session = await getServerSession(request);
        const { searchParams } = new URL(request.url);
        const auth = authorizeTenantAccess(session, searchParams.get('userId'));
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const userDir = join(process.cwd(), 'data', 'users', auth.tenantId);
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

        const googleDetails = connections.google;
        let plainGoogleRefresh = '';
        if (googleDetails?.refreshToken) {
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

        if (
            googleDetails?.connected === true &&
            plainGoogleRefresh &&
            !plainGoogleRefresh.startsWith('mock_') &&
            googleConfigured
        ) {
            const { accessToken, refreshToken, ...rest } = googleDetails;
            sanitized.google = { ...rest, connected: true, providerConfigured: true };
        } else {
            sanitized.google = {
                connected: false,
                providerConfigured: googleConfigured,
                wasMockDisabled: Boolean(plainGoogleRefresh && plainGoogleRefresh.startsWith('mock_'))
            };
        }

        const metaDetails = connections.meta;
        let plainMetaAccess = '';
        if (metaDetails?.accessToken) {
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

        if (
            metaDetails?.connected === true &&
            plainMetaAccess &&
            !plainMetaAccess.startsWith('mock_') &&
            metaConfigured
        ) {
            const { accessToken, refreshToken, ...rest } = metaDetails;
            sanitized.meta = { ...rest, connected: true, providerConfigured: true };
        } else {
            sanitized.meta = {
                connected: false,
                providerConfigured: metaConfigured,
                wasMockDisabled: Boolean(plainMetaAccess && plainMetaAccess.startsWith('mock_'))
            };
        }

        if (upgradedAtRest) {
            await writeFile(connFilePath, JSON.stringify(connections, null, 2), 'utf-8').catch(() => {});
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
        const { userId, provider, action } = body || {};

        const auth = authorizeTenantAccess(session, userId);
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        if (!provider || action !== 'disconnect') {
            return NextResponse.json({ error: "Faltan datos requeridos (provider, action='disconnect')" }, { status: 400 });
        }

        if (provider !== 'google' && provider !== 'meta') {
            return NextResponse.json({ error: 'Proveedor no válido' }, { status: 400 });
        }

        const userDir = join(process.cwd(), 'data', 'users', auth.tenantId);
        const connFilePath = join(userDir, 'connections.json');

        let connections = {};
        try {
            const data = await readFile(connFilePath, 'utf-8');
            connections = JSON.parse(data);
        } catch {
            return NextResponse.json({ success: true, message: 'No había conexiones configuradas.' });
        }

        if (connections[provider]) {
            connections[provider] = { connected: false };
            await writeFile(connFilePath, JSON.stringify(connections, null, 2), 'utf-8');
        }

        return NextResponse.json({
            success: true,
            message: `Cuenta de ${provider === 'google' ? 'Google' : 'Meta'} desconectada con éxito.`
        });
    } catch (error) {
        console.error('Error in POST connections disconnect:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
