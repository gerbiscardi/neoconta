/**
 * NeoConta Financial Forecasting Engine (Motor Adaptativo de Pronósticos)
 * Versión 3.1 - Arquitectura Rigurosa, Causal y Totalmente Explicable
 *
 * Modelos implementados:
 * 1. Simple Mean (Media Aritmética Continua)
 * 2. Historical Median (Mediana Histórica Robusta)
 * 3. Linear WMA (Media Móvil Ponderada Lineal)
 * 4. SES Fixed (Suavizado Exponencial Simple con α fijo = 0.33)
 * 5. SES Adaptive (Suavizado Exponencial con α adaptativo = 2/(t+1))
 * 6. Holt Damped Gated (EMA + Trend Drift con salvaguarda N >= 6)
 * 7. Holt Damped Unconstrained (EMA + Trend Drift sin salvaguarda de tendencia)
 * 8. Naive 1 (Modelo Ingenuo de Persistencia: y_{t+h|t} = y_t)
 */

const round2 = (val) => Math.round((val + Number.EPSILON) * 100) / 100;

// 1. MODELO: Media Simple Continua (SMA)
export function runSimpleMean(series) {
    if (!series || series.length === 0) {
        return { forecast: [0, 0], model: 'simple_mean', name: 'Media Simple Continua', components: {} };
    }
    const n = series.length;
    const sum = series.reduce((acc, v) => acc + v, 0);
    const mean = sum / n;
    const weights = series.map(() => round2(1 / n));

    return {
        model: 'simple_mean',
        name: 'Media Simple Continua',
        forecast: [round2(mean), round2(mean)],
        components: {
            observationsCount: n,
            totalSum: round2(sum),
            mean: round2(mean),
            weights
        },
        formula: `Proyección = (Σ y_i) / N = ${round2(sum).toLocaleString('es-AR')} / ${n} = ${round2(mean).toLocaleString('es-AR')}`,
        caveats: n < 12 ? ['Historial < 12 meses: no permite estimar estacionalidad anual.'] : []
    };
}

