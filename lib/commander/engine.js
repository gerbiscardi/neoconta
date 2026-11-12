/**
 * Centralized Commander BI Financial Calculation Engine.
 * Single source of truth for /api/commander/stats, /api/commander/widgets/data,
 * and /api/commander/audit to guarantee zero discrepancies between KPIs,
 * overview charts, and custom widgets.
 */

export const INVOICE_TYPES = new Set([1, 6, 11, 51, 201, 206, 211]);
export const DEBIT_NOTE_TYPES = new Set([2, 7, 12, 52, 202, 207, 212]);
export const CREDIT_NOTE_TYPES = new Set([3, 8, 13, 53, 203, 208, 213]);

export const VOUCHER_NAMES = {
    1: 'Factura A',
    2: 'ND A',
    3: 'NC A',
    6: 'Factura B',
    7: 'ND B',
    8: 'NC B',
    11: 'Factura C',
    12: 'ND C',
    13: 'NC C',
    51: 'Factura M',
    52: 'ND M',
    53: 'NC M',
    201: 'FCE A',
    202: 'ND PyME A',
    203: 'NC PyME A',
    206: 'FCE B',
    207: 'ND PyME B',
    208: 'NC PyME B',
    211: 'FCE C',
    212: 'ND PyME C',
    213: 'NC PyME C'
};

export function getCbteTipo(invoice) {
    if (!invoice) return 11;
    if (invoice.CbteTipo !== undefined && invoice.CbteTipo !== null && invoice.CbteTipo !== '') {
        return Number(invoice.CbteTipo);
    }
    if (invoice.cbteTipo !== undefined && invoice.cbteTipo !== null && invoice.cbteTipo !== '') {
        return Number(invoice.cbteTipo);
    }
    const respTipo = invoice.afip_response?.response?.FeCabResp?.CbteTipo;
    if (respTipo !== undefined) return Number(respTipo);
    const respTipo2 = invoice.afip_response?.CbteTipo;
    if (respTipo2 !== undefined) return Number(respTipo2);
    return 11;
}

export function getVoucherName(type) {
    return VOUCHER_NAMES[Number(type)] || `Cbte ${type}`;
}

export function round2(num) {
    return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
}

function parseDateValue(raw) {
    if (!raw) return null;
    const str = String(raw).trim();
    if (!str) return null;

    if (/^\d{8}$/.test(str)) {
        const y = Number(str.slice(0, 4));
        const m = Number(str.slice(4, 6));
        const d = Number(str.slice(6, 8));
        const dt = new Date(Date.UTC(y, m - 1, d));
        if (dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d) {
            return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
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
            return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
        }
        return null;
    }

    const dmyMatch = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(str);
    if (dmyMatch) {
        const d = Number(dmyMatch[1]);
        const m = Number(dmyMatch[2]);
        const y = Number(dmyMatch[3]);
        const dt = new Date(Date.UTC(y, m - 1, d));
        if (dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d) {
            return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        }
        return null;
    }

    return null;
}

/**
 * Resolves fiscal date strictly prioritizing cbteFch (AFIP fiscal date).
 * Never fabricates today's date when missing.
 */
export function parseFiscalDate(invoice) {
    const fiscalRaw =
        invoice?.cbteFch ||
        invoice?.CbteFch ||
        invoice?.afip_response?.CbteFch ||
        invoice?.afip_response?.response?.FeDetResp?.FECAEDetResponse?.[0]?.CbteFch;

    const fiscalIso = parseDateValue(fiscalRaw);
    if (fiscalIso) {
        return { isoDate: fiscalIso, monthKey: fiscalIso.slice(0, 7), dateSource: 'cbteFch' };
    }

    const fallbackIso = parseDateValue(invoice?.fecha || invoice?.created_at);
    if (fallbackIso) {
        return { isoDate: fallbackIso, monthKey: fallbackIso.slice(0, 7), dateSource: 'created_at' };
    }

    return { isoDate: null, monthKey: null, dateSource: 'missing' };
}

export function parseTransactionDate(tx) {
    const iso = parseDateValue(tx?.transaction_date || tx?.date || tx?.created_at);
    if (iso) {
        return { isoDate: iso, monthKey: iso.slice(0, 7) };
    }
    return { isoDate: null, monthKey: null };
}

