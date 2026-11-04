import { 
    runSimpleMean, 
    runHistoricalMedian, 
    runLinearWMA, 
    runSES, 
    runHoltDampedTrend, 
    runTemporalBacktest, 
    selectAdaptiveModel 
} from '../lib/forecasting/engine.js';

console.log("================================================================================");
console.log("NEOCONTA FINANCIAL FORECASTING ENGINE — SUITE DE PRUEBAS Y VALIDACIÓN (ETAPA 3)");
console.log("================================================================================\n");

// 1. Serie real del cliente auditado (Junio a Octubre 2026)
const realSeries = [574577.28, 132021.89, 715822.54, 0.0, 492123.61];
const monthLabels = ["Jun 2026", "Jul 2026", "Ago 2026", "Sep 2026", "Oct 2026"];

console.log("1. SERIE REAL AUDITADA (N = 5):");
realSeries.forEach((v, i) => console.log(`   [t=${i+1}] ${monthLabels[i]}: $ ${v.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`));
console.log("");

// Ejecución de los 5 modelos sobre la serie completa
const m1 = runSimpleMean(realSeries);
const m2 = runHistoricalMedian(realSeries);
const m3 = runLinearWMA(realSeries);
const m4 = runSES(realSeries, 0.33); // alpha = 2/(5+1) = 0.33
const m5 = runHoltDampedTrend(realSeries, { alpha: 0.30, beta: 0.15, phi: 0.85, minHistoryForTrend: 6 });

console.log("2. RESULTADOS DE LOS MODELOS (HORIZONTES h=1 y h=2):");
console.log("--------------------------------------------------------------------------------");
console.log(`Model 1 - Simple Mean (Activo):     h=1: $ ${m1.forecast[0].toLocaleString('es-AR')} | h=2: $ ${m1.forecast[1].toLocaleString('es-AR')}`);
console.log(`Model 2 - Historical Median:        h=1: $ ${m2.forecast[0].toLocaleString('es-AR')} | h=2: $ ${m2.forecast[1].toLocaleString('es-AR')}`);
console.log(`Model 3 - Linear WMA:               h=1: $ ${m3.forecast[0].toLocaleString('es-AR')} | h=2: $ ${m3.forecast[1].toLocaleString('es-AR')}`);
console.log(`Model 4 - SES / EMA (α=0.33):       h=1: $ ${m4.forecast[0].toLocaleString('es-AR')} | h=2: $ ${m4.forecast[1].toLocaleString('es-AR')}`);
console.log(`Model 5 - Holt Damped (Trend Gate): h=1: $ ${m5.forecast[0].toLocaleString('es-AR')} | h=2: $ ${m5.forecast[1].toLocaleString('es-AR')}`);
console.log("--------------------------------------------------------------------------------\n");

console.log("3. DETALLES DE EXPLICABILIDAD MATEMÁTICA:");
console.log(`   * M1 Fórmula: ${m1.formula}`);
console.log(`   * M2 Fórmula: ${m2.formula}`);
console.log(`   * M3 Fórmula: ${m3.formula}`);
console.log(`   * M4 Fórmula: ${m4.formula}`);
console.log(`   * M5 Fórmula: ${m5.formula}`);
console.log(`   * M5 Observación: ${m5.caveats[0]}\n`);

// 3. Backtesting temporal cronológico
console.log("4. VALIDACIÓN TEMPORAL CRUZADA (BACKTESTING CRONOLÓGICO):");
const backtest = runTemporalBacktest(realSeries, 2);
console.log(`   Cortes evaluados (test points): ${backtest.testPointsCount} (t=3 [Ago], t=4 [Sep], t=5 [Oct])`);
console.log(`   Escala ingenua de referencia (Naive scale): $ ${backtest.naiveScale.toLocaleString('es-AR')}\n`);

console.log("   Tabla comparativa de métricas:");
console.log("   ┌───────────────────────────┬────────────────┬───────────┬──────────┐");
console.log("   │ Modelo                    │ MAE (ARS)      │ WAPE (%)  │ MASE     │");
console.log("   ├───────────────────────────┼────────────────┼───────────┼──────────┤");
Object.values(backtest.models).forEach(m => {
    const namePad = m.name.padEnd(25);
    const maePad = `$ ${m.mae.toLocaleString('es-AR')}`.padStart(14);
    const wapePad = `${m.wape.toFixed(1)}%`.padStart(9);
    const masePad = `${m.mase.toFixed(2)}`.padStart(8);
    console.log(`   │ ${namePad} │ ${maePad} │ ${wapePad} │ ${masePad} │`);
});
console.log("   └───────────────────────────┴────────────────┴───────────┴──────────┘\n");

// 4. Detalle de predicciones paso a paso en el backtest
console.log("5. PREDICCIONES Y ERRORES PASO A PASO EN EL CORTE TEMPORAL:");
Object.values(backtest.models).forEach(m => {
    console.log(`   >> ${m.name}:`);
    m.predictions.forEach(p => {
        const mes = monthLabels[p.t];
        console.log(`      Paso ${p.t} (${mes}): Real = $ ${p.actual.toLocaleString('es-AR')} | Pred = $ ${p.predicted.toLocaleString('es-AR')} | Error Abs = $ ${p.absErr.toLocaleString('es-AR')}`);
    });
});
console.log("");

// 5. Prueba del Mecanismo Adaptativo
console.log("6. EVALUACIÓN DEL MECANISMO DE SELECCIÓN ADAPTATIVA:");
const selShort = selectAdaptiveModel(realSeries);
console.log(`   Para N = 5 (cliente actual):`);
console.log(`   -> Modelo seleccionado: ${selShort.selectedName}`);
console.log(`   -> Razón: ${selShort.reason}`);
console.log(`   -> Pronóstico emitido: $ ${selShort.forecast[0].toLocaleString('es-AR')}\n`);

// 6. Prueba con Serie Larga (N = 10)
const longSeries = [
    300000, 320000, 310000, 340000, 360000, 
    375000, 390000, 410000, 425000, 450000
];
console.log("7. PRUEBA CON SERIE EXTENDIDA (N = 10 con tendencia positiva suave):");
const selLong = selectAdaptiveModel(longSeries);
console.log(`   -> Modelo seleccionado: ${selLong.selectedName}`);
console.log(`   -> Razón: ${selLong.reason}`);
console.log(`   -> Pronóstico h=1: $ ${selLong.forecast[0].toLocaleString('es-AR')} | h=2: $ ${selLong.forecast[1].toLocaleString('es-AR')}`);
console.log(`   -> Componentes Holt: Nivel = $ ${selLong.details.components?.finalLevel?.toLocaleString('es-AR')} | Tendencia b_n = $ ${selLong.details.components?.finalTrend?.toLocaleString('es-AR')}`);
console.log("\n================================================================================");
