import { getServerSession, authorizeTenantAccess } from '@/lib/auth';
import { loadCommanderTenantData } from '@/lib/commander/dataLoader';
import { computeCommanderAnalytics } from '@/lib/commander/engine';

/**
 * GET /api/commander/audit
 * Returns traceable source records and lineage for any KPI or widget
 * so every Commander BI metric can be audited back to its origin records.
 */
export async function GET(request) {
    try {
        const session = await getServerSession(request);
        const { searchParams } = new URL(request.url);
        const requestedUserId = searchParams.get('userId');
        const metric = searchParams.get('metric') || 'invoices'; // invoices | transactions | receivables | unverified
        const clientFilter = searchParams.get('client') || '';
        const dateFrom = searchParams.get('dateFrom') || '';
        const dateTo = searchParams.get('dateTo') || '';
        const sourceFilter = searchParams.get('source') || 'all';
        const limit = Math.min(Math.max(Number(searchParams.get('limit') || 100), 1), 500);

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

        const { eligibleInvoices, filteredTxs } = analytics._normalized;
        let records = [];

        if (metric === 'transactions' || metric === 'bankDeposits' || metric === 'reconciled') {
            const list = metric === 'reconciled'
                ? filteredTxs.filter(tx => tx.isReconciled)
                : (metric === 'bankDeposits' ? filteredTxs.filter(tx => tx.amount > 0) : filteredTxs);
            records = list.slice(0, limit).map(tx => ({
                id: tx.id,
                date: tx.isoDate,
                client_name: tx.client_name,
                bank_name: tx.bank_name,
                concept: tx.concept,
                amount: tx.amount,
                isReconciled: tx.isReconciled,
                reconciledAmount: tx.reconciledAmount,
                provenance: tx.provenance,
                source: tx.source || 'banco_manual',
                originFileName: tx.originFileName || null,
                batchId: tx.batchId || null
            }));
        } else if (metric === 'unverified') {
            records = invoices
                .filter(inv => !inv.status || !['aprobado', 'importado_externo'].includes(String(inv.status).toLowerCase()))
                .slice(0, limit)
                .map(inv => ({
                    id: inv.id || inv.cae || '-',
                    date: inv.cbteFch || inv.created_at || null,
                    RazonSocial: inv.RazonSocial || inv.cliente || '-',
                    CUIT: inv.CUIT || inv.cuit || '-',
                    Importe: Number(inv.Importe || inv.Total || 0),
                    status: inv.status || 'sin_estado',
                    source: inv.source || 'unknown'
                }));
        } else {
            records = eligibleInvoices.slice(0, limit).map(inv => ({
                id: inv.id,
                date: inv.isoDate,
                dateSource: inv.dateSource,
                cbteTipo: inv.cbteTipo,
                voucherName: inv.voucherName,
                PtoVta: inv.PtoVta || null,
                CbteDesde: inv.CbteDesde || null,
                cae: inv.cae || null,
                RazonSocial: inv.RazonSocial,
                CUIT: inv.CUIT,
                Importe: inv.Importe,
                signedAmount: inv.signedAmount,
                provenance: inv.provenance,
                isFiscalVerified: inv.isFiscalVerified,
                source: inv.source || 'arca',
                originFileName: inv.originFileName || null,
                batchId: inv.batchId || null
            }));
        }

        return new Response(JSON.stringify({
            success: true,
            metric,
            totalMatching: records.length,
            kpis: analytics.kpis,
            dataQuality: analytics.dataQuality,
            audit: analytics.audit,
            sources,
            records
        }), { status: 200 });
    } catch (error) {
        console.error('Error in /api/commander/audit GET:', error);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
    }
}