/**
 * Classifies an invoice by provenance and fiscal verification status.
 * Never auto-approves records without verifiable status.
 */
export function classifyInvoice(inv) {
    const rawStatus = typeof inv?.status === 'string' ? inv.status.trim().toLowerCase() : '';
    const src = String(inv?.source || '').trim().toLowerCase();
    const isExternalSource =
        src === 'excel_import' ||
        src === 'sql_import' ||
        src === 'cloud_import' ||
        rawStatus === 'importado_externo' ||
        inv?.isFiscalVerified === false;

    const caeStr = String(inv?.cae || inv?.CAE || inv?.afip_response?.CAE || inv?.afip_response?.cae || '').trim();
    const hasCae = /^\d{14}$/.test(caeStr);
    const hasAfipResponse = Boolean(
        inv?.afip_response &&
        typeof inv.afip_response === 'object' &&
        (inv.afip_response.cae || inv.afip_response.CAE || inv.afip_response.FeDetResp || inv.afip_response.response?.FeDetResp)
    );
    const hasCaeVtoAndVoucher = Boolean(
        inv?.caeVto &&
        String(inv.caeVto).trim().length >= 8 &&
        Number(inv?.PtoVta) > 0 &&
        Number(inv?.CbteDesde) > 0
    );
    const hasFiscalAuthEvidence = hasCae && (hasAfipResponse || hasCaeVtoAndVoucher);

    if (rawStatus === 'rechazado' || rawStatus === 'anulado') {
        return {
            provenance: 'rejected_or_void',
            isFiscalVerified: false,
            rawStatus
        };
    }

    if (isExternalSource) {
        return {
            provenance: 'external_unverified',
            isFiscalVerified: false,
            rawStatus: rawStatus || 'importado_externo'
        };
    }

    // Distinguish stored fiscal evidence from live online verification against ARCA/AFIP web services
    if (rawStatus === 'aprobado' && hasFiscalAuthEvidence) {
        return {
            provenance: 'fiscal_verified',
            isFiscalVerified: true,
            hasCae,
            rawStatus,
            fiscalEvidence: 'stored_emission_evidence',
            onlineArcaVerified: false
        };
    }

    if (rawStatus === 'aprobado') {
        return {
            provenance: 'unverified_missing_evidence',
            isFiscalVerified: false,
            hasCae,
            rawStatus,
            fiscalEvidence: 'missing_stored_evidence',
            onlineArcaVerified: false
        };
    }

    return {
        provenance: 'unverified_missing_status',
        isFiscalVerified: false,
        rawStatus: rawStatus || 'sin_estado'
    };
}

function buildMonthRange(minMonth, maxMonth) {
    if (!minMonth || !maxMonth || minMonth > maxMonth) return [];
    const [sy, sm] = minMonth.split('-').map(Number);
    const [ey, em] = maxMonth.split('-').map(Number);
    const months = [];
    let y = sy;
    let m = sm;
    let guard = 0;
    while ((y < ey || (y === ey && m <= em)) && guard < 240) {
        months.push(`${y}-${String(m).padStart(2, '0')}`);
        m++;
        if (m > 12) {
            m = 1;
            y++;
        }
        guard++;
    }
    return months;
}

