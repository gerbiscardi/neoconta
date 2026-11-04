import { 
    runSimpleMean, 
    runHistoricalMedian, 
    runLinearWMA, 
    runSES, 
    runHoltDampedTrend, 
    runNaive,
    runTemporalBacktest, 
    selectAdaptiveModel 
} from '../lib/forecasting/engine.js';

console.log("========================================================================================");
console.log("NEOCONTA — AUDITORÍA FORENSE MATEMÁTICA Y MATRIZ DE COMPARACIÓN CRUZADA (ETAPA 3.1)");
console.log("========================================================================================\n");

// ------------------------------------------------------------------------------------------------
// 1. ANÁLISIS DE LA SERIE REAL DEL CLIENTE AUDITADO (N = 5)
// ------------------------------------------------------------------------------------------------
const realSeries = [574577.28, 132021.89, 715822.54, 0.0, 492123.61];
const monthLabels = ["Jun 2026", "Jul 2026", "Ago 2026", "Sep 2026", "Oct 2026"];

console.log("1. SERIE REAL AUDITADA (N = 5):");
realSeries.forEach((v, i) => console.log(`   t=${i+1} (${monthLabels[i]}): $ ${v.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`));
console.log("");

// ------------------------------------------------------------------------------------------------
// 2. AUDITORÍA DETALLADA DE SES: ALFA FIJO (α=0.33) VS ALFA DINÁMICO (α=2/(t+1))
// ------------------------------------------------------------------------------------------------
console.log("2. AUDITORÍA EXPLICATIVA DE EMA (SES): FIJO vs DINÁMICO:");
console.log("----------------------------------------------------------------------------------------");
console.log("A. SES con alfa fijo α = 0.33:");
const sesFixedFull = runSES(realSeries, 0.33);
console.log(`   Nivel inicial l_1 = y_1 = $ ${realSeries[0].toLocaleString('es-AR')}`);
sesFixedFull.components.levelsHistory.forEach(h => {
    console.log(`   Paso t=${h.step} (${monthLabels[h.step-1]}): y_t = $ ${h.y.toLocaleString('es-AR')} | l_t = 0.33·y_t + 0.67·l_{t-1} = $ ${h.level.toLocaleString('es-AR')}`);
});
console.log(`   Pronóstico emitido para Nov y Dic: $ ${sesFixedFull.forecast[0].toLocaleString('es-AR')}\n`);

console.log("B. SES con alfa adaptativo / dinámico (α_t = 2 / (t + 1)):");
const sesAdaptiveFull = runSES(realSeries, null);
console.log(`   Nivel inicial l_1 = y_1 = $ ${realSeries[0].toLocaleString('es-AR')}`);
sesAdaptiveFull.components.levelsHistory.forEach(h => {
    const alpha_t = (2 / (h.step + 1)).toFixed(2);
    console.log(`   Paso t=${h.step} (${monthLabels[h.step-1]}): α_${h.step} = ${alpha_t} | y_t = $ ${h.y.toLocaleString('es-AR')} | l_t = $ ${h.level.toLocaleString('es-AR')}`);
});
console.log(`   Pronóstico emitido para Nov y Dic: $ ${sesAdaptiveFull.forecast[0].toLocaleString('es-AR')}\n`);

// ------------------------------------------------------------------------------------------------
// 3. AUDITORÍA DE HOLT DAMPED: CON GATE (N>=6) VS SIN GATE (UNCONSTRAINED)
// ------------------------------------------------------------------------------------------------
console.log("3. AUDITORÍA DE HOLT CON TENDENCIA AMORTIGUADA (DAMPED TREND):");
console.log("----------------------------------------------------------------------------------------");
const holtGated = runHoltDampedTrend(realSeries, { enforceGate: true, minHistoryForTrend: 6, alpha: 0.30, beta: 0.15, phi: 0.85 });
const holtUngated = runHoltDampedTrend(realSeries, { enforceGate: false, alpha: 0.30, beta: 0.15, phi: 0.85 });

console.log("A. Holt Damped CON Gate de Seguridad (N >= 6):");
console.log(`   - Estado del Gate: ${holtGated.components.isTrendActive ? 'ACTIVO' : 'NEUTRALIZADO'} (porque N = 5 < 6)`);
console.log(`   - Nivel final l_5: $ ${holtGated.components.finalLevel.toLocaleString('es-AR')}`);
console.log(`   - Tendencia final b_5: $ ${holtGated.components.finalTrend.toLocaleString('es-AR')} (forzada a 0 por salvaguarda)`);
console.log(`   - Pronóstico h=1 (Nov): $ ${holtGated.forecast[0].toLocaleString('es-AR')}`);
console.log(`   - Pronóstico h=2 (Dic): $ ${holtGated.forecast[1].toLocaleString('es-AR')}`);
console.log(`   - Causa matemática de valores idénticos: Al estar neutralizada la tendencia (b_5 = 0), l_5 + φ·(0) = l_5 para todo h.\n`);

