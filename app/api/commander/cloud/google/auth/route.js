import { NextResponse } from 'next/server';
import { getServerSession, authorizeTenantAccess } from '@/lib/auth';
import { buildCloudAuthUrl } from '@/lib/commander/cloudConnector';

export async function GET(request) {
    try {
        const session = await getServerSession(request);
        const { searchParams } = new URL(request.url);
        const requestedUserId = searchParams.get('userId');

        const auth = authorizeTenantAccess(session, requestedUserId);
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const authUrl = buildCloudAuthUrl(auth.tenantId, 'google_drive');
        return NextResponse.redirect(authUrl);
    } catch (error) {
        return NextResponse.json(
            { error: error.message, missingEnv: error.missingEnv || [] },
            { status: error.status || 500 }
        );
    }
}
