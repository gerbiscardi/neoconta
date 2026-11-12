import { getServerSession, authorizeTenantAccess } from '@/lib/auth';
import { loadCommanderTenantData } from '@/lib/commander/dataLoader';
import { computeCommanderAnalytics } from '@/lib/commander/engine';

export async function GET(request) {
    try {
        const session = await getServerSession(request);
        const { searchParams } = new URL(request.url);
        const requestedUserId = searchParams.get('userId');
        const clientFilter = searchParams.get('client') || '';
        const dateFrom = searchParams.get('dateFrom') || '';
        const dateTo = searchParams.get('dateTo') || '';
        const sourceFilter = searchParams.get('source') || 'all';

        const auth = authorizeTenantAccess(session, requestedUserId);
        if (!auth.authorized) {
            return new Response(JSON.stringify({ error: auth.error }), { status: auth.status });
        }
        const userId = auth.tenantId;

        const { invoices, transactions, sources } = await loadCommanderTenantData(userId);
        const analytics = computeCommanderAnalytics({
            invoices,
            transactions,
            filters: { client: clientFilter, dateFrom, dateTo, sourceFilter }
        });

        const { _normalized, ...publicAnalytics } = analytics;
        return new Response(JSON.stringify({
            ...publicAnalytics,
            sources
        }), { status: 200 });
    } catch (error) {
        console.error('Error in /api/commander/stats GET:', error);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
    }
}
