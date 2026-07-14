"use client";
import { useState, useEffect } from "react";
import { X, Search, Link as LinkIcon, AlertCircle, FileText, CheckCircle2, Copy } from "lucide-react";

export default function BankingDetailModal({ transactionId, onClose }) {
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Linking states
    const [showLinker, setShowLinker] = useState(false);
    const [searchInvoiceText, setSearchInvoiceText] = useState("");
    const [availableInvoices, setAvailableInvoices] = useState([]);
    const [isSearchingInvoices, setIsSearchingInvoices] = useState(false);
    const [linkingAmount, setLinkingAmount] = useState("");

    // CUIT dynamic filtering states
    const [allRawInvoices, setAllRawInvoices] = useState([]);
    const [identifiedCuit, setIdentifiedCuit] = useState(null);
    const [cuitFilterType, setCuitFilterType] = useState("");

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

    useEffect(() => {
        loadDetails();
    }, [transactionId]);

    const loadDetails = async () => {
        setLoading(true);
        try {
            const userStr = localStorage.getItem('neoconta_user');
            if (!userStr) return;
            const user = JSON.parse(userStr);

            const res = await fetch(`/api/banco/${transactionId}?userId=${user.id}`);
            if (res.ok) {
                const data = await res.json();
                setDetails(data);
            } else {
                setError("No se pudo cargar el detalle del movimiento");
            }
        } catch (error) {
            console.error(error);
            setError("Error de conexión");
        } finally {
            setLoading(false);
        }
    };

    const loadAvailableInvoices = async (bypassCuit = false) => {
        setIsSearchingInvoices(true);
        try {
            const userStr = localStorage.getItem('neoconta_user');
            const user = JSON.parse(userStr);

            let targetCuit = null;
            let filterUsed = "Ninguno";
            let fetchUrl = `/api/arca/historial?userId=${user.id}&limit=100`;

            if (details && details.transaction && !bypassCuit) {
                const tx = details.transaction;

                // Level 1: Check cuit_originante directly from the transaction
                if (tx.cuit_originante) {
                    targetCuit = String(tx.cuit_originante).replace(/[^0-9]/g, '');
                    filterUsed = "CUIT Directo";
                }

                // Level 2: Try to extract CUIT from description or concept using Regex
                if (!targetCuit) {
                    const rawText = `${tx.description || ""} ${tx.concept || ""}`;
                    const match = rawText.match(/\b\d{2}-?\d{8}-?\d{1}\b/);
                    if (match) {
                        targetCuit = match[0].replace(/[^0-9]/g, '');
                        filterUsed = "CUIT en Texto (Regex)";
                    }
                }

                if (targetCuit) {
                    fetchUrl = `/api/arca/historial?userId=${user.id}&cuit=${targetCuit}&limit=100`;
                } else if (tx.client_name) {
                    fetchUrl = `/api/arca/historial?userId=${user.id}&search=${encodeURIComponent(tx.client_name)}&limit=100`;
                    filterUsed = "Nombre de Cliente";
                }
            }

            const res = await fetch(fetchUrl);
            if (res.ok) {
                const data = await res.json();
                const rawInvoices = data.history || [];
                setAllRawInvoices(rawInvoices);

                if (targetCuit && !bypassCuit) {
                    setIdentifiedCuit(targetCuit);
                    setCuitFilterType(filterUsed);
                } else if (!targetCuit && filterUsed === "Nombre de Cliente" && rawInvoices.length > 0 && !bypassCuit) {
                    const foundCuit = getInvoiceCuit(rawInvoices[0]);
                    if (foundCuit) {
                        setIdentifiedCuit(foundCuit);
                        setCuitFilterType(filterUsed);
                        targetCuit = foundCuit;
                    }
                } else {
                    setIdentifiedCuit(null);
                    setCuitFilterType("");
                }

                let invoicesToScore = rawInvoices;
                
                // If we have a transaction to match, send it to Python FastAPI to compute XGBoost matching scores!
                if (details && details.transaction && invoicesToScore.length > 0) {
                    try {
                        const tx = details.transaction;
                        const matchRes = await fetch("/api-ds/api/reconcile/match", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                movement: {
                                    amount: parseFloat(tx.amount),
                                    date: tx.transaction_date,
                                    description: `${tx.client_name || ""} ${tx.description || tx.concept || ""}`
                                },
                                invoices: invoicesToScore.map(inv => ({
                                    id: inv.cae || String(inv.id),
                                    amount: parseFloat(inv.Total || inv.Importe || 0),
                                    date: inv.cbteFch || inv.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
                                    client_name: inv.cliente || inv.RazonSocial || inv.nombre || "Consumidor"
                                }))
                            })
                        });

                        if (matchRes.ok) {
                            const matchData = await matchRes.json();
                            if (matchData.success && matchData.matches) {
                                // Map predictions back to our invoice structures
                                const scoredInvoices = matchData.matches.map(m => {
                                    const original = invoicesToScore.find(inv => (inv.cae || String(inv.id)) === m.invoice.id);
                                    return {
                                        ...original,
                                        probability: m.probability,
                                        features_debug: m.features_debug
                                    };
                                });
                                setAvailableInvoices(scoredInvoices);
                                return;
                            }
                        }
                    } catch (pythonErr) {
                        console.warn("Python DS microservice offline or errored, falling back to standard sorting:", pythonErr);
                    }
                }
                
                // Fallback to standard if python server fails or isn't running
                setAvailableInvoices(invoicesToScore.map(i => ({ ...i, probability: 0 })));
            }
        } catch (err) {
            console.error("Error loading invoice history", err);
        } finally {
            setIsSearchingInvoices(false);
        }
    };

    const handleTransferredToggle = async (e) => {
        const isTransferred = e.target.checked;
        const previousDetails = { ...details };

        setDetails(prev => ({
            ...prev,
            transaction: { ...prev.transaction, is_transferred: isTransferred }
        }));

        try {
            const userStr = localStorage.getItem('neoconta_user');
            const user = JSON.parse(userStr);

            const res = await fetch(`/api/banco/${transactionId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: user.id,
                    updates: { is_transferred: isTransferred }
                })
            });

            if (!res.ok) {
                throw new Error("Failed");
            }
        } catch (error) {
            console.error(error);
            setDetails(previousDetails);
            alert("Error al actualizar estado");
        }
    };

    const handleLinkInvoice = async (invoice, fullAmount) => {
        const amountToLink = linkingAmount ? parseFloat(linkingAmount) : fullAmount;
        if (isNaN(amountToLink) || amountToLink <= 0) {
            alert("Cantidad a vincular inválida");
            return;
        }

        try {
            const userStr = localStorage.getItem('neoconta_user');
            const user = JSON.parse(userStr);

            // Fetch current transaction again to manipulate linked_invoices array
            const currentRes = await fetch(`/api/banco/${transactionId}?userId=${user.id}`);
            if (!currentRes.ok) throw new Error("Could not fetch current tx");
            const currentData = await currentRes.json();

            const currentLinks = currentData.transaction.linked_invoices || [];
            const existingLinkIndex = currentLinks.findIndex(l => l.invoice_id === invoice.cae);

            if (existingLinkIndex >= 0) {
                currentLinks[existingLinkIndex].amount = amountToLink;
                currentLinks[existingLinkIndex].association_date = new Date().toISOString();
            } else {
                currentLinks.push({
                    invoice_id: invoice.cae,
                    amount: amountToLink,
                    association_date: new Date().toISOString(),
                    payment_order_number: '' // Opcional future use
                });
            }

            const putRes = await fetch(`/api/banco/${transactionId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: user.id,
                    updates: { linked_invoices: currentLinks }
                })
            });

            if (putRes.ok) {
                setShowLinker(false);
                setLinkingAmount("");
                loadDetails(); // refresh details UI
            } else {
                throw new Error("Failed to link");
            }
        } catch (error) {
            console.error(error);
            alert("Error al vincular factura");
        }
    };

    const handleUnlinkInvoice = async (invoiceId) => {
        if (!window.confirm("¿Desvincular factura?")) return;

        try {
            const userStr = localStorage.getItem('neoconta_user');
            const user = JSON.parse(userStr);

            const updatedLinks = (details.transaction.linked_invoices || []).filter(l => l.invoice_id !== invoiceId);

            const putRes = await fetch(`/api/banco/${transactionId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: user.id,
                    updates: { linked_invoices: updatedLinks }
                })
            });

            if (putRes.ok) {
                loadDetails();
            } else {
                throw new Error("Failed to unlink");
            }
        } catch (error) {
            console.error(error);
            alert("Error al desvincular");
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS'
        }).format(amount || 0);
    };

    if (error) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full text-center">
                    <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Error</h3>
                    <p className="text-slate-500 mb-6">{error}</p>
                    <button onClick={onClose} className="btn-primary w-full">Cerrar</button>
                </div>
            </div>
        );
    }

    if (!details || loading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 max-w-sm w-full text-center flex flex-col items-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-600 mb-4"></div>
                    <p className="text-sm font-medium text-slate-500">Cargando transacción...</p>
                </div>
            </div>
        );
    }

    const tx = details.transaction;
    const invs = details.invoices || [];

    const totalLinked = invs.reduce((sum, i) => sum + (parseFloat(i.link_amount) || 0), 0);
    const discrepancy = parseFloat(tx.amount) - totalLinked;
    const isReconciled = Math.abs(discrepancy) < 0.01;

    // Filter available invoices logic
    const filteredAvailableInvoices = availableInvoices
        .filter(i => {
            if (!searchInvoiceText) return true;
            const lowTerm = searchInvoiceText.toLowerCase();
            return (
                (i.cliente || i.RazonSocial || i.nombre || '').toLowerCase().includes(lowTerm) ||
                (i.cae || '').includes(lowTerm) ||
                String(i.Total || i.Importe || '').includes(lowTerm)
            );
        })
        .sort((a, b) => (b.probability || 0) - (a.probability || 0));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                            <span className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-lg">
                                <FileText className="h-5 w-5" />
                            </span>
                            Detalle de Movimiento Bancario
                        </h2>
                        <div className="flex items-center gap-4 mt-3">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={tx.is_transferred || false}
                                    onChange={handleTransferredToggle}
                                    className="w-4 h-4 text-orange-600 bg-slate-100 border-slate-300 rounded focus:ring-orange-500 cursor-pointer"
                                />
                                <span className="text-sm font-medium text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                                    Transferido (Fondos Distribuidos)
                                </span>
                            </label>

                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${tx.bank_name === 'SUPERVIELLE'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                                }`}>
                                {tx.bank_name || 'BNA'}
                            </span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Body - Scrollable */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 min-h-0">

                    {/* Key Value Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Fecha</p>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                {tx.transaction_date ? tx.transaction_date.split('-').reverse().join('/') : '-'}
                            </p>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Concepto</p>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-1 truncate" title={tx.concept}>
                                {tx.concept || '-'}
                            </p>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Comprobante</p>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white break-all">
                                {tx.voucher_number || '-'}
                            </p>
                        </div>
                        <div className="p-4 bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-100 dark:border-orange-900/30">
                            <p className="text-xs font-medium text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-1">Monto Depositado</p>
                            <p className="text-lg font-bold text-orange-700 dark:text-orange-500">
                                {formatCurrency(tx.amount)}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Descripción</p>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                {tx.description || '-'}
                            </p>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Cliente / Denominación</p>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                {tx.client_name || '-'}
                            </p>
                        </div>
                    </div>

                    <hr className="border-slate-200 dark:border-slate-800" />

                    {/* Math Reconciliation Summary */}
                    <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between border border-slate-200 dark:border-slate-700/50">
                        <div className="text-center md:text-left mb-4 md:mb-0">
                            <p className="text-sm text-slate-500 font-medium">Monto Movimiento</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(tx.amount)}</p>
                        </div>
                        <div className="text-2xl text-slate-400 font-light hidden md:block">-</div>
                        <div className="text-center md:text-left mb-4 md:mb-0">
                            <p className="text-sm text-slate-500 font-medium">Asociado Restado</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(totalLinked)}</p>
                        </div>
                        <div className="text-2xl text-slate-400 font-light hidden md:block">=</div>
                        <div className="text-center md:text-right">
                            <p className="text-sm text-slate-500 font-medium flex items-center justify-center md:justify-end gap-2">
                                Diferencia
                                {isReconciled && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                            </p>
                            <p className={`text-3xl font-black ${isReconciled ? 'text-emerald-500' : 'text-amber-500'}`}>
                                {formatCurrency(discrepancy)}
                            </p>
                        </div>
                    </div>

                    {/* Linked Invoices Array */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Facturas Asociadas ({invs.length})</h3>
                            <button
                                onClick={() => {
                                    setShowLinker(!showLinker);
                                    if (!showLinker && availableInvoices.length === 0) {
                                        loadAvailableInvoices();
                                    }
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-xl transition-colors"
                            >
                                <LinkIcon className="h-4 w-4" />
                                {showLinker ? "Cerrar Buscador" : "Asociar Factura"}
                            </button>
                        </div>

                        {showLinker && (
                            <div className="mb-6 p-4 bg-orange-50/50 dark:bg-orange-900/5 border border-orange-200 dark:border-orange-900/30 rounded-xl animate-fade-in-up">
                                {identifiedCuit && (
                                    <div className="mb-4 px-3 py-2 bg-orange-100/60 dark:bg-orange-950/20 text-orange-800 dark:text-orange-400 rounded-lg text-xs font-semibold flex items-center justify-between border border-orange-200/40">
                                        <div className="flex items-center gap-2">
                                            <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-500" />
                                            <span>Filtro por CUIT de Cliente activo: <span className="font-bold underline">{identifiedCuit}</span> (Asociado por {cuitFilterType})</span>
                                        </div>
                                        <button 
                                            onClick={() => loadAvailableInvoices(true)}
                                            className="px-2 py-0.5 bg-orange-600 hover:bg-orange-700 text-white rounded text-[10px] font-bold transition-colors"
                                            title="Mostrar todas las facturas sin filtrar"
                                        >
                                            Mostrar todas
                                        </button>
                                    </div>
                                )}
                                {!identifiedCuit && allRawInvoices.length > 0 && details?.transaction?.client_name && (
                                    <div className="mb-4 px-3 py-2 bg-slate-100 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-medium flex items-center justify-between border border-slate-200/30">
                                        <span>Mostrando todas las facturas del sistema (sin filtro de CUIT).</span>
                                        <button 
                                            onClick={() => loadAvailableInvoices(false)}
                                            className="px-2 py-0.5 bg-slate-200 hover:bg-orange-600 hover:text-white dark:bg-slate-700 dark:hover:bg-orange-600 rounded text-[10px] font-bold transition-colors"
                                            title="Aplicar filtro por CUIT de cliente"
                                        >
                                            Re-aplicar Filtro
                                        </button>
                                    </div>
                                )}
                                <div className="flex gap-4 mb-4">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Buscar factura por cliente, CUIT, o CAE..."
                                            value={searchInvoiceText}
                                            onChange={(e) => setSearchInvoiceText(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm dark:bg-slate-900 dark:text-white focus:ring-orange-500 focus:border-orange-500"
                                        />
                                    </div>
                                    <div className="w-1/3 relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                                        <input
                                            type="number"
                                            placeholder="Parcial (opcional)"
                                            value={linkingAmount}
                                            onChange={(e) => setLinkingAmount(e.target.value)}
                                            className="w-full pl-8 pr-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm dark:bg-slate-900 dark:text-white focus:ring-orange-500 focus:border-orange-500"
                                        />
                                    </div>
                                </div>

                                <div className="max-h-[250px] overflow-y-auto bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-inner">
                                    {isSearchingInvoices ? (
                                        <div className="p-4 text-center text-sm text-slate-500">Buscando facturas...</div>
                                    ) : filteredAvailableInvoices.length === 0 ? (
                                        <div className="p-4 text-center text-sm text-slate-500">No hay resultados para asignar.</div>
                                    ) : (
                                        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {filteredAvailableInvoices.slice(0, 20).map(inv => {
                                                const totalInv = parseFloat(inv.Total || inv.Importe || 0);
                                                return (
                                                    <li key={inv.cae || inv.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center justify-between group">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                                                    {inv.cliente || inv.RazonSocial || inv.nombre || "Consumidor"}
                                                                </p>
                                                                {inv.probability !== undefined && inv.probability > 0 && (
                                                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                                                                        inv.probability >= 80
                                                                            ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/20'
                                                                            : inv.probability >= 40
                                                                                ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/20'
                                                                                : 'bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-800/50'
                                                                    }`}>
                                                                        {inv.probability}% Match
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-slate-500">CAE: {inv.cae} | Emisión: {inv.cbteFch || inv.created_at?.split('T')[0]}</p>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <span className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(totalInv)}</span>
                                                            <button
                                                                onClick={() => handleLinkInvoice(inv, totalInv)}
                                                                className="px-3 py-1 bg-slate-100 hover:bg-orange-100 text-slate-700 hover:text-orange-700 rounded-lg text-xs font-semibold transition-colors"
                                                            >
                                                                Vincular
                                                            </button>
                                                        </div>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                                <thead className="bg-slate-50 dark:bg-slate-800/80">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha Asoc.</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">ID Factura (CAE)</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Monto Asignado</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800/50">
                                    {invs.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="px-4 py-8 text-center text-slate-500 text-sm">
                                                No hay facturas vinculadas aún.
                                            </td>
                                        </tr>
                                    ) : (
                                        invs.map(inv => (
                                            <tr key={inv.cae || inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
                                                    {inv.association_date ? new Date(inv.association_date).toLocaleDateString('es-AR') : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white truncate max-w-[150px]">
                                                    {inv.cliente || inv.RazonSocial || inv.nombre || "N/A"}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500 font-mono">
                                                    {inv.cae || inv.id || "N/A"}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-slate-900 dark:text-white text-right">
                                                    {formatCurrency(inv.link_amount)}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-center">
                                                    <button
                                                        onClick={() => handleUnlinkInvoice(inv.cae || inv.id)}
                                                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                        title="Desvincular"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
