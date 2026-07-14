import fs from 'fs/promises';
import path from 'path';

// Helper to resolve AFIP voucher type
const getCbteTipo = (invoice) => {
    if (!invoice) return 11;
    if (invoice.CbteTipo !== undefined) return Number(invoice.CbteTipo);
    if (invoice.cbteTipo !== undefined) return Number(invoice.cbteTipo);
    const respTipo = invoice.afip_response?.response?.FeCabResp?.CbteTipo;
    if (respTipo !== undefined) return Number(respTipo);
    const respTipo2 = invoice.afip_response?.CbteTipo;
    if (respTipo2 !== undefined) return Number(respTipo2);
    return 11;
};

// Helper to map type to friendly name
const getVoucherName = (type) => {
    const mapping = {
        1: "Factura A",
        2: "ND A",
        3: "NC A",
        6: "Factura B",
        7: "ND B",
        8: "NC B",
        11: "Factura C",
        12: "ND C",
        13: "NC C",
        201: "FCE A",
        202: "ND PyME A",
        203: "NC PyME A",
        206: "FCE B",
        207: "ND PyME B",
        208: "NC PyME B",
        211: "FCE C",
        212: "ND PyME C",
        213: "NC PyME C"
    };
    return mapping[Number(type)] || `Cbte ${type}`;
};

// Helper to get formatted emission date
const getEmissionDate = (invoice) => {
    let rawDateStr = "";
    if (invoice.created_at) {
        rawDateStr = invoice.created_at.split('T')[0]; // YYYY-MM-DD
    } else {
        const dateStr = invoice.cbteFch || invoice.CbteFch || invoice?.afip_response?.CbteFch;
        if (dateStr && String(dateStr).length === 8) {
            const year = String(dateStr).substring(0, 4);
            const month = String(dateStr).substring(4, 6);
            const day = String(dateStr).substring(6, 8);
            rawDateStr = `${year}-${month}-${day}`;
        }
    }

    if (rawDateStr) {
        const parts = rawDateStr.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
        }
    }
    
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
};

