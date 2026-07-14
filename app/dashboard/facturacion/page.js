"use client";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { 
    Upload, 
    FileText, 
    CheckCircle, 
    AlertCircle, 
    Download, 
    FileSpreadsheet, 
    Loader2, 
    CheckCircle2,
    Search,
    RefreshCw,
    FileArchive,
    Trash2,
    Eye,
    X,
    Lock,
    PlusCircle,
    Link2Off,
    TrendingUp
} from "lucide-react";

export default function FacturacionPage() {
    const router = useRouter();
    const [file, setFile] = useState(null);
    const [data, setData] = useState([]);
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [results, setResults] = useState([]);
    const [totalRows, setTotalRows] = useState(0);
    const [historyLoaded, setHistoryLoaded] = useState(false);
    const [issuerConfig, setIssuerConfig] = useState({ razonSocial: "", cuit: "", logo: "", hasCert: false });

    // Inflation Adjusted States
    const [inflationRates, setInflationRates] = useState([]);
    const [showAdjustment, setShowAdjustment] = useState(false);

    // Invoice Detail Modal State
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [showAddNotes, setShowAddNotes] = useState(false);

    useEffect(() => {
        if (!selectedInvoice) {
            setShowAddNotes(false);
        }
    }, [selectedInvoice]);

    // New Polished States
    const [validationErrors, setValidationErrors] = useState({});
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all"); // "all", "aprobado", "rechazado", "pendiente"
    const [editingCell, setEditingCell] = useState(null); // { idx, field }
    const [isIndividualModalOpen, setIsIndividualModalOpen] = useState(false);
    const [indVoucher, setIndVoucher] = useState({
        cuit: "",
        razonSocial: "",
        condicionIva: "Consumidor Final",
        cbteTipo: 11,
        docTipo: 80, // Default: CUIT (code 80)
        concepto: 2, // Default: Services
        detalle: "",
        total: "",
        cbteFch: new Date().toISOString().split('T')[0],
        fchServDesde: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        fchServHasta: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
        fchVtoPago: new Date(new Date().setDate(new Date().getDate() + 10)).toISOString().split('T')[0],
        vatRate: "21",
        ptoVta: 1,
        assocTipo: 11,
        assocPtoVta: 1,
        assocNro: "",
        cbu: "",
        transferSystem: true
    });

    const [cuitVerifying, setCuitVerifying] = useState(false);
    const [cuitVerified, setCuitVerified] = useState(null); 
    const [cuitMessage, setCuitMessage] = useState("");
    const [frequentClients, setFrequentClients] = useState([]);

    // Pagination States
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 50;

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, statusFilter]);

    useEffect(() => {
        const cleanDoc = indVoucher.cuit.replace(/[^0-9]/g, '');
        const isCuitOrCuil = indVoucher.docTipo === 80 || indVoucher.docTipo === 86;
        const isDni = indVoucher.docTipo === 96;

        if ((isCuitOrCuil && cleanDoc.length === 11) || (isDni && (cleanDoc.length === 7 || cleanDoc.length === 8))) {
            if (cuitVerified === true && cuitMessage === "Cliente habitual") {
                return;
            }
            const verifyCuit = async () => {
                setCuitVerifying(true);
                setCuitVerified(null);
                setCuitMessage("");
                try {
                    const user = JSON.parse(localStorage.getItem('neoconta_user'));
                    if (!user) return;

                    const res = await fetch('/api/arca/consultar-cuit', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ cuit: cleanDoc, userId: user.id })
                    });
                    
                    if (!res.ok) {
                        const errData = await res.json();
                        throw new Error(errData.error || "No se pudo consultar el documento.");
                    }

                    const data = await res.json();
                    if (data.success) {
                        setIndVoucher(prev => ({
                            ...prev,
                            razonSocial: data.razonSocial,
                            condicionIva: data.condicionIva
                        }));
                        setCuitVerified(true);
                        setCuitMessage("Verificado en ARCA");
                    }
                } catch (err) {
                    console.error("Document Verification failed:", err);
                    setCuitVerified(false);
                    setCuitMessage(err.message || "No se pudo verificar.");
                } finally {
                    setCuitVerifying(false);
                }
            };
            verifyCuit();
        } else {
            setCuitVerified(null);
            setCuitMessage("");
            if (indVoucher.docTipo === 99) {
                setIndVoucher(prev => ({
                    ...prev,
                    razonSocial: "Consumidor Final",
                    condicionIva: "Consumidor Final"
                }));
            }
        }
    }, [indVoucher.cuit, indVoucher.docTipo]);

    const fetchInflation = useCallback(async () => {
        try {
            const res = await fetch('/api/arca/inflacion');
            if (res.ok) {
                const dataObj = await res.json();
                if (dataObj.success && dataObj.data) {
                    setInflationRates(dataObj.data);
                }
            }
        } catch (error) {
            console.error("Failed to load inflation rates", error);
        }
    }, []);

    const fetchIssuerConfig = useCallback(async () => {
        const user = JSON.parse(localStorage.getItem('neoconta_user'));
        if (!user) return;
        try {
            const res = await fetch(`/api/user/config?userId=${user.id}`);
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    setIssuerConfig({
                        razonSocial: data.razonSocial || "",
                        cuit: data.cuit || "",
                        logo: data.logo || "",
                        hasCert: data.hasCert || false
                    });
                }
            }
        } catch (error) {
            console.error("Error loading issuer config", error);
        }
    }, []);

    const fetchFrequentClients = useCallback(async () => {
        const userStr = localStorage.getItem('neoconta_user');
        if (!userStr) return;
        const user = JSON.parse(userStr);
        try {
            const res = await fetch(`/api/arca/historial?userId=${user.id}&frequent=true`);
            if (res.ok) {
                const data = await res.json();
                if (data.success && Array.isArray(data.clients)) {
                    setFrequentClients(data.clients);
                }
            }
        } catch (e) {
            console.error("Error fetching frequent clients:", e);
        }
    }, []);

    const formatCuit = (cuit) => {
        if (!cuit) return "";
        const clean = String(cuit).replace(/[^0-9]/g, '');
        if (clean.length === 11) {
            return `${clean.substring(0, 2)}-${clean.substring(2, 10)}-${clean.substring(10, 11)}`;
        }
        return cuit;
    };

    const getPtoVta = (invoice) => {
        if (!invoice) return 1;
        if (invoice.PtoVta) return invoice.PtoVta;
        if (invoice.ptoVta) return invoice.ptoVta;
        const respPtoVta = invoice.afip_response?.response?.FeCabResp?.PtoVta;
        if (respPtoVta) return respPtoVta;
        if (invoice.afip_response?.PtoVta) return invoice.afip_response.PtoVta;
        return 1;
    };

    const getCbteDesde = (invoice) => {
        if (!invoice) return 0;
        if (invoice.CbteDesde) return invoice.CbteDesde;
        if (invoice.cbteDesde) return invoice.cbteDesde;
        const respCbte = invoice.afip_response?.response?.FeDetResp?.FECAEDetResponse?.[0]?.CbteDesde;
        if (respCbte) return respCbte;
        if (invoice.afip_response?.CbteDesde) return invoice.afip_response.CbteDesde;
        return invoice.id || 0;
    };

    const fetchHistory = useCallback(async () => {
        const user = JSON.parse(localStorage.getItem('neoconta_user'));
        if (!user) return;

        try {
            const url = `/api/arca/historial?userId=${user.id}&page=${currentPage}&limit=${rowsPerPage}&search=${encodeURIComponent(searchQuery)}&status=${statusFilter}`;
            const res = await fetch(url);
            if (res.ok) {
                const historyData = await res.json();
                if (historyData.history) {
                    const normalizedHistory = historyData.history.map(inv => ({
                        ...inv,
                        RazonSocial: inv.RazonSocial || inv.cliente || inv.Nombre || inv.nombre || "-",
                        CUIT: inv.CUIT || inv.Cuit || inv.cuit || inv.DocNro || "-",
                        Importe: inv.Importe || inv.Total || inv.importe || inv.total || 0,
                        status: inv.status || 'aprobado'
                    }));
                    setResults(normalizedHistory);
                    setTotalRows(historyData.total || 0);
                } else {
                    setResults([]);
                    setTotalRows(0);
                }
            }
        } catch (error) {
            console.error("Error loading invoice history", error);
        } finally {
            setHistoryLoaded(true);
        }
    }, [currentPage, rowsPerPage, searchQuery, statusFilter]);

    useEffect(() => {
        const userStr = localStorage.getItem('neoconta_user');
        if (!userStr) {
            router.push("/login");
            return;
        }
        const user = JSON.parse(userStr);
        if (user.role === 'no-cliente') {
            router.push("/dashboard");
            return;
        }
        fetchHistory();
        fetchInflation();
        fetchIssuerConfig();
        fetchFrequentClients();
    }, [fetchHistory, fetchInflation, fetchIssuerConfig, fetchFrequentClients, router]);

    const handleCuitChange = (e) => {
        const val = e.target.value;
        const cleanVal = val.replace(/[^0-9]/g, '');
        const matched = frequentClients.find(c => c.cuit === cleanVal);
        if (matched) {
            setIndVoucher(prev => ({
                ...prev,
                cuit: matched.cuit,
                razonSocial: matched.razonSocial,
                condicionIva: matched.condicionIva,
                docTipo: Number(matched.docTipo)
            }));
            setCuitVerified(true);
            setCuitMessage("Cliente habitual");
        } else {
            setIndVoucher(prev => ({ ...prev, cuit: val }));
            setCuitVerified(null);
            setCuitMessage("");
        }
    };

    const handleIndividualSubmit = async (e) => {
        e.preventDefault();
        
        const cleanDoc = indVoucher.cuit.replace(/[^0-9]/g, '');
        const isCuitOrCuil = indVoucher.docTipo === 80 || indVoucher.docTipo === 86;

        if (isCuitOrCuil) {
            if (cleanDoc.length !== 11) {
                alert(`Por favor, ingresa un ${indVoucher.docTipo === 80 ? 'CUIT' : 'CUIL'} válido de 11 dígitos.`);
                return;
            }
        } else if (indVoucher.docTipo === 96) {
            if (cleanDoc.length < 7 || cleanDoc.length > 8) {
                alert("Por favor, ingresa un DNI válido de 7 u 8 dígitos.");
                return;
            }
        }
        if (!indVoucher.razonSocial.trim()) {
            alert("Por favor, ingresa la Razón Social.");
            return;
        }
        if (!indVoucher.detalle.trim()) {
            alert("Por favor, ingresa el detalle o descripción del comprobante.");
            return;
        }
        const parsedTotal = parseFloat(indVoucher.total);
        if (isNaN(parsedTotal) || parsedTotal <= 0) {
            alert("Por favor, ingresa un monto total mayor a 0.");
            return;
        }

        const user = JSON.parse(localStorage.getItem('neoconta_user'));
        if (!user) {
            alert("No se encontró la sesión del usuario. Por favor, vuelve a iniciar sesión.");
            return;
        }

        setProcessing(true);

        try {
            const rawInvoice = {
                CUIT: indVoucher.cuit.replace(/[^0-9]/g, ''),
                RazonSocial: indVoucher.razonSocial,
                CondicionIVA: indVoucher.condicionIva,
                Total: parsedTotal,
                CbteTipo: Number(indVoucher.cbteTipo),
                PtoVta: Number(indVoucher.ptoVta || 1), 
                ConceptoId: Number(indVoucher.concepto),
                Concepto: indVoucher.detalle,
                CbteFch: indVoucher.cbteFch,
                DocTipo: Number(indVoucher.docTipo || 80),
                DocNro: Number(indVoucher.cuit.replace(/[^0-9]/g, '') || 0)
            };

            if (rawInvoice.ConceptoId === 2 || rawInvoice.ConceptoId === 3) {
                rawInvoice.FchServDesde = indVoucher.fchServDesde;
                rawInvoice.FchServHasta = indVoucher.fchServHasta;
                rawInvoice.FchVtoPago = indVoucher.fchVtoPago;
            }

            const vatVouchers = [1, 2, 3, 6, 7, 8, 201, 202, 203, 206, 207, 208];
            if (vatVouchers.includes(rawInvoice.CbteTipo)) {
                const totalAmt = parsedTotal;
                if (indVoucher.vatRate === "Exento") {
                    rawInvoice.ImpNeto = 0;
                    rawInvoice.ImpOpEx = totalAmt;
                    rawInvoice.ImpIVA = 0;
                    rawInvoice.Iva = [];
                } else if (indVoucher.vatRate === "No Gravado") {
                    rawInvoice.ImpNeto = 0;
                    rawInvoice.ImpTotConc = totalAmt;
                    rawInvoice.ImpIVA = 0;
                    rawInvoice.Iva = [];
                } else {
                    const rateMultiplier = parseFloat(indVoucher.vatRate) / 100;
                    const net = Math.round((totalAmt / (1 + rateMultiplier)) * 100) / 100;
                    const vat = Math.round((totalAmt - net) * 100) / 100;
                    
                    let vatId = 5;
                    if (indVoucher.vatRate === "10.5") vatId = 4;
                    if (indVoucher.vatRate === "27") vatId = 6;
                    if (indVoucher.vatRate === "0") vatId = 3;

                    rawInvoice.ImpNeto = net;
                    rawInvoice.ImpIVA = vat;
                    rawInvoice.Iva = [
                        {
                            Id: vatId,
                            BaseImp: net,
                            Importe: vat
                        }
                    ];
                }
            }

            const noteVouchers = [2, 3, 7, 8, 12, 13, 202, 203, 207, 208, 212, 213];
            if (noteVouchers.includes(rawInvoice.CbteTipo)) {
                if (!indVoucher.assocNro) {
                    alert("Por favor, ingresa el número del comprobante asociado para la Nota de Débito/Crédito.");
                    setProcessing(false);
                    return;
                }
                rawInvoice.CbtesAsoc = [
                    {
                        Tipo: Number(indVoucher.assocTipo),
                        PtoVta: Number(indVoucher.assocPtoVta),
                        Nro: Number(indVoucher.assocNro)
                    }
                ];
            }

            const fceVouchers = [201, 202, 203, 206, 207, 208, 211, 212, 213];
            if (fceVouchers.includes(rawInvoice.CbteTipo)) {
                rawInvoice.FchVtoPago = indVoucher.fchVtoPago;
                const opcionales = [];
                
                if (indVoucher.cbu.trim()) {
                    opcionales.push({ Id: "27", Valor: indVoucher.cbu.trim() });
                }
                if (indVoucher.transferSystem) {
                    opcionales.push({ Id: "2101", Valor: "S" });
                }
                
                if (opcionales.length > 0) {
                    rawInvoice.Opcionales = opcionales;
                }
            }

            const res = await fetch('/api/arca/facturar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    invoices: [rawInvoice],
                    userId: user.id
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Ocurrió un error inesperado al conectar con el servidor.");
            }

            const resData = await res.json();
            const resultItem = resData.results[0];

            if (resultItem.status === 'aprobado') {
                alert(`¡Comprobante emitido con éxito!\nCAE: ${resultItem.cae}`);
                setIsIndividualModalOpen(false);
                setIndVoucher({
                    cuit: "",
                    razonSocial: "",
                    condicionIva: "Consumidor Final",
                    cbteTipo: 11,
                    docTipo: 80, // Default: CUIT
                    concepto: 2,
                    detalle: "",
                    total: "",
                    cbteFch: new Date().toISOString().split('T')[0],
                    fchServDesde: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
                    fchServHasta: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
                    fchVtoPago: new Date(new Date().setDate(new Date().getDate() + 10)).toISOString().split('T')[0],
                    vatRate: "21",
                    ptoVta: 1,
                    assocTipo: 11,
                    assocPtoVta: 1,
                    assocNro: "",
                    cbu: "",
                    transferSystem: true
                });
                fetchHistory();
                fetchFrequentClients();
                setCuitVerified(null);
                setCuitMessage("");
            } else {
                alert(`Error de ARCA al emitir comprobante:\n${resultItem.error}`);
            }

        } catch (error) {
            console.error("Error submitting individual invoice:", error);
            alert(`Error al emitir comprobante individual:\n${error.message}`);
        } finally {
            setProcessing(false);
        }
    };

    const updateInvoice = async (invoiceId, fieldOrObject, valueIfSingle) => {
        const user = JSON.parse(localStorage.getItem('neoconta_user'));
        if (!user) return;

        let patchData = {
            userId: user.id,
            invoiceId: invoiceId
        };

        if (typeof fieldOrObject === 'object') {
            patchData = { ...patchData, ...fieldOrObject };
            // Optimistic UI update
            setResults(prev => prev.map(inv => inv.cae === invoiceId ? { ...inv, ...fieldOrObject } : inv));
        } else {
            patchData[fieldOrObject] = valueIfSingle;
            // Optimistic UI update
            setResults(prev => prev.map(inv => inv.cae === invoiceId ? { ...inv, [fieldOrObject]: valueIfSingle } : inv));
        }

        try {
            await fetch('/api/arca/historial/update', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patchData)
            });
        } catch (error) {
            console.error(`Error updating invoice`, error);
            fetchHistory(); // Revert on fail
        }
    };

    const calculateInflation = useCallback((emissionDateStr, originalAmount) => {
        if (!emissionDateStr || !originalAmount) return { rate: 0, additional: 0 };
        const amount = Number(originalAmount);
        if (isNaN(amount) || amount <= 0) return { rate: 0, additional: 0 };

        // Parse emissionDate (formatted as DD/MM/YYYY)
        const parts = emissionDateStr.split('/');
        if (parts.length !== 3) return { rate: 0, additional: 0 };
        const emissionDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00`);
        const today = new Date();

        const diffTime = Math.max(0, today.getTime() - emissionDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) return { rate: 0, additional: 0 };

        let compoundedRate = 1;
        let matchedMonths = 0;

        if (inflationRates && inflationRates.length > 0) {
            const sortedRates = [...inflationRates].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
            sortedRates.forEach(rate => {
                const rateDate = new Date(rate.fecha);
                if (rateDate >= emissionDate && rateDate <= today) {
                    const monthlyRate = Number(rate.valor || 0) / 100;
                    compoundedRate *= (1 + monthlyRate);
                    matchedMonths++;
                }
            });
        }

        if (matchedMonths === 0) {
            const fallbackMonthlyRate = 0.035;
            const dailyRate = Math.pow(1 + fallbackMonthlyRate, 1/30) - 1;
            compoundedRate = Math.pow(1 + dailyRate, diffDays);
        }

        const ratePercent = (compoundedRate - 1) * 100;
        const additionalValue = Math.round(amount * (compoundedRate - 1) * 100) / 100;

        return {
            rate: ratePercent,
            additional: additionalValue
        };
    }, [inflationRates]);

    const formatAmount = (rawAmount) => {
        const val = rawAmount || 0;
        const amount = typeof val === 'string'
            ? parseFloat(val.replace(/\./g, '').replace(/,/g, '.'))
            : Number(val);

        return new Intl.NumberFormat('es-AR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    };

    const getFallbackDate = (invoice) => {
        let issueDate;
        const dateStr = invoice.cbteFch || invoice.CbteFch || invoice?.afip_response?.CbteFch;

        if (dateStr && String(dateStr).length === 8) {
            const year = parseInt(String(dateStr).substring(0, 4));
            const month = parseInt(String(dateStr).substring(4, 6)) - 1;
            const day = parseInt(String(dateStr).substring(6, 8));
            issueDate = new Date(year, month, day);
        } else if (invoice.created_at) {
            issueDate = new Date(invoice.created_at);
        } else {
            return '';
        }

        issueDate.setDate(issueDate.getDate() + 30);
        return issueDate.toISOString().split('T')[0];
    };

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
        
        // Fallback: today's date in DD/MM/YYYY format
        const today = new Date();
        const dd = String(today.getDate()).padStart(2, '0');
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const yyyy = today.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    };

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

    const getVoucherStyle = (type) => {
        const numType = Number(type);
        const isCreditNote = [3, 8, 13, 203, 208, 213].includes(numType);
        const isDebitNote = [2, 7, 12, 202, 207, 212].includes(numType);
        
        if (isCreditNote) {
            return "bg-amber-50/80 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/50";
        }
        if (isDebitNote) {
            return "bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-355 border-emerald-200 dark:border-emerald-900/50";
        }
        return "bg-violet-50/80 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-850/60";
    };

    const getRelatedVouchers = (parentInvoice) => {
        if (!parentInvoice) return [];
        
        const parentType = Number(getCbteTipo(parentInvoice));
        const parentPtoVta = Number(getPtoVta(parentInvoice));
        const parentNro = Number(getCbteDesde(parentInvoice));
        
        return results.filter(item => {
            if (item.status !== 'aprobado') return false;
            if (item.cae === parentInvoice.cae) return false;
            
            const itemType = Number(getCbteTipo(item));
            const isNote = [2, 3, 7, 8, 12, 13, 202, 203, 207, 208, 212, 213].includes(itemType);
            if (!isNote) return false;
            
            const assocList = item.CbtesAsoc || item.cbtesAsoc || [];
            return assocList.some(assoc => {
                const assocTipo = assoc.Tipo !== undefined ? assoc.Tipo : assoc.tipo;
                const assocPtoVta = assoc.PtoVta !== undefined ? assoc.PtoVta : assoc.ptoVta;
                const assocNro = assoc.Nro !== undefined ? assoc.Nro : assoc.nro;
                
                return Number(assocTipo) === parentType &&
                       Number(assocPtoVta) === parentPtoVta &&
                       Number(assocNro) === parentNro;
            });
        });
    };

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

    const getAvailableNotesToLink = (parentInvoice) => {
        if (!parentInvoice) return [];
        const parentCuit = String(parentInvoice.CUIT || parentInvoice.Cuit || parentInvoice.cuit || parentInvoice.DocNro || "").replace(/[^0-9]/g, '');
        if (!parentCuit) return [];

        return results.filter(item => {
            if (item.status !== 'aprobado') return false;
            if (item.cae === parentInvoice.cae) return false;
            
            // Check if it belongs to the same CUIT
            const itemCuit = String(item.CUIT || item.Cuit || item.cuit || item.DocNro || "").replace(/[^0-9]/g, '');
            if (itemCuit !== parentCuit) return false;

            // Check if it is a Credit Note or Debit Note
            const itemType = Number(getCbteTipo(item));
            const isNote = [2, 3, 7, 8, 12, 13, 202, 203, 207, 208, 212, 213].includes(itemType);
            if (!isNote) return false;

            // Check if it is currently unlinked (empty or no existing approved parent in results)
            const assocList = item.CbtesAsoc || item.cbtesAsoc || [];
            if (assocList.length === 0) return true;

            // If it has references, check if any referenced parent invoice actually exists and is approved in results
            const hasExistingParent = assocList.some(assoc => {
                const assocTipo = assoc.Tipo !== undefined ? assoc.Tipo : assoc.tipo;
                const assocPtoVta = assoc.PtoVta !== undefined ? assoc.PtoVta : assoc.ptoVta;
                const assocNro = assoc.Nro !== undefined ? assoc.Nro : assoc.nro;
                
                return results.some(parent => 
                    parent.status === 'aprobado' &&
                    Number(getCbteTipo(parent)) === Number(assocTipo) &&
                    Number(getPtoVta(parent)) === Number(assocPtoVta) &&
                    Number(getCbteDesde(parent)) === Number(assocNro)
                );
            });

            return !hasExistingParent;
        });
    };

    // ==========================================
    // FUZZY COLUMN NORMALIZATION & VALIDATION
    // ==========================================
    const normalizeExcelData = (rawData) => {
        return rawData.map(row => {
            const normalized = {};
            for (const rawKey in row) {
                const key = rawKey.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                
                // Fuzzy mapping matches
                if (key === "razonsocial" || key === "razon social" || key === "nombre" || key === "cliente" || key === "empresa" || key === "receptor") {
                    normalized["RazonSocial"] = row[rawKey];
                } else if (key === "cuit" || key === "documento" || key === "nro doc" || key === "nrodoc" || key === "dni") {
                    normalized["CUIT"] = String(row[rawKey]).replace(/[^0-9]/g, ""); // Clean non-digits
                } else if (key === "condicioniva" || key === "condicion iva" || key === "iva" || key === "categoria") {
                    normalized["CondicionIVA"] = row[rawKey];
                } else if (key === "concepto" || key === "detalle" || key === "descripcion" || key === "producto" || key === "servicio") {
                    normalized["Concepto"] = row[rawKey];
                } else if (key === "importe" || key === "monto" || key === "total" || key === "neto" || key === "valor" || key === "precio") {
                    normalized["Importe"] = row[rawKey];
                } else {
                    normalized[rawKey.trim()] = row[rawKey];
                }
            }

            // Fallback default values
            if (!normalized["RazonSocial"]) normalized["RazonSocial"] = "";
            if (!normalized["CUIT"]) normalized["CUIT"] = "";
            if (!normalized["CondicionIVA"]) normalized["CondicionIVA"] = "Consumidor Final";
            if (!normalized["Concepto"]) normalized["Concepto"] = "Servicios";
            if (!normalized["Importe"]) normalized["Importe"] = 0;

            return normalized;
        });
    };

    const validateData = (rows) => {
        const errors = {};
        rows.forEach((row, idx) => {
            const rowErrors = {};
            
            const cuitStr = String(row.CUIT || "").replace(/[^0-9]/g, "");
            if (!cuitStr) {
                rowErrors.CUIT = "Falta CUIT";
            } else if (cuitStr.length !== 11) {
                rowErrors.CUIT = "Cuit inválido (debe tener 11 dígitos)";
            }
            
            const rawAmount = row.Importe;
            const amount = typeof rawAmount === 'string'
                ? parseFloat(rawAmount.replace(/\./g, '').replace(/,/g, '.'))
                : Number(rawAmount);
            if (isNaN(amount) || amount <= 0) {
                rowErrors.Importe = "Monto inválido (debe ser mayor a 0)";
            }
            
            if (!String(row.RazonSocial || "").trim()) {
                rowErrors.RazonSocial = "Falta Razón Social";
            }
            
            if (Object.keys(rowErrors).length > 0) {
                errors[idx] = rowErrors;
            }
        });
        setValidationErrors(errors);
    };

    const handleFileUpload = (e) => {
        const uploadedFile = e.target.files[0];
        setFile(uploadedFile);

        const reader = new FileReader();
        reader.onload = (event) => {
            const bstr = event.target.result;
            const wb = XLSX.read(bstr, { type: "binary" });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const rawData = XLSX.utils.sheet_to_json(ws);
            
            const normalized = normalizeExcelData(rawData);
            setData(normalized);
            validateData(normalized);
        };
        reader.readAsBinaryString(uploadedFile);
    };

    const handleCellChange = (idx, field, value, isResult = false) => {
        if (isResult) {
            setResults(prev => {
                const updated = [...prev];
                updated[idx] = { ...updated[idx], [field]: value };
                return updated;
            });
        } else {
            setData(prev => {
                const updated = [...prev];
                updated[idx] = { ...updated[idx], [field]: value };
                validateData(updated);
                return updated;
            });
        }
    };

    // ==========================================
    // EXCEL TEMPLATE GENERATION
    // ==========================================
    const downloadExcelTemplate = () => {
        const sampleData = [
            {
                RazonSocial: "Tech Solutions SRL",
                CUIT: "30-11111111-8",
                CondicionIVA: "Responsable Inscripto",
                Concepto: "Servicios de Software Mayo 2026",
                Importe: 150000
            },
            {
                RazonSocial: "Juan Perez",
                CUIT: "20-22222222-7",
                CondicionIVA: "Consumidor Final",
                Concepto: "Venta de Licencias",
                Importe: 45000
            },
            {
                RazonSocial: "El Puente SA",
                CUIT: "30-99928182-2",
                CondicionIVA: "Exento",
                Concepto: "Consultoría de TI",
                Importe: 85000
            }
        ];
        const ws = XLSX.utils.json_to_sheet(sampleData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Facturas a Emitir");
        XLSX.writeFile(wb, "plantilla_facturacion_masiva.xlsx");
    };

    // ==========================================
    // EMISSION & RE-EMISSION LOGIC
    // ==========================================
    const processInvoices = async () => {
        validateData(data);
        const hasErrors = Object.keys(validationErrors).length > 0;
        if (hasErrors) {
            alert("No se pueden emitir facturas con errores de validación. Por favor, corrígelas en la tabla.");
            return;
        }

        setProcessing(true);
        setResults([]);
        setProgress(10);

        const user = JSON.parse(localStorage.getItem('neoconta_user'));
        if (!user) {
            alert("Usuario no identificado. Por favor inicia sesión nuevamente.");
            setProcessing(false);
            return;
        }

        try {
            const response = await fetch('/api/arca/facturar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    invoices: data,
                    userId: user.id
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                alert(`Error del Servidor:\nMensaje: ${result.error}\nDetalle: ${result.details || 'Revisa la consola'}`);
                setProcessing(false);
                return;
            }

            const normalizedResults = result.results.map(r => ({
                ...r,
                RazonSocial: r.RazonSocial || r.cliente || r.Nombre || r.nombre || "-",
                CUIT: r.CUIT || r.Cuit || r.cuit || r.DocNro || "-",
                Importe: r.Importe || r.Total || r.importe || r.total || 0
            }));

            setResults(prev => {
                const newApproved = normalizedResults.filter(r => r.status === 'aprobado');
                const newRejected = normalizedResults.filter(r => r.status !== 'aprobado');
                return [...newRejected, ...newApproved, ...prev];
            });
            setProgress(100);
            setData([]); // Clear raw upload preview on successful process

        } catch (error) {
            console.error("Error processing invoices:", error);
            alert("Ocurrió un error de red al procesar las facturas.");
        } finally {
            setProcessing(false);
        }
    };

    const reEmitFailedInvoices = async () => {
        const failed = results.filter(r => r.status !== 'aprobado');
        if (failed.length === 0) return;

        setProcessing(true);
        setProgress(10);

        const user = JSON.parse(localStorage.getItem('neoconta_user'));
        if (!user) {
            alert("Usuario no identificado.");
            setProcessing(false);
            return;
        }

        try {
            const response = await fetch('/api/arca/facturar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    invoices: failed,
                    userId: user.id
                }),
            });

            const result = await response.json();
            if (!response.ok) {
                alert(`Error al re-emitir: ${result.error}`);
                setProcessing(false);
                return;
            }

            const normalizedResults = result.results.map(r => ({
                ...r,
                RazonSocial: r.RazonSocial || r.cliente || r.Nombre || r.nombre || "-",
                CUIT: r.CUIT || r.Cuit || r.cuit || r.DocNro || "-",
                Importe: r.Importe || r.Total || r.importe || r.total || 0
            }));

            setResults(prev => {
                // Remove the old failed ones that were just re-sent
                const remaining = prev.filter(r => r.status === 'aprobado' || !failed.some(f => f.CUIT === r.CUIT && f.Importe === r.Importe));
                const newApproved = normalizedResults.filter(r => r.status === 'aprobado');
                const newFailed = normalizedResults.filter(r => r.status !== 'aprobado');
                return [...newFailed, ...newApproved, ...remaining];
            });
            setProgress(100);
        } catch (error) {
            console.error("Error re-emitting:", error);
            alert("Error al intentar re-emitir.");
        } finally {
            setProcessing(false);
        }
    };

    // ==========================================
    // PDF GENERATION & ZIP COMPRESSION
    // ==========================================
    const getVoucherLetterInfo = (type) => {
        const numType = Number(type);
        if ([1, 2, 3, 201, 202, 203].includes(numType)) {
            return { letter: "A", code: String(numType).padStart(3, '0') };
        }
        if ([6, 7, 8, 206, 207, 208].includes(numType)) {
            return { letter: "B", code: String(numType).padStart(3, '0') };
        }
        if ([11, 12, 13, 211, 212, 213].includes(numType)) {
            return { letter: "C", code: String(numType).padStart(3, '0') };
        }
        return { letter: "C", code: "011" };
    };

    const buildInvoicePDF = (invoice) => {
        return new Promise((resolve) => {
            const doc = new jsPDF();
            const voucherType = getCbteTipo(invoice);
            const { letter, code } = getVoucherLetterInfo(voucherType);
            const voucherName = getVoucherName(voucherType).toUpperCase();

            // Outer header box
            doc.setDrawColor(80, 80, 80);
            doc.setLineWidth(0.3);
            doc.rect(10, 10, 190, 42); // Header border

            // Letter box
            doc.rect(97, 10, 16, 16);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(26);
            doc.text(letter, 105, 21, { align: "center" });
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.text(`COD. ${code}`, 105, 24, { align: "center" });

            // Vertical separator line
            doc.line(105, 26, 105, 52);

            // Left Column (Vendor Info)
            if (issuerConfig.logo) {
                try {
                    doc.addImage(issuerConfig.logo, 'PNG', 14, 12, 40, 14);
                } catch (logoErr) {
                    console.error("Error drawing logo inside PDF:", logoErr);
                }
                doc.setFont("helvetica", "bold");
                doc.setFontSize(9);
                doc.text(issuerConfig.razonSocial || "Empresa No Configurada", 14, 29);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8.5);
                doc.text(`CUIT: ${formatCuit(issuerConfig.cuit)}`, 14, 34);
                doc.text(`Ingresos Brutos: Convenio Simplificado (${formatCuit(issuerConfig.cuit)})`, 14, 39);
                doc.text("Condición IVA: Responsable Inscripto", 14, 44);
                doc.text("Inicio de Actividades: -", 14, 49);
            } else {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(11);
                doc.text(issuerConfig.razonSocial || "Empresa No Configurada", 14, 18);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9);
                doc.text(`CUIT: ${formatCuit(issuerConfig.cuit)}`, 14, 25);
                doc.text(`Ingresos Brutos: Convenio Simplificado (${formatCuit(issuerConfig.cuit)})`, 14, 31);
                doc.text("Condición IVA: Responsable Inscripto", 14, 37);
                doc.text("Inicio de Actividades: -", 14, 43);
            }

            // Right Column (Invoice Details)
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.text(voucherName, 120, 18);
            
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            const dateStr = invoice.created_at || invoice.cbteFch;
            const processDate = dateStr ? new Date(dateStr).toLocaleDateString('es-AR') : new Date().toLocaleDateString('es-AR');
            doc.text(`Fecha de Emisión: ${processDate}`, 120, 25);

            const ptoVta = String(getPtoVta(invoice)).padStart(5, '0');
            const numExt = String(getCbteDesde(invoice)).padStart(8, '0');
            doc.setFontSize(11);
            doc.text(`Comp. Nro: ${ptoVta}-${numExt}`, 120, 31);

            // Client Info Box
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(10, 56, 190, 28, 2, 2, "F");
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(10, 56, 190, 28, 2, 2, "D");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(71, 85, 105); // slate-600
            doc.text("DATOS DEL RECEPTOR", 14, 62);

            const razonSocial = invoice.RazonSocial || invoice.nombre || "Consumidor Final";
            const cuitClient = invoice.CUIT || invoice.Cuit || invoice.cuit || "00-00000000-0";
            const condiIVA = invoice.CondicionIVA || invoice.condicion || "Consumidor Final";

            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(0, 0, 0);
            doc.text(`Razón Social: ${razonSocial}`, 14, 68);
            doc.text(`CUIT: ${cuitClient}`, 14, 74);
            doc.text(`Condición IVA: ${condiIVA}`, 14, 80);

            const rawAmount = invoice.Importe || invoice.importe || invoice.Total || invoice.total || 0;
            const amountDisplay = formatAmount(rawAmount);

            // Items Table
            autoTable(doc, {
                startY: 88,
                head: [['Concepto', 'Cantidad', 'Precio Unit.', 'Subtotal']],
                body: [
                    [invoice.Concepto || invoice.concepto || "Servicios", 1, `$${amountDisplay}`, `$${amountDisplay}`]
                ],
                theme: 'grid',
                headStyles: { 
                    fillColor: [30, 41, 59], // Slate-800
                    textColor: [255, 255, 255],
                    fontSize: 9,
                    fontStyle: 'bold'
                },
                columnStyles: {
                    0: { halign: 'left' },
                    1: { halign: 'center' },
                    2: { halign: 'right' },
                    3: { halign: 'right' }
                },
                bodyStyles: {
                    fontSize: 9,
                    textColor: [51, 65, 85]
                },
                alternateRowStyles: {
                    fillColor: [248, 250, 252]
                }
            });

            const finalY = doc.lastAutoTable.finalY + 8;

            // Grand Total Box
            doc.setFillColor(248, 250, 252);
            doc.rect(130, finalY, 70, 12, "F");
            doc.setDrawColor(226, 232, 240);
            doc.rect(130, finalY, 70, 12, "D");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.text("TOTAL:", 135, finalY + 8);
            doc.text(`$${amountDisplay}`, 194, finalY + 8, { align: "right" });

            // CAE Block
            if (invoice.cae) {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(9);
                const caeExp = invoice.caeVto || "";
                const formattedExp = caeExp.length === 8
                    ? `${caeExp.substring(6, 8)}/${caeExp.substring(4, 6)}/${caeExp.substring(0, 4)}`
                    : caeExp;

                doc.text(`CAE: ${invoice.cae}`, 14, finalY + 22);
                doc.text(`Vto. CAE: ${formattedExp}`, 14, finalY + 27);

                try {
                    const cleanIssuerCuit = String(issuerConfig.cuit).replace(/[^0-9]/g, '');
                    const qrData = {
                        ver: 1,
                        fecha: invoice.afip_response?.CbteFch ? String(invoice.afip_response.CbteFch).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3") : new Date().toISOString().split('T')[0],
                        cuit: parseInt(cleanIssuerCuit, 10) || 0,
                        ptoVta: getPtoVta(invoice),
                        tipoCmp: getCbteTipo(invoice),
                        nroCmp: getCbteDesde(invoice),
                        importe: amountDisplay,
                        moneda: "PES",
                        ctz: 1,
                        tipoDocRec: invoice.afip_response?.DocTipo || 99,
                        nroDocRec: invoice.afip_response?.DocNro || 0,
                        tipoCodAut: "E",
                        codAut: parseInt(invoice.cae, 10)
                    };

                    const jsonString = JSON.stringify(qrData);
                    const b64Str = btoa(jsonString);
                    const afipUrl = `https://www.afip.gob.ar/fe/qr/?p=${b64Str}`;
                    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(afipUrl)}`;

                    fetch(qrApiUrl)
                        .then(response => response.blob())
                        .then(blob => {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                                const base64data = reader.result;
                                doc.addImage(base64data, 'PNG', 14, finalY + 32, 32, 32);

                                doc.setFontSize(8);
                                doc.setFont("helvetica", "bolditalic");
                                doc.text("Comprobante Autorizado", 50, finalY + 44);
                                doc.setFontSize(7);
                                doc.setFont("helvetica", "normal");
                                doc.text("Esta Administración Federal no se responsabiliza por los datos ingresados.", 50, finalY + 49);

                                resolve(doc);
                            };
                            reader.readAsDataURL(blob);
                        })
                        .catch(err => {
                            console.error("Error generating QR:", err);
                            resolve(doc);
                        });
                } catch (qrError) {
                    console.error("Failed to assemble QR string", qrError);
                    resolve(doc);
                }
            } else {
                resolve(doc);
            }
        });
    };

    const generatePDF = async (invoice) => {
        const doc = await buildInvoicePDF(invoice);
        const numExt = String(getCbteDesde(invoice)).padStart(8, '0');
        const razonSocial = invoice.RazonSocial || invoice.nombre || "Consumidor Final";
        const voucherType = getCbteTipo(invoice);
        const isCreditNote = [3, 8, 13, 203, 208, 213].includes(voucherType);
        const isDebitNote = [2, 7, 12, 202, 207, 212].includes(voucherType);
        let prefix = "Factura";
        if (isCreditNote) prefix = "NotaCredito";
        else if (isDebitNote) prefix = "NotaDebito";
        doc.save(`${prefix}_${numExt}_${razonSocial.substring(0, 10)}.pdf`);
    };

    const buildDebitNotePDF = (invoice) => {
        return new Promise((resolve) => {
            const doc = new jsPDF();
            const voucherType = 12; // 12 = Nota de Débito C
            const { letter, code } = getVoucherLetterInfo(voucherType);
            const voucherName = "NOTA DE DÉBITO C";

            // Outer header box
            doc.setDrawColor(80, 80, 80);
            doc.setLineWidth(0.3);
            doc.rect(10, 10, 190, 42); // Header border

            // Letter box
            doc.rect(97, 10, 16, 16);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(26);
            doc.text(letter, 105, 21, { align: "center" });
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.text(`COD. ${code}`, 105, 24, { align: "center" });

            // Vertical separator line
            doc.line(105, 26, 105, 52);

            // Left Column (Vendor Info)
            if (issuerConfig.logo) {
                try {
                    doc.addImage(issuerConfig.logo, 'PNG', 14, 12, 40, 14);
                } catch (logoErr) {
                    console.error("Error drawing logo inside PDF:", logoErr);
                }
                doc.setFont("helvetica", "bold");
                doc.setFontSize(9);
                doc.text(issuerConfig.razonSocial || "Empresa No Configurada", 14, 29);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8.5);
                doc.text(`CUIT: ${formatCuit(issuerConfig.cuit)}`, 14, 34);
                doc.text(`Ingresos Brutos: Convenio Simplificado (${formatCuit(issuerConfig.cuit)})`, 14, 39);
                doc.text("Condición IVA: Responsable Inscripto", 14, 44);
                doc.text("Inicio de Actividades: -", 14, 49);
            } else {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(11);
                doc.text(issuerConfig.razonSocial || "Empresa No Configurada", 14, 18);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9);
                doc.text(`CUIT: ${formatCuit(issuerConfig.cuit)}`, 14, 25);
                doc.text(`Ingresos Brutos: Convenio Simplificado (${formatCuit(issuerConfig.cuit)})`, 14, 31);
                doc.text("Condición IVA: Responsable Inscripto", 14, 37);
                doc.text("Inicio de Actividades: -", 14, 43);
            }

            // Right Column (Invoice Details)
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.text(voucherName, 120, 18);
            
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            const dateStr = invoice.debitNoteDate || new Date().toLocaleDateString('es-AR');
            doc.text(`Fecha de Emisión: ${dateStr}`, 120, 25);

            const numExt = String(invoice.debitNoteNro || 0).padStart(8, '0');
            const ptoVta = String(invoice.debitNotePtoVta || 1).padStart(5, '0');
            doc.setFontSize(11);
            doc.text(`Comp. Nro: ${ptoVta}-${numExt}`, 120, 31);

            // Client Info Box
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(10, 56, 190, 28, 2, 2, "F");
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(10, 56, 190, 28, 2, 2, "D");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(71, 85, 105);
            doc.text("DATOS DEL RECEPTOR", 14, 62);

            const razonSocial = invoice.RazonSocial || invoice.nombre || "Consumidor Final";
            const cuitClient = invoice.CUIT || invoice.Cuit || invoice.cuit || "00-00000000-0";
            const condiIVA = invoice.CondicionIVA || invoice.condicion || "Consumidor Final";

            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(0, 0, 0);
            doc.text(`Razón Social: ${razonSocial}`, 14, 68);
            doc.text(`CUIT: ${cuitClient}`, 14, 74);
            doc.text(`Condición IVA: ${condiIVA}`, 14, 80);

            // Related Invoice Reference
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);
            doc.setTextColor(100, 116, 139); // slate-500
            const origPtoVta = String(getPtoVta(invoice)).padStart(5, '0');
            const origNro = String(getCbteDesde(invoice)).padStart(8, '0');
            doc.text(`Comprobante Relacionado: FACTURA C ${origPtoVta}-${origNro} (CAE: ${invoice.cae})`, 10, 89);

            const amountDisplay = formatAmount(invoice.debitNoteAmount || 0);

            // Items Table
            autoTable(doc, {
                startY: 93,
                head: [['Concepto / Descripción', 'Cantidad', 'Precio Unit.', 'Subtotal']],
                body: [
                    [`Recargo e intereses por inflación acumulada (${calculateInflation(getEmissionDate(invoice), invoice.originalImporte || invoice.Importe).rate.toFixed(2)}%)`, 1, `$${amountDisplay}`, `$${amountDisplay}`]
                ],
                theme: 'grid',
                headStyles: { 
                    fillColor: [139, 92, 246], // Violet-500
                    textColor: [255, 255, 255],
                    fontSize: 9,
                    fontStyle: 'bold'
                },
                columnStyles: {
                    0: { halign: 'left' },
                    1: { halign: 'center' },
                    2: { halign: 'right' },
                    3: { halign: 'right' }
                },
                bodyStyles: {
                    fontSize: 9,
                    textColor: [51, 65, 85]
                },
                alternateRowStyles: {
                    fillColor: [248, 250, 252]
                }
            });

            const finalY = doc.lastAutoTable.finalY + 8;

            // Grand Total Box
            doc.setFillColor(248, 250, 252);
            doc.rect(130, finalY, 70, 12, "F");
            doc.setDrawColor(226, 232, 240);
            doc.rect(130, finalY, 70, 12, "D");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.text("TOTAL:", 135, finalY + 8);
            doc.text(`$${amountDisplay}`, 194, finalY + 8, { align: "right" });

            // CAE Block
            if (invoice.debitNoteCae) {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(9);
                const caeExp = invoice.debitNoteVto || "";
                const formattedExp = caeExp.length === 8
                    ? `${caeExp.substring(6, 8)}/${caeExp.substring(4, 6)}/${caeExp.substring(0, 4)}`
                    : caeExp;

                doc.text(`CAE: ${invoice.debitNoteCae}`, 14, finalY + 22);
                doc.text(`Vto. CAE: ${formattedExp}`, 14, finalY + 27);

                try {
                    const cleanIssuerCuit = String(issuerConfig.cuit).replace(/[^0-9]/g, '');
                    const qrData = {
                        ver: 1,
                        fecha: invoice.debitNoteDate || new Date().toISOString().split('T')[0],
                        cuit: parseInt(cleanIssuerCuit, 10) || 0,
                        ptoVta: invoice.debitNotePtoVta || 1,
                        tipoCmp: 12, // 12 = Nota de Débito C
                        nroCmp: invoice.debitNoteNro || 0,
                        importe: amountDisplay,
                        moneda: "PES",
                        ctz: 1,
                        tipoDocRec: invoice.afip_response?.DocTipo || 99,
                        nroDocRec: invoice.afip_response?.DocNro || 0,
                        tipoCodAut: "E",
                        codAut: parseInt(invoice.debitNoteCae, 10)
                    };

                    const jsonString = JSON.stringify(qrData);
                    const b64Str = btoa(jsonString);
                    const afipUrl = `https://www.afip.gob.ar/fe/qr/?p=${b64Str}`;
                    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(afipUrl)}`;

                    fetch(qrApiUrl)
                        .then(response => response.blob())
                        .then(blob => {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                                const base64data = reader.result;
                                doc.addImage(base64data, 'PNG', 14, finalY + 32, 32, 32);

                                doc.setFontSize(8);
                                doc.setFont("helvetica", "bolditalic");
                                doc.text("Comprobante Autorizado", 50, finalY + 44);
                                doc.setFontSize(7);
                                doc.setFont("helvetica", "normal");
                                doc.text("Esta Administración Federal no se responsabiliza por los datos ingresados.", 50, finalY + 49);

                                resolve(doc);
                            };
                            reader.readAsDataURL(blob);
                        })
                        .catch(err => {
                            console.error("Error generating QR:", err);
                            resolve(doc);
                        });
                } catch (qrError) {
                    console.error("Failed to assemble QR string", qrError);
                    resolve(doc);
                }
            } else {
                resolve(doc);
            }
        });
    };

    const generateDebitNotePDF = async (invoice) => {
        const doc = await buildDebitNotePDF(invoice);
        const numExt = String(invoice.debitNoteNro || 0).padStart(8, '0');
        const razonSocial = invoice.RazonSocial || invoice.nombre || "Consumidor Final";
        doc.save(`NotaDebito_${numExt}_${razonSocial.substring(0, 10)}.pdf`);
    };

    const emitDebitNote = async (invoice) => {
        const user = JSON.parse(localStorage.getItem('neoconta_user'));
        if (!user) return;

        const baseAmount = invoice.originalImporte || invoice.Importe;
        const { additional } = calculateInflation(getEmissionDate(invoice), baseAmount);
        if (additional <= 0) return;

        setProcessing(true);
        try {
            const res = await fetch('/api/arca/nota-debito', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    invoiceId: invoice.cae,
                    amount: additional
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                alert(`¡Nota de Débito C emitida con éxito!\nComprobante Nro: 00001-${String(data.debitNote.nro).padStart(8, '0')}\nCAE: ${data.debitNote.cae}`);
                fetchHistory(); // Refresh
            } else {
                alert(`Error al emitir Nota de Débito: ${data.error || 'Revisa la consola'}`);
            }
        } catch (err) {
            console.error("Error emitting Debit Note", err);
            alert("Ocurrió un error de red al intentar emitir la Nota de Débito.");
        } finally {
            setProcessing(false);
        }
    };

    const downloadAllPDFsAsZip = async () => {
        const approvedInvoices = results.filter(r => r.status === 'aprobado');
        if (approvedInvoices.length === 0) {
            alert("No hay facturas aprobadas para descargar en este lote.");
            return;
        }

        setProcessing(true);
        setProgress(5);

        const JSZip = (await import("jszip")).default;
        const zip = new JSZip();

        try {
            let count = 0;
            for (const invoice of approvedInvoices) {
                const doc = await buildInvoicePDF(invoice);
                const numExt = String(getCbteDesde(invoice)).padStart(8, '0');
                const razonSocial = invoice.RazonSocial || invoice.nombre || "Consumidor Final";
                const pdfBytes = doc.output('arraybuffer');
                zip.file(`Factura_${numExt}_${razonSocial.substring(0, 10)}.pdf`, pdfBytes);
                
                count++;
                setProgress(Math.round(5 + (count / approvedInvoices.length) * 90));
            }

            const zipBlob = await zip.generateAsync({ type: "blob" });
            const url = window.URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = "comprobantes_afip_emitidos.zip";
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            setProgress(100);
        } catch (error) {
            console.error("Error generating ZIP:", error);
            alert("Ocurrió un error al empaquetar el archivo ZIP.");
        } finally {
            setProcessing(false);
        }
    };

    // ==========================================
    // INTERACTIVE CELL RENDERING & EDITING
    // ==========================================
    const renderCell = (invoice, idx, field, isResult = false) => {
        const hasError = !isResult && validationErrors[idx] && validationErrors[idx][field];
        const isEditable = !isResult || invoice.status !== 'aprobado';
        const val = invoice[field] || "";
        
        if (isEditable && editingCell?.idx === idx && editingCell?.field === field) {
            return (
                <input
                    type={field === 'Importe' ? 'number' : 'text'}
                    value={val}
                    onChange={(e) => handleCellChange(idx, field, e.target.value, isResult)}
                    onBlur={() => setEditingCell(null)}
                    onKeyDown={(e) => { if (e.key === 'Enter') setEditingCell(null); }}
                    autoFocus
                    className="w-full px-1.5 py-0.5 text-xs border border-orange-300 dark:border-orange-500 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                />
            );
        }
        
        return (
            <div 
                onClick={() => isEditable && setEditingCell({ idx, field })}
                className={`cursor-pointer min-h-[24px] flex items-center justify-between rounded px-1 py-0.5 group transition-colors ${
                    isEditable ? 'hover:bg-slate-50 dark:hover:bg-slate-800/60' : ''
                } ${hasError ? 'border border-red-500/60 bg-red-50/50 dark:bg-red-950/20' : ''}`}
                title={hasError ? validationErrors[idx][field] : (isEditable ? "Doble clic para editar" : "")}
            >
                <span className={field === 'CUIT' ? 'font-mono text-xs' : 'text-xs'}>
                    {field === 'Importe' ? `$${formatAmount(val)}` : val}
                </span>
                {isEditable && (
                    <span className="opacity-0 group-hover:opacity-100 text-[8px] text-orange-500 font-semibold transition-opacity shrink-0 ml-1">
                        edit
                    </span>
                )}
            </div>
        );
    };

    // ==========================================
    // FILTERED TABLE DATA GETTER
    // ==========================================
    const getFilteredRows = () => {
        const activeList = results.length > 0 ? results : data;
        const isResultList = results.length > 0;
        
        // Build a Set of approved parent invoice keys to avoid O(N^2) complexity in filter
        const approvedParentsSet = new Set();
        if (isResultList) {
            results.forEach(parent => {
                if (parent.status === 'aprobado') {
                    const parentType = Number(getCbteTipo(parent));
                    const parentPtoVta = Number(getPtoVta(parent));
                    const parentNro = Number(getCbteDesde(parent));
                    approvedParentsSet.add(`${parentType}_${parentPtoVta}_${parentNro}`);
                }
            });
        }
        
        return activeList.filter(invoice => {
            const clientName = String(invoice.RazonSocial || invoice.Nombre || invoice.razonSocial || invoice.nombre || "").toLowerCase();
            const cuitVal = String(invoice.CUIT || invoice.Cuit || invoice.cuit || invoice.DocNro || "").toLowerCase();
            const matchesSearch = clientName.includes(searchQuery.toLowerCase()) || cuitVal.includes(searchQuery.toLowerCase());
            
            if (!matchesSearch) return false;
            
            // Ocultar del listado general las notas de crédito/débito que tengan un comprobante asociado activo en el historial
            if (isResultList && invoice.status === "aprobado") {
                const invoiceType = Number(getCbteTipo(invoice));
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

            if (statusFilter === "all") return true;
            
            if (isResultList) {
                if (statusFilter === "aprobado") return invoice.status === "aprobado";
                if (statusFilter === "rechazado") return invoice.status !== "aprobado";
            } else {
                if (statusFilter === "pendiente") return true;
                return false;
            }
            return true;
        });
    };

    const filteredRows = getFilteredRows();
    const isShowingResults = results.length > 0;
    const hasFailedInvoices = results.some(r => r.status !== 'aprobado');

    const totalPages = isShowingResults 
        ? (Math.ceil(totalRows / rowsPerPage) || 1)
        : (Math.ceil(filteredRows.length / rowsPerPage) || 1);
    const paginatedRows = isShowingResults 
        ? filteredRows 
        : filteredRows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    return (
        <div className="max-w-[95vw] mx-auto space-y-6 animate-fade-in-up pb-10">
            {/* Header section with title and upload button */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <FileText className="h-8 w-8 text-orange-600 animate-pulse" />
                        Facturación Masiva (ARCA)
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Sube tu Excel, conéctate en vivo con ARCA y emite facturas masivamente.
                    </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* Plantilla Excel button */}
                    <button
                        onClick={downloadExcelTemplate}
                        disabled={processing}
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 font-medium rounded-xl transition-all shadow-sm border border-slate-200 dark:border-slate-700"
                        title="Descargar Planilla de Carga de ejemplo"
                    >
                        <Download className="h-4 w-4" />
                        Plantilla Excel
                    </button>

                    {/* Cargar archivo button */}
                    <label className="relative cursor-pointer">
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            onChange={handleFileUpload}
                            disabled={processing}
                            className="sr-only"
                        />
                        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${processing
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                            : "bg-white text-slate-700 border border-slate-300 shadow-sm hover:bg-slate-50 hover:shadow dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800"
                            }`}>
                            <FileSpreadsheet className="h-4 w-4 text-green-600 animate-bounce" />
                            {file ? `Cambiar: ${file.name.substring(0, 15)}...` : "Subir Excel de Facturas"}
                        </div>
                    </label>

                    {/* Emitir Comprobante Individual button */}
                    <button
                        onClick={() => setIsIndividualModalOpen(true)}
                        disabled={processing}
                        className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-xl transition-all shadow-sm border border-orange-700 hover:shadow cursor-pointer"
                        title="Emitir un comprobante individual (Factura, Nota de Crédito/Débito, etc.)"
                    >
                        <PlusCircle className="h-4.5 w-4.5" />
                        Comprobante Individual
                    </button>

                    {/* Process invoices button */}
                    {data.length > 0 && (
                        <button
                            onClick={processInvoices}
                            disabled={processing}
                            className="flex items-center justify-center gap-2 py-2.5 px-5 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-xl transition-all shadow disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {processing ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Emitiendo ({progress}%)
                                </>
                            ) : (
                                <>
                                    <Upload className="h-4 w-4" />
                                    Emitir {data.length} Facturas
                                </>
                            )}
                        </button>
                    )}

                    {/* ZIP download button for results */}
                    {isShowingResults && results.some(r => r.status === 'aprobado') && (
                        <button
                            onClick={downloadAllPDFsAsZip}
                            disabled={processing}
                            className="flex items-center justify-center gap-2 py-2.5 px-5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all shadow border border-blue-700"
                            title="Descargar todos los comprobantes emitidos en un archivo comprimido .ZIP"
                        >
                            <FileArchive className="h-4 w-4" />
                            Descargar Todo (ZIP)
                        </button>
                    )}

                    {/* Re-emit failed invoices */}
                    {isShowingResults && hasFailedInvoices && (
                        <button
                            onClick={reEmitFailedInvoices}
                            disabled={processing}
                            className="flex items-center justify-center gap-2 py-2.5 px-5 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl transition-all shadow border border-amber-600"
                        >
                            <RefreshCw className="h-4 w-4 animate-spin-slow" />
                            Re-emitir Errores
                        </button>
                    )}
                </div>
            </div>

            {/* Premium Instruction and Formatting Alert Banner */}
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl p-4 text-xs text-slate-600 dark:text-slate-400 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-2.5">
                    <AlertCircle className="h-5 w-5 text-orange-500 shrink-0 animate-bounce" />
                    <span>
                        <strong>Formato flexible (normalizado con IA):</strong> El Excel puede contener celdas escritas como <i>Monto, Cuit, Razón Social, Detalle, etc.</i> Las celdas marcadas con <span className="text-red-500 font-bold">editar</span> tienen fallas y pueden ser corregidas haciendo clic en ellas directamente en la tabla.
                    </span>
                </div>
                {file && (
                    <button
                        onClick={() => {
                            setFile(null);
                            setData([]);
                            setResults([]);
                            setProgress(0);
                            setValidationErrors({});
                        }}
                        className="flex items-center gap-1.5 text-red-500 hover:text-red-700 font-semibold underline shrink-0 cursor-pointer animate-fade-in"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        Limpiar pantalla
                    </button>
                )}
            </div>

            {/* Controls Bar: Search & Status Filters */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                {/* Search bar */}
                <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por cliente o CUIT..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 pr-4 py-2 w-full text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-slate-900 dark:text-white"
                    />
                </div>

                {/* Filters */}
                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 p-1 rounded-xl border border-slate-200/50 dark:border-slate-700/50 overflow-x-auto w-full sm:w-auto">
                    {[
                        { label: "Todos", value: "all" },
                        ...(isShowingResults ? [
                            { label: "Aprobados", value: "aprobado" },
                            { label: "Errores ARCA", value: "rechazado" }
                        ] : [
                            { label: "Pendientes", value: "pendiente" }
                        ])
                    ].map(tab => (
                        <button
                            key={tab.value}
                            onClick={() => setStatusFilter(tab.value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                                statusFilter === tab.value
                                    ? "bg-orange-600 text-white shadow-sm"
                                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Results Table Section */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden min-h-[500px]">
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                        {isShowingResults ? "Historial y Comprobantes ARCA" : "Vista Previa de Excel Importado"}
                    </h2>
                    <div className="flex items-center gap-4">
                        {isShowingResults && (
                            <button
                                onClick={() => setShowAdjustment(!showAdjustment)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                    showAdjustment
                                        ? "bg-orange-600 text-white shadow-md shadow-orange-600/20"
                                        : "bg-slate-200 dark:bg-slate-800 text-slate-750 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
                                }`}
                            >
                                <TrendingUp className="h-3.5 w-3.5" />
                                <span>Actualizar Valores</span>
                            </button>
                        )}
                        {processing && (
                            <span className="text-sm font-medium text-orange-600 dark:text-orange-400 animate-pulse flex items-center gap-1.5">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Operando con ARCA...
                            </span>
                        )}
                    </div>
                </div>

                {processing && (
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 shrink-0 animate-fade-in">
                        <div className="bg-orange-600 h-1.5 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                    </div>
                )}

                <div className="p-6">
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                            <thead className="bg-slate-50 dark:bg-slate-800">
                                <tr>
                                    <th className="w-[85px] px-2 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Emisión</th>
                                    <th className="px-2 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                                    <th className="w-[110px] px-2 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">CUIT</th>
                                    <th className="w-[95px] px-2 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                                    <th className="px-2 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Concepto</th>
                                    <th className="w-[100px] px-2 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Monto</th>
                                    {showAdjustment && <th className="w-[125px] px-2 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Ajuste</th>}
                                    <th className="w-[100px] px-2 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Saldo</th>
                                    <th className="w-[105px] px-2 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                                    <th className="w-[130px] px-2 py-2 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Vence</th>
                                    <th className="w-[60px] px-2 py-2 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pago</th>
                                    <th className="w-[180px] px-2 py-2 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800">
                                {filteredRows.length === 0 && (
                                    <tr>
                                        <td colSpan={showAdjustment ? "12" : "11"} className="px-6 py-16 text-center text-slate-500 dark:text-slate-400">
                                            No hay registros para mostrar en el estado actual. Sube una planilla de Excel para previsualizar.
                                        </td>
                                    </tr>
                                )}

                                {paginatedRows.map((invoice, idx) => {
                                    const isApproved = invoice.status === 'aprobado';
                                    const baseAmount = invoice.originalImporte || invoice.Importe;
                                    const { rate, additional } = calculateInflation(getEmissionDate(invoice), baseAmount);
                                    
                                    return (
                                        <tr 
                                            key={idx} 
                                            onClick={() => isApproved && setSelectedInvoice(invoice)}
                                            className={`transition-colors ${
                                                !isApproved && isShowingResults ? 'bg-red-500/5 hover:bg-red-500/10' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
                                            } ${isApproved ? 'cursor-pointer' : ''}`}
                                            title={isApproved ? "Clic para ver detalle del comprobante y ND asociada" : ""}
                                        >
                                            {/* Fecha de Emisión */}
                                            <td className="px-2 py-2 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400 font-mono">
                                                {getEmissionDate(invoice)}
                                            </td>

                                            {/* Razon Social */}
                                            <td className="px-2 py-2 whitespace-nowrap text-xs text-slate-900 dark:text-white truncate max-w-[220px]" title={invoice.RazonSocial}>
                                                {renderCell(invoice, idx, "RazonSocial", isShowingResults)}
                                            </td>

                                            {/* CUIT */}
                                            <td className="px-2 py-2 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400 font-mono">
                                                {renderCell(invoice, idx, "CUIT", isShowingResults)}
                                            </td>

                                            {/* Tipo de Comprobante */}
                                            <td className="px-2 py-2 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                                                <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold border ${getVoucherStyle(getCbteTipo(invoice))}`}>
                                                    {getVoucherName(getCbteTipo(invoice))}
                                                </span>
                                            </td>

                                            {/* Concepto */}
                                            <td className="px-2 py-2 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400 max-w-[180px] truncate" title={invoice.Concepto}>
                                                {renderCell(invoice, idx, "Concepto", isShowingResults)}
                                            </td>

                                            {/* Monto */}
                                            <td className="px-2 py-2 whitespace-nowrap text-xs text-slate-900 dark:text-white font-medium">
                                                {isApproved ? (
                                                    <div className="flex flex-col">
                                                        <span className={invoice.inflationAdded ? "text-violet-600 dark:text-violet-400 font-bold" : ""}>
                                                            ${formatAmount(invoice.inflationAdded ? (invoice.adjustedImporte || invoice.Importe) : invoice.Importe)}
                                                        </span>
                                                        {invoice.inflationAdded && (
                                                            <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-800 rounded font-semibold w-max mt-0.5 animate-fade-in-quick">
                                                                Con Ajuste
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    renderCell(invoice, idx, "Importe", isShowingResults)
                                                )}
                                            </td>

                                            {/* Ajuste Inflación */}
                                            {showAdjustment && (
                                                <td className="px-2 py-2 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                                                    {isApproved ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                                                                    +${formatAmount(additional)}
                                                                </span>
                                                                <span className="text-[10px] text-slate-450 dark:text-slate-400">
                                                                    ({rate.toFixed(2)}%)
                                                                </span>
                                                            </div>
                                                                                            {invoice.debitNoteIssued ? (
                                                                <span 
                                                                    className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-450 dark:bg-slate-800 dark:text-slate-500 border border-slate-200 dark:border-slate-700 flex items-center gap-1 cursor-help shrink-0 animate-fade-in-quick" 
                                                                    title="El ajuste por inflación ya fue facturado legalmente mediante una Nota de Débito en AFIP y no puede ser removido."
                                                                >
                                                                    <Lock className="h-2.5 w-2.5 text-slate-400 dark:text-slate-500" /> Facturado
                                                                </span>
                                                            ) : (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (invoice.inflationAdded) {
                                                                            // Revert adjustment
                                                                            updateInvoice(invoice.cae, {
                                                                                inflationAdded: false,
                                                                                originalImporte: null,
                                                                                adjustedImporte: null
                                                                            });
                                                                        } else {
                                                                            // Apply adjustment
                                                                            updateInvoice(invoice.cae, {
                                                                                inflationAdded: true,
                                                                                originalImporte: baseAmount,
                                                                                adjustedImporte: baseAmount + additional
                                                                            });
                                                                        }
                                                                    }}
                                                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all flex items-center gap-0.5 border shrink-0 cursor-pointer ${
                                                                        invoice.inflationAdded
                                                                            ? 'bg-red-500/10 text-red-600 border-red-200 hover:bg-red-500/20'
                                                                            : 'bg-violet-500/10 text-violet-600 border-violet-200 hover:bg-violet-500/20'
                                                                    }`}
                                                                    title={invoice.inflationAdded ? "Revertir Ajuste de Saldo" : "Sumar Ajuste por Inflación al Saldo"}
                                                                >
                                                                    {invoice.inflationAdded ? "Quitar" : "Sumar"}
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400">-</span>
                                                    )}
                                                </td>
                                            )}

                                            {/* Saldo Pendiente */}
                                            <td className="px-2 py-2 whitespace-nowrap text-xs">
                                                {isApproved ? (
                                                    <div className="flex flex-col">
                                                        <span className={`font-semibold ${invoice.isPaid || getInvoiceBalance(invoice) === 0 ? 'text-green-600 dark:text-green-400 font-bold' : 'text-slate-900 dark:text-white'}`}>
                                                            ${formatAmount(getInvoiceBalance(invoice))}
                                                        </span>
                                                        {invoice.inflationAdded && getInvoiceBalance(invoice) > 0 && (
                                                            <div className="mt-0.5 animate-fade-in-quick">
                                                                {invoice.debitNoteIssued ? (
                                                                    <div className="flex flex-col items-start gap-0.5">
                                                                        <span className="px-1 py-0.2 inline-flex text-[9px] leading-3 font-bold rounded bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 items-center gap-0.5" title={`ND Cae: ${invoice.debitNoteCae}`}>
                                                                            <CheckCircle className="h-2 w-2 text-emerald-500" /> ND Emitida
                                                                        </span>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                generateDebitNotePDF(invoice);
                                                                            }}
                                                                            className="text-[9px] text-blue-500 hover:text-blue-700 hover:underline flex items-center gap-0.5 font-medium cursor-pointer"
                                                                            title="Descargar Nota de Débito en PDF"
                                                                        >
                                                                            <Download className="h-2 w-2" /> PDF ND
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            emitDebitNote(invoice);
                                                                        }}
                                                                        disabled={processing}
                                                                        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-600 hover:bg-violet-700 text-white shadow-sm transition-all border border-violet-750 cursor-pointer disabled:opacity-50"
                                                                        title="Emitir Nota de Débito electrónica AFIP asociada por la diferencia de inflación"
                                                                    >
                                                                        <FileText className="h-2 w-2" />
                                                                        Emitir ND
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400">-</span>
                                                )}
                                            </td>

                                            {/* Estado ARCA */}
                                            <td className="px-2 py-2 whitespace-nowrap text-xs">
                                                {!isShowingResults ? (
                                                    <span className="px-1.5 py-0.2 inline-flex text-[9px] leading-4 font-bold rounded-full bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                        Pendiente Emisión
                                                    </span>
                                                ) : isApproved ? (
                                                    <span className="px-1.5 py-0.2 inline-flex text-[9px] leading-4 font-bold rounded-full bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400 border border-green-200 dark:border-green-800 items-center gap-0.5">
                                                        <CheckCircle className="h-2.5 w-2.5" /> Emitida (A)
                                                    </span>
                                                ) : (
                                                    <div className="flex flex-col">
                                                        <span
                                                            className="px-1.5 py-0.2 inline-flex text-[9px] leading-4 font-bold rounded-full bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-800 items-center gap-0.5 cursor-help w-max"
                                                            title={invoice.error || "Rechazado por validación ARCA"}
                                                        >
                                                            <AlertCircle className="h-2.5 w-2.5" /> Rechazada
                                                        </span>
                                                        {invoice.error && <p className="text-[10px] text-red-500 mt-1 max-w-xs whitespace-normal font-medium leading-tight">{invoice.error}</p>}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Vencimiento */}
                                            <td className="px-2 py-2 whitespace-nowrap text-center text-xs">
                                                {isApproved ? (
                                                    <input
                                                        type="date"
                                                        value={invoice.expirationDate || getFallbackDate(invoice) || ''}
                                                        onChange={(e) => updateInvoice(invoice.cae, 'expirationDate', e.target.value)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="mx-auto block w-[115px] px-1 py-0.5 text-[11px] border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-orange-500 outline-none"
                                                    />
                                                ) : (
                                                    <span className="text-slate-400">-</span>
                                                )}
                                            </td>

                                            {/* Pagado Check */}
                                            <td className="px-2 py-2 whitespace-nowrap text-center text-xs">
                                                {isApproved ? (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            updateInvoice(invoice.cae, 'isPaid', !invoice.isPaid);
                                                        }}
                                                        className={`p-0.5 rounded-full transition-all border ${
                                                            invoice.isPaid 
                                                                ? 'bg-green-500/10 text-green-600 border-green-200 hover:bg-green-500/20' 
                                                                : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700'
                                                        }`}
                                                        title={invoice.isPaid ? "Marcar como Impaga" : "Marcar como Cobrada"}
                                                    >
                                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                                    </button>
                                                ) : (
                                                    <span className="text-slate-400">-</span>
                                                )}
                                            </td>

                                            {/* Acciones / CAE */}
                                            <td className="px-2 py-2 whitespace-nowrap text-right text-xs font-semibold">
                                                {isApproved ? (
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <span className="text-slate-500 dark:text-slate-400 font-mono text-[10px] font-normal" title="Código de Autorización Electrónico">{invoice.cae}</span>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedInvoice(invoice);
                                                            }}
                                                            className="p-0.5 rounded bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors border border-blue-200/50 cursor-pointer"
                                                            title="Ver detalle del comprobante y ND relacionada"
                                                        >
                                                            <Eye className="h-3 w-3" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                generatePDF(invoice);
                                                            }}
                                                            className="p-0.5 rounded bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 transition-colors border border-orange-200/50 cursor-pointer"
                                                            title="Descargar comprobante en PDF"
                                                        >
                                                            <Download className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 font-normal">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination Controls */}
                    {((isShowingResults ? totalRows : filteredRows.length) > rowsPerPage) && (
                        <div className="flex justify-between items-center px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-xs font-semibold text-slate-500">
                            <div className="flex items-center gap-2">
                                <span>Mostrando {paginatedRows.length} de {isShowingResults ? totalRows : filteredRows.length} registros</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-350 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors cursor-pointer disabled:cursor-not-allowed"
                                >
                                    Anterior
                                </button>
                                <span className="px-3">Página {currentPage} de {totalPages}</span>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-350 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors cursor-pointer disabled:cursor-not-allowed"
                                >
                                    Siguiente
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ==========================================
                COMPROBANTE DETAIL MODAL (360 VIEW)
               ========================================== */}
            {selectedInvoice && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-fade-in-up">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                            <div className="flex items-center gap-3">
                                <FileText className="h-6 w-6 text-orange-600 shrink-0" />
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                        Detalle del Comprobante
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Vista 360 y comprobantes relacionados ARCA
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedInvoice(null)}
                                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-8 space-y-6">
                            {/* Grid info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Factura details */}
                                <div className="space-y-4">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Datos del Comprobante</h4>
                                    <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/60 space-y-2 text-sm">
                                        <div className="flex justify-between"><span className="text-slate-400">Tipo:</span> <span className="font-semibold text-slate-900 dark:text-white">{getVoucherName(getCbteTipo(selectedInvoice))}</span></div>
                                        <div className="flex justify-between"><span className="text-slate-400">Punto de Venta:</span> <span className="font-semibold text-slate-900 dark:text-white">{String(getPtoVta(selectedInvoice)).padStart(5, '0')}</span></div>
                                        <div className="flex justify-between"><span className="text-slate-400">Número:</span> <span className="font-semibold text-slate-900 dark:text-white">{String(getCbteDesde(selectedInvoice)).padStart(8, '0')}</span></div>
                                        <div className="flex justify-between"><span className="text-slate-400">CAE:</span> <span className="font-mono text-slate-900 dark:text-white">{selectedInvoice.cae}</span></div>
                                        <div className="flex justify-between"><span className="text-slate-400">Vto. CAE:</span> <span className="font-semibold text-slate-900 dark:text-white">
                                            {selectedInvoice.caeVto?.length === 8 
                                                ? `${selectedInvoice.caeVto.substring(6, 8)}/${selectedInvoice.caeVto.substring(4, 6)}/${selectedInvoice.caeVto.substring(0, 4)}` 
                                                : selectedInvoice.caeVto || '-'}
                                        </span></div>
                                        <div className="flex justify-between"><span className="text-slate-400">Emisión:</span> <span className="font-semibold text-slate-900 dark:text-white">{getEmissionDate(selectedInvoice)}</span></div>
                                        <div className="flex justify-between"><span className="text-slate-400">Vencimiento:</span> <span className="font-semibold text-slate-900 dark:text-white">{selectedInvoice.expirationDate || getFallbackDate(selectedInvoice)}</span></div>
                                        <div className="flex justify-between items-center pt-1 border-t border-slate-200/40 dark:border-slate-800">
                                            <span className="text-slate-400">Estado de Cobro:</span> 
                                            <span className={`px-2 py-0.5 inline-flex text-[10px] leading-4 font-bold rounded-full border ${
                                                selectedInvoice.isPaid 
                                                    ? 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400 border-green-200 dark:border-green-800' 
                                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                                            }`}>
                                                {selectedInvoice.isPaid ? 'Cobrada' : 'Impaga'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Cliente details */}
                                <div className="space-y-4">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Datos del Receptor</h4>
                                    <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/60 space-y-2 text-sm">
                                        <div className="flex justify-between"><span className="text-slate-400">Cliente:</span> <span className="font-semibold text-slate-900 dark:text-white max-w-[150px] truncate" title={selectedInvoice.RazonSocial}>{selectedInvoice.RazonSocial}</span></div>
                                        <div className="flex justify-between"><span className="text-slate-400">CUIT:</span> <span className="font-mono text-slate-900 dark:text-white">{selectedInvoice.CUIT}</span></div>
                                        <div className="flex justify-between"><span className="text-slate-400">Condición IVA:</span> <span className="font-semibold text-slate-900 dark:text-white">{selectedInvoice.CondicionIVA}</span></div>
                                        <div className="flex justify-between"><span className="text-slate-400">Concepto facturado:</span> <span className="font-semibold text-slate-900 dark:text-white max-w-[150px] truncate" title={selectedInvoice.Concepto}>{selectedInvoice.Concepto}</span></div>
                                        <div className="flex justify-between pt-1 border-t border-slate-200/40 dark:border-slate-800"><span className="text-slate-400">Monto Base:</span> <span className="font-semibold text-slate-900 dark:text-white">${formatAmount(selectedInvoice.originalImporte || selectedInvoice.Importe)}</span></div>
                                        {selectedInvoice.inflationAdded && (
                                            <div className="flex justify-between text-violet-600 dark:text-violet-400 font-medium">
                                                <span>Ajuste Inflación:</span>
                                                <span>+${formatAmount((selectedInvoice.adjustedImporte || 0) - (selectedInvoice.originalImporte || selectedInvoice.Importe))}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700 font-bold text-slate-900 dark:text-white">
                                            <span>Monto Final:</span> 
                                            <span>${formatAmount(selectedInvoice.inflationAdded ? (selectedInvoice.adjustedImporte || selectedInvoice.Importe) : selectedInvoice.Importe)}</span>
                                        </div>
                                        <div className="flex justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700 font-bold text-slate-900 dark:text-white">
                                            <span>Saldo:</span> 
                                            <span className={getInvoiceBalance(selectedInvoice) === 0 ? "text-green-600 dark:text-green-400 font-bold" : ""}>
                                                ${formatAmount(getInvoiceBalance(selectedInvoice))}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                                                    {/* Relaciones / Comprobantes Modificatorios */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <RefreshCw className="h-3.5 w-3.5" />
                                        Comprobantes Modificatorios Relacionados
                                    </div>
                                    {getAvailableNotesToLink(selectedInvoice).length > 0 && (
                                        <button
                                            onClick={() => setShowAddNotes(!showAddNotes)}
                                            className="text-[10px] font-bold text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 border border-violet-200 dark:border-violet-800 rounded-lg px-2.5 py-1 bg-violet-50/50 dark:bg-violet-950/10 cursor-pointer hover:bg-violet-100/50 dark:hover:bg-violet-900/20 transition-all shrink-0"
                                        >
                                            {showAddNotes ? "Ocultar Disponibles" : "Agregar / Vincular"}
                                        </button>
                                    )}
                                </h4>

                                {(() => {
                                    const relatedVouchers = getRelatedVouchers(selectedInvoice);
                                    const hasInflationDebitNote = selectedInvoice.debitNoteIssued;
                                    const hasInflationPending = selectedInvoice.inflationAdded && !selectedInvoice.debitNoteIssued;
                                    const totalRelatedCount = relatedVouchers.length + (hasInflationDebitNote ? 1 : 0);

                                    return (
                                        <div className="space-y-3">
                                            {/* 1. Inflation Debit Note if issued */}
                                            {hasInflationDebitNote && (
                                                <div className="bg-violet-500/5 border border-violet-500/20 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in-quick">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-bold text-violet-600 dark:text-violet-400">Nota de Débito C (Ajuste)</span>
                                                            <span className="px-2 py-0.2 text-[9px] font-bold rounded bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-450 border border-emerald-200 dark:border-emerald-800">ARCA Autorizada</span>
                                                        </div>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                                            Comprobante Nro: <b>00001-{String(selectedInvoice.debitNoteNro || 0).padStart(8, '0')}</b><br />
                                                            CAE: <span className="font-mono">{selectedInvoice.debitNoteCae}</span> (Vto: {selectedInvoice.debitNoteVto})<br />
                                                            Fecha de Emisión: {selectedInvoice.debitNoteDate}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-3 shrink-0">
                                                        <span className="text-base font-bold text-violet-600 dark:text-violet-400 font-mono">
                                                            +${formatAmount(selectedInvoice.debitNoteAmount || 0)}
                                                        </span>
                                                        <button
                                                            onClick={() => generateDebitNotePDF(selectedInvoice)}
                                                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white shadow transition-all border border-violet-750 cursor-pointer"
                                                            title="Descargar comprobante de Nota de Débito en PDF"
                                                        >
                                                            <Download className="h-3 w-3" />
                                                            Descargar PDF
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* 2. Manual Credit/Debit Notes associated */}
                                            {relatedVouchers.map((item, index) => {
                                                const itemType = getCbteTipo(item);
                                                const isCreditNote = [3, 8, 13, 203, 208, 213].includes(itemType);
                                                const cardBg = isCreditNote 
                                                    ? "bg-amber-500/5 border-amber-500/20" 
                                                    : "bg-emerald-500/5 border-emerald-500/20";
                                                const titleColor = isCreditNote 
                                                    ? "text-amber-600 dark:text-amber-400" 
                                                    : "text-emerald-655 dark:text-emerald-400";
                                                const badgeBg = isCreditNote 
                                                    ? "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/50"
                                                    : "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-450 border-emerald-200 dark:border-emerald-900/50";
                                                const amountPrefix = isCreditNote ? "-" : "+";
                                                const amountColor = isCreditNote ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-450";
                                                
                                                const ptoVtaStr = String(getPtoVta(item)).padStart(5, '0');
                                                const nroStr = String(getCbteDesde(item)).padStart(8, '0');
                                                const emissionDate = getEmissionDate(item);
                                                
                                                return (
                                                    <div key={`rel-${index}`} className={`border p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in-quick ${cardBg}`}>
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`text-sm font-bold ${titleColor}`}>
                                                                    {getVoucherName(itemType)}
                                                                </span>
                                                                <span className={`px-2 py-0.2 text-[9px] font-bold rounded border ${badgeBg}`}>
                                                                    ARCA Autorizado
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                                                Comprobante Nro: <b>{ptoVtaStr}-{nroStr}</b><br />
                                                                CAE: <span className="font-mono">{item.cae}</span> (Vto: {item.caeVto || item.caeFchVto})<br />
                                                                Fecha de Emisión: {emissionDate}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-3 shrink-0">
                                                            <span className={`text-base font-bold font-mono ${amountColor}`}>
                                                                {amountPrefix}${formatAmount(item.Importe)}
                                                            </span>
                                                            <button
                                                                onClick={async () => {
                                                                    if (confirm("¿Estás seguro de que deseas desvincular este comprobante de la factura? Al hacerlo, volverá a aparecer por separado en el listado principal.")) {
                                                                        await updateInvoice(item.cae, { CbtesAsoc: [], cbtesAsoc: [] });
                                                                    }
                                                                }}
                                                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50/50 hover:bg-rose-100/60 dark:bg-rose-950/20 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-450 border border-rose-200 dark:border-rose-900/50 shadow-sm transition-all cursor-pointer"
                                                                title="Desvincular comprobante de la factura"
                                                            >
                                                                <Link2Off className="h-3 w-3" />
                                                                Desvincular
                                                            </button>
                                                            <button
                                                                onClick={() => generatePDF(item)}
                                                                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow transition-all cursor-pointer ${
                                                                    isCreditNote 
                                                                        ? 'bg-amber-600 hover:bg-amber-700 border-amber-700' 
                                                                        : 'bg-emerald-600 hover:bg-emerald-700 border-emerald-700'
                                                                }`}
                                                                title="Descargar comprobante en PDF"
                                                            >
                                                                <Download className="h-3 w-3" />
                                                                Descargar PDF
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {/* 3. Inflation Adjustment Pending if not issued and inflation was added */}
                                            {hasInflationPending && (
                                                <div className="bg-amber-500/5 border border-amber-500/20 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in-quick">
                                                    <div className="space-y-1">
                                                        <span className="text-sm font-bold text-amber-650 dark:text-amber-400">Ajuste por Inflación Pendiente de Facturar</span>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                                            Se aplicó un recargo por inflación de <b>+${formatAmount(calculateInflation(getEmissionDate(selectedInvoice), selectedInvoice.originalImporte || selectedInvoice.Importe).additional)}</b>, pero aún no se ha emitido la Nota de Débito legal para este cliente.
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            emitDebitNote(selectedInvoice);
                                                            setSelectedInvoice(null); // Close modal on trigger to refresh
                                                        }}
                                                        disabled={processing}
                                                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white shadow-md border border-violet-750 cursor-pointer shrink-0 disabled:opacity-50"
                                                    >
                                                        <FileText className="h-3.5 w-3.5" />
                                                        Emitir Nota Débito
                                                    </button>
                                                </div>
                                            )}

                                            {/* 4. Empty State if nothing is related/pending */}
                                            {totalRelatedCount === 0 && !hasInflationPending && (
                                                <div className="bg-slate-50 dark:bg-slate-800/20 border border-slate-200/50 dark:border-slate-800/80 p-5 rounded-2xl text-center text-xs text-slate-400">
                                                    No se registran comprobantes modificatorios (notas de débito o crédito) asociados a este comprobante.
                                                </div>
                                            )}

                                            {/* 5. Available Notes to Link (Manual Attachment) */}
                                            {showAddNotes && (() => {
                                                const availableNotes = getAvailableNotesToLink(selectedInvoice);
                                                if (availableNotes.length === 0) return null;
                                                
                                                return (
                                                    <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-slate-800/60 space-y-3 animate-fade-in-quick">
                                                        <h5 className="text-[10px] font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                                            <PlusCircle className="h-3 w-3" />
                                                            Vincular Notas de Crédito/Débito Disponibles (Mismo CUIT)
                                                        </h5>
                                                        <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                                                            {availableNotes.map((note, idx) => {
                                                                const noteType = getCbteTipo(note);
                                                                const isCredit = [3, 8, 13, 203, 208, 213].includes(noteType);
                                                                const ptoVtaStr = String(getPtoVta(note)).padStart(5, '0');
                                                                const nroStr = String(getCbteDesde(note)).padStart(8, '0');
                                                                
                                                                return (
                                                                    <div key={`avail-${idx}`} className="flex items-center justify-between p-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/5 text-xs">
                                                                        <div className="space-y-0.5">
                                                                            <div className="flex items-center gap-1.5">
                                                                                <span className={`font-bold ${isCredit ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                                                    {getVoucherName(noteType)}
                                                                                </span>
                                                                                <span className="text-slate-400 font-mono">({ptoVtaStr}-{nroStr})</span>
                                                                            </div>
                                                                            <p className="text-[10px] text-slate-400 font-mono">
                                                                                CAE: {note.cae} | Emisión: {getEmissionDate(note)}
                                                                            </p>
                                                                        </div>
                                                                        <div className="flex items-center gap-2.5 shrink-0">
                                                                            <span className={`font-bold font-mono text-xs ${isCredit ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                                                {isCredit ? '-' : '+'}${formatAmount(note.Importe)}
                                                                            </span>
                                                                            <button
                                                                                onClick={async () => {
                                                                                    const parentType = getCbteTipo(selectedInvoice);
                                                                                    const parentPtoVta = getPtoVta(selectedInvoice);
                                                                                    const parentNro = getCbteDesde(selectedInvoice);
                                                                                    const assocObj = {
                                                                                        Tipo: Number(parentType),
                                                                                        PtoVta: Number(parentPtoVta),
                                                                                        Nro: Number(parentNro)
                                                                                    };
                                                                                    await updateInvoice(note.cae, { CbtesAsoc: [assocObj], cbtesAsoc: [assocObj] });
                                                                                }}
                                                                                className="px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-bold cursor-pointer transition-all text-[11px] shadow-sm border border-violet-750"
                                                                            >
                                                                                Vincular
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/30">
                            <button
                                onClick={() => generatePDF(selectedInvoice)}
                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl border border-slate-350 hover:bg-slate-100 dark:border-slate-750 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer"
                                title={`Descargar ${getVoucherName(getCbteTipo(selectedInvoice))} en PDF`}
                            >
                                <Download className="h-4 w-4" />
                                Descargar PDF
                            </button>
                            <button
                                onClick={() => setSelectedInvoice(null)}
                                className="px-5 py-2.5 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white transition-all cursor-pointer"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal para Factura Individual */}
            {isIndividualModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col my-8 animate-fade-in-up">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <PlusCircle className="h-5 w-5 text-orange-600" />
                                    Emitir Comprobante Individual (ARCA)
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    Completa los datos para emitir directamente en ARCA
                                </p>
                            </div>
                            <button
                                onClick={() => setIsIndividualModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleIndividualSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
                            {/* Grid 1: Tipo y Nro de Documento */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Tipo de Documento</label>
                                    <select
                                        value={indVoucher.docTipo || 80}
                                        onChange={(e) => {
                                            const type = Number(e.target.value);
                                            setIndVoucher(prev => ({
                                                ...prev,
                                                docTipo: type,
                                                cuit: type === 99 ? "0" : (prev.docTipo === 99 ? "" : prev.cuit)
                                            }));
                                        }}
                                        className="w-full px-3.5 py-2 text-sm border border-slate-350 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all cursor-pointer"
                                    >
                                        <option value={80}>CUIT (Empresas / Monotributistas)</option>
                                        <option value={96}>DNI (Persona Física)</option>
                                        <option value={86}>CUIL</option>
                                        <option value={99}>Sin Identificar / Consumidor Final</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                                            {indVoucher.docTipo === 80 ? "CUIT del Receptor" :
                                             indVoucher.docTipo === 86 ? "CUIL del Receptor" :
                                             indVoucher.docTipo === 96 ? "DNI del Receptor" : "Nro. de Documento"}
                                        </label>
                                        {cuitVerifying && (
                                            <span className="text-[10px] font-medium text-orange-500 animate-pulse flex items-center gap-1">
                                                <Loader2 className="h-2.5 w-2.5 animate-spin" /> Buscando en ARCA...
                                            </span>
                                        )}
                                        {cuitVerified === true && (
                                            <span className="text-[10px] font-bold text-green-600 dark:text-green-400 flex items-center gap-0.5" title={cuitMessage}>
                                                ✓ ARCA Verificado
                                            </span>
                                        )}
                                        {cuitVerified === false && (
                                            <span className="text-[10px] font-bold text-red-500 flex items-center gap-0.5" title={cuitMessage}>
                                                {cuitMessage.includes("notAuthorized") || cuitMessage.includes("no autorizado") 
                                                    ? "⚠ Sin Permiso ARCA" 
                                                    : cuitMessage.includes("certificados") || cuitMessage.includes("configuración") 
                                                    ? "⚠ Sin Certificados" 
                                                    : "⚠ Error de Consulta"
                                                }
                                            </span>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        list={indVoucher.docTipo !== 99 ? "frequent-cuits" : undefined}
                                        required={indVoucher.docTipo !== 99}
                                        disabled={indVoucher.docTipo === 99}
                                        placeholder={
                                            indVoucher.docTipo === 80 || indVoucher.docTipo === 86 
                                                ? "Ej: 30518594466 (o selecciona frecuente)" 
                                                : indVoucher.docTipo === 96 
                                                    ? "Ej: 22444555 (o selecciona frecuente)" 
                                                    : "0"
                                        }
                                        value={indVoucher.docTipo === 99 ? "0" : indVoucher.cuit}
                                        onChange={handleCuitChange}
                                        className={`w-full px-3.5 py-2 text-sm border rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all ${
                                            cuitVerified === true ? 'border-green-500/50 dark:border-green-500/30' : 
                                            cuitVerified === false ? 'border-red-500/50 dark:border-red-500/30' : 'border-slate-350 dark:border-slate-700'
                                        } disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800/50`}
                                    />
                                    {indVoucher.docTipo !== 99 && frequentClients.length > 0 && (
                                        <datalist id="frequent-cuits">
                                            {frequentClients
                                                .filter(c => Number(c.docTipo) === Number(indVoucher.docTipo))
                                                .map(client => (
                                                    <option key={client.cuit} value={client.cuit}>
                                                        {client.razonSocial} ({client.condicionIva})
                                                    </option>
                                                ))
                                            }
                                        </datalist>
                                    )}
                                    {cuitVerified === false && cuitMessage && (
                                        <p className="text-[11px] font-semibold text-red-600 dark:text-red-400 mt-1 pl-1 leading-normal animate-fade-in-quick">
                                            {cuitMessage.includes("notAuthorized") || cuitMessage.includes("no autorizado") ? (
                                                <>
                                                    <b>Permisos insuficientes:</b> El certificado de este emisor no tiene el servicio de padrón delegado en ARCA. Debes delegar el servicio <code>ws_sr_padron_a13</code> (Servicio Consulta Padrón A13) al certificado del CUIT emisor desde la web de ARCA ("Administrador de Relaciones").
                                                </>
                                            ) : cuitMessage.includes("certificados") || cuitMessage.includes("configuración") ? (
                                                <>
                                                    <b>Certificados requeridos:</b> {cuitMessage}
                                                </>
                                            ) : (
                                                <>
                                                    <b>Error:</b> {cuitMessage}
                                                </>
                                            )}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Razón Social */}
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">A. y Nombre o Razón Social</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: Universidad de Mendoza"
                                    value={indVoucher.razonSocial}
                                    onChange={(e) => setIndVoucher(prev => ({ ...prev, razonSocial: e.target.value }))}
                                    className="w-full px-3.5 py-2 text-sm border border-slate-350 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all font-medium"
                                />
                            </div>

                            {/* Grid 2: Tipo de Comprobante / Condición IVA / Concepto */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Tipo de Comprobante</label>
                                    <select
                                        value={indVoucher.cbteTipo}
                                        onChange={(e) => {
                                            const type = Number(e.target.value);
                                            let assoc = 11;
                                            if ([2, 3, 202, 203].includes(type)) {
                                                assoc = 1; 
                                            } else if ([7, 8, 207, 208].includes(type)) {
                                                assoc = 6; 
                                            }
                                            let cond = indVoucher.condicionIva;
                                            if ([1, 2, 3, 201, 202, 203].includes(type) && cond === "Consumidor Final") {
                                                cond = "IVA Responsable Inscripto";
                                            }
                                            setIndVoucher(prev => ({
                                                ...prev,
                                                cbteTipo: type,
                                                assocTipo: assoc,
                                                condicionIva: cond
                                            }));
                                        }}
                                        className="w-full px-3.5 py-2 text-sm border border-slate-350 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all cursor-pointer"
                                    >
                                        <option value={11}>Factura C (Monotributo)</option>
                                        <option value={12}>Nota de Débito C</option>
                                        <option value={13}>Nota de Crédito C</option>
                                        <option value={211}>FCE MiPyME C (Factura de Crédito)</option>
                                        <option value={212}>Nota de Débito MiPyME C</option>
                                        <option value={213}>Nota de Crédito MiPyME C</option>
                                        <option value={1}>Factura A (Resp. Inscripto)</option>
                                        <option value={2}>Nota de Débito A</option>
                                        <option value={3}>Nota de Crédito A</option>
                                        <option value={201}>FCE MiPyME A</option>
                                        <option value={202}>Nota de Débito MiPyME A</option>
                                        <option value={203}>Nota de Crédito MiPyME A</option>
                                        <option value={6}>Factura B</option>
                                        <option value={7}>Nota de Débito B</option>
                                        <option value={8}>Nota de Crédito B</option>
                                        <option value={206}>FCE MiPyME B</option>
                                        <option value={207}>Nota de Débito MiPyME B</option>
                                        <option value={208}>Nota de Crédito MiPyME B</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Punto de Venta</label>
                                    <input
                                        type="number"
                                        min={1}
                                        required
                                        value={indVoucher.ptoVta}
                                        onChange={(e) => setIndVoucher(prev => ({ ...prev, ptoVta: Math.max(1, Number(e.target.value)) }))}
                                        className="w-full px-3.5 py-2 text-sm border border-slate-350 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all font-medium"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Condición IVA Receptor</label>
                                    <select
                                        value={indVoucher.condicionIva}
                                        onChange={(e) => setIndVoucher(prev => ({ ...prev, condicionIva: e.target.value }))}
                                        className="w-full px-3.5 py-2 text-sm border border-slate-350 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all cursor-pointer"
                                    >
                                        <option value="Consumidor Final">Consumidor Final</option>
                                        <option value="IVA Responsable Inscripto">IVA Responsable Inscripto</option>
                                        <option value="Responsable Monotributo">Responsable Monotributo</option>
                                        <option value="IVA Sujeto Exento">IVA Sujeto Exento</option>
                                        <option value="Sujeto No Categorizado">Sujeto No Categorizado</option>
                                        <option value="Proveedor del Exterior">Proveedor del Exterior</option>
                                        <option value="Cliente del Exterior">Cliente del Exterior</option>
                                        <option value="IVA Liberado - Ley N° 19.640">IVA Liberado - Ley N° 19.640</option>
                                        <option value="Monotributista Social">Monotributista Social</option>
                                        <option value="IVA No Alcanzado">IVA No Alcanzado</option>
                                        <option value="Monotributista Trabajador Independiente Promovido">Monotributista Trabajador Independiente Promovido</option>
                                    </select>
                                </div>
                            </div>

                            {/* Detalle / Descripción */}
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Detalle / Descripción del Comprobante</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: Honorarios por servicios profesionales correspondientes a Junio 2026"
                                    value={indVoucher.detalle}
                                    onChange={(e) => setIndVoucher(prev => ({ ...prev, detalle: e.target.value }))}
                                    className="w-full px-3.5 py-2 text-sm border border-slate-350 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all font-medium"
                                />
                            </div>

                            {/* Grid 3: Concepto / Monto Total / Fecha */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Tipo de Concepto</label>
                                    <select
                                        value={indVoucher.concepto}
                                        onChange={(e) => setIndVoucher(prev => ({ ...prev, concepto: Number(e.target.value) }))}
                                        className="w-full px-3.5 py-2 text-sm border border-slate-350 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all cursor-pointer"
                                    >
                                        <option value={1}>Productos</option>
                                        <option value={2}>Servicios</option>
                                        <option value={3}>Productos y Servicios</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Monto Total ($)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        placeholder="Ej: 131890.00"
                                        value={indVoucher.total}
                                        onChange={(e) => setIndVoucher(prev => ({ ...prev, total: e.target.value }))}
                                        className="w-full px-3.5 py-2 text-sm border border-slate-350 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all font-semibold"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Fecha del Comprobante</label>
                                    <input
                                        type="date"
                                        required
                                        value={indVoucher.cbteFch}
                                        onChange={(e) => setIndVoucher(prev => ({ ...prev, cbteFch: e.target.value }))}
                                        className="w-full px-3.5 py-2 text-sm border border-slate-350 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all cursor-pointer"
                                    />
                                </div>
                            </div>

                            {/* VAT rate selector: visible ONLY for A/B vouchers */}
                            {[1, 2, 3, 6, 7, 8, 201, 202, 203, 206, 207, 208].includes(Number(indVoucher.cbteTipo)) && (
                                <div className="p-4 bg-orange-50/50 dark:bg-orange-950/10 border border-orange-200/50 dark:border-orange-900/30 rounded-2xl space-y-3 animate-fade-in-quick">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-orange-600 dark:text-orange-400">Desglose de IVA</span>
                                        <select
                                            value={indVoucher.vatRate}
                                            onChange={(e) => setIndVoucher(prev => ({ ...prev, vatRate: e.target.value }))}
                                            className="px-3 py-1 text-xs border border-orange-200 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-orange-500 outline-none transition-all cursor-pointer"
                                        >
                                            <option value="21">IVA 21%</option>
                                            <option value="10.5">IVA 10.5%</option>
                                            <option value="27">IVA 27%</option>
                                            <option value="0">IVA 0%</option>
                                            <option value="Exento">IVA Exento (Op. Exentas)</option>
                                            <option value="No Gravado">No Gravado</option>
                                        </select>
                                    </div>
                                    {/* Calculations display */}
                                    {indVoucher.total && !isNaN(parseFloat(indVoucher.total)) && (
                                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                            <div className="bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-200/60 dark:border-slate-800">
                                                <span className="text-[10px] text-slate-400 block uppercase">Subtotal Neto</span>
                                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                                    ${indVoucher.vatRate === "Exento" || indVoucher.vatRate === "No Gravado" 
                                                        ? "0.00" 
                                                        : (parseFloat(indVoucher.total) / (1 + (parseFloat(indVoucher.vatRate) / 100))).toFixed(2)}
                                                </span>
                                            </div>
                                            <div className="bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-200/60 dark:border-slate-800">
                                                <span className="text-[10px] text-slate-400 block uppercase">Importe IVA</span>
                                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                                    ${indVoucher.vatRate === "Exento" || indVoucher.vatRate === "No Gravado" 
                                                        ? "0.00" 
                                                        : (parseFloat(indVoucher.total) - (parseFloat(indVoucher.total) / (1 + (parseFloat(indVoucher.vatRate) / 100)))).toFixed(2)}
                                                </span>
                                            </div>
                                            <div className="bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-200/60 dark:border-slate-800">
                                                <span className="text-[10px] text-slate-400 block uppercase">Total Final</span>
                                                <span className="font-bold text-orange-600 dark:text-orange-400">
                                                    ${parseFloat(indVoucher.total).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Service Period dates: visible ONLY if Concepto is 2 (Servicios) or 3 */}
                            {(Number(indVoucher.concepto) === 2 || Number(indVoucher.concepto) === 3) && (
                                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl space-y-3 animate-fade-in-quick">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Período de Facturación del Servicio</span>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase font-bold text-slate-500">Servicio Desde</label>
                                            <input
                                                type="date"
                                                required
                                                value={indVoucher.fchServDesde}
                                                onChange={(e) => setIndVoucher(prev => ({ ...prev, fchServDesde: e.target.value }))}
                                                className="w-full px-3 py-1.5 text-xs border border-slate-350 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none cursor-pointer"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase font-bold text-slate-500">Servicio Hasta</label>
                                            <input
                                                type="date"
                                                required
                                                value={indVoucher.fchServHasta}
                                                onChange={(e) => setIndVoucher(prev => ({ ...prev, fchServHasta: e.target.value }))}
                                                className="w-full px-3 py-1.5 text-xs border border-slate-350 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none cursor-pointer"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase font-bold text-slate-500">Vencimiento de Pago</label>
                                            <input
                                                type="date"
                                                required
                                                value={indVoucher.fchVtoPago}
                                                onChange={(e) => setIndVoucher(prev => ({ ...prev, fchVtoPago: e.target.value }))}
                                                className="w-full px-3 py-1.5 text-xs border border-slate-350 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none cursor-pointer"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Associated Voucher section: visible ONLY for Credit/Debit Notes */}
                            {[2, 3, 7, 8, 12, 13, 202, 203, 207, 208, 212, 213].includes(Number(indVoucher.cbteTipo)) && (
                                <div className="p-4 bg-violet-50/50 dark:bg-violet-950/10 border border-violet-200/50 dark:border-violet-900/30 rounded-2xl space-y-3 animate-fade-in-quick">
                                    <span className="text-xs font-bold text-violet-700 dark:text-violet-400 block">Comprobante Asociado (Referencia Requerida)</span>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase font-bold text-slate-500">Tipo Comprobante</label>
                                            <select
                                                value={indVoucher.assocTipo}
                                                onChange={(e) => setIndVoucher(prev => ({ ...prev, assocTipo: Number(e.target.value) }))}
                                                className="w-full px-3 py-1.5 text-xs border border-slate-350 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none cursor-pointer"
                                            >
                                                <option value={11}>Factura C</option>
                                                <option value={1}>Factura A</option>
                                                <option value={6}>Factura B</option>
                                                <option value={211}>FCE MiPyME C</option>
                                                <option value={201}>FCE MiPyME A</option>
                                                <option value={206}>FCE MiPyME B</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase font-bold text-slate-500">Punto de Venta</label>
                                            <input
                                                type="number"
                                                required
                                                min={1}
                                                value={indVoucher.assocPtoVta}
                                                onChange={(e) => setIndVoucher(prev => ({ ...prev, assocPtoVta: Number(e.target.value) }))}
                                                className="w-full px-3 py-1.5 text-xs border border-slate-350 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase font-bold text-slate-500">Número Comprobante</label>
                                            <input
                                                type="number"
                                                required
                                                min={1}
                                                placeholder="Ej: 42"
                                                value={indVoucher.assocNro}
                                                onChange={(e) => setIndVoucher(prev => ({ ...prev, assocNro: e.target.value }))}
                                                className="w-full px-3 py-1.5 text-xs border border-slate-350 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* MiPyME FCE Details: visible ONLY for FCEs */}
                            {[201, 202, 203, 206, 207, 208, 211, 212, 213].includes(Number(indVoucher.cbteTipo)) && (
                                <div className="p-4 bg-blue-50/50 dark:bg-blue-950/10 border border-blue-200/50 dark:border-blue-900/30 rounded-2xl space-y-3 animate-fade-in-quick">
                                    <span className="text-xs font-bold text-blue-700 dark:text-blue-400 block">Datos de MiPyME (FCE)</span>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase font-bold text-slate-500">CBU para Cobro (22 dígitos)</label>
                                            <input
                                                type="text"
                                                maxLength={22}
                                                placeholder="Ej: 0110546420054640248456"
                                                value={indVoucher.cbu}
                                                onChange={(e) => setIndVoucher(prev => ({ ...prev, cbu: e.target.value }))}
                                                className="w-full px-3 py-1.5 text-xs border border-slate-350 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                                            />
                                        </div>
                                        <div className="flex items-center pt-5">
                                            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={indVoucher.transferSystem}
                                                    onChange={(e) => setIndVoucher(prev => ({ ...prev, transferSystem: e.target.checked }))}
                                                    className="rounded border-slate-350 dark:border-slate-700 text-orange-600 focus:ring-orange-500"
                                                />
                                                <span>Transferir a Sist. de Circulación Abierta (SCA)</span>
                                            </label>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-slate-500">Fecha de Vencimiento de Pago (FCE)</label>
                                        <input
                                            type="date"
                                            required
                                            value={indVoucher.fchVtoPago}
                                            onChange={(e) => setIndVoucher(prev => ({ ...prev, fchVtoPago: e.target.value }))}
                                            className="w-2/3 px-3 py-1.5 text-xs border border-slate-350 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none cursor-pointer"
                                        />
                                    </div>
                                </div>
                            )}
                        </form>

                        {/* Footer */}
                        <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50 dark:bg-slate-800/30 rounded-b-3xl">
                            <button
                                type="button"
                                onClick={() => setIsIndividualModalOpen(false)}
                                className="px-5 py-2.5 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-750 dark:text-slate-300 transition-all cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleIndividualSubmit}
                                disabled={processing}
                                className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white shadow-md transition-all cursor-pointer border border-orange-700"
                            >
                                {processing ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Emitiendo...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="h-4 w-4" />
                                        Emitir Comprobante
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
