import { NextResponse } from 'next/server';
import { getServerSession, authorizeTenantAccess } from '@/lib/auth';
import { signOAuthState } from '@/lib/publicTokens';
import { META_GRAPH_VERSION } from '@/lib/commentor/metaConnector';

export async function GET(request) {
    try {
        const session = await getServerSession(request);
        const { searchParams } = new URL(request.url);
        const auth = authorizeTenantAccess(session, searchParams.get('userId'));
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const appId = process.env.META_APP_ID;
        const appSecret = process.env.META_APP_SECRET;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const redirectUri = `${appUrl}/api/auth/meta/callback`;

        if (!appId || !appId.trim() || !appSecret || !appSecret.trim()) {
            const wantsJson = (request.headers.get('accept') || '').includes('application/json');
            const message = 'Integración OAuth de Meta (IG / FB) todavía no disponible (credenciales no configuradas).';
            if (wantsJson) {
                return NextResponse.json({ success: false, code: 'OAUTH_NOT_CONFIGURED', error: message }, { status: 501 });
            }
            return NextResponse.redirect(`${appUrl}/dashboard/commentor?oauth_error=${encodeURIComponent(message)}`);
        }

        const signedState = signOAuthState(auth.tenantId, 'meta');
        const metaAuthUrl =
            `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?` +
            `client_id=${encodeURIComponent(appId)}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&scope=${encodeURIComponent('pages_show_list,pages_read_engagement,pages_read_user_content,instagram_basic,instagram_manage_comments')}` +
            `&state=${encodeURIComponent(signedState)}`;

        return NextResponse.redirect(metaAuthUrl);
    } catch (error) {
        console.error('Error in Meta OAuth redirect:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