// Helper to extract year and month key (YYYY-MM)
const getMonthKey = (dateStr) => {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}`;
    }
    return new Date().toISOString().substring(0, 7);
};

export async function POST(request) {
    try {
        const body = await request.json();
        const { userId, widgets, clientFilter } = body;

        if (!userId) {
            return new Response(JSON.stringify({ error: 'userId is required' }), { status: 400 });
        }

        if (!widgets || !Array.isArray(widgets)) {
            return new Response(JSON.stringify({ error: 'widgets array is required' }), { status: 400 });
        }

        const invoicesFilePath = path.join(process.cwd(), 'data', 'invoices', `${userId}_history.json`);
        const transactionsFilePath = path.join(process.cwd(), 'data', 'users', userId, 'banco', '_transactions.json');

        // Load files safely
        let invoices = [];
        try {
            const invoicesData = await fs.readFile(invoicesFilePath, 'utf-8');
            invoices = JSON.parse(invoicesData).map(inv => ({
                ...inv,
                RazonSocial: inv.RazonSocial || inv.cliente || inv.Nombre || inv.nombre || "-",
                CUIT: inv.CUIT || inv.Cuit || inv.cuit || inv.DocNro || "-",
                Importe: inv.Importe || inv.Total || inv.importe || inv.total || 0,
                status: inv.status || 'aprobado'
            }));
        } catch (error) {
            if (error.code !== 'ENOENT') console.error('Error reading invoices file:', error);
        }

        let transactions = [];
        try {
            const txData = await fs.readFile(transactionsFilePath, 'utf-8');
            transactions = JSON.parse(txData);
        } catch (error) {
            if (error.code !== 'ENOENT') console.error('Error reading bank transactions file:', error);
        }

        // Precompute stats maps to process custom widgets
        const approvedInvoices = invoices.filter(inv => inv.status === 'aprobado');
        const bankDeposits = transactions.filter(tx => Number(tx.amount) > 0);

        const results = {};

        for (const widget of widgets) {
            const { id, type, dataSource, xAxisDimension, yAxisMeasure, aggregation } = widget;

            let sourceData = [];
            if (dataSource === 'invoices') {
                sourceData = approvedInvoices;
            } else if (dataSource === 'transactions') {
                sourceData = bankDeposits;
            }

            // Apply global client filter if applicable
            if (clientFilter) {
                if (dataSource === 'invoices') {
                    sourceData = sourceData.filter(item => 
                        (item.RazonSocial || "").toLowerCase().includes(clientFilter.toLowerCase())
                    );
                } else if (dataSource === 'transactions') {
                    sourceData = sourceData.filter(item => 
                        (item.client_name || "").toLowerCase().includes(clientFilter.toLowerCase())
                    );
                }
            }

            if (type === 'kpi') {
                let value = 0;
                if (yAxisMeasure === 'amount') {
                    if (aggregation === 'sum') {
                        sourceData.forEach(item => {
                            const amt = Number(item.adjustedImporte || item.Importe || item.amount || 0);
                            if (dataSource === 'invoices') {
                                const cbteType = getCbteTipo(item);
                                const isCreditNote = [3, 8, 13, 203, 208, 213].includes(cbteType);
                                value += isCreditNote ? -amt : amt;
                            } else {
                                value += amt;
                            }
                        });
                    } else if (aggregation === 'avg') {
                        let total = 0;
                        sourceData.forEach(item => {
                            const amt = Number(item.adjustedImporte || item.Importe || item.amount || 0);
                            if (dataSource === 'invoices') {
                                const cbteType = getCbteTipo(item);
                                const isCreditNote = [3, 8, 13, 203, 208, 213].includes(cbteType);
                                total += isCreditNote ? -amt : amt;
                            } else {
                                total += amt;
                            }
                        });
                        value = sourceData.length > 0 ? (total / sourceData.length) : 0;
                    } else if (aggregation === 'count') {
                        value = sourceData.length;
                    }
                } else {
                    // count
                    value = sourceData.length;
                }

                results[id] = { value: Math.max(0, value) };

            } else {
                // type === 'chart'
                const groups = {};

                sourceData.forEach(item => {
                    let groupKey = 'Otros';

                    if (xAxisDimension === 'month') {
                        if (dataSource === 'invoices') {
                            const dateStr = getEmissionDate(item);
                            groupKey = getMonthKey(dateStr);
                        } else {
                            groupKey = item.transaction_date ? item.transaction_date.substring(0, 7) : new Date().toISOString().substring(0, 7);
                        }
                    } else if (xAxisDimension === 'date') {
                        if (dataSource === 'invoices') {
                            const dateStr = getEmissionDate(item); // DD/MM/YYYY -> YYYY-MM-DD
                            const parts = dateStr.split('/');
                            groupKey = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : dateStr;
                        } else {
                            groupKey = item.transaction_date ? item.transaction_date.substring(0, 10) : new Date().toISOString().substring(0, 10);
                        }
                    } else if (xAxisDimension === 'client') {
                        groupKey = dataSource === 'invoices' ? (item.RazonSocial || 'Sin Razón Social') : (item.client_name || 'Sin Cliente');
                    } else if (xAxisDimension === 'voucherType') {
                        if (dataSource === 'invoices') {
                            const cbteType = getCbteTipo(item);
                            groupKey = getVoucherName(cbteType);
                        } else {
                            groupKey = item.concept || 'Movimiento Banco';
                        }
                    } else if (xAxisDimension === 'bank') {
                        groupKey = item.bank_name || 'GALICIA';
                    }

                    const amt = Number(item.adjustedImporte || item.Importe || item.amount || 0);

                    if (!groups[groupKey]) {
                        groups[groupKey] = [];
                    }
                    groups[groupKey].push({ amt, item });
                });

                // Compute aggregations for each group
                const groupList = Object.keys(groups).map(name => {
                    let val = 0;
                    const items = groups[name];

                    if (yAxisMeasure === 'amount') {
                        if (aggregation === 'sum') {
                            items.forEach(g => {
                                if (dataSource === 'invoices') {
                                    const cbteType = getCbteTipo(g.item);
                                    const isCreditNote = [3, 8, 13, 203, 208, 213].includes(cbteType);
                                    val += isCreditNote ? -g.amt : g.amt;
                                } else {
                                    val += g.amt;
                                }
                            });
                        } else if (aggregation === 'avg') {
                            let total = 0;
                            items.forEach(g => {
                                if (dataSource === 'invoices') {
                                    const cbteType = getCbteTipo(g.item);
                                    const isCreditNote = [3, 8, 13, 203, 208, 213].includes(cbteType);
                                    total += isCreditNote ? -g.amt : g.amt;
                                } else {
                                    total += g.amt;
                                }
                            });
                            val = total / items.length;
                        } else if (aggregation === 'count') {
                            val = items.length;
                        }
                    } else {
                        // count
                        val = items.length;
                    }

                    // Format user-friendly labels for dates/months
                    let label = name;
                    if (xAxisDimension === 'month' && name.includes('-')) {
                        const [year, month] = name.split('-');
                        const dateObj = new Date(parseInt(year), parseInt(month) - 1, 15);
                        label = dateObj.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' });
                    } else if (xAxisDimension === 'date' && name.includes('-')) {
                        const parts = name.split('-');
                        if (parts.length === 3) {
                            const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0);
                            label = dateObj.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
                        }
                    }

                    return {
                        name,
                        value: Math.max(0, val),
                        label
                    };
                });

                // Sorting
                if (xAxisDimension === 'month' || xAxisDimension === 'date') {
                    // Sort chronologically by the raw name (YYYY-MM or YYYY-MM-DD)
                    groupList.sort((a, b) => a.name.localeCompare(b.name));
                } else {
                    // Sort descending by value (largest first)
                    groupList.sort((a, b) => b.value - a.value);
                }

                results[id] = groupList;
            }
        }

        return new Response(JSON.stringify({ success: true, results }), { status: 200 });

    } catch (error) {
        console.error('Error in /api/commander/widgets/data POST:', error);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
    }
}
