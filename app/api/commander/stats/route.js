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
    // Input format: DD/MM/YYYY
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}`;
    }
    return new Date().toISOString().substring(0, 7);
};

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const clientFilter = searchParams.get('client') || '';

        if (!userId) {
            return new Response(JSON.stringify({ error: 'userId is required' }), { status: 400 });
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

        const approvedInvoices = invoices.filter(inv => inv.status === 'aprobado');

        // Pre-build index of related notes to avoid O(N^2) complexity
        const notesIndex = {}; // key: "type_ptoVta_nro" -> list of related notes
        approvedInvoices.forEach(item => {
            const itemType = Number(getCbteTipo(item));
            const isNote = [2, 3, 7, 8, 12, 13, 202, 203, 207, 208, 212, 213].includes(itemType);
            if (!isNote) return;

            const assocList = item.CbtesAsoc || item.cbtesAsoc || [];
            assocList.forEach(assoc => {
                const assocTipo = Number(assoc.Tipo !== undefined ? assoc.Tipo : assoc.tipo);
                const assocPtoVta = Number(assoc.PtoVta !== undefined ? assoc.PtoVta : assoc.ptoVta);
                const assocNro = Number(assoc.Nro !== undefined ? assoc.Nro : assoc.nro);
                
                const key = `${assocTipo}_${assocPtoVta}_${assocNro}`;
                if (!notesIndex[key]) {
                    notesIndex[key] = [];
                }
                if (!notesIndex[key].some(n => n.id === item.id)) {
                    notesIndex[key].push(item);
                }
            });
        });

        // Helper to get related vouchers (O(1) lookup)
        const getRelatedVouchers = (parentInvoice) => {
            if (!parentInvoice) return [];
            
            const parentType = Number(getCbteTipo(parentInvoice));
            const parentPtoVta = parentInvoice.PtoVta !== undefined ? Number(parentInvoice.PtoVta) : 1;
            const parentNro = parentInvoice.CbteDesde !== undefined ? Number(parentInvoice.CbteDesde) : (parentInvoice.id || 0);
            
            const key = `${parentType}_${parentPtoVta}_${parentNro}`;
            return notesIndex[key] || [];
        };

        // Helper to get invoice balance
        const getInvoiceBalance = (invoice) => {
            if (!invoice) return 0;
            if (invoice.isPaid) return 0;

            const invoiceType = Number(getCbteTipo(invoice));
            const isBaseInvoice = [1, 6, 11, 211].includes(invoiceType);
            if (!isBaseInvoice) {
                return invoice.inflationAdded ? (invoice.adjustedImporte || invoice.Importe) : invoice.Importe;
            }

            let balance = invoice.inflationAdded ? (invoice.adjustedImporte || invoice.Importe) : invoice.Importe;
            const related = getRelatedVouchers(invoice);
            related.forEach(item => {
                const type = Number(getCbteTipo(item));
                const isCreditNote = [3, 8, 13, 203, 208, 213].includes(type);
                const amt = Number(item.Importe || 0);
                if (isCreditNote) {
                    balance -= amt;
                } else {
                    balance += amt;
                }
            });
            return Math.max(0, balance);
        };

        // Extract list of unique client names/cuit
        const clientsSet = new Set();
        approvedInvoices.forEach(inv => {
            if (inv.RazonSocial && inv.RazonSocial !== '-') {
                clientsSet.add(inv.RazonSocial.trim());
            }
        });
        const clients = Array.from(clientsSet).sort();

        // 1. Calculate Monthly Invoicing stats
        const monthlyInvoicingMap = {};
        approvedInvoices.forEach(inv => {
            const clientName = inv.RazonSocial || "";
            if (clientFilter && !clientName.toLowerCase().includes(clientFilter.toLowerCase())) {
                return;
            }

            const type = getCbteTipo(inv);
            const isCreditNote = [3, 8, 13, 203, 208, 213].includes(type);
            const dateStr = getEmissionDate(inv);
            const monthKey = getMonthKey(dateStr); // YYYY-MM
            const amount = Number(inv.adjustedImporte || inv.Importe || 0);

            if (!monthlyInvoicingMap[monthKey]) {
                monthlyInvoicingMap[monthKey] = 0;
            }

            if (isCreditNote) {
                monthlyInvoicingMap[monthKey] -= amount;
            } else {
                monthlyInvoicingMap[monthKey] += amount;
            }
        });

        // 2. Calculate Monthly Banking Deposits stats (Deposits = credits only)
        const deposits = transactions.filter(tx => Number(tx.amount) > 0);
        const monthlyDepositsMap = {};
        deposits.forEach(tx => {
            const dateStr = tx.transaction_date.substring(0, 10); // YYYY-MM-DD
            const monthKey = dateStr.substring(0, 7); // YYYY-MM
            const amount = Number(tx.amount || 0);

            if (!monthlyDepositsMap[monthKey]) {
                monthlyDepositsMap[monthKey] = 0;
            }
            monthlyDepositsMap[monthKey] += amount;
        });

        // Build sorted list of months for charts (past 12 months or active months range)
        const allMonthsSet = new Set([...Object.keys(monthlyInvoicingMap), ...Object.keys(monthlyDepositsMap)]);
        const sortedMonths = Array.from(allMonthsSet).sort();

        // Fill gaps and map for frontend
        const invoiceData = [];
        const bankingData = [];

        sortedMonths.forEach(mKey => {
            const [year, month] = mKey.split('-');
            const date = new Date(parseInt(year), parseInt(month) - 1, 15);
            const label = date.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' });

            invoiceData.push({
                month: mKey,
                total_amount: Math.max(0, monthlyInvoicingMap[mKey] || 0),
                label
            });

            bankingData.push({
                month: mKey,
                total_amount: monthlyDepositsMap[mKey] || 0,
                label
            });
        });

        // 3. Deposits by Bank Account (Pie Chart)
        const bankDepositsMap = {};
        deposits.forEach(tx => {
            const bank = tx.bank_name || 'OTROS / MANUAL';
            const amount = Number(tx.amount || 0);
            if (!bankDepositsMap[bank]) {
                bankDepositsMap[bank] = { count: 0, total_amount: 0 };
            }
            bankDepositsMap[bank].count++;
            bankDepositsMap[bank].total_amount += amount;
        });

        const bankStats = Object.keys(bankDepositsMap).map(bank => ({
            name: bank,
            value: bankDepositsMap[bank].count,
            total_amount: bankDepositsMap[bank].total_amount
        })).sort((a, b) => b.total_amount - a.total_amount);

        // 4. Invoicing Voucher Type Distribution (Pie Chart)
        const voucherTypeMap = {};
        approvedInvoices.forEach(inv => {
            const clientName = inv.RazonSocial || "";
            if (clientFilter && !clientName.toLowerCase().includes(clientFilter.toLowerCase())) {
                return;
            }
            const type = getCbteTipo(inv);
            const isCreditNote = [3, 8, 13, 203, 208, 213].includes(type);
            const name = getVoucherName(type);
            const amount = Number(inv.adjustedImporte || inv.Importe || 0);

            if (!voucherTypeMap[name]) {
                voucherTypeMap[name] = { count: 0, total_amount: 0 };
            }
            voucherTypeMap[name].count++;
            if (isCreditNote) {
                voucherTypeMap[name].total_amount -= amount;
            } else {
                voucherTypeMap[name].total_amount += amount;
            }
        });

        const voucherStats = Object.keys(voucherTypeMap).map(name => ({
            name,
            value: voucherTypeMap[name].count,
            total_amount: Math.max(0, voucherTypeMap[name].total_amount)
        })).sort((a, b) => b.total_amount - a.total_amount);

        // 5. Daily timeline deposits with Brush
        const dailyTimelineMap = {};
        deposits.forEach(tx => {
            const dateStr = tx.transaction_date.split('T')[0]; // YYYY-MM-DD
            const amount = Number(tx.amount || 0);

            if (!dailyTimelineMap[dateStr]) {
                dailyTimelineMap[dateStr] = 0;
            }
            dailyTimelineMap[dateStr] += amount;
        });

        const dailyBankingData = Object.keys(dailyTimelineMap).map(dateStr => {
            const parts = dateStr.split('-');
            const timestamp = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0).getTime();
            return {
                dateStr,
                timestamp,
                total_amount: dailyTimelineMap[dateStr]
            };
        }).sort((a, b) => a.timestamp - b.timestamp);

        // 6. Debt Ranking by Client
        const debtRankingMap = {};
        approvedInvoices.forEach(inv => {
            const client = inv.RazonSocial || "Consumidor Final";
            const cuit = inv.CUIT || "-";
            const balance = getInvoiceBalance(inv);

            const key = `${client} (CUIT: ${cuit})`;

            if (!debtRankingMap[key]) {
                debtRankingMap[key] = { client_name: client, cuit, total_debt: 0 };
            }
            debtRankingMap[key].total_debt += balance;
        });

        const debtRanking = Object.values(debtRankingMap)
            .filter(item => item.total_debt > 0)
            .sort((a, b) => b.total_debt - a.total_debt);

        // 7. Monthly Bank Matching/Reconciliation Rates
        const monthlyReconMap = {};
        transactions.forEach(tx => {
            const dateStr = tx.transaction_date.substring(0, 10);
            const monthKey = dateStr.substring(0, 7);
            const isReconciled = tx.linked_invoices && tx.linked_invoices.length > 0;

            if (!monthlyReconMap[monthKey]) {
                monthlyReconMap[monthKey] = { total: 0, reconciled: 0 };
            }
            monthlyReconMap[monthKey].total++;
            if (isReconciled) {
                monthlyReconMap[monthKey].reconciled++;
            }
        });

        const reconciliationStats = sortedMonths.map(mKey => {
            const data = monthlyReconMap[mKey] || { total: 0, reconciled: 0 };
            const rate = data.total > 0 ? Math.round((data.reconciled / data.total) * 1000) / 10 : 0;
            const [year, month] = mKey.split('-');
            const date = new Date(parseInt(year), parseInt(month) - 1, 15);
            return {
                month: mKey,
                rate,
                label: date.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })
            };
        });

        return new Response(JSON.stringify({
            clients,
            invoiceData,
            bankingData,
            bankStats,
            voucherStats,
            dailyBankingData,
            debtRanking,
            reconciliationStats
        }), { status: 200 });

    } catch (error) {
        console.error('Error in /api/commander/stats GET:', error);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
    }
}
