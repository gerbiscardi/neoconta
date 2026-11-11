import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getServerSession, authorizeTenantAccess } from '@/lib/auth';
import { 
    runSimpleMean, 
    runHistoricalMedian, 
    runLinearWMA, 
    runSES, 
    runHoltDampedTrend, 
    runNaive,
    runTemporalBacktest, 
    selectAdaptiveModel 
} from '@/lib/forecasting/engine';
import { recordShadowForecasts, getShadowLedger } from '@/lib/forecasting/shadowLedger';

// Helper to resolve AFIP voucher type
const getCbteTipo = (invoice) => {
    if (!invoice) return 11;
    if (invoice.CbteTipo !== undefined) return Number(invoice.CbteTipo);
    if (invoice.cbteTipo !== undefined) return Number(invoice.cbteTipo);
    const respTipo = invoice.afip_response?.response?.FeCabResp?.CbteTipo;
    if (respTipo !== undefined) return Number(respTipo);
    const respTipo2 = invoice.afip_response?.CbteTipo;
    if (respTipo2 !== undefined) return Number(respTipo2);
    return 11;
};

const parseInvoiceEmissionDate = (inv) => {
    const raw = inv.cbteFch || inv.CbteFch || inv.created_at;
    if (!raw) return null;
    const str = String(raw).trim();
    if (str.length === 8 && /^\d{8}$/.test(str)) {
        const y = parseInt(str.substring(0, 4), 10);
        const m = parseInt(str.substring(4, 6), 10) - 1;
        const d = parseInt(str.substring(6, 8), 10);
        return new Date(y, m, d);
    }
    const parsed = new Date(str);
    return isNaN(parsed.getTime()) ? null : parsed;
};

export async function GET(request) {
    try {
        const session = await getServerSession(request);
        const { searchParams } = new URL(request.url);
        const auth = authorizeTenantAccess(session, searchParams.get('userId'));
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }
        const targetUserId = auth.tenantId;

        const invoicesDir = path.join(process.cwd(), 'data', 'invoices');
        const historyFile = path.join(invoicesDir, `${targetUserId}_history.json`);

        let history = [];
        try {
            const fileData = await fs.readFile(historyFile, 'utf8');
            history = JSON.parse(fileData);
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }

        const approved = history.filter(inv => (inv.status || 'aprobado') === 'aprobado');
        const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
        const fullMonthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        const buckets = {};
        let earliestDate = null;

        approved.forEach(inv => {
            const emissionDate = parseInvoiceEmissionDate(inv);
            if (!emissionDate) return;

            if (!earliestDate || emissionDate < earliestDate) {
                earliestDate = emissionDate;
            }

            const y = emissionDate.getFullYear();
            const m = emissionDate.getMonth();
            const key = `${y}-${String(m + 1).padStart(2, '0')}-01`;

            const type = getCbteTipo(inv);
            const isCredit = [3, 8, 13, 203, 208, 213].includes(type);
            const amount = parseFloat(inv.Importe || inv.Total || 0);
            const diff = isCredit ? -amount : amount;

            if (!buckets[key]) {
                buckets[key] = {
                    year: y,
                    month: m,
                    key,
                    facturasCount: 0,
                    facturasTotal: 0,
                    ncCount: 0,
                    ncTotal: 0,
                    netTotal: 0
                };
            }

            if (isCredit) {
                buckets[key].ncCount++;
                buckets[key].ncTotal += amount;
                buckets[key].netTotal -= amount;
            } else {
                buckets[key].facturasCount++;
                buckets[key].facturasTotal += amount;
                buckets[key].netTotal += amount;
            }
        });

        // Construir serie continua cerrada
        const completedMonths = [];
        if (earliestDate) {
            let cur = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1);
            const lastCompleteDate = new Date(currentYear, currentMonth - 1, 1);

            while (cur <= lastCompleteDate) {
                const y = cur.getFullYear();
                const m = cur.getMonth();
                const key = `${y}-${String(m + 1).padStart(2, '0')}-01`;

                const b = buckets[key] || {
                    year: y,
                    month: m,
                    key,
                    facturasCount: 0,
                    facturasTotal: 0,
                    ncCount: 0,
                    ncTotal: 0,
                    netTotal: 0
                };

                // Conservar el dato contable neto exacto sin truncar (soporta meses con saldo negativo por notas de crédito)
                const net = Math.round(b.netTotal * 100) / 100;
                completedMonths.push({
                    key,
                    year: y,
                    month: m,
                    label: `${monthNames[m]} ${y}`,
                    fullLabel: `${fullMonthNames[m]} ${y}`,
                    netTotal: net
                });

                cur.setMonth(cur.getMonth() + 1);
            }
        }

        const seriesValues = completedMonths.map(m => m.netTotal);

        // Ejecutar los modelos individuales
        const m0 = runNaive(seriesValues);
        const m1 = runSimpleMean(seriesValues);
        const m2 = runHistoricalMedian(seriesValues);
        const m3 = runLinearWMA(seriesValues);
        const m4_fixed = runSES(seriesValues, 0.33);
        const m4_adaptive = runSES(seriesValues, null);
        const m5_gated = runHoltDampedTrend(seriesValues, { enforceGate: true, minHistoryForTrend: 6 });
        const m5_ungated = runHoltDampedTrend(seriesValues, { enforceGate: false });

        const backtest = runTemporalBacktest(seriesValues, 2, completedMonths.map(m => m.label));
        const adaptiveSelection = selectAdaptiveModel(seriesValues);

        // Registrar en el Shadow Ledger para el mes en curso (Noviembre 2026)
        const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
        await recordShadowForecasts({
            userId: targetUserId,
            seriesValues,
            targetMonthKey: currentMonthKey
        });

        // Si se solicita específicamente el historial de auditoría del ledger
        const ledgerHistory = await getShadowLedger(targetUserId);

        return NextResponse.json({
            success: true,
            isExperimental: true,
            metadata: {
                targetUserId,
                seriesLength: seriesValues.length,
                periodStart: completedMonths[0]?.label || 'N/A',
                periodEnd: completedMonths[completedMonths.length - 1]?.label || 'N/A',
                currency: 'ARS',
                accountingCriteria: 'Facturación neta devengada mensual (Facturas - Notas de Crédito por cbteFch). Excluye mes en curso.',
                auditTimestamp: new Date().toISOString()
            },
            series: completedMonths,
            models: [m0, m1, m2, m3, m4_fixed, m4_adaptive, m5_gated, m5_ungated],
            backtest,
            adaptiveSelection,
            shadowLedger: {
                targetMonth: currentMonthKey,
                totalRecorded: ledgerHistory.length,
                entries: ledgerHistory
            }
        });

    } catch (error) {
        console.error('Error in forecasting benchmark API:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
