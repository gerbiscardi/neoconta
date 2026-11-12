import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getUserDataDir, getInvoiceHistoryPath, writeJsonAtomic } from '../dataPaths.js';

// In-process per-tenant mutex queue + cross-process advisory lockfile with heartbeat & PID liveness check
const tenantLocks = new Map();
const LOCK_STALE_MS = 30000;
const LOCK_HEARTBEAT_MS = 5000;
const LOCK_ACQUIRE_TIMEOUT_MS = 15000;

function isPidAlive(pid) {
    if (!Number.isInteger(pid) || pid <= 0) return false;
    try {
        process.kill(pid, 0);
        return true;
    } catch (err) {
        return err.code === 'EPERM';
    }
}

async function acquireFileLock(lockPath) {
    await fs.mkdir(path.dirname(lockPath), { recursive: true });
    const deadline = Date.now() + LOCK_ACQUIRE_TIMEOUT_MS;

    while (true) {
        try {
            const handle = await fs.open(lockPath, 'wx');
            await handle.writeFile(JSON.stringify({ pid: process.pid, ts: Date.now() }), 'utf8');
            await handle.close();
            return;
        } catch (err) {
            if (err.code !== 'EEXIST') throw err;
            try {
                const stat = await fs.stat(lockPath);
                if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
                    let ownerAlive = false;
                    try {
                        const raw = await fs.readFile(lockPath, 'utf8');
                        const parsed = JSON.parse(raw);
                        ownerAlive = isPidAlive(Number(parsed?.pid));
                    } catch {
                        ownerAlive = false;
                    }
                    if (!ownerAlive) {
                        await fs.unlink(lockPath).catch(() => {});
                        continue;
                    }
                }
            } catch {
                continue;
            }
            if (Date.now() >= deadline) {
                throw new Error('Timeout esperando bloqueo de ingesta multi-proceso para el tenant.');
            }
            await new Promise((r) => setTimeout(r, 25 + Math.floor(Math.random() * 25)));
        }
    }
}

export async function withTenantIngestLock(tenantId, task) {
    const prev = tenantLocks.get(tenantId) || Promise.resolve();
    let release;
    const current = new Promise(resolve => {
        release = resolve;
    });
    const chained = prev.then(() => current);
    tenantLocks.set(tenantId, chained);

    await prev;
    const lockPath = path.join(getUserDataDir(tenantId), '.commander_ingest.lock');
    let fileLocked = false;
    let heartbeat = null;
    try {
        await acquireFileLock(lockPath);
        fileLocked = true;
        heartbeat = setInterval(() => {
            const now = new Date();
            fs.utimes(lockPath, now, now).catch(() => {});
        }, LOCK_HEARTBEAT_MS);
        if (typeof heartbeat.unref === 'function') heartbeat.unref();
        return await task();
    } finally {
        if (heartbeat) clearInterval(heartbeat);
        if (fileLocked) {
            await fs.unlink(lockPath).catch(() => {});
        }
        release();
        if (tenantLocks.get(tenantId) === chained) {
            tenantLocks.delete(tenantId);
        }
    }
}

async function readOptionalRaw(filePath) {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        return { existed: true, content };
    } catch (err) {
        if (err.code === 'ENOENT') return { existed: false, content: null };
        throw err;
    }
}

async function restoreSnapshot(filePath, snapshot) {
    if (!snapshot) return;
    if (snapshot.existed) {
        await writeJsonAtomic(filePath, snapshot.content);
        const verified = await fs.readFile(filePath, 'utf-8');
        if (verified !== snapshot.content) {
            throw new Error(`Falla verificando restauración de respaldo para ${path.basename(filePath)}`);
        }
    } else {
        await fs.unlink(filePath).catch((err) => {
            if (err.code !== 'ENOENT') throw err;
        });
    }
}

async function commitDataAndHistoryAtomically({ dataFilePath, nextData, ingestionsFilePath, nextIngestions }) {
    const prevDataSnap = await readOptionalRaw(dataFilePath);
    await writeJsonAtomic(dataFilePath, nextData);
    try {
        await writeJsonAtomic(ingestionsFilePath, nextIngestions);
    } catch (err) {
        await restoreSnapshot(dataFilePath, prevDataSnap);
        throw err;
    }
}

export function getIngestPaths(userId) {
    const invoicesFilePath = getInvoiceHistoryPath(userId);
    const userDir = getUserDataDir(userId);
    const transactionsFilePath = path.join(userDir, 'banco', '_transactions.json');
    const ingestionsFilePath = path.join(userDir, 'ingestions.json');
    return { invoicesFilePath, transactionsFilePath, ingestionsFilePath, userDir };
}

