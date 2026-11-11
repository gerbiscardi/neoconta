import { NextResponse } from 'next/server';
import { getServerSession, authorizeTenantAccess } from '@/lib/auth';
import { signOAuthState } from '@/lib/publicTokens';

export async function GET(request) {
    try {
        const session = await getServerSession(request);
        const { searchParams } = new URL(request.url);
        const auth = authorizeTenantAccess(session, searchParams.get('userId'));
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const redirectUri = `${appUrl}/api/auth/google/callback`;

        if (!clientId || !clientId.trim() || !clientSecret || !clientSecret.trim()) {
            const wantsJson = (request.headers.get('accept') || '').includes('application/json');
            const message = 'Integración OAuth de Google Business todavía no disponible (credenciales no configuradas).';
            if (wantsJson) {
                return NextResponse.json({ success: false, code: 'OAUTH_NOT_CONFIGURED', error: message }, { status: 501 });
            }
            return NextResponse.redirect(`${appUrl}/dashboard/commentor?oauth_error=${encodeURIComponent(message)}`);
        }

        const signedState = signOAuthState(auth.tenantId, 'google');
        const googleAuthUrl =
            `https://accounts.google.com/o/oauth2/v2/auth?` +
            `response_type=code` +
            `&client_id=${encodeURIComponent(clientId)}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&scope=${encodeURIComponent('https://www.googleapis.com/auth/business.manage')}` +
            `&access_type=offline` +
            `&prompt=consent` +
            `&state=${encodeURIComponent(signedState)}`;

        return NextResponse.redirect(googleAuthUrl);
    } catch (error) {
        console.error('Error in Google OAuth redirect:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
