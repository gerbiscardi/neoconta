import fs from 'fs/promises';
import path from 'path';

// Helper to resolve user files
const getPaths = (userId) => {
    const invoicesFilePath = path.join(process.cwd(), 'data', 'invoices', `${userId}_history.json`);
    const userDir = path.join(process.cwd(), 'data', 'users', userId);
    const transactionsFilePath = path.join(userDir, 'banco', '_transactions.json');
    const ingestionsFilePath = path.join(userDir, 'ingestions.json');
    return { invoicesFilePath, transactionsFilePath, ingestionsFilePath, userDir };
};

// Helper to load file content or return empty array
const loadJsonFile = async (filePath) => {
    try {
        const fileData = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(fileData);
    } catch (err) {
        return [];
    }
};

// Helper to save file content safely
const saveJsonFile = async (filePath, data) => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
};

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return new Response(JSON.stringify({ error: 'userId parameter is required' }), { status: 400 });
        }

        const { ingestionsFilePath } = getPaths(userId);
        const ingestions = await loadJsonFile(ingestionsFilePath);

        // Sort by timestamp descending
        ingestions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return new Response(JSON.stringify({ success: true, ingestions }), { status: 200 });
    } catch (error) {
        console.error('Error in /api/commander/ingest GET:', error);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { userId, ingestionType, dataType, data, fileName } = body;

        if (!userId) {
            return new Response(JSON.stringify({ error: 'userId is required' }), { status: 400 });
        }

        const { invoicesFilePath, transactionsFilePath, ingestionsFilePath } = getPaths(userId);

        const currentInvoices = await loadJsonFile(invoicesFilePath);
        const currentTxs = await loadJsonFile(transactionsFilePath);
        const currentIngestions = await loadJsonFile(ingestionsFilePath);

        const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        if (ingestionType === 'excel') {
            if (!data || !Array.isArray(data)) {
                return new Response(JSON.stringify({ error: 'data array is required for excel ingestion' }), { status: 400 });
            }

            if (dataType === 'invoices') {
                const newInvoices = data.map(item => {
                    const cleanCuit = String(item.CUIT ?? item.cuit ?? "30-11111111-8").replace(/[^0-9]/g, '');
                    return {
                        id: Math.random().toString(36).substring(2, 11),
                        cae: item.cae || Math.random().toString().substring(2, 16),
                        caeVto: item.caeVto || new Date(new Date().setDate(new Date().getDate() + 10)).toISOString().split('T')[0].replace(/-/g, ''),
                        cbteFch: item.cbteFch || item.date || new Date().toISOString().split('T')[0].replace(/-/g, ''),
                        RazonSocial: item.RazonSocial || item.client_name || "Cliente Importado",
                        CUIT: cleanCuit,
                        Importe: parseFloat(item.Importe ?? item.amount ?? item.total ?? 1000),
                        Concepto: item.Concepto || item.detail || "Servicios BI",
                        status: "aprobado",
                        CbteTipo: Number(item.CbteTipo ?? item.cbteTipo ?? 11),
                        PtoVta: Number(item.PtoVta ?? item.ptoVta ?? 1),
                        CbteDesde: Number(item.CbteDesde ?? item.cbteDesde ?? Math.floor(Math.random() * 1000) + 1),
                        isPaid: item.isPaid ?? false,
                        created_at: item.created_at || new Date().toISOString(),
                        batchId: batchId // Inject batchId
                    };
                });

                const merged = [...newInvoices, ...currentInvoices];
                await saveJsonFile(invoicesFilePath, merged);

                // Add to ingestions log
                currentIngestions.push({
                    batchId,
                    timestamp: new Date().toISOString(),
                    fileName: fileName || "Importación Excel Facturas",
                    dataType: "invoices",
                    ingestionType: "excel",
                    recordCount: newInvoices.length,
                    status: "active"
                });
                await saveJsonFile(ingestionsFilePath, currentIngestions);

                return new Response(JSON.stringify({ success: true, message: `Se importaron ${newInvoices.length} facturas exitosamente.` }), { status: 200 });

            } else if (dataType === 'transactions') {
                const newTxs = data.map(item => ({
                    id: Math.random().toString(36).substring(2, 15) + Date.now().toString(36),
                    transaction_date: item.transaction_date || item.date || new Date().toISOString(),
                    concept: item.concept || 'Transferencia Recibida',
                    voucher_number: item.voucher_number || String(Math.floor(Math.random() * 1000000)),
                    amount: parseFloat(item.amount ?? item.importe ?? 1000),
                    description: item.description || 'Ingreso por Excel',
                    client_name: item.client_name || item.cliente || 'Cliente Banco',
                    bank_name: item.bank_name || 'GALICIA',
                    is_transferred: false,
                    linked_invoices: [],
                    created_at: new Date().toISOString(),
                    batchId: batchId // Inject batchId
                }));

                const merged = [...newTxs, ...currentTxs];
                merged.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));
                await saveJsonFile(transactionsFilePath, merged);

                // Add to ingestions log
                currentIngestions.push({
                    batchId,
                    timestamp: new Date().toISOString(),
                    fileName: fileName || "Importación Excel Banco",
                    dataType: "transactions",
                    ingestionType: "excel",
                    recordCount: newTxs.length,
                    status: "active"
                });
                await saveJsonFile(ingestionsFilePath, currentIngestions);

                return new Response(JSON.stringify({ success: true, message: `Se importaron ${newTxs.length} movimientos bancarios exitosamente.` }), { status: 200 });
            }

            return new Response(JSON.stringify({ error: 'invalid dataType' }), { status: 400 });

        } else if (ingestionType === 'sql') {
            const mockClients = [
                { name: "GALENO ARGENTINA S.A.", cuit: "30-50000789-8" },
                { name: "SWISS MEDICAL S.A.", cuit: "30-66322899-3" },
                { name: "MEDIFE ASOCIACION CIVIL", cuit: "30-70809988-1" },
                { name: "OSDE ORGANIZACION DE SERVICIOS", cuit: "30-54674125-3" }
            ];

            const addedInvoices = [];
            const addedTxs = [];
            const today = new Date();

            for (let i = 0; i < 5; i++) {
                const client = mockClients[i % mockClients.length];
                const amount = Math.floor(Math.random() * 150000) + 50000;
                const invDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (i * 2));
                const dateStr = invDate.toISOString().split('T')[0];
                const cae = Math.random().toString().substring(2, 16);
                const cbteDesde = Math.floor(Math.random() * 5000) + 100;

                const inv = {
                    id: Math.random().toString(36).substring(2, 11),
                    cae,
                    caeVto: new Date(invDate.setDate(invDate.getDate() + 10)).toISOString().split('T')[0].replace(/-/g, ''),
                    cbteFch: dateStr.replace(/-/g, ''),
                    RazonSocial: client.name,
                    CUIT: client.cuit.replace(/[^0-9]/g, ''),
                    Importe: amount,
                    Concepto: `Prestaciones Médicas - Código ${Math.floor(Math.random() * 900) + 100}`,
                    status: "aprobado",
                    CbteTipo: 11,
                    PtoVta: 1,
                    CbteDesde: cbteDesde,
                    isPaid: true,
                    created_at: invDate.toISOString(),
                    batchId: batchId // Inject batchId
                };

                const tx = {
                    id: Math.random().toString(36).substring(2, 15) + Date.now().toString(36),
                    transaction_date: invDate.toISOString(),
                    concept: 'Acreditación Directa SQL',
                    voucher_number: String(Math.floor(Math.random() * 900000) + 100000),
                    amount: amount,
                    description: `Cobro Factura C 00001-${String(cbteDesde).padStart(8, '0')}`,
                    client_name: client.name,
                    bank_name: i % 2 === 0 ? 'SANTANDER' : 'GALICIA',
                    is_transferred: false,
                    linked_invoices: [cae],
                    created_at: new Date().toISOString(),
                    batchId: batchId // Inject batchId
                };

                addedInvoices.push(inv);
                addedTxs.push(tx);
            }

            await saveJsonFile(invoicesFilePath, [...addedInvoices, ...currentInvoices]);
            
            const mergedTxs = [...addedTxs, ...currentTxs];
            mergedTxs.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));
            await saveJsonFile(transactionsFilePath, mergedTxs);

            // Add to ingestions log
            currentIngestions.push({
                batchId,
                timestamp: new Date().toISOString(),
                fileName: "Sincronización Base de Datos SQL",
                dataType: "mixed",
                ingestionType: "sql",
                recordCount: addedInvoices.length + addedTxs.length,
                status: "active"
            });
            await saveJsonFile(ingestionsFilePath, currentIngestions);

            return new Response(JSON.stringify({ 
                success: true, 
                message: "Sincronización SQL exitosa. Se importaron 5 facturas y 5 movimientos de banco." 
            }), { status: 200 });

        } else if (ingestionType === 'cloud') {
            const addedInvoices = [];
            const addedTxs = [];
            const today = new Date();

            const cloudClients = [
                { name: "PAMI INSSJP", cuit: "30-52282240-1" },
                { name: "SANCOR SALUD", cuit: "30-68992200-4" }
            ];

            for (let i = 0; i < 3; i++) {
                const client = cloudClients[i % cloudClients.length];
                const amount = Math.floor(Math.random() * 80000) + 20000;
                const invDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (i * 3 + 1));
                const dateStr = invDate.toISOString().split('T')[0];
                const cae = Math.random().toString().substring(2, 16);
                const cbteDesde = Math.floor(Math.random() * 5000) + 500;

                const inv = {
                    id: Math.random().toString(36).substring(2, 11),
                    cae,
                    caeVto: new Date(invDate.setDate(invDate.getDate() + 10)).toISOString().split('T')[0].replace(/-/g, ''),
                    cbteFch: dateStr.replace(/-/g, ''),
                    RazonSocial: client.name,
                    CUIT: client.cuit.replace(/[^0-9]/g, ''),
                    Importe: amount,
                    Concepto: `Sincronización Cloud Folder`,
                    status: "aprobado",
                    CbteTipo: 11,
                    PtoVta: 1,
                    CbteDesde: cbteDesde,
                    isPaid: false,
                    created_at: invDate.toISOString(),
                    batchId: batchId // Inject batchId
                };

                const tx = {
                    id: Math.random().toString(36).substring(2, 15) + Date.now().toString(36),
                    transaction_date: invDate.toISOString(),
                    concept: 'Depósito Cloud Folder',
                    voucher_number: String(Math.floor(Math.random() * 900000) + 500000),
                    amount: amount,
                    description: `Escaneo automático cloud OneDrive`,
                    client_name: client.name,
                    bank_name: 'GALICIA',
                    is_transferred: false,
                    linked_invoices: [],
                    created_at: new Date().toISOString(),
                    batchId: batchId // Inject batchId
                };

                addedInvoices.push(inv);
                addedTxs.push(tx);
            }

            await saveJsonFile(invoicesFilePath, [...addedInvoices, ...currentInvoices]);
            
            const mergedTxs = [...addedTxs, ...currentTxs];
            mergedTxs.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));
            await saveJsonFile(transactionsFilePath, mergedTxs);

            // Add to ingestions log
            currentIngestions.push({
                batchId,
                timestamp: new Date().toISOString(),
                fileName: "Sincronización Cloud Folder (OneDrive)",
                dataType: "mixed",
                ingestionType: "cloud",
                recordCount: addedInvoices.length + addedTxs.length,
                status: "active"
            });
            await saveJsonFile(ingestionsFilePath, currentIngestions);

            return new Response(JSON.stringify({ 
                success: true, 
                message: "Escaneo Cloud completado. Se importaron 3 facturas y 3 movimientos desde OneDrive." 
            }), { status: 200 });
        }

        return new Response(JSON.stringify({ error: 'invalid ingestionType' }), { status: 400 });

    } catch (error) {
        console.error('Error in /api/commander/ingest POST:', error);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const batchId = searchParams.get('batchId');

        if (!userId || !batchId) {
            return new Response(JSON.stringify({ error: 'userId and batchId are required' }), { status: 400 });
        }

        const { invoicesFilePath, transactionsFilePath, ingestionsFilePath } = getPaths(userId);

        // Load ingestions log
        const ingestions = await loadJsonFile(ingestionsFilePath);
        const ingestion = ingestions.find(i => i.batchId === batchId);

        if (!ingestion) {
            return new Response(JSON.stringify({ error: 'Lote de importación no encontrado' }), { status: 404 });
        }

        if (ingestion.status === 'rolled_back') {
            return new Response(JSON.stringify({ error: 'Este lote ya ha sido revertido previamente.' }), { status: 400 });
        }

        // Remove from invoices database if needed
        if (ingestion.dataType === 'invoices' || ingestion.dataType === 'mixed') {
            const invoices = await loadJsonFile(invoicesFilePath);
            const filteredInvoices = invoices.filter(inv => inv.batchId !== batchId);
            await saveJsonFile(invoicesFilePath, filteredInvoices);
        }

        // Remove from bank transactions database if needed
        if (ingestion.dataType === 'transactions' || ingestion.dataType === 'mixed') {
            const transactions = await loadJsonFile(transactionsFilePath);
            const filteredTxs = transactions.filter(tx => tx.batchId !== batchId);
            await saveJsonFile(transactionsFilePath, filteredTxs);
        }

        // Mark as rolled back in ingestions log
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