export async function loadJsonArray(filePath) {
    try {
        const fileData = await fs.readFile(filePath, 'utf-8');
        const parsed = JSON.parse(fileData);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function parseCbteFch(rawDate) {
    if (rawDate === undefined || rawDate === null || rawDate === '') return null;
    if (typeof rawDate === 'number' && rawDate > 25000 && rawDate < 90000) {
        // Excel serial date
        const utcDays = Math.floor(rawDate - 25569);
        const dt = new Date(utcDays * 86400 * 1000);
        const y = dt.getUTCFullYear();
        const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
        const d = String(dt.getUTCDate()).padStart(2, '0');
        return { cbteFch: `${y}${m}${d}`, isoDate: `${y}-${m}-${d}` };
    }
    const str = String(rawDate).trim();
    if (/^\d{8}$/.test(str)) {
        const y = Number(str.slice(0, 4));
        const m = Number(str.slice(4, 6));
        const d = Number(str.slice(6, 8));
        const dt = new Date(Date.UTC(y, m - 1, d));
        if (dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d) {
            return { cbteFch: str, isoDate: `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}` };
        }
        return null;
    }
    const ddmmyyyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (ddmmyyyy) {
        const d = Number(ddmmyyyy[1]);
        const m = Number(ddmmyyyy[2]);
        const y = Number(ddmmyyyy[3]);
        const dt = new Date(Date.UTC(y, m - 1, d));
        if (dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d) {
            const mm = String(m).padStart(2, '0');
            const dd = String(d).padStart(2, '0');
            return { cbteFch: `${y}${mm}${dd}`, isoDate: `${y}-${mm}-${dd}` };
        }
        return null;
    }
    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
    if (isoMatch) {
        const y = Number(isoMatch[1]);
        const m = Number(isoMatch[2]);
        const d = Number(isoMatch[3]);
        const dt = new Date(Date.UTC(y, m - 1, d));
        if (dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d) {
            return { cbteFch: `${isoMatch[1]}${isoMatch[2]}${isoMatch[3]}`, isoDate: `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}` };
        }
        return null;
    }
    return null;
}

function parsePositiveInt(val) {
    if (val === undefined || val === null || val === '') return null;
    const num = Number(val);
    if (!Number.isInteger(num) || num <= 0) return null;
    return num;
}

export function parseLocalizedAmount(val) {
    if (typeof val === 'number') return Number.isFinite(val) ? val : NaN;
    if (val === undefined || val === null || val === '') return NaN;
    let s = String(val).trim();
    const isParenNeg = s.startsWith('(') && s.endsWith(')');
    if (isParenNeg) s = `-${s.slice(1, -1)}`;
    if (s.includes('.') && s.includes(',')) {
        s = s.replace(/\./g, '').replace(/,/g, '.');
    } else if (s.includes(',')) {
        const parts = s.split(',');
        if (parts.length === 2 && parts[1].length <= 2) {
            s = s.replace(/,/g, '.');
        } else {
            s = s.replace(/,/g, '');
        }
    }
    s = s.replace(/[^0-9.-]/g, '');
    const num = parseFloat(s);
    return Number.isFinite(num) ? num : NaN;
}

function resolveMappedField(row, columnMapping, fieldName, fallbackKeys = []) {
    if (columnMapping && columnMapping[fieldName] && row && Object.prototype.hasOwnProperty.call(row, columnMapping[fieldName])) {
        return row[columnMapping[fieldName]];
    }
    if (row && Object.prototype.hasOwnProperty.call(row, fieldName) && row[fieldName] !== undefined) {
        return row[fieldName];
    }
    for (const key of fallbackKeys) {
        if (row && Object.prototype.hasOwnProperty.call(row, key) && row[key] !== undefined) {
            return row[key];
        }
    }
    return undefined;
}

function buildInvoiceIdentityKey(inv) {
    const cleanCuit = String(inv?.CUIT ?? inv?.cuit ?? '').replace(/[^0-9]/g, '');
    const cbteTipo = parsePositiveInt(inv?.CbteTipo ?? inv?.cbteTipo) || 11;
    const ptoVta = parsePositiveInt(inv?.PtoVta ?? inv?.ptoVta);
    const cbteDesde = parsePositiveInt(inv?.CbteDesde ?? inv?.cbteDesde);
    if (ptoVta && cbteDesde && cleanCuit) {
        return `doc:${cbteTipo}|${ptoVta}|${cbteDesde}|${cleanCuit}`;
    }
    const cae = String(inv?.cae || '').trim();
    if (/^\d{14}$/.test(cae)) {
        return `cae:${cae}`;
    }
    return null;
}

function buildTxFingerprint(tx) {
    const parsed = parseCbteFch(tx?.transaction_date || tx?.date);
    const iso = parsed ? parsed.isoDate : 'undated';
    const amt = Number(tx?.amount ?? 0).toFixed(2);
    const vch = String(tx?.voucher_number || '').trim().toLowerCase();
    const concept = String(tx?.concept || tx?.description || '').trim().toLowerCase().slice(0, 60);
    return `${iso}|${amt}|${vch}|${concept}`;
}

/**
 * Validates, deduplicates, and optionally commits external records (Excel/CSV, SQL, Cloud)
 * for a tenant without ever overwriting ARCA fiscal records.
 */
export async function processExternalIngestion({
    tenantId,
    ingestionType = 'excel',
    source = 'excel_import',
    provenance = 'external_excel',
    dataType,
    data,
    fileName,
    columnMapping = null,
    mode = 'commit', // 'preview' | 'commit'
    skipDuplicates = false,
    idempotencyKey = null,
    metadata = null
}) {
    if (!['invoices', 'transactions'].includes(dataType)) {
        return { ok: false, status: 400, error: 'dataType no válido (invoices | transactions)' };
    }
    if (!Array.isArray(data) || data.length === 0) {
        return { ok: false, status: 400, error: 'Se requiere un listado válido de registros para importar' };
    }
    if (data.length > 5000) {
        return { ok: false, status: 400, error: 'El lote excede el máximo de 5000 registros por importación' };
    }

    return withTenantIngestLock(tenantId, async () => {
        const { invoicesFilePath, transactionsFilePath, ingestionsFilePath } = getIngestPaths(tenantId);
        const safeFileName = String(fileName || '').replace(/[^\w.\-\s()]/g, '').trim() || null;
        const contentHash = crypto
            .createHash('sha256')
            .update(JSON.stringify({ dataType, data }))
            .digest('hex');

        const currentIngestions = await loadJsonArray(ingestionsFilePath);

        if (mode === 'commit') {
            const existingBatch = currentIngestions.find(
                b =>
                    b.status === 'active' &&
                    b.dataType === dataType &&
                    ((idempotencyKey && b.idempotencyKey === idempotencyKey) || b.contentHash === contentHash)
            );
            if (existingBatch) {
                return {
                    ok: true,
                    status: 200,
                    idempotentReplay: true,
                    batchId: existingBatch.batchId,
                    recordCount: 0,
                    skippedDuplicates: data.length,
                    message: `Carga idempotente detectada: el lote ya fue procesado (${existingBatch.batchId}).`
                };
            }
        }

        const batchId = `batch_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        const rowErrors = [];
        const duplicateRows = [];
        const normalizedRows = [];

        if (dataType === 'invoices') {
            const currentInvoices = await loadJsonArray(invoicesFilePath);
            const existingKeys = new Set(
                currentInvoices.map(buildInvoiceIdentityKey).filter(Boolean)
            );

            data.forEach((item, idx) => {
                const rowNum = idx + 1;
                const rawName = String(resolveMappedField(item, columnMapping, 'client_name', ['RazonSocial', 'razonSocial', 'cliente', 'nombre']) || '').trim();
                const rawCuit = resolveMappedField(item, columnMapping, 'cuit', ['CUIT', 'docNro', 'documento']);
                const cleanCuit = String(rawCuit ?? '').replace(/[^0-9]/g, '');
                const rawAmt = resolveMappedField(item, columnMapping, 'amount', ['Importe', 'importe', 'total']);
                const amount = parseLocalizedAmount(rawAmt);
                const rawDate = resolveMappedField(item, columnMapping, 'date', ['cbteFch', 'CbteFch', 'fecha']);
                const parsedDate = parseCbteFch(rawDate);

                if (!rawName) {
                    rowErrors.push({ row: rowNum, error: 'Falta Razón Social / Cliente.' });
                    return;
                }
                if (!cleanCuit || cleanCuit.length < 7 || cleanCuit.length > 11) {
                    rowErrors.push({ row: rowNum, error: 'CUIT/DNI inválido o faltante.' });
                    return;
                }
                if (!Number.isFinite(amount) || amount <= 0) {
                    rowErrors.push({ row: rowNum, error: 'Importe inválido o no positivo.' });
                    return;
                }
                if (!parsedDate) {
                    rowErrors.push({ row: rowNum, error: 'Fecha de comprobante inválida o faltante.' });
                    return;
                }

                const cbteTipo = parsePositiveInt(resolveMappedField(item, columnMapping, 'cbteTipo', ['CbteTipo', 'tipo'])) || 11;
                const ptoVta = parsePositiveInt(resolveMappedField(item, columnMapping, 'ptoVta', ['PtoVta', 'puntoVenta']));
                const cbteDesde = parsePositiveInt(resolveMappedField(item, columnMapping, 'cbteDesde', ['CbteDesde', 'numero']));
                const rawCae = resolveMappedField(item, columnMapping, 'cae', ['CAE']);
                const caeStr = rawCae !== undefined && rawCae !== null ? String(rawCae).trim() : '';
                const hasDeclaredCae = /^\d{14}$/.test(caeStr);
                const rawCaeVto = resolveMappedField(item, columnMapping, 'caeVto', ['CaeVto', 'vencimiento']);
                const declaredCaeVto = hasDeclaredCae && rawCaeVto ? parseCbteFch(rawCaeVto)?.cbteFch || null : null;
                const detail = String(resolveMappedField(item, columnMapping, 'detail', ['Concepto', 'concepto', 'descripcion']) || 'Importación externa').trim();

                const candidate = {
                    id: `ext_${crypto.randomBytes(6).toString('hex')}`,
                    cae: hasDeclaredCae ? caeStr : null,
                    caeVto: declaredCaeVto,
                    cbteFch: parsedDate.cbteFch,
                    RazonSocial: rawName,
                    CUIT: cleanCuit,
                    Importe: amount,
                    Concepto: detail,
                    status: 'importado_externo',
                    verificationStatus: hasDeclaredCae ? 'declared_cae_unverified' : 'external_unverified',
                    isFiscalVerified: false,
                    source,
                    provenance,
                    originFileName: safeFileName || 'importacion_externa',
                    CbteTipo: cbteTipo,
                    PtoVta: ptoVta,
                    CbteDesde: cbteDesde,
                    isPaid: item?.isPaid === true,
                    created_at: `${parsedDate.isoDate}T12:00:00.000Z`,
                    importedAt: new Date().toISOString(),
                    batchId
                };

                const identityKey = buildInvoiceIdentityKey(candidate);
                if (identityKey && existingKeys.has(identityKey)) {
                    duplicateRows.push({
                        row: rowNum,
                        identityKey,
                        error: `El comprobante ${cbteTipo}-${ptoVta || '?'}-${cbteDesde || '?'} para ${cleanCuit} ya existe.`
                    });
                    return;
                }
                if (identityKey) existingKeys.add(identityKey);
                normalizedRows.push(candidate);
            });

            if (mode === 'preview') {
                return {
                    ok: true,
                    status: 200,
                    preview: true,
                    dataType,
                    contentHash,
                    totalRows: data.length,
                    validCount: normalizedRows.length,
                    duplicateCount: duplicateRows.length,
                    errorCount: rowErrors.length,
                    rowErrors: rowErrors.slice(0, 50),
                    duplicateRows: duplicateRows.slice(0, 50),
                    previewRows: normalizedRows.slice(0, 25)
                };
            }

            const allErrors = skipDuplicates
                ? rowErrors
                : [...rowErrors, ...duplicateRows.map(d => ({ row: d.row, error: d.error }))];

            if (allErrors.length > 0) {
                const msgList = allErrors.map(e => `Fila ${e.row}: ${e.error}`);
                return {
                    ok: false,
                    status: 400,
                    error: `Validación documental fallida en ${msgList.length} fila(s): ${msgList.slice(0, 3).join(' ')}`,
                    validationErrors: msgList,
                    rowErrors: allErrors
                };
            }

            if (normalizedRows.length === 0) {
                return {
                    ok: true,
                    status: 200,
                    batchId: null,
                    recordCount: 0,
                    skippedDuplicates: duplicateRows.length,
                    message: 'No se agregaron nuevos comprobantes (todos los registros ya existían).'
                };
            }

            const merged = [...currentInvoices, ...normalizedRows];
            currentIngestions.push({
                batchId,
                timestamp: new Date().toISOString(),
                fileName: safeFileName || 'Importación Comprobantes',
                dataType: 'invoices',
                ingestionType,
                source,
                verificationStatus: 'external_unverified',
                recordCount: normalizedRows.length,
                skippedDuplicates: duplicateRows.length,
                contentHash,
                ...(idempotencyKey ? { idempotencyKey } : {}),
                ...(metadata ? { metadata } : {}),
                status: 'active'
            });
            await commitDataAndHistoryAtomically({
                dataFilePath: invoicesFilePath,
                nextData: merged,
                ingestionsFilePath,
                nextIngestions: currentIngestions
            });

            return {
                ok: true,
                status: 200,
                batchId,
                recordCount: normalizedRows.length,
                skippedDuplicates: duplicateRows.length,
                message: `Se importaron ${normalizedRows.length} comprobantes externos con procedencia registrada (sin autorización fiscal ARCA).`
            };
        }

        // dataType === 'transactions'
        const currentTxs = await loadJsonArray(transactionsFilePath);
        const existingTxFingerprints = new Set(currentTxs.map(buildTxFingerprint));

        data.forEach((item, idx) => {
            const rowNum = idx + 1;
            const rawAmt = resolveMappedField(item, columnMapping, 'amount', ['Importe', 'importe']);
            const rawCredit = resolveMappedField(item, columnMapping, 'credit', ['credito', 'Credito', 'haber', 'Haber']);
            const rawDebit = resolveMappedField(item, columnMapping, 'debit', ['debito', 'Debito', 'debe', 'Debe']);

            let amount = parseLocalizedAmount(rawAmt);
            if (!Number.isFinite(amount)) {
                const cVal = parseLocalizedAmount(rawCredit);
                const dVal = parseLocalizedAmount(rawDebit);
                if (Number.isFinite(cVal) || Number.isFinite(dVal)) {
                    amount = (Number.isFinite(cVal) ? Math.abs(cVal) : 0) - (Number.isFinite(dVal) ? Math.abs(dVal) : 0);
                }
            }

            const rawDate = resolveMappedField(item, columnMapping, 'date', ['transaction_date', 'fecha']);
            const parsedDate = parseCbteFch(rawDate);
            const concept = String(resolveMappedField(item, columnMapping, 'concept', ['Concepto', 'concepto', 'description', 'descripcion', 'detail']) || '').trim();
            const clientName = String(resolveMappedField(item, columnMapping, 'client_name', ['cliente', 'RazonSocial', 'nombre']) || 'No especificado').trim();
            const bankName = String(resolveMappedField(item, columnMapping, 'bank_name', ['banco', 'cuenta']) || 'No especificado').trim();
            const voucherNumberRaw = resolveMappedField(item, columnMapping, 'voucher_number', ['comprobante', 'numero']);
            const voucherNumber = voucherNumberRaw ? String(voucherNumberRaw).trim() : null;
            const description = String(resolveMappedField(item, columnMapping, 'description', ['descripcion', 'concepto']) || concept || 'Importación externa').trim();

            if (!Number.isFinite(amount) || amount === 0) {
                rowErrors.push({ row: rowNum, error: 'Importe bancario inválido o cero.' });
                return;
            }
            if (!parsedDate) {
                rowErrors.push({ row: rowNum, error: 'Fecha de movimiento inválida o faltante.' });
                return;
            }
            if (!concept && clientName === 'No especificado') {
                rowErrors.push({ row: rowNum, error: 'Se requiere concepto, descripción o contraparte.' });
                return;
            }

            const candidate = {
                id: `tx_ext_${crypto.randomBytes(6).toString('hex')}`,
                transaction_date: `${parsedDate.isoDate}T12:00:00.000Z`,
                concept: concept || 'Movimiento importado',
                voucher_number: voucherNumber,
                amount,
                description,
                client_name: clientName,
                bank_name: bankName,
                is_transferred: false,
                linked_invoices: [],
                source,
                provenance,
                verificationStatus: 'external_unverified',
                originFileName: safeFileName || 'importacion_externa',
                created_at: new Date().toISOString(),
                batchId
            };

            const fp = buildTxFingerprint(candidate);
            if (existingTxFingerprints.has(fp)) {
                duplicateRows.push({
                    row: rowNum,
                    identityKey: fp,
                    error: `Movimiento duplicado (${parsedDate.isoDate}, ${amount}, ${concept || clientName}).`
                });
                return;
            }
            existingTxFingerprints.add(fp);
            normalizedRows.push(candidate);
        });

        if (mode === 'preview') {
            return {
                ok: true,
                status: 200,
                preview: true,
                dataType,
                contentHash,
                totalRows: data.length,
                validCount: normalizedRows.length,
                duplicateCount: duplicateRows.length,
                errorCount: rowErrors.length,
                rowErrors: rowErrors.slice(0, 50),
                duplicateRows: duplicateRows.slice(0, 50),
                previewRows: normalizedRows.slice(0, 25)
            };
        }

        const allErrors = skipDuplicates
            ? rowErrors
            : [...rowErrors, ...duplicateRows.map(d => ({ row: d.row, error: d.error }))];

        if (allErrors.length > 0) {
            const msgList = allErrors.map(e => `Fila ${e.row}: ${e.error}`);
            return {
                ok: false,
                status: 400,
                error: `Validación fallida en ${msgList.length} movimiento(s): ${msgList.slice(0, 3).join(' ')}`,
                validationErrors: msgList,
                rowErrors: allErrors
            };
        }

        if (normalizedRows.length === 0) {
            return {
                ok: true,
                status: 200,
                batchId: null,
                recordCount: 0,
                skippedDuplicates: duplicateRows.length,
                message: 'No se agregaron nuevos movimientos bancarios (todos ya existían).'
            };
        }

        const merged = [...currentTxs, ...normalizedRows];
        merged.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));
        currentIngestions.push({
            batchId,
            timestamp: new Date().toISOString(),
            fileName: safeFileName || 'Importación Movimientos Banco',
            dataType: 'transactions',
            ingestionType,
            source,
            verificationStatus: 'external_unverified',
            recordCount: normalizedRows.length,
            skippedDuplicates: duplicateRows.length,
            contentHash,
            ...(idempotencyKey ? { idempotencyKey } : {}),
            ...(metadata ? { metadata } : {}),
            status: 'active'
        });
        await commitDataAndHistoryAtomically({
            dataFilePath: transactionsFilePath,
            nextData: merged,
            ingestionsFilePath,
            nextIngestions: currentIngestions
        });

        return {
            ok: true,
            status: 200,
            batchId,
            recordCount: normalizedRows.length,
            skippedDuplicates: duplicateRows.length,
            message: `Se importaron ${normalizedRows.length} movimientos bancarios externos exitosamente.`
        };
    });
}

export async function rollbackExternalBatch(tenantId, batchId) {
    return withTenantIngestLock(tenantId, async () => {
        const { invoicesFilePath, transactionsFilePath, ingestionsFilePath } = getIngestPaths(tenantId);
        const ingestions = await loadJsonArray(ingestionsFilePath);
        const ingestion = ingestions.find(i => i.batchId === batchId);

        if (!ingestion) {
            return { ok: false, status: 404, error: 'Lote de importación no encontrado' };
        }
        if (ingestion.status === 'rolled_back') {
            return { ok: false, status: 400, error: 'Este lote ya ha sido revertido previamente.' };
        }

        const externalSources = new Set(['excel_import', 'sql_import', 'cloud_import']);
        const prevInvoicesSnap = (ingestion.dataType === 'invoices' || ingestion.dataType === 'mixed')
            ? await readOptionalRaw(invoicesFilePath)
            : null;
        const prevTxsSnap = (ingestion.dataType === 'transactions' || ingestion.dataType === 'mixed')
            ? await readOptionalRaw(transactionsFilePath)
            : null;

        try {
            if (prevInvoicesSnap) {
                const invoices = await loadJsonArray(invoicesFilePath);
                const filteredInvoices = invoices.filter(
                    inv => !(inv.batchId === batchId && externalSources.has(inv.source))
                );
                await writeJsonAtomic(invoicesFilePath, filteredInvoices);
            }

            if (prevTxsSnap) {
                const transactions = await loadJsonArray(transactionsFilePath);
                const filteredTxs = transactions.filter(
                    tx => !(tx.batchId === batchId && externalSources.has(tx.source))
                );
                await writeJsonAtomic(transactionsFilePath, filteredTxs);
            }

            ingestion.status = 'rolled_back';
            ingestion.rolledBackAt = new Date().toISOString();
            await writeJsonAtomic(ingestionsFilePath, ingestions);
        } catch (err) {
            await restoreSnapshot(invoicesFilePath, prevInvoicesSnap);
            await restoreSnapshot(transactionsFilePath, prevTxsSnap);
            throw err;
        }

        return {
            ok: true,
            status: 200,
            message: `Lote "${ingestion.fileName}" (${ingestion.recordCount} registros) revertido exitosamente.`
        };
    });
}
