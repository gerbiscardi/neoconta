import { getServerSession, authorizeTenantAccess } from '@/lib/auth';
import { loadCommanderTenantData } from '@/lib/commander/dataLoader';
import { computeCommanderAnalytics, evaluateWidgets } from '@/lib/commander/engine';

export async function POST(request) {
    try {
        const session = await getServerSession(request);
        const body = await request.json();
        const { userId: requestedUserId, widgets, clientFilter, dateFrom, dateTo, sourceFilter } = body || {};

        const auth = authorizeTenantAccess(session, requestedUserId);
        if (!auth.authorized) {
            return new Response(JSON.stringify({ error: auth.error }), { status: auth.status });
        }
        const userId = auth.tenantId;

        if (!widgets || !Array.isArray(widgets)) {
            return new Response(JSON.stringify({ error: 'widgets array is required' }), { status: 400 });
        }

        const { invoices, transactions, sources } = await loadCommanderTenantData(userId);
        const analytics = computeCommanderAnalytics({
            invoices,
            transactions,
            filters: {
                client: clientFilter || '',
                dateFrom: dateFrom || '',
                dateTo: dateTo || '',
                sourceFilter: sourceFilter || 'all'
            }
        });

        const { results, widgetMeta } = evaluateWidgets({ widgets, analytics });

        return new Response(JSON.stringify({
            success: true,
            results,
            widgetMeta,
            audit: analytics.audit,
            sources
        }), { status: 200 });
    } catch (error) {
        console.error('Error in /api/commander/widgets/data POST:', error);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
    }
}
