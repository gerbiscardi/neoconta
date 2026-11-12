import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { computeCommanderAnalytics, evaluateWidgets } from '../lib/commander/engine.js';
import { processExternalIngestion, rollbackExternalBatch, getIngestPaths, loadJsonArray } from '../lib/commander/ingestService.js';

async function testComponent1Engine() {
    const sampleInvoices = [
        // 1. ARCA verified Factura A in 2026-08 ($100,000), partially paid $40,000 via linked bank tx
        {
            id: 'arca_f1',
            cae: '75111111111111',
            cbteFch: '20260815',
            CbteTipo: 1,
            PtoVta: 1,
            CbteDesde: 10,
            RazonSocial: 'Clinica Alfa',
            CUIT: '30711111119',
            Importe: 100000,
            status: 'aprobado'
        },
        // 2. ARCA verified ND A linked to Factura A (+$10,000) in 2026-08
        {
            id: 'arca_nd1',
            cae: '75111111111112',
            cbteFch: '20260820',
            CbteTipo: 2,
            PtoVta: 1,
            CbteDesde: 2,
            CbtesAsoc: [{ Tipo: 1, PtoVta: 1, Nro: 10 }],
            RazonSocial: 'Clinica Alfa',
            CUIT: '30711111119',
            Importe: 10000,
            status: 'aprobado'
        },
        // 3. ARCA verified NC A linked to Factura A (-$25,000) in 2026-08
        {
            id: 'arca_nc1',
            cae: '75111111111113',
            cbteFch: '20260825',
            CbteTipo: 3,
            PtoVta: 1,
            CbteDesde: 3,
            CbtesAsoc: [{ Tipo: 1, PtoVta: 1, Nro: 10 }],
            RazonSocial: 'Clinica Alfa',
            CUIT: '30711111119',
            Importe: 25000,
            status: 'aprobado'
        },
        // 4. ARCA FCE MiPyME B (206) $50,000 in 2026-08 + NC PyME B (208) $70,000 in 2026-10 -> net 2026-10 = -$70,000 (must NOT clamp to 0!)
        {
            id: 'arca_fce1',
            cae: '75111111111114',
            cbteFch: '20260828',
            CbteTipo: 206,
            PtoVta: 2,
            CbteDesde: 1,
            RazonSocial: 'Obra Social Beta',
            CUIT: '30722222223',
            Importe: 50000,
            status: 'aprobado'
        },
        {
            id: 'arca_nc_pyme',
            cae: '75111111111115',
            cbteFch: '20261005',
            CbteTipo: 208,
            PtoVta: 2,
            CbteDesde: 1,
            CbtesAsoc: [{ Tipo: 206, PtoVta: 2, Nro: 1 }],
            RazonSocial: 'Obra Social Beta',
            CUIT: '30722222223',
            Importe: 70000,
            status: 'aprobado'
        },
        // 5. External unverified Excel import in 2026-10 ($30,000)
        {
            id: 'ext_1',
            cae: null,
            cbteFch: '20261010',
            CbteTipo: 11,
            PtoVta: 5,
            CbteDesde: 99,
            RazonSocial: 'Proveedor Externo',
            CUIT: '30733333331',
            Importe: 30000,
            status: 'importado_externo',
            source: 'excel_import',
            isFiscalVerified: false
        },
        // 6. Invoice WITHOUT status -> must NEVER be auto-approved
        {
            id: 'no_status_1',
            cbteFch: '20261012',
            CbteTipo: 11,
            RazonSocial: 'Sin Estado SRL',
            CUIT: '30744444449',
            Importe: 99999
        },
        // 7. Invoice WITHOUT date -> must NEVER be moved to current month
        {
            id: 'undated_1',
            cae: '75111111111116',
            CbteTipo: 11,
            RazonSocial: 'Sin Fecha SA',
            CUIT: '30755555557',
            Importe: 55555,
            status: 'aprobado'
        }
    ];

    const sampleTxs = [
        // Positive bank deposit linked partially ($40,000) to arca_f1 (total tx $50,000, only $40,000 reconciled)
        {
            id: 'tx_pos_1',
            transaction_date: '2026-08-29T10:00:00Z',
            amount: 50000,
            client_name: 'Clinica Alfa',
            bank_name: 'GALICIA',
            linked_invoices: [{ invoice_id: '75111111111111', amount: 40000 }]
        },
        // Unlinked positive deposit ($20,000) -> NOT counted as reconciledCollections!
        {
            id: 'tx_pos_unlinked',
            transaction_date: '2026-10-15T10:00:00Z',
            amount: 20000,
            client_name: 'Desconocido',
            bank_name: 'GALICIA',
            linked_invoices: []
        },
        // Negative bank debit (-$85,000) -> bankNetFlow = 70,000 - 85,000 = -15,000 (must NOT clamp to 0!)
        {
            id: 'tx_neg_1',
            transaction_date: '2026-10-18T10:00:00Z',
            amount: -85000,
            client_name: 'AFIP',
            bank_name: 'GALICIA',
            linked_invoices: []
        }
    ];

    const analytics = computeCommanderAnalytics({
        invoices: sampleInvoices,
        transactions: sampleTxs,
        filters: { sourceFilter: 'all' }
    });

    // Check provenance counts & missing-status / undated exclusions
    assert.equal(analytics.dataQuality.unverifiedMissingStatusCount, 1);
    assert.equal(analytics.dataQuality.undatedInvoicesCount, 1);
    assert.equal(analytics.kpis.invoicingCount, 6);

    // 2026-08 net = 100k + 10k - 25k + 50k = 135k
    // 2026-09 empty month -> must be present with hasMovement === false
    // 2026-10 net = -70k (fiscal) + 30k (external) = -40k (NEGATIVE preserved, not clamped!)
    const m08 = analytics.invoiceData.find(m => m.month === '2026-08');
    const m09 = analytics.invoiceData.find(m => m.month === '2026-09');
    const m10 = analytics.invoiceData.find(m => m.month === '2026-10');
    assert.equal(m08.total_amount, 135000);
    assert.equal(m09.hasMovement, false);
    assert.equal(m09.total_amount, 0);
    assert.equal(m10.total_amount, -40000);
    assert.ok(analytics.dataQuality.emptyMonths.includes('2026-09'));

    // Total net = 135k - 40k = 95k (65k fiscal + 30k external)
    assert.equal(analytics.kpis.netInvoicing, 95000);
    assert.equal(analytics.kpis.fiscalVerifiedNet, 65000);
    assert.equal(analytics.kpis.externalUnverifiedNet, 30000);

    // Banking vs Reconciled collections
    assert.equal(analytics.kpis.bankDeposits, 70000);
    assert.equal(analytics.kpis.bankDebits, -85000);
    assert.equal(analytics.kpis.bankNetFlow, -15000);
    assert.equal(analytics.kpis.reconciledCollections, 40000);

    // Receivables:
    // Clinica Alfa: 100k + 10k - 25k - 40k(partial linked) = 45,000
    // Obra Social Beta: 50k - 70k(NC PyME) = 0
    // Proveedor Externo: 30k
    // Total pending = 75,000
    assert.equal(analytics.kpis.pendingReceivables, 75000);
    const alfaDebt = analytics.debtRanking.find(d => d.client_name === 'Clinica Alfa');
    assert.equal(alfaDebt.total_debt, 45000);

    // Widget reconciliation check against KPIs
    const widgets = [
        { id: 'w_kpi_inv', type: 'kpi', dataSource: 'invoices', yAxisMeasure: 'amount', aggregation: 'sum' },
        { id: 'w_kpi_bank_net', type: 'kpi', dataSource: 'transactions_net', yAxisMeasure: 'amount', aggregation: 'sum' },
        { id: 'w_chart_month', type: 'chart', dataSource: 'invoices', xAxisDimension: 'month', yAxisMeasure: 'amount', aggregation: 'sum' }
    ];
    const { results } = evaluateWidgets({ widgets, analytics });
    assert.equal(results.w_kpi_inv.value, analytics.kpis.netInvoicing, 'Widget KPI must match engine netInvoicing');
    assert.equal(results.w_kpi_bank_net.value, analytics.kpis.bankNetFlow, 'Widget bank net must preserve negative flow');
    assert.equal(results.w_chart_month.find(p => p.name === '2026-10').value, -40000, 'Widget monthly chart must preserve negative net invoicing');

    // Fiscal-only filter check
    const fiscalOnly = computeCommanderAnalytics({
        invoices: sampleInvoices,
        transactions: sampleTxs,
        filters: { sourceFilter: 'fiscal_verified' }
    });
    assert.equal(fiscalOnly.kpis.netInvoicing, 65000);
    assert.equal(fiscalOnly.kpis.externalUnverifiedNet, 0);

    console.log('PASS: Component 1 Commander financial engine & widget reconciliation verified');
}