console.log("B. Holt Damped SIN Gate (b_n libremente estimado):");
console.log(`   - Estado del Gate: LIBRE (enforceGate: false)`);
console.log(`   - Nivel final l_5: $ ${holtUngated.components.finalLevel.toLocaleString('es-AR')}`);
console.log(`   - Tendencia final b_5: $ ${holtUngated.components.finalTrend.toLocaleString('es-AR')}`);
console.log(`   - h=1 Drift (φ · b_5 = 0.85 · ${holtUngated.components.finalTrend}): $ ${holtUngated.components.trendDriftH1.toLocaleString('es-AR')}`);
console.log(`   - h=2 Drift ((φ+φ²) · b_5 = 1.5725 · ${holtUngated.components.finalTrend}): $ ${holtUngated.components.trendDriftH2.toLocaleString('es-AR')}`);
console.log(`   - Pronóstico h=1 (Nov): max(0, l_5 + φ·b_5) = $ ${holtUngated.forecast[0].toLocaleString('es-AR')}`);
console.log(`   - Pronóstico h=2 (Dic): max(0, l_5 + (φ+φ²)·b_5) = $ ${holtUngated.forecast[1].toLocaleString('es-AR')}`);
console.log(`   - Detalle de la evolución de estados paso a paso:`);
holtUngated.components.history.forEach(h => {
    console.log(`     Paso t=${h.step} (${monthLabels[h.step-1]}): y_t = $ ${h.y.toLocaleString('es-AR')} | l_t = $ ${h.level.toLocaleString('es-AR')} | b_t = $ ${h.trend.toLocaleString('es-AR')}`);
});
console.log("");

// ------------------------------------------------------------------------------------------------
// 4. BACKTESTING TEMPORAL SEPARADO POR HORIZONTE (h=1 y h=2) CON MASE CAUSAL
// ------------------------------------------------------------------------------------------------
console.log("4. BACKTESTING TEMPORAL CRONOLÓGICO SEPARADO POR HORIZONTE:");
console.log("----------------------------------------------------------------------------------------");
const bt = runTemporalBacktest(realSeries, 2);

console.log(`\n=== HORIZONTE h=1 (Pronóstico a 1 mes vista) — Cortes disponibles: ${bt.h1.cutsCount} ===`);
console.log("┌─────────────────────────────┬────────────────┬───────────┬──────────┐");
console.log("│ Modelo                      │ MAE (ARS)      │ WAPE (%)  │ MASE     │");
console.log("├─────────────────────────────┼────────────────┼───────────┼──────────┤");
Object.values(bt.h1.metrics).forEach(m => {
    const namePad = m.name.padEnd(27);
    const maePad = `$ ${m.mae.toLocaleString('es-AR')}`.padStart(14);
    const wapePad = `${m.wape.toFixed(1)}%`.padStart(9);
    const masePad = `${m.mase.toFixed(2)}`.padStart(8);
    console.log(`│ ${namePad} │ ${maePad} │ ${wapePad} │ ${masePad} │`);
});
console.log("└─────────────────────────────┴────────────────┴───────────┴──────────┘");

console.log(`\n=== HORIZONTE h=2 (Pronóstico a 2 meses vista) — Cortes disponibles: ${bt.h2.cutsCount} ===`);
console.log("┌─────────────────────────────┬────────────────┬───────────┬──────────┐");
console.log("│ Modelo                      │ MAE (ARS)      │ WAPE (%)  │ MASE     │");
console.log("├─────────────────────────────┼────────────────┼───────────┼──────────┤");
Object.values(bt.h2.metrics).forEach(m => {
    const namePad = m.name.padEnd(27);
    const maePad = `$ ${m.mae.toLocaleString('es-AR')}`.padStart(14);
    const wapePad = `${m.wape.toFixed(1)}%`.padStart(9);
    const masePad = `${m.mase.toFixed(2)}`.padStart(8);
    console.log(`│ ${namePad} │ ${maePad} │ ${wapePad} │ ${masePad} │`);
});
console.log("└─────────────────────────────┴────────────────┴───────────┴──────────┘\n");

console.log("MATRIZ DETALLADA DE PREDICCIONES Y ERRORES POR CORTE (h=1):");
const modelsToInspect = ['naive', 'simple_mean', 'ses_fixed_33', 'ses_adaptive', 'linear_wma', 'holt_damped_ungated'];
modelsToInspect.forEach(mid => {
    const m = bt.h1.metrics[mid];
    console.log(`\n>> Modelo: ${m.name}`);
    m.predictions.forEach(p => {
        const targetLabel = monthLabels[p.targetIndex];
        console.log(`   Corte t=${p.originTime} -> Predicción para ${targetLabel}: Real = $ ${p.actual.toLocaleString('es-AR')} | Pred = $ ${p.predicted.toLocaleString('es-AR')} | Error Abs = $ ${p.absError.toLocaleString('es-AR')} | Escala Naive Causal = $ ${p.causalNaiveScale.toLocaleString('es-AR')} | Scaled Err = ${p.scaledError}`);
    });
});
console.log("");