function formatMonthLabel(monthKey) {
    if (!monthKey || !monthKey.includes('-')) return 'Sin fecha';
    const [year, month] = monthKey.split('-');
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, 15));
    return date.toLocaleDateString('es-AR', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function isWithinDateRange(isoDate, dateFrom, dateTo) {
    if (!isoDate) return false;
    if (dateFrom && isoDate < dateFrom) return false;
    if (dateTo && isoDate > dateTo) return false;
    return true;
}

export function normalizeInvoiceRecord(inv) {
    const cbteTipo = getCbteTipo(inv);
    const isCreditNote = CREDIT_NOTE_TYPES.has(cbteTipo);
    const isDebitNote = DEBIT_NOTE_TYPES.has(cbteTipo);
    const isBaseInvoice = INVOICE_TYPES.has(cbteTipo);

    const rawAmount = Number(
        inv?.inflationAdded ? (inv?.adjustedImporte ?? inv?.Importe ?? inv?.Total ?? 0) : (inv?.Importe ?? inv?.Total ?? inv?.importe ?? inv?.total ?? 0)
    );
    const amount = Number.isFinite(rawAmount) ? rawAmount : 0;
    const signedAmount = isCreditNote ? -Math.abs(amount) : amount;

    const classification = classifyInvoice(inv);
    const dateInfo = parseFiscalDate(inv);

    return {
        ...inv,
        id: inv?.id || inv?.cae || `inv_${cbteTipo}_${inv?.PtoVta || 0}_${inv?.CbteDesde || 0}`,
        RazonSocial: String(inv?.RazonSocial || inv?.cliente || inv?.Nombre || inv?.nombre || '-').trim(),
        CUIT: String(inv?.CUIT || inv?.Cuit || inv?.cuit || inv?.DocNro || '-').trim(),
        Importe: amount,
        signedAmount,
        cbteTipo,
        voucherName: getVoucherName(cbteTipo),
        isCreditNote,
        isDebitNote,
        isBaseInvoice,
        provenance: classification.provenance,
        isFiscalVerified: classification.isFiscalVerified,
        fiscalEvidence: classification.fiscalEvidence || 'none',
        onlineArcaVerified: Boolean(classification.onlineArcaVerified),
        effectiveStatus: classification.rawStatus,
        isoDate: dateInfo.isoDate,
        monthKey: dateInfo.monthKey,
        dateSource: dateInfo.dateSource
    };
}

export function normalizeTransactionRecord(tx) {
    const amount = Number(tx?.amount ?? tx?.importe ?? 0);
    const validAmount = Number.isFinite(amount) ? amount : 0;
    const dateInfo = parseTransactionDate(tx);
    const links = Array.isArray(tx?.linked_invoices) ? tx.linked_invoices : [];

    let reconciledAmount = 0;
    links.forEach(link => {
        if (link && typeof link === 'object') {
            const la = Number(link.amount ?? 0);
            if (Number.isFinite(la) && la > 0) reconciledAmount += la;
        }
    });

    return {
        ...tx,
        id: tx?.id || `tx_${dateInfo.isoDate || 'undated'}_${validAmount}`,
        amount: validAmount,
        client_name: String(tx?.client_name || tx?.cliente || 'No especificado').trim(),
        bank_name: String(tx?.bank_name || 'OTROS / MANUAL').trim(),
        concept: String(tx?.concept || tx?.description || 'Movimiento Banco').trim(),
        isoDate: dateInfo.isoDate,
        monthKey: dateInfo.monthKey,
        linked_invoices: links,
        isReconciled: links.length > 0,
        reconciledAmount: round2(reconciledAmount),
        provenance: tx?.source === 'excel_import' || tx?.source === 'sql_import' || tx?.source === 'cloud_import'
            ? 'external_unverified'
            : 'bank_record'
    };
}

/**
 * Computes full reconciled analytics from raw invoices & transactions.
 */
export function computeCommanderAnalytics({ invoices = [], transactions = [], filters = {} } = {}) {
    const clientFilter = String(filters.client || '').trim().toLowerCase();
    const dateFrom = filters.dateFrom ? parseDateValue(filters.dateFrom) : null;
    const dateTo = filters.dateTo ? parseDateValue(filters.dateTo) : null;
    const sourceFilter = ['fiscal_verified', 'external_unverified', 'all'].includes(filters.sourceFilter)
        ? filters.sourceFilter
        : 'all';

    const normalizedInvoices = (Array.isArray(invoices) ? invoices : []).map(normalizeInvoiceRecord);
    const normalizedTxs = (Array.isArray(transactions) ? transactions : []).map(normalizeTransactionRecord);

    const dataQuality = {
        totalRawInvoices: normalizedInvoices.length,
        fiscalVerifiedCount: 0,
        externalUnverifiedCount: 0,
        unverifiedMissingStatusCount: 0,
        rejectedOrVoidCount: 0,
        undatedInvoicesCount: 0,
        totalRawTransactions: normalizedTxs.length,
        undatedTransactionsCount: 0,
        unreconciledTransactionsCount: 0,
        inferredLinksCount: 0,
        emptyMonths: []
    };

    const clientsSet = new Set();
    normalizedInvoices.forEach(inv => {
        if (inv.provenance === 'fiscal_verified') dataQuality.fiscalVerifiedCount++;
        else if (inv.provenance === 'external_unverified') dataQuality.externalUnverifiedCount++;
        else if (inv.provenance === 'unverified_missing_status' || inv.provenance === 'unverified_missing_evidence') dataQuality.unverifiedMissingStatusCount++;
        else if (inv.provenance === 'rejected_or_void') dataQuality.rejectedOrVoidCount++;

        if (!inv.isoDate) dataQuality.undatedInvoicesCount++;
        if ((inv.provenance === 'fiscal_verified' || inv.provenance === 'external_unverified') && inv.RazonSocial && inv.RazonSocial !== '-') {
            clientsSet.add(inv.RazonSocial);
        }
    });

    normalizedTxs.forEach(tx => {
        if (!tx.isoDate) dataQuality.undatedTransactionsCount++;
        if (!tx.isReconciled) dataQuality.unreconciledTransactionsCount++;
        if (tx.client_name && tx.client_name !== 'No especificado' && tx.client_name !== '-') {
            clientsSet.add(tx.client_name);
        }
    });

    // Eligible invoices exclude rejected/void and unverified_missing_status
    const eligibleInvoices = normalizedInvoices.filter(inv => {
        if (inv.provenance !== 'fiscal_verified' && inv.provenance !== 'external_unverified') return false;
        if (sourceFilter !== 'all' && inv.provenance !== sourceFilter) return false;
        if (clientFilter && !inv.RazonSocial.toLowerCase().includes(clientFilter)) return false;
        if (!inv.isoDate) return false;
        if ((dateFrom || dateTo) && !isWithinDateRange(inv.isoDate, dateFrom, dateTo)) return false;
        return true;
    });

    const filteredTxs = normalizedTxs.filter(tx => {
        if (sourceFilter === 'fiscal_verified' && tx.provenance === 'external_unverified') return false;
        if (sourceFilter === 'external_unverified' && tx.provenance !== 'external_unverified') return false;
        if (clientFilter && !tx.client_name.toLowerCase().includes(clientFilter)) return false;
        if (!tx.isoDate) return false;
        if ((dateFrom || dateTo) && !isWithinDateRange(tx.isoDate, dateFrom, dateTo)) return false;
        return true;
    });

    // All provenance-valid invoices (across all periods) for cross-period NC/ND and link-amount resolution
    const allValidInvoices = normalizedInvoices.filter(inv => {
        if (inv.provenance !== 'fiscal_verified' && inv.provenance !== 'external_unverified') return false;
        if (sourceFilter !== 'all' && inv.provenance !== sourceFilter) return false;
        return true;
    });

    const invoiceAmountByKey = new Map();
    allValidInvoices.forEach(inv => {
        if (inv.cae) invoiceAmountByKey.set(String(inv.cae), inv.Importe);
        if (inv.id) invoiceAmountByKey.set(String(inv.id), inv.Importe);
    });

    // Build linked payment index (confirmed explicit link.amount ONLY) and separate inferred estimates
    const linkedPaymentsByInvoiceKey = new Map();
    const resolvedTxReconMap = new Map();
    const resolvedTxInferredMap = new Map();
    normalizedTxs.forEach(tx => {
        if (!tx.isReconciled || tx.amount <= 0) {
            resolvedTxReconMap.set(tx, 0);
            resolvedTxInferredMap.set(tx, 0);
            return;
        }
        let remainingCash = tx.amount;
        let confirmedAllocated = 0;
        let inferredAllocated = 0;

        tx.linked_invoices.forEach(link => {
            if (!link || remainingCash <= 0) return;
            const key = typeof link === 'object' ? String(link.invoice_id || '') : String(link);
            if (!key) return;
            const explicitAmt = typeof link === 'object' ? Number(link.amount ?? 0) : 0;
            if (Number.isFinite(explicitAmt) && explicitAmt > 0) {
                const amt = Math.min(remainingCash, explicitAmt);
                linkedPaymentsByInvoiceKey.set(key, (linkedPaymentsByInvoiceKey.get(key) || 0) + amt);
                confirmedAllocated += amt;
                remainingCash = round2(remainingCash - amt);
            } else {
                // Keep inferred amounts strictly separate from confirmed reconciled collections
                const est = Math.min(remainingCash, invoiceAmountByKey.get(key) || 0);
                if (est > 0) {
                    inferredAllocated += est;
                    remainingCash = round2(remainingCash - est);
                    dataQuality.inferredLinksCount++;
                }
            }
        });
        resolvedTxReconMap.set(tx, round2(confirmedAllocated));
        resolvedTxInferredMap.set(tx, round2(inferredAllocated));
        tx.reconciledAmount = round2(confirmedAllocated);
        tx.inferredReconciledAmount = round2(inferredAllocated);
    });

    // Build index of related Credit/Debit notes across ALL valid periods so cross-period NC/ND adjust receivables
    const notesIndex = new Map();
    allValidInvoices.forEach(item => {
        if (!item.isCreditNote && !item.isDebitNote) return;
        const assocList = item.CbtesAsoc || item.cbtesAsoc || [];
        assocList.forEach(assoc => {
            const assocTipo = Number(assoc.Tipo !== undefined ? assoc.Tipo : assoc.tipo);
            const assocPtoVta = Number(assoc.PtoVta !== undefined ? assoc.PtoVta : assoc.ptoVta);
            const assocNro = Number(assoc.Nro !== undefined ? assoc.Nro : assoc.nro);
            const key = `${assocTipo}_${assocPtoVta}_${assocNro}`;
            if (!notesIndex.has(key)) notesIndex.set(key, []);
            const list = notesIndex.get(key);
            if (!list.some(n => n.id === item.id)) list.push(item);
        });
    });

    const getInvoiceBalance = (invoice) => {
        if (!invoice) return 0;
        if (invoice.isPaid === true) return 0;

        let adjusted = invoice.Importe;
        if (invoice.isBaseInvoice) {
            const ptoVta = invoice.PtoVta !== undefined && invoice.PtoVta !== null ? Number(invoice.PtoVta) : 1;
            const nro = invoice.CbteDesde !== undefined && invoice.CbteDesde !== null ? Number(invoice.CbteDesde) : (invoice.id || 0);
            const related = notesIndex.get(`${invoice.cbteTipo}_${ptoVta}_${nro}`) || [];
            related.forEach(rel => {
                if (rel.isCreditNote) adjusted -= rel.Importe;
                else if (rel.isDebitNote) adjusted += rel.Importe;
            });
        }
        if (invoice.isCreditNote) {
            return 0;
        }
        if (invoice.isDebitNote) {
            const assoc = invoice.CbtesAsoc || invoice.cbtesAsoc || [];
            if (Array.isArray(assoc) && assoc.length > 0) return 0;
        }

        const linkedByCae = invoice.cae ? (linkedPaymentsByInvoiceKey.get(String(invoice.cae)) || 0) : 0;
        const linkedById = invoice.id ? (linkedPaymentsByInvoiceKey.get(String(invoice.id)) || 0) : 0;
        const linkedPaid = linkedByCae + linkedById;
        const explicitPaid = Number(invoice.paidAmount || 0);
        const totalPaid = Math.max(linkedPaid, Number.isFinite(explicitPaid) ? explicitPaid : 0);

        return Math.max(0, round2(adjusted - totalPaid));
    };

    // Aggregate KPIs & monthly maps
    let netInvoicing = 0;
    let fiscalVerifiedNet = 0;
    let externalUnverifiedNet = 0;
    let invoicesGross = 0;
    let debitNotesTotal = 0;
    let creditNotesTotal = 0;

    const monthlyInvoicingMap = new Map();
    const voucherTypeMap = new Map();
    const debtRankingMap = new Map();

    eligibleInvoices.forEach(inv => {
        netInvoicing += inv.signedAmount;
        if (inv.provenance === 'fiscal_verified') fiscalVerifiedNet += inv.signedAmount;
        else externalUnverifiedNet += inv.signedAmount;

        if (inv.isCreditNote) creditNotesTotal += inv.Importe;
        else if (inv.isDebitNote) debitNotesTotal += inv.Importe;
        else invoicesGross += inv.Importe;

        if (!monthlyInvoicingMap.has(inv.monthKey)) {
            monthlyInvoicingMap.set(inv.monthKey, { net: 0, fiscalNet: 0, externalNet: 0, count: 0 });
        }
        const mEntry = monthlyInvoicingMap.get(inv.monthKey);
        mEntry.net += inv.signedAmount;
        if (inv.provenance === 'fiscal_verified') mEntry.fiscalNet += inv.signedAmount;
        else mEntry.externalNet += inv.signedAmount;
        mEntry.count++;

        if (!voucherTypeMap.has(inv.voucherName)) {
            voucherTypeMap.set(inv.voucherName, { count: 0, total_amount: 0 });
        }
        const vEntry = voucherTypeMap.get(inv.voucherName);
        vEntry.count++;
        vEntry.total_amount += inv.signedAmount;

        const balance = getInvoiceBalance(inv);
        if (balance > 0) {
            const client = inv.RazonSocial || 'Consumidor Final';
            const cuit = inv.CUIT || '-';
            const key = `${client} (CUIT: ${cuit})`;
            if (!debtRankingMap.has(key)) {
                debtRankingMap.set(key, { client_name: client, cuit, total_debt: 0, open_vouchers: 0 });
            }
            const d = debtRankingMap.get(key);
            d.total_debt = round2(d.total_debt + balance);
            d.open_vouchers++;
        }
    });

    let bankDeposits = 0;
    let bankDebits = 0;
    let reconciledCollections = 0;
    let inferredCollections = 0;
    let reconciledTxCount = 0;

    const monthlyBankingMap = new Map();
    const bankAccountsMap = new Map();
    const dailyTimelineMap = new Map();
    const monthlyReconMap = new Map();

    filteredTxs.forEach(tx => {
        if (tx.amount > 0) bankDeposits += tx.amount;
        else if (tx.amount < 0) bankDebits += tx.amount;

        if (tx.isReconciled) {
            const confirmedAmt = resolvedTxReconMap.get(tx) ?? 0;
            const inferredAmt = resolvedTxInferredMap.get(tx) ?? 0;
            if (confirmedAmt > 0) reconciledTxCount++;
            reconciledCollections += confirmedAmt;
            inferredCollections += inferredAmt;
        }

        if (!monthlyBankingMap.has(tx.monthKey)) {
            monthlyBankingMap.set(tx.monthKey, { deposits: 0, debits: 0, net: 0, count: 0 });
        }
        const mb = monthlyBankingMap.get(tx.monthKey);
        if (tx.amount > 0) mb.deposits += tx.amount;
        else mb.debits += tx.amount;
        mb.net += tx.amount;
        mb.count++;

        if (tx.amount > 0) {
            if (!bankAccountsMap.has(tx.bank_name)) {
                bankAccountsMap.set(tx.bank_name, { count: 0, total_amount: 0 });
            }
            const ba = bankAccountsMap.get(tx.bank_name);
            ba.count++;
            ba.total_amount += tx.amount;

            dailyTimelineMap.set(tx.isoDate, (dailyTimelineMap.get(tx.isoDate) || 0) + tx.amount);
        }

        if (!monthlyReconMap.has(tx.monthKey)) {
            monthlyReconMap.set(tx.monthKey, { total: 0, reconciled: 0 });
        }
        const mr = monthlyReconMap.get(tx.monthKey);
        mr.total++;
        if (tx.isReconciled) mr.reconciled++;
    });

    // Build continuous month axis so periods without movement are visible rather than hidden
    const observedMonths = [...new Set([...monthlyInvoicingMap.keys(), ...monthlyBankingMap.keys()])].sort();
    const minMonth = dateFrom ? dateFrom.slice(0, 7) : observedMonths[0];
    const maxMonth = dateTo ? dateTo.slice(0, 7) : observedMonths[observedMonths.length - 1];
    const continuousMonths = (minMonth && maxMonth) ? buildMonthRange(minMonth, maxMonth) : [];

    const invoiceData = [];
    const bankingData = [];
    const reconciliationStats = [];

    continuousMonths.forEach(mKey => {
        const invM = monthlyInvoicingMap.get(mKey) || { net: 0, fiscalNet: 0, externalNet: 0, count: 0 };
        const bankM = monthlyBankingMap.get(mKey) || { deposits: 0, debits: 0, net: 0, count: 0 };
        const recM = monthlyReconMap.get(mKey) || { total: 0, reconciled: 0 };
        const hasMovement = invM.count > 0 || bankM.count > 0;
        if (!hasMovement) dataQuality.emptyMonths.push(mKey);

        const label = formatMonthLabel(mKey);
        invoiceData.push({
            month: mKey,
            label,
            total_amount: round2(invM.net),
            fiscal_amount: round2(invM.fiscalNet),
            external_amount: round2(invM.externalNet),
            count: invM.count,
            hasMovement
        });
        bankingData.push({
            month: mKey,
            label,
            total_amount: round2(bankM.deposits),
            debits_amount: round2(bankM.debits),
            net_amount: round2(bankM.net),
            count: bankM.count,
            hasMovement
        });
        reconciliationStats.push({
            month: mKey,
            label,
            rate: recM.total > 0 ? Math.round((recM.reconciled / recM.total) * 1000) / 10 : 0,
            total: recM.total,
            reconciled: recM.reconciled,
            hasMovement
        });
    });

    const bankStats = Array.from(bankAccountsMap.entries())
        .map(([name, info]) => ({
            name,
            value: info.count,
            total_amount: round2(info.total_amount)
        }))
        .sort((a, b) => b.total_amount - a.total_amount);

    const voucherStats = Array.from(voucherTypeMap.entries())
        .map(([name, info]) => ({
            name,
            value: info.count,
            total_amount: round2(info.total_amount)
        }))
        .sort((a, b) => b.total_amount - a.total_amount);

    const dailyBankingData = Array.from(dailyTimelineMap.entries())
        .map(([dateStr, total]) => {
            const parts = dateStr.split('-');
            const timestamp = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0).getTime();
            return { dateStr, timestamp, total_amount: round2(total) };
        })
        .sort((a, b) => a.timestamp - b.timestamp);

    const debtRanking = Array.from(debtRankingMap.values())
        .filter(item => item.total_debt > 0)
        .sort((a, b) => b.total_debt - a.total_debt);

    const pendingReceivables = round2(debtRanking.reduce((sum, item) => sum + item.total_debt, 0));

    const kpis = {
        netInvoicing: round2(netInvoicing),
        fiscalVerifiedNet: round2(fiscalVerifiedNet),
        externalUnverifiedNet: round2(externalUnverifiedNet),
        invoicesGross: round2(invoicesGross),
        debitNotesTotal: round2(debitNotesTotal),
        creditNotesTotal: round2(creditNotesTotal),
        invoicingCount: eligibleInvoices.length,
        bankDeposits: round2(bankDeposits),
        bankDebits: round2(bankDebits),
        bankNetFlow: round2(bankDeposits + bankDebits),
        transactionsCount: filteredTxs.length,
        reconciledCollections: round2(reconciledCollections),
        inferredCollections: round2(inferredCollections),
        reconciledTxCount,
        reconciliationRate: filteredTxs.length > 0 ? Math.round((reconciledTxCount / filteredTxs.length) * 1000) / 10 : 0,
        pendingReceivables
    };

    return {
        clients: Array.from(clientsSet).sort(),
        kpis,
        invoiceData,
        bankingData,
        bankStats,
        voucherStats,
        dailyBankingData,
        debtRanking,
        reconciliationStats,
        dataQuality,
        audit: {
            updatedAt: new Date().toISOString(),
            appliedFilters: {
                client: filters.client || null,
                dateFrom: dateFrom || null,
                dateTo: dateTo || null,
                sourceFilter
            },
            criteria: {
                netInvoicing: 'Facturas + Notas de Débito − Notas de Crédito agrupadas por fecha fiscal cbteFch (excluye rechazados, anulados y sin estado verificable).',
                bankDeposits: 'Suma de movimientos bancarios acreditados (importe > 0); no representa automáticamente facturas cobradas.',
                reconciledCollections: 'Suma de importes efectivamente conciliados contra comprobantes vía linked_invoices.',
                pendingReceivables: 'Facturas base + ND relacionadas − NC relacionadas − pagos parciales conciliados o marcados.'
            }
        },
        _normalized: {
            eligibleInvoices,
            filteredTxs
        }
    };
}

