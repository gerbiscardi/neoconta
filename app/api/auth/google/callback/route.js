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
            locationName: "Mi Negocio Local (Mock)",
            refreshToken: "mock_google_refresh_token",
            accessToken: "mock_google_access_token",
            connectedAt: new Date().toISOString()
        };

        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const redirectUri = `${appUrl}/api/auth/google/callback`;

        // If it's not a mock flow and we have credentials, perform the real exchange
        if (code !== 'mock_code' && clientId && clientSecret) {
            try {
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

                if (!response.ok) {
                    throw new Error(data.error_description || data.error || "Error al obtener tokens de Google");
                }

                // In a real application, we would call the Google Business Profile API to fetch the Location details.
                // For now, we set a default name or use the user's name.
                connectionData = {
                    connected: true,
                    locationName: "Perfil de Google Business",
                    refreshToken: data.refresh_token || "", // Refresh token is only sent on first consent
                    accessToken: data.access_token,
                    connectedAt: new Date().toISOString()
                };

            } catch (exchangeError) {
                console.error("Google token exchange error:", exchangeError);
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

        // Merge google connection
        allConnections.google = {
            ...allConnections.google,
            ...connectionData
        };

        await writeFile(connFilePath, JSON.stringify(allConnections, null, 2), 'utf-8');

        // Redirect back to the komentor dashboard page
        return NextResponse.redirect(`${appUrl}/dashboard/commentor?sync=google`);

    } catch (error) {
        console.error("Error in Google OAuth callback:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
