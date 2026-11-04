import { recordShadowForecasts, getShadowLedger, reconcileMonthInLedger } from '../lib/forecasting/shadowLedger.js';

async function test() {
    console.log("=== TEST DE SHADOW FORECAST LEDGER CON PRISMA ===");
    const userId = "rmanuelguerrero_kk8e";
    const series = [574577.28, 132021.89, 715822.54, 0.0, 492123.61]; // Jun a Oct 2026

    console.log("1. Congelando pronósticos shadow para Noviembre 2026 (target: 2026-11-01)...");
    const recResult = await recordShadowForecasts({
        userId,
        seriesValues: series,
        targetMonthKey: "2026-11-01",
        trainingEndMonth: "2026-10-01"
    });
    console.log("Resultado de registro:", recResult);

    console.log("\n2. Consultando el Shadow Ledger de la base de datos...");
    const ledger = await getShadowLedger(userId);
    console.log(`Se recuperaron ${ledger.length} registros del ledger:`);
    console.table(ledger.map(r => ({
        id: r.id,
        horizon: `h=${r.horizon}`,
        model: r.modelName,
        target: r.targetMonthKey,
        rawForecast: r.rawForecast,
        status: r.reconciliationStatus
    })));

    console.log("\n3. Probando conciliación simulada para un mes previo (Octubre 2026 = $ 492.123,61)...");
    // Simulamos un registro previo para Octubre
    await recordShadowForecasts({
        userId,
        seriesValues: [574577.28, 132021.89, 715822.54, 0.0],
        targetMonthKey: "2026-10-01",
        trainingEndMonth: "2026-09-01"
    });

    const reconResult = await reconcileMonthInLedger({
        userId,
        targetMonthKey: "2026-10-01",
        actualNetInvoiced: 492123.61
    });
    console.log("Resultado de conciliación:", reconResult);

    const updatedLedger = await getShadowLedger(userId);
    const octRecords = updatedLedger.filter(r => r.targetMonthKey === '2026-10-01');
    console.log("\nRegistros de Octubre conciliados:");
    console.table(octRecords.map(r => ({
        model: r.modelName,
        predicted: r.rawForecast,
        actual: r.actualObserved,
        error: r.error,
        absError: r.absError,
        status: r.reconciliationStatus
    })));

    console.log("\n=== TEST COMPLETADO CON ÉXITO ===");
}

test().catch(console.error);