// ------------------------------------------------------------------------------------------------
// 5. BANCO DE PRUEBAS EXTENDIDO (8 ESCENARIOS DE COMPORTAMIENTO FINANCIERO)
// ------------------------------------------------------------------------------------------------
console.log("5. BANCO DE PRUEBAS EXTENDIDO (SUITE DE 8 ESCENARIOS FINANCIEROS):");
console.log("========================================================================================");

const scenarios = [
    {
        name: "Escenario 1: Serie Real Auditada del Cliente (Volátil con cero intermitente, N=5)",
        series: [574577.28, 132021.89, 715822.54, 0.0, 492123.61]
    },
    {
        name: "Escenario 2: Serie Estable Estacionaria (Sin tendencia, N=10)",
        series: [400000, 410000, 395000, 405000, 402000, 398000, 403000, 401000, 404000, 400000]
    },
    {
        name: "Escenario 3: Serie Decreciente Continua (Contracción sostenida, N=10)",
        series: [600000, 560000, 520000, 490000, 450000, 420000, 380000, 350000, 320000, 290000]
    },
    {
        name: "Escenario 4: Serie de Alta Volatilidad Sin Tendencia (Ruido blanco financiero, N=10)",
        series: [100000, 800000, 200000, 750000, 150000, 900000, 300000, 600000, 250000, 700000]
    },
    {
        name: "Escenario 5: Serie Intermitente / Facturación por Hitos (Ceros recurrentes, N=10)",
        series: [350000, 0, 420000, 0, 0, 380000, 0, 500000, 0, 410000]
    },
    {
        name: "Escenario 6: Notas de Crédito Superiores a Facturación (Saldos netos negativos, N=6)",
        series: [200000, 150000, -50000, 300000, -20000, 250000]
    },
    {
        name: "Escenario 7: Huecos de Registro con Reinicio de Operaciones (N=6)",
        series: [300000, 320000, 0, 0, 280000, 310000]
    },
    {
        name: "Escenario 8: Quiebre Estructural / Salto Permanente de Nivel (N=10)",
        series: [200000, 210000, 195000, 205000, 200000, 600000, 620000, 590000, 610000, 630000]
    }
];

scenarios.forEach((sc, idx) => {
    console.log(`\n----------------------------------------------------------------------------------------`);
    console.log(`[TEST ${idx + 1}] ${sc.name}`);
    console.log(`Valores: [${sc.series.map(v => typeof v === 'number' ? `$ ${v.toLocaleString('es-AR')}` : v).join(', ')}]`);

    const sel = selectAdaptiveModel(sc.series);
    const meanRes = runSimpleMean(sc.series);
    const holtRes = runHoltDampedTrend(sc.series, { enforceGate: false });
    const sesRes = runSES(sc.series, 0.33);

    console.log(`-> Modelo seleccionado: ${sel.selectedName}`);
    console.log(`-> Justificación: ${sel.reason}`);
    console.log(`-> Pronósticos emitidos: h=1: $ ${sel.forecast[0].toLocaleString('es-AR')} | h=2: $ ${sel.forecast[1].toLocaleString('es-AR')}`);
    console.log(`-> Comparativa de salidas h=1: SMA = $ ${meanRes.forecast[0].toLocaleString('es-AR')} | SES (0.33) = $ ${sesRes.forecast[0].toLocaleString('es-AR')} | Holt Sin Gate = $ ${holtRes.forecast[0].toLocaleString('es-AR')}`);

    if (sc.series.length >= 4) {
        const btScenario = runTemporalBacktest(sc.series, Math.min(3, sc.series.length - 2));
        if (btScenario.h1) {
            console.log(`-> WAPE Backtest h=1: SMA = ${btScenario.h1.metrics.simple_mean.wape}% | Naive = ${btScenario.h1.metrics.naive.wape}% | SES Fijo = ${btScenario.h1.metrics.ses_fixed_33.wape}% | Holt Sin Gate = ${btScenario.h1.metrics.holt_damped_ungated.wape}%`);
            const holtBeatsSMA = btScenario.h1.metrics.holt_damped_ungated.wape < btScenario.h1.metrics.simple_mean.wape;
            console.log(`-> ¿Holt supera a Media Simple?: ${holtBeatsSMA ? 'SÍ' : 'NO (Media Simple es superior o más robusta)'}`);
        }
    }
});

console.log("\n========================================================================================");
console.log("FIN DE LA SUITE DE AUDITORÍA Y VALIDACIÓN CRUZADA");
console.log("========================================================================================");