// 2. MODELO: Mediana Histórica Robusta
export function runHistoricalMedian(series) {
    if (!series || series.length === 0) {
        return { forecast: [0, 0], model: 'historical_median', name: 'Mediana Histórica', components: {} };
    }
    const n = series.length;
    const sorted = [...series].sort((a, b) => a - b);
    let median = 0;
    if (n % 2 === 1) {
        median = sorted[Math.floor(n / 2)];
    } else {
        median = (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    }

    return {
        model: 'historical_median',
        name: 'Mediana Histórica Robusta',
        forecast: [round2(median), round2(median)],
        components: {
            observationsCount: n,
            sortedValues: sorted.map(round2),
            median: round2(median),
            min: round2(sorted[0]),
            max: round2(sorted[n - 1])
        },
        formula: `Mediana = valor central de la serie ordenada: ${round2(median).toLocaleString('es-AR')}`,
        caveats: ['Insensible a valores atípicos extremos, pero no captura tendencias crecientes.']
    };
}

// 3. MODELO: Media Móvil Ponderada Lineal (Linear WMA)
export function runLinearWMA(series) {
    if (!series || series.length === 0) {
        return { forecast: [0, 0], model: 'linear_wma', name: 'Media Móvil Ponderada Lineal', components: {} };
    }
    const n = series.length;
    const sumWeights = (n * (n + 1)) / 2;
    let weightedSum = 0;
    const weights = [];

    series.forEach((val, idx) => {
        const w = idx + 1;
        const normalizedWeight = w / sumWeights;
        weights.push({ index: idx + 1, rawWeight: w, normalizedWeight: round2(normalizedWeight) });
        weightedSum += val * w;
    });

    const wma = weightedSum / sumWeights;

    return {
        model: 'linear_wma',
        name: 'Media Móvil Ponderada Lineal (WMA)',
        forecast: [round2(wma), round2(wma)],
        components: {
            observationsCount: n,
            sumWeights,
            weightedSum: round2(weightedSum),
            wma: round2(wma),
            weights
        },
        formula: `WMA = (Σ i · y_i) / (Σ i) = ${round2(weightedSum).toLocaleString('es-AR')} / ${sumWeights} = ${round2(wma).toLocaleString('es-AR')}`,
        caveats: ['Ponderación linealmente creciente hacia los datos recientes. Horizonte plano para h >= 1.']
    };
}

// 4. MODELO: Suavizado Exponencial Simple (SES) con Parámetro Fijo o Adaptativo
export function runSES(series, fixedAlpha = null) {
    if (!series || series.length === 0) {
        return { forecast: [0, 0], model: 'ses_ema', name: 'Suavizado Exponencial Simple', components: {} };
    }
    const n = series.length;
    const isFixed = fixedAlpha !== null;
    const alpha = isFixed ? fixedAlpha : round2(2 / (n + 1));

    // Inicialización clásica: l_1 = y_1
    let level = series[0];
    const levelsHistory = [{ step: 1, y: round2(series[0]), level: round2(level) }];

    for (let t = 1; t < n; t++) {
        level = alpha * series[t] + (1 - alpha) * level;
        levelsHistory.push({ step: t + 1, y: round2(series[t]), level: round2(level) });
    }

    const forecastVal = round2(Math.max(0, level));

    return {
        model: isFixed ? `ses_fixed_${Math.round(alpha * 100)}` : 'ses_adaptive',
        name: isFixed ? `SES / EMA Fijo (α=${alpha})` : `SES / EMA Adaptativo (α=2/(N+1)=${alpha})`,
        forecast: [forecastVal, forecastVal],
        components: {
            observationsCount: n,
            alphaType: isFixed ? 'fijo' : 'adaptativo',
            alpha,
            initialLevel: round2(series[0]),
            finalLevel: round2(level),
            levelsHistory
        },
        formula: `l_t = α · y_t + (1 - α) · l_{t-1} con α = ${alpha} → l_${n} = ${forecastVal.toLocaleString('es-AR')}`,
        caveats: ['Memoria con decaimiento exponencial geométrico. Horizonte plano para h >= 1.']
    };
}

// 5. MODELO: Holt Lineal con Tendencia Amortiguada (Damped Trend)
export function runHoltDampedTrend(series, options = {}) {
    if (!series || series.length === 0) {
        return { forecast: [0, 0], model: 'holt_damped', name: 'EMA + Trend Drift Amortiguado', components: {} };
    }

    const n = series.length;
    const {
        alpha = 0.30,
        beta = 0.15,
        phi = 0.85,
        enforceGate = true,
        minHistoryForTrend = 6
    } = options;

    const isTrendActive = enforceGate ? (n >= minHistoryForTrend) : (n >= 2);

    // Inicialización estándar de Holt:
    // l_1 = y_0 (o l_2 = y_1), b_1 = y_1 - y_0
    let level = series[0];
    let trend = series.length > 1 ? (series[1] - series[0]) : 0;

    if (!isTrendActive) {
        trend = 0; // Neutralizada por salvaguarda
    }

    const history = [
        { step: 1, y: round2(series[0]), level: round2(series[0]), trend: round2(trend) }
    ];

    if (series.length > 1) {
        level = series[1];
        history.push({ step: 2, y: round2(series[1]), level: round2(level), trend: round2(trend) });
    }

    for (let t = 2; t < n; t++) {
        const y = series[t];
        const prevLevel = level;
        const prevTrend = trend;

        const effectivePhi = isTrendActive ? phi : 0;
        level = alpha * y + (1 - alpha) * (prevLevel + effectivePhi * prevTrend);

        if (isTrendActive) {
            trend = beta * (level - prevLevel) + (1 - beta) * effectivePhi * prevTrend;
        } else {
            trend = 0;
        }

        history.push({
            step: t + 1,
            y: round2(y),
            level: round2(level),
            trend: round2(trend)
        });
    }

    // Pronósticos multi-horizonte con factor de amortiguación:
    // h=1: l_n + phi · b_n
    // h=2: l_n + (phi + phi^2) · b_n
    const h1Multiplier = isTrendActive ? phi : 0;
    const h2Multiplier = isTrendActive ? (phi + Math.pow(phi, 2)) : 0;

    const h1Drift = h1Multiplier * trend;
    const h2Drift = h2Multiplier * trend;

    const forecastH1 = round2(Math.max(0, level + h1Drift));
    const forecastH2 = round2(Math.max(0, level + h2Drift));

    return {
        model: enforceGate ? 'holt_damped_gated' : 'holt_damped_unconstrained',
        name: enforceGate 
            ? `EMA + Trend Drift Amortiguado (Gate N>=${minHistoryForTrend}: ${isTrendActive ? 'Activo' : 'Neutralizado'})`
            : `EMA + Trend Drift Amortiguado (Sin Gate, b_n libre)`,
        forecast: [forecastH1, forecastH2],
        components: {
            observationsCount: n,
            alpha,
            beta,
            phi,
            enforceGate,
            isTrendActive,
            minHistoryForTrend,
            finalLevel: round2(level),
            finalTrend: round2(trend),
            h1Multiplier: round2(h1Multiplier),
            h2Multiplier: round2(h2Multiplier),
            trendDriftH1: round2(h1Drift),
            trendDriftH2: round2(h2Drift),
            history
        },
        formula: isTrendActive
            ? `h=1: l_n + φ·b_n = ${round2(level).toLocaleString('es-AR')} + (${round2(h1Drift).toLocaleString('es-AR')}) = ${forecastH1.toLocaleString('es-AR')} | h=2: l_n + (φ+φ²)·b_n = ${forecastH2.toLocaleString('es-AR')}`
            : `Tendencia neutralizada (b_n = 0) por N = ${n} < ${minHistoryForTrend}. Nivel: ${round2(level).toLocaleString('es-AR')}`,
        caveats: [
            !isTrendActive 
                ? `Tendencia neutralizada: N = ${n} < ${minHistoryForTrend}. Se proyecta nivel plano para evitar sobredispersión.`
                : `Amortiguación φ = ${phi} garantiza límite finito en la deriva (techo asintótico = ${round2(trend * phi / (1 - phi)).toLocaleString('es-AR')}).`
        ]
    };
}

// 6. MODELO: Naive 1 (Modelo Ingenuo de Persistencia)
export function runNaive(series) {
    if (!series || series.length === 0) {
        return { forecast: [0, 0], model: 'naive', name: 'Modelo Ingenuo (Persistencia)', components: {} };
    }
    const lastVal = series[series.length - 1];
    return {
        model: 'naive',
        name: 'Modelo Ingenuo (Persistencia: y_{t+h} = y_t)',
        forecast: [round2(lastVal), round2(lastVal)],
        components: {
            observationsCount: series.length,
            lastObservedValue: round2(lastVal)
        },
        formula: `y_{t+h|t} = y_t = ${round2(lastVal).toLocaleString('es-AR')}`,
        caveats: ['Benchmark basal de referencia estandarizado en forecasting temporal.']
    };
}

// 7. SUITE DE VALIDACIÓN CRONOLÓGICA (BACKTESTING TEMPORAL SEPARADO POR HORIZONTE h=1 y h=2)
export function runTemporalBacktest(series, minTrain = 2) {
    if (!series || series.length <= minTrain) {
        return { error: 'Serie demasiado corta para validación temporal.' };
    }

    const n = series.length;
    const modelDefinitions = [
        { id: 'naive', name: 'Naive (Persistencia)', fn: (train) => runNaive(train).forecast },
        { id: 'simple_mean', name: 'Media Simple', fn: (train) => runSimpleMean(train).forecast },
        { id: 'historical_median', name: 'Mediana Histórica', fn: (train) => runHistoricalMedian(train).forecast },
        { id: 'linear_wma', name: 'WMA Lineal', fn: (train) => runLinearWMA(train).forecast },
        { id: 'ses_fixed_33', name: 'SES Fijo (α=0.33)', fn: (train) => runSES(train, 0.33).forecast },
        { id: 'ses_adaptive', name: 'SES Adaptativo (α=2/(t+1))', fn: (train) => runSES(train, null).forecast },
        { id: 'holt_damped_gated', name: 'Holt Damped (Gate N>=6)', fn: (train) => runHoltDampedTrend(train, { enforceGate: true, minHistoryForTrend: 6 }).forecast },
        { id: 'holt_damped_ungated', name: 'Holt Damped (Sin Gate)', fn: (train) => runHoltDampedTrend(train, { enforceGate: false }).forecast }
    ];

    const resultsH1 = {};
    const resultsH2 = {};

    modelDefinitions.forEach(m => {
        resultsH1[m.id] = { id: m.id, name: m.name, predictions: [], absErrors: [], totalActual: 0, scaledErrors: [] };
        resultsH2[m.id] = { id: m.id, name: m.name, predictions: [], absErrors: [], totalActual: 0, scaledErrors: [] };
    });

    // 1. Evaluación de Horizonte h=1
    // Cortes donde t + 1 < n
    let cutsCountH1 = 0;
    for (let t = minTrain; t < n; t++) {
        cutsCountH1++;
        const train = series.slice(0, t);
        const actualH1 = series[t];

        // Escala Naive estrictamente causal calculada sobre el set de entrenamiento [0, t)
        let naiveDiffSum = 0;
        for (let i = 1; i < t; i++) {
            naiveDiffSum += Math.abs(train[i] - train[i - 1]);
        }
        const naiveScaleCausal = (t > 1 && naiveDiffSum > 0) ? (naiveDiffSum / (t - 1)) : (Math.abs(train[t - 1]) || 1);

        modelDefinitions.forEach(m => {
            const preds = m.fn(train);
            const predH1 = preds[0];
            const errH1 = actualH1 - predH1;
            const absErrH1 = Math.abs(errH1);
            const scaledErrH1 = absErrH1 / naiveScaleCausal;

            resultsH1[m.id].predictions.push({
                originTime: t,
                trainLength: t,
                targetIndex: t,
                actual: actualH1,
                predicted: round2(predH1),
                absError: round2(absErrH1),
                causalNaiveScale: round2(naiveScaleCausal),
                scaledError: round2(scaledErrH1)
            });
            resultsH1[m.id].absErrors.push(absErrH1);
            resultsH1[m.id].scaledErrors.push(scaledErrH1);
            resultsH1[m.id].totalActual += actualH1;
        });
    }

    // 2. Evaluación de Horizonte h=2
    // Cortes donde t + 2 <= n  ==> t <= n - 2
    let cutsCountH2 = 0;
    for (let t = minTrain; t <= n - 2; t++) {
        cutsCountH2++;
        const train = series.slice(0, t);
        const actualH2 = series[t + 1]; // Objetivo en t+2 (1-based: t+1)

        let naiveDiffSum = 0;
        for (let i = 1; i < t; i++) {
            naiveDiffSum += Math.abs(train[i] - train[i - 1]);
        }
        const naiveScaleCausal = (t > 1 && naiveDiffSum > 0) ? (naiveDiffSum / (t - 1)) : (Math.abs(train[t - 1]) || 1);

        modelDefinitions.forEach(m => {
            const preds = m.fn(train);
            const predH2 = preds[1]; // horizonte h=2
            const errH2 = actualH2 - predH2;
            const absErrH2 = Math.abs(errH2);
            const scaledErrH2 = absErrH2 / naiveScaleCausal;

            resultsH2[m.id].predictions.push({
                originTime: t,
                trainLength: t,
                targetIndex: t + 1,
                actual: actualH2,
                predicted: round2(predH2),
                absError: round2(absErrH2),
                causalNaiveScale: round2(naiveScaleCausal),
                scaledError: round2(scaledErrH2)
            });
            resultsH2[m.id].absErrors.push(absErrH2);
            resultsH2[m.id].scaledErrors.push(scaledErrH2);
            resultsH2[m.id].totalActual += actualH2;
        });
    }

    // Calcular MAE, WAPE y MASE agregados para cada horizonte
    const summaryH1 = {};
    modelDefinitions.forEach(m => {
        const res = resultsH1[m.id];
        const sumAbs = res.absErrors.reduce((a, b) => a + b, 0);
        const sumScaled = res.scaledErrors.reduce((a, b) => a + b, 0);
        summaryH1[m.id] = {
            id: m.id,
            name: m.name,
            mae: round2(sumAbs / cutsCountH1),
            wape: res.totalActual > 0 ? round2((sumAbs / res.totalActual) * 100) : 0,
            mase: round2(sumScaled / cutsCountH1),
            predictions: res.predictions
        };
    });

    const summaryH2 = {};
    modelDefinitions.forEach(m => {
        const res = resultsH2[m.id];
        const sumAbs = res.absErrors.reduce((a, b) => a + b, 0);
        const sumScaled = res.scaledErrors.reduce((a, b) => a + b, 0);
        summaryH2[m.id] = {
            id: m.id,
            name: m.name,
            mae: cutsCountH2 > 0 ? round2(sumAbs / cutsCountH2) : 0,
            wape: (cutsCountH2 > 0 && res.totalActual > 0) ? round2((sumAbs / res.totalActual) * 100) : 0,
            mase: cutsCountH2 > 0 ? round2(sumScaled / cutsCountH2) : 0,
            predictions: res.predictions
        };
    });

    return {
        seriesLength: n,
        h1: { cutsCount: cutsCountH1, metrics: summaryH1 },
        h2: { cutsCount: cutsCountH2, metrics: summaryH2 }
    };
}

// 8. MECANISMO DE SELECCIÓN ADAPTATIVA CON REGLAS AUDITABLES
export function selectAdaptiveModel(series, metadata = {}) {
    const n = series ? series.length : 0;

    // Clasificación de la actividad mensual
    const zeroCount = series.filter(v => v === 0).length;
    const negativeCount = series.filter(v => v < 0).length;
    const isIntermittent = zeroCount >= Math.floor(n * 0.3);

    // Salvaguarda 1: Sin datos
    if (n === 0) {
        return {
            selectedModel: 'fallback_zero',
            selectedName: 'Sin Datos (0)',
            forecast: [0, 0],
            confidenceStatus: 'Sin información',
            reason: 'La serie no contiene observaciones históricas registradas.'
        };
    }

    // Salvaguarda 2: Historial corto (< 6 meses)
    if (n < 6) {
        const baseline = runSimpleMean(series);
        return {
            selectedModel: 'simple_mean',
            selectedName: baseline.name,
            forecast: baseline.forecast,
            confidenceStatus: `Historial limitado (${n} meses)`,
            reason: `Historial de ${n} meses cerrados (< 6 requeridos para estabilidad de parámetros autorregresivos). Se selecciona Media Simple Continua por mínima varianza muestral.`,
            isExperimental: false,
            details: baseline
        };
    }

    // Si n >= 6, ejecutar validación cronológica y seleccionar según WAPE ponderado (70% h1, 30% h2)
    const backtest = runTemporalBacktest(series, 4);
    let bestModel = 'simple_mean';
    let bestScore = Infinity;

    Object.keys(backtest.h1.metrics).forEach(modelId => {
        // Excluir naive de la selección activa a menos que ningún modelo lo supere
        const wapeH1 = backtest.h1.metrics[modelId].wape;
        const wapeH2 = backtest.h2.metrics[modelId] ? backtest.h2.metrics[modelId].wape : wapeH1;
        const compositeWape = 0.70 * wapeH1 + 0.30 * wapeH2;

        if (compositeWape < bestScore) {
            bestScore = compositeWape;
            bestModel = modelId;
        }
    });

    // Mapear modelo seleccionado
    let execution;
    if (bestModel === 'holt_damped_gated' || bestModel === 'holt_damped_ungated') {
        execution = runHoltDampedTrend(series, { enforceGate: !isIntermittent });
    } else if (bestModel === 'ses_fixed_33' || bestModel === 'ses_adaptive') {
        execution = runSES(series, bestModel === 'ses_fixed_33' ? 0.33 : null);
    } else if (bestModel === 'linear_wma') {
        execution = runLinearWMA(series);
    } else if (bestModel === 'historical_median') {
        execution = runHistoricalMedian(series);
    } else {
        execution = runSimpleMean(series);
    }

    return {
        selectedModel: bestModel,
        selectedName: execution.name,
        forecast: execution.forecast,
        confidenceStatus: 'Validado adaptativamente',
        reason: `Selección adaptativa basada en menor WAPE temporal combinado (WAPE compuesto = ${round2(bestScore)}%).`,
        isExperimental: true,
        backtest,
        details: execution
    };
}
