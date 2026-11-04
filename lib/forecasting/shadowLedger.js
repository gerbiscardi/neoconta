import fs from 'fs/promises';
import path from 'path';
import { 
    runSimpleMean, 
    runHistoricalMedian, 
    runLinearWMA, 
    runSES, 
    runHoltDampedTrend, 
    runNaive 
} from './engine';

const LEDGER_DIR = path.join(process.cwd(), 'data', 'forecasting_ledger');

async function ensureLedgerDir() {
    try {
        await fs.mkdir(LEDGER_DIR, { recursive: true });
    } catch (e) {
        // ignore if exists
    }
}

function getLedgerFilePath(userId) {
    const safeUser = String(userId).replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(LEDGER_DIR, `${safeUser}_ledger.json`);
}

/**
 * Registra en modo shadow las predicciones de todos los modelos antes del cierre mensual.
 */
export async function recordShadowForecasts({ userId, seriesValues, targetMonthKey, emissionDate = new Date().toISOString() }) {
    await ensureLedgerDir();
    const filePath = getLedgerFilePath(userId);

    let ledger = [];
    try {
        const fileContent = await fs.readFile(filePath, 'utf8');
        ledger = JSON.parse(fileContent);
    } catch (e) {
        ledger = [];
    }

    const n = seriesValues.length;
    const modelsToRecord = [
        { id: 'naive', name: 'Naive (Persistencia)', exec: () => runNaive(seriesValues) },
        { id: 'simple_mean', name: 'Media Simple Continua', exec: () => runSimpleMean(seriesValues) },
        { id: 'historical_median', name: 'Mediana Histórica', exec: () => runHistoricalMedian(seriesValues) },
        { id: 'linear_wma', name: 'WMA Lineal', exec: () => runLinearWMA(seriesValues) },
        { id: 'ses_fixed_33', name: 'SES Fijo (α=0.33)', exec: () => runSES(seriesValues, 0.33) },
        { id: 'ses_adaptive', name: 'SES Adaptativo (α=2/(N+1))', exec: () => runSES(seriesValues, null) },
        { id: 'holt_damped_gated', name: 'Holt Damped (Gate N>=6)', exec: () => runHoltDampedTrend(seriesValues, { enforceGate: true, minHistoryForTrend: 6 }) },
        { id: 'holt_damped_ungated', name: 'Holt Damped (Sin Gate)', exec: () => runHoltDampedTrend(seriesValues, { enforceGate: false }) }
    ];

    const newEntries = [];

    modelsToRecord.forEach(m => {
        const res = m.exec();
        // Registrar para horizonte h=1 (targetMonthKey)
        const recordIdH1 = `${userId}_${targetMonthKey}_h1_${m.id}`;
        const existingIdxH1 = ledger.findIndex(e => e.id === recordIdH1);

        const entryH1 = {
            id: recordIdH1,
            userId,
            emissionDate,
            trainingObservationsCount: n,
            targetMonthKey,
            horizon: 1,
            modelId: m.id,
            modelName: m.name,
            rawForecast: res.rawForecast ? res.rawForecast[0] : res.forecast[0],
            forecast: res.forecast[0],
            parameters: res.components || {},
            formula: res.formula || '',
            actualObserved: null,
            error: null,
            absError: null,
            status: 'pending_closure'
        };

        if (existingIdxH1 >= 0) {
            // Actualizar si aún no está cerrado
            if (ledger[existingIdxH1].status === 'pending_closure') {
                ledger[existingIdxH1] = { ...ledger[existingIdxH1], ...entryH1 };
            }
        } else {
            ledger.push(entryH1);
            newEntries.push(entryH1);
        }
    });

    await fs.writeFile(filePath, JSON.stringify(ledger, null, 2), 'utf8');
    return { success: true, recordedCount: newEntries.length, totalEntries: ledger.length };
}

/**
 * Cierra un mes observado en el ledger y evalúa el error real de cada modelo.
 */
export async function closeObservedMonthInLedger({ userId, targetMonthKey, actualNetInvoiced }) {
    await ensureLedgerDir();
    const filePath = getLedgerFilePath(userId);

    let ledger = [];
    try {
        const fileContent = await fs.readFile(filePath, 'utf8');
        ledger = JSON.parse(fileContent);
    } catch (e) {
        return { success: false, error: 'Ledger no encontrado' };
    }

    let updatedCount = 0;
    ledger.forEach(entry => {
        if (entry.targetMonthKey === targetMonthKey && entry.status === 'pending_closure') {
            const err = actualNetInvoiced - entry.rawForecast;
            entry.actualObserved = actualNetInvoiced;
            entry.error = Math.round(err * 100) / 100;
            entry.absError = Math.round(Math.abs(err) * 100) / 100;
            entry.status = 'closed_evaluated';
            entry.evaluatedAt = new Date().toISOString();
            updatedCount++;
        }
    });

    await fs.writeFile(filePath, JSON.stringify(ledger, null, 2), 'utf8');
    return { success: true, updatedCount };
}

/**
 * Consulta el historial del shadow ledger protegido para el usuario.
 */
export async function getShadowLedger(userId) {
    await ensureLedgerDir();
    const filePath = getLedgerFilePath(userId);
    try {
        const fileContent = await fs.readFile(filePath, 'utf8');
        return JSON.parse(fileContent);
    } catch (e) {
        return [];
    }
}
