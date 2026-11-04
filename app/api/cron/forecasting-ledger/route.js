import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { recordShadowForecasts, reconcileMonthInLedger } from '@/lib/forecasting/shadowLedger';

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
    // Verificación de seguridad CRON_SECRET en producción
    const authHeader = request.headers.get('authorization');
    if (process.env.NODE_ENV === 'production' && process.env.CRON_SECRET) {
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'No autorizado para ejecutar tarea programada' }, { status: 401 });
        }
    }

    const jobResults = {
        executionTimestamp: new Date().toISOString(),
        clientsProcessed: 0,
        forecastsRecorded: 0,
        monthsReconciled: 0,
        errors: []
    };

    try {
        const invoicesDir = path.join(process.cwd(), 'data', 'invoices');
        let files = [];
        try {
            files = await fs.readdir(invoicesDir);
        } catch (e) {
            return NextResponse.json({ message: 'No se encontraron directorios de comprobantes', jobResults });
        }

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
        const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
        const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-01`;

        for (const file of files) {
            if (!file.endsWith('_history.json')) continue;
            const userId = file.replace('_history.json', '');

            try {
                const filePath = path.join(invoicesDir, file);
                const fileData = await fs.readFile(filePath, 'utf8');
                const history = JSON.parse(fileData);

                const approved = history.filter(inv => (inv.status || 'aprobado') === 'aprobado');
                if (approved.length === 0) continue;

                // Agrupación continua por mes fiscal (cbteFch)
                const buckets = {};
                let earliestDate = null;

                approved.forEach(inv => {
                    const emDate = parseInvoiceEmissionDate(inv);
                    if (!emDate) return;
                    if (!earliestDate || emDate < earliestDate) earliestDate = emDate;

                    const y = emDate.getFullYear();
                    const m = emDate.getMonth();
                    const key = `${y}-${String(m + 1).padStart(2, '0')}-01`;

                    const type = getCbteTipo(inv);
                    const isCredit = [3, 8, 13, 203, 208, 213].includes(type);
                    const amount = parseFloat(inv.Importe || inv.Total || 0);
                    const diff = isCredit ? -amount : amount;

                    if (!buckets[key]) {
                        buckets[key] = { key, netTotal: 0 };
                    }
                    buckets[key].netTotal += diff;
                });

                if (!earliestDate) continue;

                // Construir serie continua cerrada hasta el mes anterior al actual
                const completedSeries = [];
                let cur = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1);
                const lastCompleteDate = new Date(currentYear, currentMonth - 1, 1);

                while (cur <= lastCompleteDate) {
                    const y = cur.getFullYear();
                    const m = cur.getMonth();
                    const key = `${y}-${String(m + 1).padStart(2, '0')}-01`;
                    const b = buckets[key] || { netTotal: 0 };
                    completedSeries.push(Math.max(0, b.netTotal));
                    cur.setMonth(cur.getMonth() + 1);
                }

                if (completedSeries.length === 0) continue;

                // 1. Congelar pronósticos provisionales para el mes en curso (h=1) y próximo (h=2)
                const recRes = await recordShadowForecasts({
                    userId,
                    seriesValues: completedSeries,
                    targetMonthKey: currentMonthKey,
                    trainingEndMonth: prevMonthKey,
                    emissionDate: now
                });

                if (recRes.success) {
                    jobResults.forecastsRecorded += (recRes.recordedCount || 0);
                }

                // 2. Conciliar el mes cerrado previo (si hay datos registrados en el ledger)
                const prevClosedNet = buckets[prevMonthKey] ? Math.max(0, buckets[prevMonthKey].netTotal) : 0;
                const reconRes = await reconcileMonthInLedger({
                    userId,
                    targetMonthKey: prevMonthKey,
                    actualNetInvoiced: prevClosedNet
                });

                if (reconRes.success && reconRes.reconciledCount > 0) {
                    jobResults.monthsReconciled += reconRes.reconciledCount;
                }

                jobResults.clientsProcessed++;

            } catch (clientErr) {
                console.error(`Error processing client ${userId} in forecasting cron:`, clientErr);
                jobResults.errors.push({ userId, error: clientErr.message });
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Tarea programada de Shadow Forecast Ledger ejecutada con éxito',
            summary: jobResults
        });

    } catch (jobErr) {
        console.error('Fatal error in forecasting ledger cron:', jobErr);
        return NextResponse.json({ success: false, error: jobErr.message, jobResults }, { status: 500 });
    }
}
