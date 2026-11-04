/**
 * NeoConta Financial Forecasting Engine (Motor Adaptativo de Pronósticos)
 * Módulo de modelado temporal financiero con explicabilidad matemática completa.
 *
 * Modelos implementados:
 * 1. Simple Mean (Media Aritmética Continua)
 * 2. Historical Median (Mediana Histórica Robusta)
 * 3. Linear WMA (Media Móvil Ponderada Lineal)
 * 4. Simple Exponential Smoothing / SES (EMA)
 * 5. Holt Linear with Damped Trend (EMA + Trend Drift Amortiguado)
 */

// Helper para redondear a 2 decimales
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
        name: 'Media Simple Continua (Modelo de Referencia Activo)',
        forecast: [round2(mean), round2(mean)],
        components: {
            observationsCount: n,
            totalSum: round2(sum),
            mean: round2(mean),
            weightType: 'uniforme',
            uniformWeight: round2(1 / n),
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
        const w = idx + 1; // Ponderación lineal 1, 2, ..., n
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
            weightType: 'lineal_creciente',
            weights
        },
        formula: `WMA = (Σ i · y_i) / (Σ i) = ${round2(weightedSum).toLocaleString('es-AR')} / ${sumWeights} = ${round2(wma).toLocaleString('es-AR')}`,
        caveats: ['Asigna linealmente mayor importancia a meses recientes, pero con horizonte plano.']
    };
}

// 4. MODELO: Suavizado Exponencial Simple (SES / EMA)
export function runSES(series, alpha = null) {
    if (!series || series.length === 0) {
        return { forecast: [0, 0], model: 'ses_ema', name: 'Suavizado Exponencial Simple (EMA)', components: {} };
    }
    const n = series.length;
    // Si no se especifica alpha, usar la regla estándar de EMA: 2 / (N + 1)
    const effectiveAlpha = alpha !== null ? alpha : round2(2 / (n + 1));

    // Inicialización: nivel inicial l_0 = y_0
    let level = series[0];
    const levelsHistory = [{ step: 1, y: round2(series[0]), level: round2(level) }];

    for (let t = 1; t < n; t++) {
        level = effectiveAlpha * series[t] + (1 - effectiveAlpha) * level;
        levelsHistory.push({ step: t + 1, y: round2(series[t]), level: round2(level) });
    }

    const forecast = round2(Math.max(0, level));

    return {
        model: 'ses_ema',
        name: 'Suavizado Exponencial Simple (EMA)',
        forecast: [forecast, forecast],
        components: {
            observationsCount: n,
            alpha: effectiveAlpha,
            initialLevel: round2(series[0]),
            finalLevel: round2(level),
            levelsHistory
        },
        formula: `Nivel actual l_t = α · y_t + (1 - α) · l_{t-1} con α = ${effectiveAlpha} → ${forecast.toLocaleString('es-AR')}`,
        caveats: ['Decaimiento exponencial de la memoria histórica. Horizonte plano sin pendiente.']
    };
}

// 5. MODELO: Holt Linear with Damped Trend (EMA + Trend Drift Amortiguado)
export function runHoltDampedTrend(series, options = {}) {
    if (!series || series.length === 0) {
        return { forecast: [0, 0], model: 'holt_damped', name: 'EMA + Trend Drift Amortiguado', components: {} };
    }

    const n = series.length;
    const {
        alpha = 0.30,       // Suavizado del nivel
        beta = 0.15,        // Suavizado de la tendencia
        phi = 0.85,         // Factor de amortiguación (damping)
        minHistoryForTrend = 6 // Requisito mínimo para habilitar deriva de tendencia
    } = options;

    // Regla de salvaguarda metodológica: Si la serie es menor a minHistoryForTrend,
    // la tendencia se neutraliza para no sobreajustar ruido o caídas puntuales.
    const isTrendActive = n >= minHistoryForTrend;

    // Inicialización estándar de Holt:
    // l_1 = y_1, b_1 = y_1 - y_0
    let level = series.length > 1 ? series[1] : series[0];
    let trend = series.length > 1 ? (series[1] - series[0]) : 0;

    if (!isTrendActive) {
        trend = 0; // Neutralizada por historial insuficiente
    }

    const history = [
        { step: 1, y: round2(series[0]), level: round2(series[0]), trend: 0 },
        { step: 2, y: round2(series[1] || 0), level: round2(level), trend: round2(trend) }
    ];

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

    // Pronósticos multi-horizonte con amortiguación:
    // h=1: l_n + phi · b_n
    // h=2: l_n + (phi + phi^2) · b_n
    const h1Drift = isTrendActive ? (phi * trend) : 0;
    const h2Drift = isTrendActive ? ((phi + Math.pow(phi, 2)) * trend) : 0;

    const forecastH1 = round2(Math.max(0, level + h1Drift));
    const forecastH2 = round2(Math.max(0, level + h2Drift));

    return {
        model: 'holt_damped',
        name: 'EMA + Trend Drift Amortiguado (Damped Holt)',
        forecast: [forecastH1, forecastH2],
        components: {
            observationsCount: n,
            alpha,
            beta,
            phi,
            isTrendActive,
            minHistoryForTrend,
            finalLevel: round2(level),
            finalTrend: round2(trend),
            trendDriftH1: round2(h1Drift),
            trendDriftH2: round2(h2Drift),
            history
        },
        formula: isTrendActive
            ? `h=1: l_n + φ·b_n = ${round2(level).toLocaleString('es-AR')} + (${round2(h1Drift).toLocaleString('es-AR')}) = ${forecastH1.toLocaleString('es-AR')}`
            : `Tendencia neutralizada (b_n = 0) por N = ${n} < ${minHistoryForTrend}. Nivel suavizado: ${round2(level).toLocaleString('es-AR')}`,
        caveats: [
            !isTrendActive 
                ? `Historial insuficiente (${n} meses < ${minHistoryForTrend} meses requeridos). La deriva de tendencia se desactiva automáticamente para evitar sobredispersión.`
                : `Factor de amortiguación φ = ${phi} limita el crecimiento asintótico a un techo finito, evitando divergencias explosivas.`
        ]
    };
}

