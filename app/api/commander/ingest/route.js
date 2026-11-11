import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getServerSession, authorizeTenantAccess } from '@/lib/auth';
import { getUserDataDir, getInvoiceHistoryPath } from '@/lib/dataPaths';

const getPaths = (userId) => {
    const invoicesFilePath = getInvoiceHistoryPath(userId);
    const userDir = getUserDataDir(userId);
    const transactionsFilePath = path.join(userDir, 'banco', '_transactions.json');
    const ingestionsFilePath = path.join(userDir, 'ingestions.json');
    return { invoicesFilePath, transactionsFilePath, ingestionsFilePath, userDir };
};

const loadJsonFile = async (filePath) => {
    try {
        const fileData = await fs.readFile(filePath, 'utf-8');
        const parsed = JSON.parse(fileData);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const saveJsonFile = async (filePath, data) => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
};

function parseCbteFch(rawDate) {
    if (!rawDate) return null;
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
    const iso = new Date(str);
    if (!Number.isNaN(iso.getTime())) {
        const y = iso.getUTCFullYear();
        const m = String(iso.getUTCMonth() + 1).padStart(2, '0');
        const d = String(iso.getUTCDate()).padStart(2, '0');
        return { cbteFch: `${y}${m}${d}`, isoDate: `${y}-${m}-${d}` };
    }
    return null;
}

function parsePositiveInt(val) {
    if (val === undefined || val === null || val === '') return null;
    const num = Number(val);
    if (!Number.isInteger(num) || num <= 0) return null;
    return num;
}

export async function GET(request) {
    try {
        const session = await getServerSession(request);
        const { searchParams } = new URL(request.url);
        const requestedUserId = searchParams.get('userId');

        const auth = authorizeTenantAccess(session, requestedUserId);
        if (!auth.authorized) {
            return new Response(JSON.stringify({ error: auth.error }), { status: auth.status });
        }

        const { ingestionsFilePath } = getPaths(auth.tenantId);
        const ingestions = await loadJsonFile(ingestionsFilePath);
        ingestions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return new Response(JSON.stringify({ success: true, ingestions }), { status: 200 });
    } catch (error) {
        console.error('Error in /api/commander/ingest GET:', error);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
    }
}

export async function POST(request) {
    try {
        const session = await getServerSession(request);
        const body = await request.json();
        const { userId, ingestionType, dataType, data, fileName } = body || {};

        const auth = authorizeTenantAccess(session, userId);
        if (!auth.authorized) {
            return new Response(JSON.stringify({ error: auth.error }), { status: auth.status });
        }

        if (ingestionType === 'sql' || ingestionType === 'cloud') {
            return new Response(JSON.stringify({
                success: false,
                code: 'INTEGRATION_NOT_AVAILABLE',
                error: 'Integración todavía no disponible'
            }), { status: 501 });
        }

        if (ingestionType !== 'excel') {
            return new Response(JSON.stringify({ error: 'Tipo de ingesta no válido' }), { status: 400 });
        }

        if (!data || !Array.isArray(data) || data.length === 0) {
            return new Response(JSON.stringify({ error: 'Se requiere un listado válido de registros para importar' }), { status: 400 });
        }
        if (data.length > 5000) {
            return new Response(JSON.stringify({ error: 'El lote excede el máximo de 5000 registros por importación' }), { status: 400 });
        }

        const targetUserId = auth.tenantId;
        const { invoicesFilePath, transactionsFilePath, ingestionsFilePath } = getPaths(targetUserId);
        const batchId = `batch_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        const safeFileName = String(fileName || '').replace(/[^\w.\-\s()]/g, '').trim() || null;

        const currentIngestions = await loadJsonFile(ingestionsFilePath);

        if (dataType === 'invoices') {
            const currentInvoices = await loadJsonFile(invoicesFilePath);
            const validationErrors = [];
            const newInvoices = [];

            const existingIdentityKeys = new Set(
                currentInvoices
                    .filter(inv => inv.CbteTipo && inv.PtoVta && inv.CbteDesde && inv.CUIT)
                    .map(inv => `${inv.CbteTipo}|${inv.PtoVta}|${inv.CbteDesde}|${String(inv.CUIT).replace(/[^0-9]/g, '')}`)
            );

            data.forEach((item, idx) => {
                const rowNum = idx + 1;
                const rawName = String(item?.RazonSocial || item?.client_name || '').trim();
                const cleanCuit = String(item?.CUIT ?? item?.cuit ?? '').replace(/[^0-9]/g, '');
                const amount = Number(item?.Importe ?? item?.amount ?? item?.total);
                const parsedDate = parseCbteFch(item?.cbteFch || item?.date);

                if (!rawName) {
                    validationErrors.push(`Fila ${rowNum}: falta Razón Social / Cliente.`);
                    return;
                }
                if (!cleanCuit || cleanCuit.length < 7 || cleanCuit.length > 11) {
                    validationErrors.push(`Fila ${rowNum}: CUIT/DNI inválido o faltante.`);
                    return;
                }
                if (!Number.isFinite(amount) || amount <= 0) {
                    validationErrors.push(`Fila ${rowNum}: importe inválido o no positivo.`);
                    return;
                }
                if (!parsedDate) {
                    validationErrors.push(`Fila ${rowNum}: fecha de comprobante inválida o faltante.`);
                    return;
                }

                const cbteTipo = parsePositiveInt(item?.CbteTipo ?? item?.cbteTipo) || 11;
                const ptoVta = parsePositiveInt(item?.PtoVta ?? item?.ptoVta);
                const cbteDesde = parsePositiveInt(item?.CbteDesde ?? item?.cbteDesde);

                const rawCae = item?.cae !== undefined && item?.cae !== null ? String(item.cae).trim() : '';
                const hasDeclaredCae = /^\d{14}$/.test(rawCae);
                const declaredCaeVto = hasDeclaredCae && item?.caeVto ? parseCbteFch(item.caeVto)?.cbteFch || null : null;

                if (ptoVta && cbteDesde) {
                    const identityKey = `${cbteTipo}|${ptoVta}|${cbteDesde}|${cleanCuit}`;
                    if (existingIdentityKeys.has(identityKey)) {
                        validationErrors.push(`Fila ${rowNum}: el comprobante ${cbteTipo}-${ptoVta}-${cbteDesde} para ${cleanCuit} ya existe.`);
                        return;
                    }
                    existingIdentityKeys.add(identityKey);
                }

                newInvoices.push({
                    id: `ext_${crypto.randomBytes(6).toString('hex')}`,
                    cae: hasDeclaredCae ? rawCae : null,
                    caeVto: declaredCaeVto,
                    cbteFch: parsedDate.cbteFch,
                    RazonSocial: rawName,
                    CUIT: cleanCuit,
                    Importe: amount,
                    Concepto: String(item?.Concepto || item?.detail || 'Importación externa').trim(),
                    status: 'importado_externo',
                    verificationStatus: hasDeclaredCae ? 'declared_cae_unverified' : 'external_unverified',
                    isFiscalVerified: false,
                    source: 'excel_import',
                    provenance: 'external_excel',
                    originFileName: safeFileName || 'importacion_excel.xlsx',
                    CbteTipo: cbteTipo,
                    PtoVta: ptoVta,
                    CbteDesde: cbteDesde,
                    isPaid: item?.isPaid === true,
                    created_at: `${parsedDate.isoDate}T12:00:00.000Z`,
                    importedAt: new Date().toISOString(),
                    batchId
                });
            });

            if (validationErrors.length > 0) {
                return new Response(JSON.stringify({
                    error: `Validación documental fallida en ${validationErrors.length} fila(s): ${validationErrors.slice(0, 3).join(' ')}`,
                    validationErrors
                }), { status: 400 });
            }

            // Preserve all pre-existing invoices untouched; append new validated imports
            const merged = [...currentInvoices, ...newInvoices];
            await saveJsonFile(invoicesFilePath, merged);

            currentIngestions.push({
                batchId,
                timestamp: new Date().toISOString(),
                fileName: safeFileName || 'Importación Excel Comprobantes',
                dataType: 'invoices',
                ingestionType: 'excel',
                source: 'excel_import',
                verificationStatus: 'external_unverified',
                recordCount: newInvoices.length,
                status: 'active'
            });
            await saveJsonFile(ingestionsFilePath, currentIngestions);

            return new Response(JSON.stringify({
                success: true,
                batchId,
                recordCount: newInvoices.length,
                message: `Se importaron ${newInvoices.length} comprobantes externos con procedencia registrada (sin autorización fiscal ARCA).`
            }), { status: 200 });

        } else if (dataType === 'transactions') {
            const currentTxs = await loadJsonFile(transactionsFilePath);
            const validationErrors = [];
            const newTxs = [];

            data.forEach((item, idx) => {
                const rowNum = idx + 1;
                const amount = Number(item?.amount ?? item?.importe);
                const parsedDate = parseCbteFch(item?.transaction_date || item?.date);
                const concept = String(item?.concept || item?.description || '').trim();

                if (!Number.isFinite(amount) || amount === 0) {
                    validationErrors.push(`Fila ${rowNum}: importe bancario inválido o cero.`);
                    return;
                }
                if (!parsedDate) {
                    validationErrors.push(`Fila ${rowNum}: fecha de movimiento inválida o faltante.`);
                    return;
                }
                if (!concept && !item?.client_name && !item?.cliente) {
                    validationErrors.push(`Fila ${rowNum}: se requiere concepto, descripción o contraparte.`);
                    return;
                }

                newTxs.push({
                    id: `tx_ext_${crypto.randomBytes(6).toString('hex')}`,
                    transaction_date: `${parsedDate.isoDate}T12:00:00.000Z`,
                    concept: concept || 'Movimiento importado',
                    voucher_number: item?.voucher_number ? String(item.voucher_number).trim() : null,
                    amount,
                    description: String(item?.description || concept || 'Importación externa por Excel').trim(),
                    client_name: String(item?.client_name || item?.cliente || 'No especificado').trim(),
                    bank_name: String(item?.bank_name || 'No especificado').trim(),
                    is_transferred: false,
                    linked_invoices: [],
                    source: 'excel_import',
                    provenance: 'external_excel',
                    verificationStatus: 'external_unverified',
                    originFileName: safeFileName || 'importacion_excel.xlsx',
                    created_at: new Date().toISOString(),
                    batchId
                });
            });

            if (validationErrors.length > 0) {
                return new Response(JSON.stringify({
                    error: `Validación fallida en ${validationErrors.length} movimiento(s): ${validationErrors.slice(0, 3).join(' ')}`,
                    validationErrors
                }), { status: 400 });
            }

            const merged = [...currentTxs, ...newTxs];
            merged.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));
            await saveJsonFile(transactionsFilePath, merged);

            currentIngestions.push({
                batchId,
                timestamp: new Date().toISOString(),
                fileName: safeFileName || 'Importación Excel Banco',
                dataType: 'transactions',
                ingestionType: 'excel',
                source: 'excel_import',
                verificationStatus: 'external_unverified',
                recordCount: newTxs.length,
                status: 'active'
            });
            await saveJsonFile(ingestionsFilePath, currentIngestions);

            return new Response(JSON.stringify({
                success: true,
                batchId,
                recordCount: newTxs.length,
                message: `Se importaron ${newTxs.length} movimientos bancarios externos exitosamente.`
            }), { status: 200 });
        }

        return new Response(JSON.stringify({ error: 'dataType no válido' }), { status: 400 });
    } catch (error) {
        console.error('Error in /api/commander/ingest POST:', error);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const session = await getServerSession(request);
        const { searchParams } = new URL(request.url);
        const requestedUserId = searchParams.get('userId');
        const batchId = searchParams.get('batchId');

        const auth = authorizeTenantAccess(session, requestedUserId);
        if (!auth.authorized) {
            return new Response(JSON.stringify({ error: auth.error }), { status: auth.status });
        }

        if (!batchId) {
            return new Response(JSON.stringify({ error: 'batchId es requerido' }), { status: 400 });
        }

        const { invoicesFilePath, transactionsFilePath, ingestionsFilePath } = getPaths(auth.tenantId);

        const ingestions = await loadJsonFile(ingestionsFilePath);
        const ingestion = ingestions.find(i => i.batchId === batchId);

        if (!ingestion) {
            return new Response(JSON.stringify({ error: 'Lote de importación no encontrado' }), { status: 404 });
        }

        if (ingestion.status === 'rolled_back') {
            return new Response(JSON.stringify({ error: 'Este lote ya ha sido revertido previamente.' }), { status: 400 });
        }

        // Only remove records belonging exclusively to this excel_import batch (never pre-existing fiscal records)
        if (ingestion.dataType === 'invoices' || ingestion.dataType === 'mixed') {
            const invoices = await loadJsonFile(invoicesFilePath);
            const filteredInvoices = invoices.filter(
                inv => !(inv.batchId === batchId && inv.source === 'excel_import')
            );
            await saveJsonFile(invoicesFilePath, filteredInvoices);
        }

        if (ingestion.dataType === 'transactions' || ingestion.dataType === 'mixed') {
            const transactions = await loadJsonFile(transactionsFilePath);
            const filteredTxs = transactions.filter(
                tx => !(tx.batchId === batchId && tx.source === 'excel_import')
            );
            await saveJsonFile(transactionsFilePath, filteredTxs);
        }

        ingestion.status = 'rolled_back';
        ingestion.rolledBackAt = new Date().toISOString();
        await saveJsonFile(ingestionsFilePath, ingestions);

        return new Response(JSON.stringify({
            success: true,
            message: `Lote "${ingestion.fileName}" (${ingestion.recordCount} registros) revertido exitosamente.`
        }), { status: 200 });
    } catch (error) {
        console.error('Error in /api/commander/ingest DELETE:', error);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
    }
}
