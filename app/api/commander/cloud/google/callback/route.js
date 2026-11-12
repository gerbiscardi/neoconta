import { NextResponse } from 'next/server';
import { exchangeCloudOAuthCode } from '@/lib/commander/cloudConnector';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

    if (error || !code || !state) {
        return NextResponse.redirect(
            `${appUrl}/dashboard/commander?cloud=google_drive&status=error&reason=${encodeURIComponent(error || 'missing_code')}`
        );
    }

    try {
        await exchangeCloudOAuthCode({ provider: 'google_drive', code, state });
        return NextResponse.redirect(`${appUrl}/dashboard/commander?cloud=google_drive&status=connected`);
    } catch (err) {
        return NextResponse.redirect(
            `${appUrl}/dashboard/commander?cloud=google_drive&status=error&reason=${encodeURIComponent(err.message || 'oauth_failed')}`
        );
    }
}