// 6. SUITE DE VALIDACIÓN CRONOLÓGICA (BACKTESTING TEMPORAL)
export function runTemporalBacktest(series, minTrain = 2) {
    if (!series || series.length <= minTrain) {
        return { error: 'Serie demasiado corta para validación temporal cruzada.' };
    }

    const n = series.length;
    const models = [
        { id: 'simple_mean', name: 'Media Simple', fn: (train) => runSimpleMean(train).forecast[0] },
        { id: 'historical_median', name: 'Mediana Histórica', fn: (train) => runHistoricalMedian(train).forecast[0] },
        { id: 'linear_wma', name: 'WMA Lineal', fn: (train) => runLinearWMA(train).forecast[0] },
        { id: 'ses_ema', name: 'EMA / SES', fn: (train) => runSES(train).forecast[0] },
        { id: 'holt_damped', name: 'EMA + Trend Drift', fn: (train) => runHoltDampedTrend(train, { minHistoryForTrend: 4 }).forecast[0] }
    ];

    const results = {};
    models.forEach(m => {
        results[m.id] = {
            id: m.id,
            name: m.name,
            predictions: [],
            errors: [],
            absErrors: [],
            totalActual: 0,
            mae: 0,
            wape: 0,
            mase: 0
        };
    });

    // Calcular escala para MASE (error medio absoluto del modelo ingenuo t vs t-1 sobre la serie histórica disponible)
    let naiveDiffSum = 0;
    for (let i = 1; i < n; i++) {
        naiveDiffSum += Math.abs(series[i] - series[i - 1]);
    }
    const naiveScale = naiveDiffSum / (n - 1) || 1;

    // Rolling Origin Backtesting (h=1)
    for (let t = minTrain; t < n; t++) {
        const train = series.slice(0, t);
        const actual = series[t];

        models.forEach(m => {
            const pred = m.fn(train);
            const err = actual - pred;
            const absErr = Math.abs(err);

            results[m.id].predictions.push({ t, trainLength: t, actual, predicted: round2(pred), absErr: round2(absErr) });
            results[m.id].absErrors.push(absErr);
            results[m.id].totalActual += actual;
        });
    }

    // Calcular métricas agregadas
    const testPointsCount = n - minTrain;
    models.forEach(m => {
        const res = results[m.id];
        const sumAbs = res.absErrors.reduce((acc, v) => acc + v, 0);
        res.mae = round2(sumAbs / testPointsCount);
        res.wape = res.totalActual > 0 ? round2((sumAbs / res.totalActual) * 100) : 0;
        res.mase = round2(res.mae / naiveScale);
    });

    return {
        testPointsCount,
        naiveScale: round2(naiveScale),
        models: results
    };
}

// 7. MECANISMO DE SELECCIÓN ADAPTATIVA Y AUDITORÍA
export function selectAdaptiveModel(series, metadata = {}) {
    const n = series ? series.length : 0;

    // Fallbacks defensivos
    if (n === 0) {
        return {
            selectedModel: 'fallback_zero',
            reason: 'Serie temporal vacía. Fallback seguro a 0.',
            forecast: [0, 0],
            confidenceStatus: 'Sin datos'
        };
    }

    if (n < 6) {
        // Para series con menos de 6 meses cerrados, la Media Simple Continua es el estimador con menor varianza muestral
        const baseline = runSimpleMean(series);
        return {
            selectedModel: 'simple_mean',
            selectedName: 'Media Simple Continua (Modelo Base)',
            forecast: baseline.forecast,
            reason: `Historial de ${n} meses cerrados (< 6 requeridos para modelos autorregresivos). Se selecciona la Media Simple Continua por prudencia financiera.`,
            confidenceStatus: `Historial limitado (${n} meses)`,
            isExperimental: false,
            details: baseline
        };
    }

    // Si n >= 6, ejecutar backtest y seleccionar según menor WAPE
    const backtest = runTemporalBacktest(series, 4);
    let bestModel = 'simple_mean';
    let minWape = Infinity;

    Object.values(backtest.models).forEach(m => {
        if (m.wape < minWape) {
            minWape = m.wape;
            bestModel = m.id;
        }
    });

    let execution;
    if (bestModel === 'holt_damped') {
        execution = runHoltDampedTrend(series);
    } else if (bestModel === 'ses_ema') {
        execution = runSES(series);
    } else if (bestModel === 'linear_wma') {
        execution = runLinearWMA(series);
    } else {
        execution = runSimpleMean(series);
    }

    return {
        selectedModel: bestModel,
        selectedName: execution.name,
        forecast: execution.forecast,
        reason: `Selección adaptativa basada en menor error de validación temporal (WAPE = ${minWape}% sobre ${backtest.testPointsCount} cortes históricos).`,
        confidenceStatus: 'Validado adaptativamente',
        isExperimental: true,
        backtestSummary: backtest,
        details: execution
    };
}
