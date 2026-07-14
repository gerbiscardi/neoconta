"use client";

import { useState, useEffect } from "react";
import { 
    MessageSquare, 
    Globe, 
    History, 
    RefreshCw, 
    Share2, 
    TrendingUp, 
    AlertCircle, 
    CheckCircle, 
    Trash2, 
    Chrome, 
    Facebook, 
    Instagram, 
    ExternalLink, 
    FileText, 
    Award,
    Compass,
    Target,
    EyeOff
} from "lucide-react";

export default function CommentorPage() {
    const [currentUser, setCurrentUser] = useState(null);
    const [activeTab, setActiveTab] = useState("social"); // social, web, history
    const [loading, setLoading] = useState(true);

    // Connection states
    const [connections, setConnections] = useState({
        google: { connected: false },
        meta: { connected: false }
    });
    const [loadingConnections, setLoadingConnections] = useState(false);

    // Syncing and analyzing states
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncError, setSyncError] = useState("");
    const [syncSuccess, setSyncSuccess] = useState(false);

    // Web audit states
    const [webQuery, setWebQuery] = useState("");
    const [isAuditingWeb, setIsAuditingWeb] = useState(false);
    const [webAuditError, setWebAuditError] = useState("");
    const [webAuditSuccess, setWebAuditSuccess] = useState(false);

    // History and report states
    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [selectedReport, setSelectedReport] = useState(null);
    const [isRecalculating, setIsRecalculating] = useState(false);

    useEffect(() => {
        const userStr = localStorage.getItem('neoconta_user');
        if (userStr) {
            const user = JSON.parse(userStr);
            setCurrentUser(user);
            fetchConnections(user.id);
            fetchHistory(user.id);
            // Fetch company config to initialize web query with Razón Social
            fetchCompanyConfig(user.id);
        }
    }, []);

    const fetchConnections = async (userId) => {
        setLoadingConnections(true);
        try {
            const res = await fetch(`/api/ai/connections?userId=${userId}`);
            const data = await res.json();
            if (data.success) {
                setConnections(data.connections);
            }
        } catch (e) {
            console.error("Error fetching connections:", e);
        } finally {
            setLoadingConnections(false);
            setLoading(false);
        }
    };

    const fetchHistory = async (userId) => {
        setLoadingHistory(true);
        try {
            const res = await fetch(`/api/ai/history?userId=${userId}`);
            const data = await res.json();
            if (data.success) {
                setHistory(data.history);
                // Default to show latest report if available
                if (data.history.length > 0 && !selectedReport) {
                    setSelectedReport(data.history[0]);
                }
            }
        } catch (e) {
            console.error("Error fetching history:", e);
        } finally {
            setLoadingHistory(false);
        }
    };

    const fetchCompanyConfig = async (userId) => {
        try {
            const res = await fetch(`/api/user/config?userId=${userId}`);
            const data = await res.json();
            if (data.success && data.razonSocial) {
                setWebQuery(data.razonSocial);
            }
        } catch (e) {
            console.error("Error fetching user config:", e);
        }
    };

    const handleConnect = (provider) => {
        if (!currentUser) return;
        // Redirect to OAuth route
        window.location.href = `/api/auth/${provider}?userId=${currentUser.id}`;
    };

    const handleDisconnect = async (provider) => {
        if (!currentUser) return;
        if (!confirm(`¿Estás seguro de que deseas desconectar tu cuenta de ${provider === 'google' ? 'Google Business' : 'Meta'}?`)) return;

        try {
            const res = await fetch('/api/ai/connections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: currentUser.id,
                    provider,
                    action: 'disconnect'
                })
            });
            const data = await res.json();
            if (data.success) {
                fetchConnections(currentUser.id);
            } else {
                alert(data.error || "Ocurrió un error al desconectar.");
            }
        } catch (e) {
            console.error("Disconnect error:", e);
        }
    };

    const handleSyncReviews = async () => {
        if (!currentUser) return;
        setIsSyncing(true);
        setSyncError("");
        setSyncSuccess(false);

        try {
            const res = await fetch('/api/ai/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUser.id })
            });

            const data = await res.json();
            if (data.success) {
                setSyncSuccess(true);
                fetchHistory(currentUser.id);
                // Switch to show the newly generated report
                setSelectedReport(data.report);
            } else {
                setSyncError(data.error || "Error al sincronizar opiniones.");
            }
        } catch (e) {
            setSyncError("Error de conexión con el servidor.");
        } finally {
            setIsSyncing(false);
        }
    };

    const handleAuditWeb = async (e) => {
        e.preventDefault();
        if (!currentUser || !webQuery.trim()) return;

        setIsAuditingWeb(true);
        setWebAuditError("");
        setWebAuditSuccess(false);

        try {
            const res = await fetch('/api/ai/audit-web', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: currentUser.id,
                    query: webQuery.trim()
                })
            });

            const data = await res.json();
            if (data.success) {
                setWebAuditSuccess(true);
                fetchHistory(currentUser.id);
                setSelectedReport(data.report);
            } else {
                setWebAuditError(data.error || "Error al realizar la auditoría web.");
            }
        } catch (e) {
            setWebAuditError("Error de conexión con el servidor.");
        } finally {
            setIsAuditingWeb(false);
        }
    };

    const handleDeleteReport = async (reportId, e) => {
        e.stopPropagation(); // Prevent selecting the report when clicking delete
        if (!currentUser) return;
        if (!confirm("¿Estás seguro de que deseas eliminar este informe de reputación?")) return;

        try {
            const res = await fetch(`/api/ai/history?userId=${currentUser.id}&reportId=${reportId}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                if (selectedReport?.id === reportId) {
                    setSelectedReport(null);
                }
                fetchHistory(currentUser.id);
            }
        } catch (e) {
            console.error("Delete report error:", e);
        }
    };

    const handleExcludeSource = async (urlToExclude) => {
        if (!currentUser || !selectedReport || isRecalculating) return;

        if (!confirm("¿Estás seguro de que deseas desestimar este resultado? Se eliminará de la lista y se recalculará tu reputación web.")) return;

        setIsRecalculating(true);
        try {
            const res = await fetch('/api/ai/audit-web/recalculate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: currentUser.id,
                    reportId: selectedReport.id,
                    urlToExclude
                })
            });

            const data = await res.json();
            if (data.success) {
                // Update active report in state
                setSelectedReport(data.report);
                // Refresh list of reports in history
                fetchHistory(currentUser.id);
            } else {
                alert(data.error || "Ocurrió un error al desestimar el resultado.");
            }
        } catch (e) {
            console.error("Error excluding source:", e);
            alert("Error de conexión al recalcular.");
        } finally {
            setIsRecalculating(false);
        }
    };

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);
    };

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-orange-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in font-sans">
            {/* Header Title */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
                        <MessageSquare className="h-7 w-7 text-[#ff5e00]" /> Commentor <span className="text-xs bg-orange-100 dark:bg-orange-950/40 text-[#ff5e00] px-2 py-0.5 rounded-full font-bold uppercase">Feedback IA</span>
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Sincronización real de comentarios en redes y auditoría de reputación web mediante Inteligencia Artificial.
                    </p>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="border-b border-slate-200 dark:border-slate-800 flex gap-2">
                <button
                    onClick={() => setActiveTab("social")}
                    className={`pb-4 px-6 font-bold text-sm transition-all border-b-2 flex items-center gap-2 ${
                        activeTab === 'social' ? 'border-[#ff5e00] text-[#ff5e00]' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                    <Share2 className="h-4 w-4" />
                    <span>Canales Sociales</span>
                </button>
                <button
                    onClick={() => setActiveTab("web")}
                    className={`pb-4 px-6 font-bold text-sm transition-all border-b-2 flex items-center gap-2 ${
                        activeTab === 'web' ? 'border-[#ff5e00] text-[#ff5e00]' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                    <Globe className="h-4 w-4" />
                    <span>Imagen Pública Web</span>
                </button>
                <button
                    onClick={() => setActiveTab("history")}
                    className={`pb-4 px-6 font-bold text-sm transition-all border-b-2 flex items-center gap-2 ${
                        activeTab === 'history' ? 'border-[#ff5e00] text-[#ff5e00]' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                    <History className="h-4 w-4" />
                    <span>Historial de Informes ({history.length})</span>
                </button>
            </div>

            {/* TAB 1: SOCIAL REVIEWS */}
            {activeTab === "social" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Panel: Connections & Sync */}
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                            <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                <RefreshCw className="h-5 w-5 text-orange-500" />
                                <span>Cuentas Vinculadas</span>
                            </h3>

                            {/* Providers list */}
                            <div className="space-y-4">
                                {/* Google Card */}
                                <div className="p-4 rounded-xl border border-slate-150 dark:border-slate-800 bg-slate-50/55 dark:bg-slate-900/50 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400">
                                            <Chrome className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-xs text-slate-800 dark:text-slate-200">Google Business Profile</p>
                                            <p className="text-[10px] text-slate-500 truncate max-w-[150px]">
                                                {connections.google?.connected ? connections.google.locationName : "Desconectado"}
                                            </p>
                                        </div>
                                    </div>
                                    {connections.google?.connected ? (
                                        <button
                                            onClick={() => handleDisconnect("google")}
                                            className="px-2.5 py-1 text-[10px] font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-md border border-red-200 dark:border-red-900/50 transition-colors"
                                        >
                                            Desconectar
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleConnect("google")}
                                            className="px-3 py-1 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                                        >
                                            Conectar
                                        </button>
                                    )}
                                </div>

                                {/* Meta (Facebook/Instagram) Card */}
                                <div className="p-4 rounded-xl border border-slate-150 dark:border-slate-800 bg-slate-50/55 dark:bg-slate-900/50 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 rounded-lg bg-pink-50 dark:bg-pink-950/20 text-pink-600 dark:text-pink-400 flex gap-0.5">
                                            <Instagram className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-xs text-slate-800 dark:text-slate-200">Meta (IG / FB)</p>
                                            <p className="text-[10px] text-slate-500 truncate max-w-[150px]">
                                                {connections.meta?.connected ? `${connections.meta.pageName} (${connections.meta.instagramUsername})` : "Desconectado"}
                                            </p>
                                        </div>
                                    </div>
                                    {connections.meta?.connected ? (
                                        <button
                                            onClick={() => handleDisconnect("meta")}
                                            className="px-2.5 py-1 text-[10px] font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-md border border-red-200 dark:border-red-900/50 transition-colors"
                                        >
                                            Desconectar
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleConnect("meta")}
                                            className="px-3 py-1 text-[10px] font-bold text-white bg-pink-600 hover:bg-pink-700 rounded-md transition-colors"
                                        >
                                            Conectar
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Sync controls */}
                        {(connections.google?.connected || connections.meta?.connected) && (
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
                                <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider">Acciones</h4>
                                <button
                                    disabled={isSyncing}
                                    onClick={handleSyncReviews}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#ff5e00] hover:bg-[#ff5e00]/90 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-500/10 hover:shadow-orange-500/25 transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                                >
                                    <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                                    <span>{isSyncing ? "Sincronizando opiniones..." : "Sincronizar y Analizar ahora"}</span>
                                </button>

                                {syncError && (
                                    <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 text-red-755 dark:text-red-300 rounded-lg text-xs flex gap-2">
                                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                        <p>{syncError}</p>
                                    </div>
                                )}

                                {syncSuccess && (
                                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs flex gap-2">
                                        <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                        <p>¡Sincronización y análisis IA completado con éxito!</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right Panel: Insights and Report rendering */}
                    <div className="lg:col-span-2 space-y-6">
                        {!selectedReport || selectedReport.type !== 'social_reviews' ? (
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 shadow-sm text-center flex flex-col items-center justify-center h-full">
                                <div className="p-4 bg-orange-50 dark:bg-orange-950/20 rounded-full text-orange-500 mb-4">
                                    <MessageSquare className="h-10 w-10" />
                                </div>
                                <h3 className="font-bold text-slate-900 dark:text-white mb-2">No hay análisis de opiniones cargado</h3>
                                <p className="text-xs text-slate-500 max-w-sm">
                                    Conectá tus perfiles sociales y presioná "Sincronizar" para descargar los últimos comentarios y analizar tu reputación con IA.
                                </p>
                            </div>
                        ) : (
                            <RenderReportDashboard report={selectedReport} />
                        )}
                    </div>
                </div>
            )}

            {/* TAB 2: WEB AUDIT */}
            {activeTab === "web" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Panel: Query Input */}
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                            <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                <Globe className="h-5 w-5 text-orange-500" />
                                <span>Auditoría de Imagen Pública</span>
                            </h3>

                            <form onSubmit={handleAuditWeb} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label htmlFor="webQuery" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Término de Búsqueda (Marca/Nombre)</label>
                                    <input
                                        id="webQuery"
                                        type="text"
                                        value={webQuery}
                                        onChange={(e) => setWebQuery(e.target.value)}
                                        placeholder="Ej. Guerrero Rodolfo Manuel Kinesiología"
                                        required
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#ff5e00] outline-none transition-all"
                                    />
                                    <p className="text-[10px] text-slate-400">
                                        Se recomienda incluir la especialidad o ciudad del negocio para obtener búsquedas en Google más precisas.
                                    </p>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isAuditingWeb || !webQuery.trim()}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#ff5e00] hover:bg-[#ff5e00]/90 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-500/10 hover:shadow-orange-500/25 transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                                >
                                    <RefreshCw className={`h-4 w-4 ${isAuditingWeb ? "animate-spin" : ""}`} />
                                    <span>{isAuditingWeb ? "Analizando presencia web..." : "Auditar Presencia Web"}</span>
                                </button>
                            </form>

                            {webAuditError && (
                                <div className="p-3 mt-4 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 text-red-755 dark:text-red-300 rounded-lg text-xs flex gap-2">
                                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                    <p>{webAuditError}</p>
                                </div>
                            )}

                            {webAuditSuccess && (
                                <div className="p-3 mt-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs flex gap-2">
                                    <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                    <p>¡Auditoría web e informe completado con éxito!</p>
                                </div>
                            )}
                        </div>

                        {selectedReport && selectedReport.type === 'web_audit' && (
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm animate-fade-in">
                                <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2.5">
                                    Análisis de Presencia Digital
                                </h4>
                                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-semibold">
                                    {selectedReport.results.summary}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Right Panel: Web Insights */}
                    <div className="lg:col-span-2 space-y-6">
                        {!selectedReport || selectedReport.type !== 'web_audit' ? (
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 shadow-sm text-center flex flex-col items-center justify-center h-full">
                                <div className="p-4 bg-orange-50 dark:bg-orange-950/20 rounded-full text-orange-500 mb-4">
                                    <Globe className="h-10 w-10" />
                                </div>
                                <h3 className="font-bold text-slate-900 dark:text-white mb-2">No hay auditoría web cargada</h3>
                                <p className="text-xs text-slate-500 max-w-sm">
                                    Ingresá tu nombre comercial o marca, presioná "Auditar Presencia" y la IA buscará en Google qué se dice de vos en internet para armar tu índice de reputación.
                                </p>
                            </div>
                        ) : (
                            <RenderWebAuditDashboard 
                                report={selectedReport} 
                                onExcludeSource={handleExcludeSource}
                                isRecalculating={isRecalculating}
                            />
                        )}
                    </div>
                </div>
            )}

            {/* TAB 3: HISTORY */}
            {activeTab === "history" && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <History className="h-5 w-5 text-orange-500" /> Historial de Informes de Reputación
                        </h3>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                                    <th className="p-4">Fecha de Análisis</th>
                                    <th className="p-4">Tipo de Informe</th>
                                    <th className="p-4">Detalle / Consulta</th>
                                    <th className="p-4 text-center">Score / Estado</th>
                                    <th className="p-4 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
                                {history.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="p-8 text-center text-slate-500 dark:text-slate-400 italic">
                                            {loadingHistory ? "Cargando historial..." : "Aún no has generado ningún informe de reputación."}
                                        </td>
                                    </tr>
                                ) : (
                                    history.map((item) => (
                                        <tr 
                                            key={item.id} 
                                            onClick={() => {
                                                setSelectedReport(item);
                                                setActiveTab(item.type === 'social_reviews' ? 'social' : 'web');
                                            }}
                                            className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 cursor-pointer transition-colors"
                                        >
                                            <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">
                                                {new Date(item.date).toLocaleDateString('es-AR', {
                                                    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                                })} hs
                                            </td>
                                            <td className="p-4">
                                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                    item.type === 'social_reviews'
                                                        ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-900/30'
                                                        : 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30'
                                                }`}>
                                                    {item.type === 'social_reviews' ? 'Opiniones Redes' : 'Auditoría Web'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-slate-650 dark:text-slate-450 truncate max-w-[200px]">
                                                {item.type === 'social_reviews' ? `Sincronización (${item.commentCount} comentarios)` : `Google: "${item.query}"`}
                                            </td>
                                            <td className="p-4 text-center">
                                                {item.type === 'social_reviews' ? (
                                                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                                        item.results?.status === 'MANTENER'
                                                            ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'
                                                            : item.results?.status === 'MONITOREAR'
                                                                ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400'
                                                                : 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400'
                                                    }`}>
                                                        {item.results?.status}
                                                    </span>
                                                ) : (
                                                    <span className="font-bold text-slate-900 dark:text-white">
                                                        {item.results?.brandScore} / 100
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 text-center">
                                                <button
                                                    onClick={(e) => handleDeleteReport(item.id, e)}
                                                    className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

/* RENDER COMPONENT: SOCIAL REVIEWS INSIGHTS */
function RenderReportDashboard({ report }) {
    const { status, sentiment, summary, feelings, suggestions } = report.results;

    const getStatusStyles = (st) => {
        switch (st) {
            case "MANTENER":
                return {
                    label: "Mantener Rumbo",
                    color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40",
                    bullet: "bg-emerald-500",
                    icon: <CheckCircle className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                };
            case "MONITOREAR":
                return {
                    label: "Monitorear con Atención",
                    color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40",
                    bullet: "bg-amber-500",
                    icon: <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                };
            case "URGENTE":
                return {
                    label: "Acción Urgente Requerida",
                    color: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40",
                    bullet: "bg-red-500",
                    icon: <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                };
            default:
                return { label: st, color: "bg-slate-100", bullet: "bg-slate-500" };
        }
    };

    const statusObj = getStatusStyles(status);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Executive Summary & Alert */}
            <div className="bg-gradient-to-tr from-orange-500/10 to-amber-500/10 dark:from-orange-950/10 dark:to-amber-950/10 border border-orange-100 dark:border-orange-900/25 p-6 rounded-2xl shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                        <Award className="h-6 w-6 text-orange-500" />
                        <h3 className="font-extrabold text-slate-900 dark:text-white text-base">Diagnóstico de Reputación IA</h3>
                    </div>
                    {/* Status Pill */}
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold ${statusObj.color}`}>
                        {statusObj.icon}
                        <span>{statusObj.label}</span>
                    </div>
                </div>

                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                    {summary}
                </p>
            </div>

            {/* Sentiment Breakdown */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-orange-500" /> Desglose de Sentimiento Cualitativo
                </h4>

                <div className="space-y-4">
                    {[
                        { label: "Comentarios Positivos", value: sentiment.positive, barColor: "bg-emerald-500" },
                        { label: "Comentarios Neutros", value: sentiment.neutral, barColor: "bg-amber-400" },
                        { label: "Comentarios Negativos", value: sentiment.negative, barColor: "bg-red-500" }
                    ].map((item, idx) => (
                        <div key={idx} className="space-y-1.5">
                            <div className="flex justify-between text-xs font-bold text-slate-650 dark:text-slate-350">
                                <span>{item.label}</span>
                                <span>{item.value}%</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                                <div 
                                    style={{ width: `${item.value}%` }} 
                                    className={`${item.barColor} h-full rounded-full`}
                                ></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Feelings Cloud */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                    <Compass className="h-4 w-4 text-orange-500" /> Sensaciones e Impresiones Recurrentes
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {feelings.map((f, idx) => (
                        <div key={idx} className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30 space-y-1.5">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">{f.emoji}</span>
                                <span className="font-extrabold text-xs text-slate-800 dark:text-slate-250 uppercase tracking-wider">{f.feeling}</span>
                            </div>
                            <p className="text-[11px] text-slate-650 dark:text-slate-400 font-medium">
                                {f.reason}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Suggestions & Action Plan */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                    <Target className="h-4 w-4 text-orange-500" /> Recomendaciones Clave de Clientes
                </h4>

                <ul className="space-y-3">
                    {suggestions.map((s, idx) => (
                        <li key={idx} className="flex gap-3 text-xs text-slate-700 dark:text-slate-300 font-medium bg-slate-50/50 dark:bg-slate-900/50 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80">
                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 font-bold text-[10px]">
                                {idx + 1}
                            </div>
                            <span className="leading-relaxed">{s}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

/* RENDER COMPONENT: WEB AUDIT INSIGHTS */
function RenderWebAuditDashboard({ report, onExcludeSource, isRecalculating }) {
    const { brandScore, publicSentiment, summary, sources, reconciliations } = report.results;

    // Get color based on brand score
    const getScoreColor = (score) => {
        if (score >= 80) return "text-emerald-500";
        if (score >= 50) return "text-amber-500";
        return "text-red-500";
    };

    const scoreColor = getScoreColor(brandScore);

    return (
        <div className="relative space-y-6 animate-fade-in">
            {/* Recalculating Loader Overlay */}
            {isRecalculating && (
                <div className="absolute inset-0 bg-white/60 dark:bg-slate-950/60 backdrop-blur-[2px] z-20 flex items-center justify-center rounded-2xl">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xl flex items-center gap-3">
                        <RefreshCw className="h-5 w-5 text-orange-500 animate-spin" />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Recalculando reputación web con IA...</span>
                    </div>
                </div>
            )}

            {/* Termómetro de Marca - Score Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Score Circle Gauge */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center text-center">
                    <h4 className="font-bold text-[10px] text-slate-500 uppercase tracking-wider mb-4">Índice de Imagen Web</h4>
                    <div className="relative flex items-center justify-center">
                        {/* Circular progress bar SVG */}
                        <svg className="w-28 h-28 transform -rotate-90">
                            <circle cx="56" cy="56" r="48" strokeWidth="8" stroke="currentColor" className="text-slate-100 dark:text-slate-800" fill="transparent" />
                            <circle cx="56" cy="56" r="48" strokeWidth="8" stroke="currentColor" className={scoreColor} fill="transparent" 
                                    strokeDasharray="301.6" strokeDashoffset={301.6 - (301.6 * brandScore) / 100} />
                        </svg>
                        <div className="absolute flex flex-col items-center">
                            <span className="text-3xl font-black text-slate-950 dark:text-white">{brandScore}</span>
                            <span className="text-[10px] font-bold text-slate-400">/ 100</span>
                        </div>
                    </div>
                </div>

                {/* Sentiment breakdown */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm md:col-span-2 flex flex-col justify-center">
                    <h4 className="font-bold text-[10px] text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-1">
                        <TrendingUp className="h-3.5 w-3.5" /> Sentimiento del Buscador
                    </h4>
                    <div className="space-y-3.5">
                        {[
                            { label: "Menciones Positivas", value: publicSentiment.positive, color: "bg-emerald-500" },
                            { label: "Menciones Neutras", value: publicSentiment.neutral, color: "bg-amber-400" },
                            { label: "Menciones Negativas", value: publicSentiment.negative, color: "bg-red-500" }
                        ].map((s, idx) => (
                            <div key={idx} className="space-y-1">
                                <div className="flex justify-between text-[11px] font-bold text-slate-650 dark:text-slate-350">
                                    <span>{s.label}</span>
                                    <span>{s.value}%</span>
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                                    <div style={{ width: `${s.value}%` }} className={`${s.color} h-full rounded-full`}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>


            {/* Menciones Encontradas (Google list) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4">Principales Resultados Auditados</h4>
                
                <div className="space-y-4">
                    {sources.map((src, idx) => (
                        <div key={idx} className="p-4 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-900/30 space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <a href={src.url} target="_blank" rel="noopener noreferrer" className="font-bold text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5">
                                    <span>{src.title}</span>
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        {/* Source Pill */}
                                        <span className="text-[9px] font-bold bg-slate-100 dark:bg-slate-850 px-2 py-0.5 rounded text-slate-500 uppercase">
                                            {src.category.replace('_', ' ')}
                                        </span>
                                        {/* Sentiment indicator */}
                                        <span className={`h-2 w-2 rounded-full ${
                                            src.sentiment === 'positivo' 
                                                ? 'bg-emerald-500' 
                                                : src.sentiment === 'neutro' 
                                                    ? 'bg-amber-400' 
                                                    : 'bg-red-500'
                                        }`}></span>
                                    </div>
                                    
                                    {/* Exclude button */}
                                    <button
                                        onClick={() => onExcludeSource(src.url)}
                                        disabled={isRecalculating}
                                        title="Desestimar este resultado (no corresponde a mi marca)"
                                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                        <EyeOff className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-450 italic leading-relaxed">
                                "{src.snippet}"
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Reconciliations / PR and SEO Actions */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-orange-500" /> Plan de Acción recomendado (SEO & Imagen Pública)
                </h4>
                
                <ul className="space-y-3">
                    {reconciliations.map((rec, idx) => (
                        <li key={idx} className="flex gap-3 text-xs text-slate-700 dark:text-slate-300 font-medium bg-slate-50/50 dark:bg-slate-900/50 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80">
                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 font-bold text-[10px]">
                                {idx + 1}
                            </div>
                            <span className="leading-relaxed">{rec}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
