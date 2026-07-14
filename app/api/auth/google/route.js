import { NextResponse } from 'next/server';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: "Falta el ID del usuario (userId)" }, { status: 400 });
        }

        const clientId = process.env.GOOGLE_CLIENT_ID;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const redirectUri = `${appUrl}/api/auth/google/callback`;

        // If credentials are not configured, use mock flow for local testing
        if (!clientId || clientId.trim() === "") {
            console.log("GOOGLE_CLIENT_ID not set. Redirecting to mock Google OAuth callback.");
            return NextResponse.redirect(`${redirectUri}?code=mock_code&state=${userId}`);
        }

        const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `response_type=code` +
            `&client_id=${encodeURIComponent(clientId)}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&scope=${encodeURIComponent("https://www.googleapis.com/auth/business.manage")}` +
            `&access_type=offline` +
            `&prompt=consent` +
            `&state=${encodeURIComponent(userId)}`;

        return NextResponse.redirect(googleAuthUrl);

    } catch (error) {
        console.error("Error in Google OAuth redirect:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
