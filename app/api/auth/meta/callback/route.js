import { NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');
        const userId = searchParams.get('state'); // State contains the userId passed

        if (!userId) {
            return NextResponse.json({ error: "Falta el ID del usuario en el state" }, { status: 400 });
        }

        if (!code) {
            return NextResponse.json({ error: "Falta el código de autorización" }, { status: 400 });
        }

        let connectionData = {
            connected: true,
            pageName: "Mi Negocio FB (Mock)",
            instagramUsername: "@minegocio_ok (Mock)",
            accessToken: "mock_meta_long_lived_token",
            connectedAt: new Date().toISOString()
        };

        const appId = process.env.META_APP_ID;
        const appSecret = process.env.META_APP_SECRET;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const redirectUri = `${appUrl}/api/auth/meta/callback`;

        // If it's not a mock flow and we have credentials, perform the real exchange
        if (code !== 'mock_code' && appId && appSecret) {
            try {
                // 1. Exchange code for short-lived access token
                const tokenUrl = `https://graph.facebook.com/v20.0/oauth/access_token?` +
                    `client_id=${appId}` +
                    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
                    `&client_secret=${appSecret}` +
                    `&code=${code}`;

                const shortRes = await fetch(tokenUrl);
                const shortData = await shortRes.json();

                if (!shortRes.ok) {
                    throw new Error(shortData.error?.message || "Error al obtener token de corta duración");
                }

                const shortToken = shortData.access_token;

                // 2. Exchange short-lived token for long-lived user token (60 days)
                const longLivedUrl = `https://graph.facebook.com/v20.0/oauth/access_token?` +
                    `grant_type=fb_exchange_token` +
                    `&client_id=${appId}` +
                    `&client_secret=${appSecret}` +
                    `&fb_exchange_token=${shortToken}`;

                const longRes = await fetch(longLivedUrl);
                const longData = await longRes.json();

                if (!longRes.ok) {
                    throw new Error(longData.error?.message || "Error al obtener token de larga duración");
                }

                const longLivedToken = longData.access_token;

                // In a real application, we would call the Facebook Pages API to get page details and page token
                // e.g. GET https://graph.facebook.com/v20.0/me/accounts?access_token=longLivedToken
                // For simplicity, we store the longLivedToken which allows querying basic details and comments.
                connectionData = {
                    connected: true,
                    pageName: "Página de Facebook Conectada",
                    instagramUsername: "@cuenta_instagram_conectada",
                    accessToken: longLivedToken,
                    connectedAt: new Date().toISOString()
                };

            } catch (exchangeError) {
                console.error("Meta token exchange error:", exchangeError);
                return NextResponse.json({ error: exchangeError.message }, { status: 500 });
            }
        }

        // Save connection info to data/users/[userId]/connections.json
        const userDir = join(process.cwd(), 'data', 'users', userId);
        await mkdir(userDir, { recursive: true });
        const connFilePath = join(userDir, 'connections.json');

        let allConnections = {};
        try {
            const fileData = await readFile(connFilePath, 'utf-8');
            allConnections = JSON.parse(fileData);
        } catch (e) {
            // File does not exist yet, ignore
        }

        // Merge meta connection
        allConnections.meta = {
            ...allConnections.meta,
            ...connectionData
        };

        await writeFile(connFilePath, JSON.stringify(allConnections, null, 2), 'utf-8');

        // Redirect back to komentor dashboard
        return NextResponse.redirect(`${appUrl}/dashboard/commentor?sync=meta`);

    } catch (error) {
        console.error("Error in Meta OAuth callback:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
