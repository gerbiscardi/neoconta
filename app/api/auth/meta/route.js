import { NextResponse } from 'next/server';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: "Falta el ID del usuario (userId)" }, { status: 400 });
        }

        const appId = process.env.META_APP_ID;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const redirectUri = `${appUrl}/api/auth/meta/callback`;

        // If credentials are not configured, use mock flow for local testing
        if (!appId || appId.trim() === "") {
            console.log("META_APP_ID not set. Redirecting to mock Meta OAuth callback.");
            return NextResponse.redirect(`${redirectUri}?code=mock_code&state=${userId}`);
        }

        const metaAuthUrl = `https://www.facebook.com/v20.0/dialog/oauth?` +
            `client_id=${encodeURIComponent(appId)}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&scope=${encodeURIComponent("pages_show_list,pages_read_engagement,instagram_basic,instagram_manage_comments")}` +
            `&state=${encodeURIComponent(userId)}`;

        return NextResponse.redirect(metaAuthUrl);

    } catch (error) {
        console.error("Error in Meta OAuth redirect:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
