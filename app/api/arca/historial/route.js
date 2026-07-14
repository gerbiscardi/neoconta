import { NextResponse } from 'next/server';
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

// Helper to get sorting timestamp
const getSortDate = (inv) => {
    if (inv.created_at) return new Date(inv.created_at).getTime();
    const dateStr = inv.cbteFch || inv.CbteFch;
    if (dateStr && String(dateStr).length === 8) {
        const year = parseInt(String(dateStr).substring(0, 4), 10);
        const month = parseInt(String(dateStr).substring(4, 6), 10) - 1;
        const day = parseInt(String(dateStr).substring(6, 8), 10);
        return new Date(year, month, day).getTime();
    }
    return 0;
};

// Helper to get CUIT
const getInvoiceCuit = (inv) => {
    if (!inv) return null;
    let doc = inv.DocNro || inv.CUIT || inv.Cuit || inv.cuit;
    if (doc) {
        return String(doc).replace(/[^0-9]/g, '');
    }
    const afipDoc = inv.afip_response?.response?.FeDetResp?.FECAEDetResponse?.[0]?.DocNro;
    if (afipDoc) {
        return String(afipDoc).replace(/[^0-9]/g, '');
    }
    return null;
};

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
        }

        const invoicesDir = path.join(process.cwd(), 'data', 'invoices');
        const historyFile = path.join(invoicesDir, `${userId}_history.json`);

        let history = [];
        try {
            const fileData = await fs.readFile(historyFile, 'utf8');
            history = JSON.parse(fileData);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }

        // Normalize history objects to avoid property mismatch crashes
        const normalized = history.map(inv => ({
            ...inv,
            RazonSocial: inv.RazonSocial || inv.cliente || inv.Nombre || inv.nombre || "-",
            CUIT: inv.CUIT || inv.Cuit || inv.cuit || inv.DocNro || "-",
            Importe: inv.Importe || inv.Total || inv.importe || inv.total || 0,
            status: inv.status || 'aprobado'
        }));

        const isFrequent = searchParams.get('frequent') === 'true';

        if (isFrequent) {
            const clientCounts = {};
            const clientDetails = {};

            normalized.forEach(inv => {
                if (inv.status !== 'aprobado') return;

                const doc = inv.CUIT || inv.Cuit || inv.cuit || inv.DocNro;
                if (!doc || doc === "-") return;
                const cleanDoc = String(doc).replace(/[^0-9]/g, '');
                if (!cleanDoc || cleanDoc === "0") return;

                clientCounts[cleanDoc] = (clientCounts[cleanDoc] || 0) + 1;

                if (!clientDetails[cleanDoc] || (!clientDetails[cleanDoc].condicionIva && (inv.CondicionIVA || inv.condicion || inv.Condicion))) {
                    clientDetails[cleanDoc] = {
                        cuit: cleanDoc,
                        razonSocial: inv.RazonSocial || inv.cliente || inv.nombre || "Sin Nombre",
                        docTipo: inv.DocTipo !== undefined ? Number(inv.DocTipo) : (cleanDoc.length >= 10 ? 80 : 96),
                        condicionIva: inv.CondicionIVA || inv.condicion || inv.Condicion || "Consumidor Final"
                    };
                }
            });

            const sortedCuits = Object.keys(clientCounts).sort((a, b) => clientCounts[b] - clientCounts[a]);
            const topClients = sortedCuits.slice(0, 10).map(c => clientDetails[c]);

            return NextResponse.json({ success: true, clients: topClients });
        }

        const isSummary = searchParams.get('summary') === 'true';

        if (isSummary) {
            // 1. Calculate summary stats (O(N) single loop)
            let totalInvoiced = 0;
            let invoiceCount = 0;
            const approved = normalized.filter(inv => inv.status === 'aprobado');
            
            const monthlyInvoiced = {};
            
            // Initialize last 12 months (up to the current month)
            const defaultMonths = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
            const now = new Date();
            const last12Months = [];
            for (let i = 11; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                last12Months.push({
                    year: d.getFullYear(),
                    month: d.getMonth(),
                    label: defaultMonths[d.getMonth()],
                    value: 0,
                    isPrediction: false
                });
            }

            approved.forEach(inv => {
                const type = getCbteTipo(inv);
                const isCredit = [3, 8, 13, 203, 208, 213].includes(type);
                const amount = parseFloat(inv.Importe || 0);
                const diff = isCredit ? -amount : amount;

                totalInvoiced += diff;
                invoiceCount++;

                // Aggregate by month for cash flow forecast
                const dateStr = inv.created_at || inv.cbteFch;
                if (dateStr) {
                    const monthKey = dateStr.substring(0, 7) + "-01"; // e.g. "2026-05-01"
                    monthlyInvoiced[monthKey] = (monthlyInvoiced[monthKey] || 0) + diff;

                    // Also aggregate into the last 12 months chart data
                    let invDate;
                    if (String(dateStr).includes('-') || String(dateStr).includes('/')) {
                        invDate = new Date(dateStr);
                    } else if (String(dateStr).length === 8) {
                        const year = parseInt(String(dateStr).substring(0, 4), 10);
                        const month = parseInt(String(dateStr).substring(4, 6), 10) - 1;
                        const day = parseInt(String(dateStr).substring(6, 8), 10);
                        invDate = new Date(year, month, day);
                    }
                    if (invDate) {
                        const invYear = invDate.getFullYear();
                        const invMonth = invDate.getMonth();
                        const match = last12Months.find(m => m.year === invYear && m.month === invMonth);
                        if (match) {
                            match.value += diff;
                        }
                    }
                }
            });

            // Ensure monthly sums are not negative
            Object.keys(monthlyInvoiced).forEach(k => {
                if (monthlyInvoiced[k] < 0) monthlyInvoiced[k] = 0;
            });

            last12Months.forEach(m => {
                if (m.value < 0) m.value = 0;
            });

            // Convert to Prophet format ds & y
            const forecastHistory = Object.keys(monthlyInvoiced).map(k => ({
                ds: k,
                y: monthlyInvoiced[k]
            })).sort((a, b) => new Date(a.ds) - new Date(b.ds));

            // Format recent activities (last 5 items)
            const sortedApproved = [...approved].sort((a, b) => getSortDate(b) - getSortDate(a));
            const recentActivities = sortedApproved.slice(0, 5).map(inv => {
                const dateStr = inv.created_at || inv.cbteFch;
                const buyerName = inv.RazonSocial || "Consumidor Final";
                const type = getCbteTipo(inv);
                const voucherName = getVoucherName(type);
                return {
                    title: `${voucherName} emitida a ${buyerName}`,
                    time: dateStr ? new Date(dateStr).toLocaleDateString('es-AR') : 'Reciente',
                    type: [3, 8, 13, 203, 208, 213].includes(type) ? 'warning' : 'success',
                    date: dateStr ? new Date(dateStr).toISOString() : new Date(0).toISOString()
                };
            });

            return NextResponse.json({
                success: true,
                summary: {
                    totalInvoiced,
                    invoiceCount,
                    recentActivities,
                    forecastHistory,
                    clientChartPoints: last12Months
                }
            });
        }

        // Build approved parents set
        const approvedParentsSet = new Set();
        normalized.forEach(parent => {
            if (parent.status === 'aprobado') {
                const parentType = getCbteTipo(parent);
                const parentPtoVta = parent.PtoVta || parent.ptoVta || 1;
                const parentNro = parent.CbteDesde || parent.cbteDesde || parent.id || 0;
                approvedParentsSet.add(`${Number(parentType)}_${Number(parentPtoVta)}_${Number(parentNro)}`);
            }
        });

        // Non-summary query: Filter and paginate
        const cuit = searchParams.get('cuit');
        const search = searchParams.get('search');
        const status = searchParams.get('status');

        let filtered = normalized.filter(invoice => {
            if (invoice.status === "aprobado") {
                const invoiceType = getCbteTipo(invoice);
                const isNote = [2, 3, 7, 8, 12, 13, 202, 203, 207, 208, 212, 213].includes(invoiceType);
                if (isNote) {
                    const assocList = invoice.CbtesAsoc || invoice.cbtesAsoc || [];
                    const hasExistingParent = assocList.some(assoc => {
                        const assocTipo = assoc.Tipo !== undefined ? assoc.Tipo : assoc.tipo;
                        const assocPtoVta = assoc.PtoVta !== undefined ? assoc.PtoVta : assoc.ptoVta;
                        const assocNro = assoc.Nro !== undefined ? assoc.Nro : assoc.nro;
                        
                        return approvedParentsSet.has(`${Number(assocTipo)}_${Number(assocPtoVta)}_${Number(assocNro)}`);
                    });
                    if (hasExistingParent) {
                        return false;
                    }
                }
            }
            return true;
        });

        if (status && status !== 'all') {
            filtered = filtered.filter(inv => inv.status === status);
        }

        if (cuit) {
            const cleanCuit = cuit.replace(/[^0-9]/g, '');
            filtered = filtered.filter(inv => getInvoiceCuit(inv) === cleanCuit);
        }

        if (search) {
            const term = search.toLowerCase();
            filtered = filtered.filter(inv => 
                (inv.RazonSocial && inv.RazonSocial.toLowerCase().includes(term)) ||
                (inv.CUIT && inv.CUIT.includes(term)) ||
                (inv.Concepto && inv.Concepto.toLowerCase().includes(term)) ||
                (inv.cae && inv.cae.includes(term))
            );
        }

        // Sort by date descending
        filtered.sort((a, b) => getSortDate(b) - getSortDate(a));

        const pageStr = searchParams.get('page');
        const limitStr = searchParams.get('limit');

        if (pageStr || limitStr) {
            const page = parseInt(pageStr || '1', 10);
            const limit = parseInt(limitStr || '50', 10);
            const startIndex = (page - 1) * limit;
            const paginated = filtered.slice(startIndex, startIndex + limit);

            return NextResponse.json({
                history: paginated,
                total: filtered.length
            });
        }

        // Default: If no pagination requested but search/cuit is active, return all matching items.
        // If nothing is active, limit to 200 items to protect server memory.
        const shouldLimitAll = !cuit && !search && (!status || status === 'all');
        const finalHistory = shouldLimitAll ? filtered.slice(0, 200) : filtered;

        return NextResponse.json({
            history: finalHistory,
            total: filtered.length
        });

    } catch (error) {
        console.error('Error fetching invoice history:', error);
        return NextResponse.json({ error: 'Failed to fetch invoice history' }, { status: 500 });
    }
}
