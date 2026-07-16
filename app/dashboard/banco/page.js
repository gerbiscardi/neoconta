"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Scale, Search, Upload, RefreshCw, AlertCircle, Eye, Loader2 } from "lucide-react";
import BankingDetailModal from "./BankingDetailModal";

export default function BankingPage() {
    const router = useRouter();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedTx, setSelectedTx] = useState(null);
    const [userConfig, setUserConfig] = useState(null);

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

        // Fetch user config/features
        fetch(`/api/user/config?userId=${user.id}`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setUserConfig(data);
                }
            })
            .catch(err => console.error("Error loading config:", err));

        loadTransactions();
    }, [router]);

    const loadTransactions = async () => {
        setLoading(true);
        try {
            const userStr = localStorage.getItem('neoconta_user');
            if (!userStr) return;
            const user = JSON.parse(userStr);

            const res = await fetch(`/api/banco?userId=${user.id}`);
            if (res.ok) {
                const data = await res.json();
                setTransactions(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error("Error cargando banco:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setImporting(true);
        try {
            const userStr = localStorage.getItem('neoconta_user');
            const user = JSON.parse(userStr);

            const formData = new FormData();
            formData.append("file", file);
            formData.append("userId", user.id);

            const res = await fetch("/api/banco/import", {
                method: "POST",
                body: formData,
            });

            if (res.ok) {
                const result = await res.json();
                alert(`Importación completada:\nNuevos: ${result.imported}\nDuplicados omitidos: ${result.skipped}`);
                loadTransactions();
            } else {
                const err = await res.json();
                alert(`Error en importación: ${err.error}`);
            }
        } catch (error) {
            console.error("Error importando banco:", error);
            alert("Error de conexión al importar");
        } finally {
            setImporting(false);
            e.target.value = null; // reset input
        }
    };

    const formatAmount = (val) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS'
        }).format(val || 0);
    };

    const getTxCuit = (tx) => {
        if (tx.cuit_originante) return tx.cuit_originante;
        const rawText = `${tx.description || ""} ${tx.concept || ""}`;
        const match = rawText.match(/\b\d{2}-?\d{8}-?\d{1}\b/);
        return match ? match[0].replace(/[^0-9]/g, '') : null;
    };

    const filteredTransactions = transactions.filter(tx => {
        const txCuit = getTxCuit(tx) || "";
        return (
            (tx.concept || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (tx.client_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (tx.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            txCuit.includes(searchTerm) ||
            (tx.voucher_number || '').includes(searchTerm)
        );
    });

    return (
        <div className="max-w-[95vw] mx-auto space-y-8 animate-fade-in-up pb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <Scale className="h-8 w-8 text-orange-600" />
                        Banco
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Importá tus resúmenes bancarios y motrealos con facturas.</p>
                </div>

                <div className="flex items-center gap-3">
                    {userConfig?.features?.limiteCuentas !== undefined && (
                        <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-800">
                            <Scale className="h-3.5 w-3.5 text-orange-600" />
                            <span>Límite de Cuentas: {userConfig.features.limiteCuentas}</span>
                        </div>
                    )}
                    <label className="relative cursor-pointer">
                        <input
                            type="file"
                            className="sr-only"
                            accept=".xlsx,.xls"
                            onChange={handleFileUpload}
                            disabled={importing}
                        />
                        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${importing
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                            : "bg-white text-slate-700 border border-slate-300 shadow-sm hover:bg-slate-50 hover:shadow"
                            }`}>
                            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            {importing ? "Importando..." : "Subir Extracto (Excel)"}
                        </div>
                    </label>

                    <button
                        onClick={loadTransactions}
                        disabled={loading}
                        className="p-2.5 rounded-xl bg-white border border-slate-300 text-slate-700 shadow-sm hover:bg-slate-50 transition-all disabled:opacity-50"
                        title="Recargar"
                    >
                        <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                    <div className="relative w-full max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por comprobante, cliente o descripción..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-orange-500 focus:border-orange-500 dark:text-white"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto min-h-[400px]">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                        <thead className="bg-slate-50 dark:bg-slate-800/80">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Banco</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Comprobante</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Detalle</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">CUIT</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Monto</th>
                                <th className="px-6 py-4 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                                <th className="px-6 py-4 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800/50">
                            {loading ? (
                                <tr>
                                    <td colSpan="8" className="px-6 py-12 text-center text-slate-500">
                                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-orange-500 mb-4" />
                                        Cargando movimientos...
                                    </td>
                                </tr>
                            ) : filteredTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="px-6 py-12 text-center text-slate-500">
                                        <AlertCircle className="h-8 w-8 mx-auto text-slate-400 mb-4" />
                                        No se encontraron transacciones
                                    </td>
                                </tr>
                            ) : (
                                filteredTransactions.map(tx => {
                                    // Calculate linking totals natively in frontend
                                    const linkedTotal = (tx.linked_invoices || []).reduce((sum, link) => sum + (parseFloat(link.amount) || 0), 0);
                                    const isOk = Math.abs(parseFloat(tx.amount) - linkedTotal) < 0.01;
                                    const isPending = linkedTotal === 0;

                                    return (
                                        <tr
                                            key={tx.id}
                                            className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                                            onClick={() => setSelectedTx(tx)}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">
                                                {tx.transaction_date ? tx.transaction_date.split('-').reverse().join('/') : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${tx.bank_name === 'SUPERVIELLE'
                                                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                                                    : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                                    }`}>
                                                    {tx.bank_name}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                                                {tx.voucher_number || '-'}
                                                <div className="text-xs text-slate-400 mt-0.5">{tx.concept}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-medium text-slate-900 dark:text-white line-clamp-1">{tx.client_name || '-'}</div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">{tx.description}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400 font-mono text-xs">
                                                {getTxCuit(tx) || "-"}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900 dark:text-white text-right">
                                                {formatAmount(tx.amount)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                {isPending ? (
                                                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-medium rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                                        Pendiente
                                                    </span>
                                                ) : isOk ? (
                                                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-medium rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                        ✅ Ok
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-medium rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" title={`Asignado: ${formatAmount(linkedTotal)}`}>
                                                        ⚠️ Dif
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setSelectedTx(tx); }}
                                                    className="text-orange-500 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20 dark:hover:bg-orange-900/40 p-2 rounded-lg transition-colors"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedTx && (
                <BankingDetailModal
                    transactionId={selectedTx.id}
                    features={userConfig?.features || {}}
                    onClose={() => {
                        setSelectedTx(null);
                        loadTransactions(); // refresh to get potential invoice link updates
                    }}
                />
            )}
        </div>
    );
}