async function testComponent2Ingest() {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'commander-c2-'));
    const prevDataDir = process.env.NEOCONTA_DATA_DIR;
    process.env.NEOCONTA_DATA_DIR = tmpRoot;
    const tenantId = 'cli_test_c2';

    try {
        const { invoicesFilePath, transactionsFilePath } = getIngestPaths(tenantId);
        await fs.mkdir(path.dirname(invoicesFilePath), { recursive: true });

        // Pre-seed real ARCA invoice that must NEVER be overwritten or duplicated
        const arcaInvoice = {
            id: 'arca_keep_1',
            cae: '75999999999999',
            cbteFch: '20260901',
            CbteTipo: 1,
            PtoVta: 1,
            CbteDesde: 50,
            RazonSocial: 'Cliente ARCA Intacto',
            CUIT: '30711111119',
            Importe: 80000,
            status: 'aprobado'
        };
        await fs.writeFile(invoicesFilePath, JSON.stringify([arcaInvoice], null, 2));

        // 1. Preview with explicit columnMapping + duplicate vs ARCA + invalid row
        const previewRes = await processExternalIngestion({
            tenantId,
            dataType: 'invoices',
            mode: 'preview',
            fileName: 'ventas.csv',
            columnMapping: {
                client_name: 'Cliente',
                cuit: 'Doc',
                amount: 'Total',
                date: 'Fecha',
                cbteTipo: 'Tipo',
                ptoVta: 'PV',
                cbteDesde: 'Nro'
            },
            data: [
                { Cliente: 'Cliente ARCA Intacto', Doc: '30-71111111-9', Total: '80.000,00', Fecha: '01/09/2026', Tipo: 1, PV: 1, Nro: 50 }, // duplicate of ARCA
                { Cliente: 'Nuevo Externo SRL', Doc: '30-72222222-3', Total: '25.500,50', Fecha: '15/09/2026', Tipo: 11, PV: 2, Nro: 10 }, // valid
                { Cliente: 'Sin Monto', Doc: '30733333331', Total: '-500', Fecha: '15/09/2026' } // error
            ]
        });
        assert.equal(previewRes.ok, true);
        assert.equal(previewRes.validCount, 1);
        assert.equal(previewRes.duplicateCount, 1);
        assert.equal(previewRes.errorCount, 1);

        // 2. Bank transactions supporting positive AND negative amounts + idempotent replay
        const txPayload = [
            { fecha: '2026-09-10', concepto: 'Transferencia recibida', importe: '45.000,00', cliente: 'Cliente A', banco: 'GALICIA' },
            { fecha: '2026-09-11', concepto: 'Debito IIBB', importe: '-3.250,75', cliente: 'ARBA', banco: 'GALICIA' }
        ];
        const commitTx1 = await processExternalIngestion({
            tenantId,
            dataType: 'transactions',
            mode: 'commit',
            fileName: 'extracto.xlsx',
            data: txPayload
        });
        assert.equal(commitTx1.ok, true);
        assert.equal(commitTx1.recordCount, 2);

        const replayTx = await processExternalIngestion({
            tenantId,
            dataType: 'transactions',
            mode: 'commit',
            fileName: 'extracto.xlsx',
            data: txPayload
        });
        assert.equal(replayTx.ok, true);
        assert.equal(replayTx.idempotentReplay, true);
        assert.equal(replayTx.recordCount, 0);

        const savedTxs = await loadJsonArray(transactionsFilePath);
        assert.equal(savedTxs.length, 2);
        assert.ok(savedTxs.some(t => t.amount === 45000));
        assert.ok(savedTxs.some(t => t.amount === -3250.75));

        // 3. Concurrent invoice commits must serialize cleanly without losing records or touching ARCA
        const [c1, c2] = await Promise.all([
            processExternalIngestion({
                tenantId,
                dataType: 'invoices',
                fileName: 'lote_a.xlsx',
                data: [{ client_name: 'Concurrente A', cuit: '30766666661', amount: 12000, date: '2026-09-20', cbteTipo: 11, ptoVta: 3, cbteDesde: 1 }]
            }),
            processExternalIngestion({
                tenantId,
                dataType: 'invoices',
                fileName: 'lote_b.xlsx',
                data: [{ client_name: 'Concurrente B', cuit: '30766666662', amount: 18000, date: '2026-09-21', cbteTipo: 11, ptoVta: 3, cbteDesde: 2 }]
            })
        ]);
        assert.equal(c1.ok, true);
        assert.equal(c2.ok, true);

        const allInvs = await loadJsonArray(invoicesFilePath);
        assert.equal(allInvs.length, 3, 'Concurrent commits must preserve ARCA + both batches');
        assert.equal(allInvs.find(i => i.id === 'arca_keep_1').status, 'aprobado');

        // 4. Safe rollback preserves ARCA and other batches
        const rb = await rollbackExternalBatch(tenantId, c1.batchId);
        assert.equal(rb.ok, true);
        const afterRb = await loadJsonArray(invoicesFilePath);
        assert.equal(afterRb.length, 2);
        assert.ok(afterRb.some(i => i.id === 'arca_keep_1'));

        console.log('PASS: Component 2 Excel/CSV preview, mapping, negative bank amounts, idempotency & concurrency verified');
    } finally {
        if (prevDataDir === undefined) delete process.env.NEOCONTA_DATA_DIR;
        else process.env.NEOCONTA_DATA_DIR = prevDataDir;
        await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
    }
}

(async () => {
    await testComponent1Engine();
    await testComponent2Ingest();
})().catch(err => {
    console.error(err);
    process.exit(1);
});
