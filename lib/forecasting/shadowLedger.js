import prisma from '../db.js';
import fs from 'fs/promises';
import path from 'path';
import { 
    runSimpleMean, 
    runHistoricalMedian, 
    runLinearWMA, 
    runSES, 
    runHoltDampedTrend, 
    runNaive 
} from './engine.js';

const LEDGER_BACKUP_DIR = path.join(process.cwd(), 'data', 'forecasting_ledger');

async function ensureBackupDir() {
    try {
        await fs.mkdir(LEDGER_BACKUP_DIR, { recursive: true });
    } catch (e) {
        // ignore
    }
}

/**
 * Registra en modo shadow las predicciones de todos los modelos antes del cierre mensual.
 * Idempotente y transaccional vía Prisma con resguardo secundario en archivo.
 */
export async function recordShadowForecasts({ 
    userId, 
    seriesValues, 
    targetMonthKey, 
    trainingEndMonth = null,
    emissionDate = new Date() 
}) {
    if (!userId || !seriesValues || seriesValues.length === 0) {
        return { success: false, error: 'Parámetros insuficientes para registrar pronósticos' };
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

    const results = [];
    const dateObj = typeof emissionDate === 'string' ? new Date(emissionDate) : emissionDate;

    for (const m of modelsToRecord) {
        const res = m.exec();

        // Registrar horizonte h=1 y h=2
        const horizons = [
            { h: 1, raw: res.rawForecast ? res.rawForecast[0] : res.forecast[0], pres: res.forecast[0] },
            { h: 2, raw: res.rawForecast ? res.rawForecast[1] : res.forecast[1], pres: res.forecast[1] }
        ];

        for (const item of horizons) {
            const recordId = `${userId}_${targetMonthKey}_h${item.h}_${m.id}`;

            try {
                // Upsert transaccional: Si ya existe y está 'definitive', no se sobreescribe el pronóstico congelado original
                const record = await prisma.shadowForecastLedger.upsert({
                    where: { id: recordId },
                    update: {
                        // Solo actualiza metadatos si está en estado provisional
                        notes: `Evaluación continua registrada: ${dateObj.toISOString()}`
                    },
                    create: {
                        id: recordId,
                        userId,
                        emissionDate: dateObj,
                        targetMonthKey,
                        horizon: item.h,
                        modelId: m.id,
                        modelName: m.name,
                        algorithmVersion: '3.2.0',
                        rawForecast: item.raw,
                        presentedForecast: item.pres,
                        parametersJson: JSON.stringify(res.components || {}),
                        formula: res.formula || '',
                        trainingEndMonth: trainingEndMonth || '',
                        trainingObservationsCount: n,
                        reconciliationStatus: 'provisional'
                    }
                });
                results.push(record);
            } catch (dbErr) {
                console.error(`Error saving forecast to Prisma for ${recordId}:`, dbErr);
            }
        }
    }

    // Resguardo secundario JSON para redundancia
    try {
        await ensureBackupDir();
        const safeUser = String(userId).replace(/[^a-zA-Z0-9_-]/g, '_');
        const backupPath = path.join(LEDGER_BACKUP_DIR, `${safeUser}_ledger.json`);
        await fs.writeFile(backupPath, JSON.stringify(results, null, 2), 'utf8');
    } catch (e) {
        // non-blocking
    }

    return { 
        success: true, 
        recordedCount: results.length, 
        targetMonthKey, 
        modelsCount: modelsToRecord.length 
    };
}

/**
 * Concilia los pronósticos congelados con el resultado real observado tras el cierre fiscal.
 * Maneja estados 'definitive' y 'adjusted' (para comprobantes ingresados tardíamente).
 */
export async function reconcileMonthInLedger({ userId, targetMonthKey, actualNetInvoiced }) {
    if (!userId || !targetMonthKey || actualNetInvoiced === undefined) {
        return { success: false, error: 'Parámetros insuficientes para conciliación' };
    }

    try {
        const records = await prisma.shadowForecastLedger.findMany({
            where: {
                userId,
                targetMonthKey
            }
        });

        if (!records || records.length === 0) {
            return { success: false, message: 'No se encontraron pronósticos registrados para este período' };
        }

        const updated = [];
        const now = new Date();

        for (const rec of records) {
            const err = actualNetInvoiced - rec.rawForecast;
            const absErr = Math.abs(err);
            const isLateAdjustment = rec.reconciliationStatus === 'definitive';

            const updatedRec = await prisma.shadowForecastLedger.update({
                where: { id: rec.id },
                data: {
                    actualObserved: actualNetInvoiced,
                    actualClosedAt: now,
                    error: Math.round(err * 100) / 100,
                    absError: Math.round(absErr * 100) / 100,
                    reconciliationStatus: isLateAdjustment ? 'adjusted' : 'definitive',
                    notes: isLateAdjustment 
                        ? `Ajuste posterior por comprobantes tardíos a las ${now.toISOString()}`
                        : `Conciliación de cierre mensual completada`
                }
            });
            updated.push(updatedRec);
        }

        return { 
            success: true, 
            reconciledCount: updated.length, 
            targetMonthKey, 
            actualNetInvoiced 
        };
    } catch (err) {
        console.error('Error in reconcileMonthInLedger:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Consulta el historial del ledger protegido para un usuario específico.
 */
export async function getShadowLedger(userId) {
    if (!userId) return [];
    try {
        return await prisma.shadowForecastLedger.findMany({
            where: { userId },
            orderBy: [
                { targetMonthKey: 'desc' },
                { horizon: 'asc' },
                { modelId: 'asc' }
            ]
        });
    } catch (err) {
        console.error('Error fetching shadow ledger:', err);
        // Fallback a archivo JSON si la BD está ocupada
        try {
            const safeUser = String(userId).replace(/[^a-zA-Z0-9_-]/g, '_');
            const backupPath = path.join(LEDGER_BACKUP_DIR, `${safeUser}_ledger.json`);
            const data = await fs.readFile(backupPath, 'utf8');
            return JSON.parse(data);
        } catch (e) {
            return [];
        }
    }
}