/**
 * Evaluates custom Commander widgets using the exact normalized records from computeCommanderAnalytics.
 */
export function evaluateWidgets({ widgets = [], analytics }) {
    const { eligibleInvoices, filteredTxs } = analytics._normalized;
    const results = {};
    const widgetMeta = {};

    for (const widget of widgets) {
        const { id, type, dataSource, xAxisDimension, yAxisMeasure, aggregation } = widget;
        const isInvoices = dataSource === 'invoices';
        const isNetBank = dataSource === 'transactions_net';
        const sourceData = isInvoices
            ? eligibleInvoices
            : (isNetBank ? filteredTxs : filteredTxs.filter(tx => tx.amount > 0));

        const getRecordValue = (item) => {
            if (isInvoices) return item.signedAmount;
            return item.amount;
        };

        if (type === 'kpi') {
            let value = 0;
            if (yAxisMeasure === 'amount') {
                if (aggregation === 'sum') {
                    value = sourceData.reduce((acc, item) => acc + getRecordValue(item), 0);
                } else if (aggregation === 'avg') {
                    const total = sourceData.reduce((acc, item) => acc + getRecordValue(item), 0);
                    value = sourceData.length > 0 ? total / sourceData.length : 0;
                } else {
                    value = sourceData.length;
                }
            } else {
                value = sourceData.length;
            }

            results[id] = {
                value: yAxisMeasure === 'amount' ? round2(value) : value,
                recordCount: sourceData.length
            };
        } else {
            const groups = new Map();
            sourceData.forEach(item => {
                let groupKey = 'Otros';
                if (xAxisDimension === 'month') {
                    groupKey = item.monthKey || 'Sin fecha';
                } else if (xAxisDimension === 'date') {
                    groupKey = item.isoDate || 'Sin fecha';
                } else if (xAxisDimension === 'client') {
                    groupKey = isInvoices ? (item.RazonSocial || 'Sin Razón Social') : (item.client_name || 'Sin Cliente');
                } else if (xAxisDimension === 'voucherType') {
                    groupKey = isInvoices ? item.voucherName : (item.concept || 'Movimiento Banco');
                } else if (xAxisDimension === 'bank') {
                    groupKey = item.bank_name || 'OTROS / MANUAL';
                }

                if (!groups.has(groupKey)) groups.set(groupKey, []);
                groups.get(groupKey).push({ val: getRecordValue(item), item });
            });

            const groupList = Array.from(groups.entries()).map(([name, items]) => {
                let val = 0;
                if (yAxisMeasure === 'amount') {
                    if (aggregation === 'sum') {
                        val = items.reduce((acc, g) => acc + g.val, 0);
                    } else if (aggregation === 'avg') {
                        const total = items.reduce((acc, g) => acc + g.val, 0);
                        val = items.length > 0 ? total / items.length : 0;
                    } else {
                        val = items.length;
                    }
                } else {
                    val = items.length;
                }

                let label = name;
                if (xAxisDimension === 'month' && name.includes('-')) {
                    label = formatMonthLabel(name);
                } else if (xAxisDimension === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(name)) {
                    const [y, m, d] = name.split('-');
                    const dateObj = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 12, 0, 0));
                    label = dateObj.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', timeZone: 'UTC' });
                }

                return {
                    name,
                    value: yAxisMeasure === 'amount' ? round2(val) : val,
                    count: items.length,
                    label
                };
            });

            if (xAxisDimension === 'month' || xAxisDimension === 'date') {
                groupList.sort((a, b) => a.name.localeCompare(b.name));
            } else {
                groupList.sort((a, b) => b.value - a.value);
            }

            results[id] = groupList;
        }

        widgetMeta[id] = {
            dataSource,
            recordCount: sourceData.length,
            updatedAt: analytics.audit.updatedAt
        };
    }

    return { results, widgetMeta };
}
