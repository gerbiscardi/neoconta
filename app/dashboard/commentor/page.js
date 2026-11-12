"use client";

import { useState, useEffect, useMemo } from "react";
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
    EyeOff,
    Star,
    Copy,
    Check,
    Filter,
    Search,
    X,
    Layers,
    ShieldAlert
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
    const [selectedBranchIds, setSelectedBranchIds] = useState([]);
    const [selectedFbPageIds, setSelectedFbPageIds] = useState([]);
    const [selectedIgAccountIds, setSelectedIgAccountIds] = useState([]);
    const [updatingSelection, setUpdatingSelection] = useState(false);

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

    // Drilldown drawer state for comments
    const [filterPlatform, setFilterPlatform] = useState("all");
    const [filterSentiment, setFilterSentiment] = useState("all");
    const [filterStar, setFilterStar] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [activeCommentIdFilter, setActiveCommentIdFilter] = useState(null);

    // Suggested response modal/state
    const [responseDraft, setResponseDraft] = useState({ commentId: null, text: "", copied: false });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const oauthErr = params.get('oauth_error');
            if (oauthErr) {
                setSyncError(oauthErr);
            }
        }
        const userStr = localStorage.getItem('neoconta_user');
        if (userStr) {
            const user = JSON.parse(userStr);
            setCurrentUser(user);
            fetchConnections(user.id);
            fetchHistory(user.id);
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
                if (data.connections.google?.selectedLocations) {
                    setSelectedBranchIds(data.connections.google.selectedLocations);
                }
                if (data.connections.meta?.facebook?.selectedPages) {
                    setSelectedFbPageIds(data.connections.meta.facebook.selectedPages);
                }
                if (data.connections.meta?.instagram?.selectedAccounts) {
                    setSelectedIgAccountIds(data.connections.meta.instagram.selectedAccounts);
                }
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

    const handleSaveLocationSelection = async () => {
        if (!currentUser) return;
        setUpdatingSelection(true);
        try {
            const res = await fetch('/api/ai/connections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: currentUser.id,
                    action: 'select_locations',
                    locationIds: selectedBranchIds
                })
            });
            const data = await res.json();
            if (data.success) {
                alert("Sucursales de Google Business actualizadas exitosamente.");
                fetchConnections(currentUser.id);
            } else {
                alert(data.error || "Error al actualizar sucursales.");
            }
        } catch (err) {
            console.error("Save locations error:", err);
        } finally {
            setUpdatingSelection(false);
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
                if (data.report) {
                    setSelectedReport(data.report);
                }
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
        e.stopPropagation();
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

        const reason = prompt("Ingresá el motivo de exclusión (opcional, ej. 'Homónimo ajeno', 'Sitio irrelevante'):", "Homónimo o fuente irrelevante");
        if (reason === null) return; // Cancelled

        setIsRecalculating(true);
        try {
            const res = await fetch('/api/ai/audit-web/recalculate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: currentUser.id,
                    reportId: selectedReport.id,
                    urlToExclude,
                    reason
                })
            });

            const data = await res.json();
            if (data.success) {
                setSelectedReport(data.report);
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

    const handleGenerateSuggestedResponse = (comment) => {
        const authorName = comment.author || 'Estimado cliente';
        let template = "";

        if (comment.sentiment === 'negativo') {
            template = `Hola ${authorName}, lamentamos profundamente tu experiencia. En nuestra empresa nos tomamos muy en serio cada detalle de atención. Por favor escribinos directamente para que podamos revisar tu caso y darte una solución inmediata. Gracias por ayudarnos a mejorar.`;
        } else if (comment.sentiment === 'positivo') {
            template = `¡Muchas gracias ${authorName} por tus palabras y por confiar en nosotros! Nos alegra saber que tuviste una gran experiencia. ¡Te esperamos pronto nuevamente!`;
        } else {
            template = `Hola ${authorName}, muchas gracias por dejarnos tus comentarios y sugerencias. Las tomamos en cuenta para continuar perfeccionando nuestro servicio día a día.`;
        }

        setResponseDraft({
            commentId: comment.id,
            author: authorName,
            text: template,
            copied: false
        });
    };

    const handleCopyResponse = () => {
        if (!responseDraft.text) return;
        navigator.clipboard.writeText(responseDraft.text);
        setResponseDraft(prev => ({ ...prev, copied: true }));
        setTimeout(() => {
            setResponseDraft(prev => ({ ...prev, copied: false }));
        }, 2000);
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
                        <MessageSquare className="h-7 w-7 text-[#ff5e00]" /> Commentor <span className="text-xs bg-orange-100 dark:bg-orange-950/40 text-[#ff5e00] px-2 py-0.5 rounded-full font-bold uppercase">Intelligence</span>
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Monitoreo de reputación digital multi-canal respaldado exclusivamente por datos reales y fuentes auditables.
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
                    <span>Historial de Auditorías ({history.length})</span>
                </button>
            </div>

            {/* TAB 1: SOCIAL REVIEWS */}
            {activeTab === "social" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Panel: Connections & Controls */}
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                            <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                <RefreshCw className="h-5 w-5 text-orange-500" />
                                <span>Cuentas y Sucursales Conectadas</span>
                            </h3>

                            <div className="space-y-4">
                                {/* Google Card */}
                                <div className="p-4 rounded-xl border border-slate-150 dark:border-slate-800 bg-slate-50/55 dark:bg-slate-900/50 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400">
                                                <Chrome className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-xs text-slate-800 dark:text-slate-200">Google Business Profile</p>
                                                <p className="text-[10px] text-slate-500 truncate max-w-[150px]">
                                                    {connections.google?.connected
                                                        ? (connections.google.account?.name || 'Perfil Conectado')
                                                        : connections.google?.providerConfigured === false
                                                            ? "Integración todavía no disponible"
                                                            : "Desconectado"}
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
                                        ) : connections.google?.providerConfigured === false ? (
                                            <span className="px-2.5 py-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-md">
                                                No disponible
                                            </span>
                                        ) : (
                                            <button
                                                onClick={() => handleConnect("google")}
                                                className="px-3 py-1 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                                            >
                                                Conectar
                                            </button>
                                        )}
                                    </div>

                                    {/* Google Multi-Location selector */}
                                    {connections.google?.connected && connections.google.availableLocations?.length > 0 && (
                                        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sucursales Monitoreadas</p>
                                            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                                {connections.google.availableLocations.map(loc => {
                                                    const isChecked = selectedBranchIds.includes(loc.id);
                                                    return (
                                                        <label key={loc.id} className="flex items-center gap-2 text-[11px] text-slate-700 dark:text-slate-300 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setSelectedBranchIds([...selectedBranchIds, loc.id]);
                                                                    } else {
                                                                        setSelectedBranchIds(selectedBranchIds.filter(id => id !== loc.id));
                                                                    }
                                                                }}
                                                                className="rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                                                            />
                                                            <span className="truncate">{loc.title}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                            <button
                                                onClick={handleSaveLocationSelection}
                                                disabled={updatingSelection}
                                                className="w-full py-1 text-[10px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-md transition-colors"
                                            >
                                                {updatingSelection ? "Guardando..." : "Guardar Selección de Sucursales"}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Meta Card */}
                                <div className="p-4 rounded-xl border border-slate-150 dark:border-slate-800 bg-slate-50/55 dark:bg-slate-900/50 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 rounded-lg bg-pink-50 dark:bg-pink-950/20 text-pink-600 dark:text-pink-400 flex gap-0.5">
                                                <Facebook className="h-4 w-4" />
                                                <Instagram className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-xs text-slate-800 dark:text-slate-200">Meta (Facebook & IG)</p>
                                                <p className="text-[10px] text-slate-500 truncate max-w-[150px]">
                                                    {connections.meta?.connected
                                                        ? connections.meta.facebook?.pageName || "Página Conectada"
                                                        : connections.meta?.providerConfigured === false
                                                            ? "Integración todavía no disponible"
                                                            : "Desconectado"}
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
                                        ) : connections.meta?.providerConfigured === false ? (
                                            <span className="px-2.5 py-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-md">
                                                No disponible
                                            </span>
                                        ) : (
                                            <button
                                                onClick={() => handleConnect("meta")}
                                                className="px-3 py-1 text-[10px] font-bold text-white bg-pink-600 hover:bg-pink-700 rounded-md transition-colors"
                                            >
                                                Conectar
                                            </button>
                                        )}
                                    </div>

                                    {/* Instagram Distinct Status */}
                                    {connections.meta?.connected && (
                                        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-[10px]">
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold text-slate-500">Instagram Profesional:</span>
                                                <span className={connections.meta.instagram?.connected ? "text-emerald-600 font-bold" : "text-amber-600 font-medium"}>
                                                    {connections.meta.instagram?.connected
                                                        ? (connections.meta.instagram.instagramUsername || "Conectada")
                                                        : "No vinculada"}
                                                </span>
                                            </div>
                                            {connections.meta.instagram?.statusReason && (
                                                <p className="mt-1 text-[9px] text-slate-400 italic">
                                                    {connections.meta.instagram.statusReason}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {syncError && !(connections.google?.connected || connections.meta?.connected) && (
                                <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 text-red-700 dark:text-red-300 rounded-lg text-xs flex gap-2">
                                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                    <p>{syncError}</p>
                                </div>
                            )}
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
                                    <span>{isSyncing ? "Descargando opiniones reales..." : "Sincronizar y Analizar ahora"}</span>
                                </button>

                                {syncError && (
                                    <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 text-red-700 dark:text-red-300 rounded-lg text-xs flex gap-2">
                                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                        <p>{syncError}</p>
                                    </div>
                                )}

                                {syncSuccess && (
                                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs flex gap-2">
                                        <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                        <p>¡Auditoría y análisis de reputación completado con éxito!</p>
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
                                    Conectá tus perfiles autorizados de Google o Meta y presioná "Sincronizar" para descargar los últimos comentarios reales de tus clientes.
                                </p>
                            </div>
                        ) : (
                            <RenderReportDashboard 
                                report={selectedReport} 
                                onFilterByCommentId={(id) => {
                                    setActiveCommentIdFilter(id);
                                }}
                                onSuggestResponse={handleGenerateSuggestedResponse}
                            />
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
                                        placeholder="Ej. Mi Empresa SRL"
                                        required
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#ff5e00] outline-none transition-all"
                                    />
                                    <p className="text-[10px] text-slate-400">
                                        Se buscan resultados orgánicos indexados en Google sin inventar URLs ni estimaciones opacas.
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
                                <div className="p-3 mt-4 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 text-red-700 dark:text-red-300 rounded-lg text-xs flex gap-2">
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
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm animate-fade-in space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                        Diagnóstico de Presencia
                                    </h4>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                        Rev #{selectedReport.revision || 0}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                                    {selectedReport.results.summary}
                                </p>
                                {selectedReport.lastChangeLog && (
                                    <div className="p-2.5 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30 text-[10px] text-orange-700 dark:text-orange-300 font-medium">
                                        {selectedReport.lastChangeLog}
                                    </div>
                                )}
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
                                    Ingresá el nombre comercial o marca para rastrear la presencia digital en buscadores mediante fuentes trazables.
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
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <History className="h-5 w-5 text-orange-500" /> Historial de Informes de Reputación
                        </h3>
                        <span className="text-xs text-slate-400 font-bold">Total: {history.length}</span>
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
                                            <td className="p-4 text-slate-600 dark:text-slate-400 truncate max-w-[200px]">
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

            {/* Response Drafting Modal */}
            {responseDraft.commentId && (
                <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-fade-in">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                                <Award className="h-4 w-4 text-orange-500" />
                                Sugerencia de Respuesta (Atención al Cliente)
                            </h3>
                            <button
                                onClick={() => setResponseDraft({ commentId: null, text: "", copied: false })}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <p className="text-[11px] text-slate-500">
                            Borrador sugerido para responder a <strong>{responseDraft.author}</strong>. Por política de seguridad, NeoConta <strong>nunca publica automáticamente</strong> en tus redes; podés copiar la respuesta y responder directamente desde tu plataforma.
                        </p>

                        <textarea
                            value={responseDraft.text}
                            onChange={(e) => setResponseDraft(prev => ({ ...prev, text: e.target.value }))}
                            rows={4}
                            className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                onClick={() => setResponseDraft({ commentId: null, text: "", copied: false })}
                                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                            >
                                Cerrar
                            </button>
                            <button
                                onClick={handleCopyResponse}
                                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-[#ff5e00] hover:bg-[#ff5e00]/90 rounded-lg shadow-sm"
                            >
                                {responseDraft.copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                <span>{responseDraft.copied ? "¡Copiado!" : "Copiar al Portapapeles"}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* RENDER COMPONENT: SOCIAL REVIEWS INSIGHTS WITH AUDITABLE METRICS & DRILLDOWN */
function RenderReportDashboard({ report, onFilterByCommentId, onSuggestResponse }) {
    const { status, summary, recurringThemes, praises, complaints, actionableSuggestions } = report.results || {};
    const metrics = report.metrics || {};
    const comments = Array.isArray(report.commentsList) ? report.commentsList : [];

    // Filter controls for comment drilldown
    const [selectedProvider, setSelectedProvider] = useState("all");
    const [selectedSentiment, setSelectedSentiment] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [showOnlyCitations, setShowOnlyCitations] = useState(null);

    const getStatusStyles = (st) => {
        switch (st) {
            case "MANTENER":
                return {
                    label: "Mantener Rumbo",
                    color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40",
                    icon: <CheckCircle className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                };
            case "MONITOREAR":
                return {
                    label: "Monitorear con Atención",
                    color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40",
                    icon: <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                };
            case "URGENTE":
                return {
                    label: "Acción Urgente Requerida",
                    color: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40",
                    icon: <ShieldAlert className="h-6 w-6 text-red-600 dark:text-red-400" />
                };
            default:
                return { label: st || "Neutro", color: "bg-slate-100", icon: <AlertCircle className="h-6 w-6" /> };
        }
    };

    const statusObj = getStatusStyles(status);

    const filteredComments = useMemo(() => {
        return comments.filter(c => {
            if (showOnlyCitations && Array.isArray(showOnlyCitations)) {
                if (!showOnlyCitations.includes(c.id)) return false;
            }
            if (selectedProvider !== "all" && c.provider !== selectedProvider) return false;
            if (selectedSentiment !== "all" && c.sentiment !== selectedSentiment) return false;
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchesAuthor = (c.author || '').toLowerCase().includes(q);
                const matchesText = (c.text || '').toLowerCase().includes(q);
                if (!matchesAuthor && !matchesText) return false;
            }
            return true;
        });
    }, [comments, selectedProvider, selectedSentiment, searchQuery, showOnlyCitations]);

    const sentimentPcts = metrics.classifiedPercentages || { positivo: 0, neutro: 0, negativo: 0 };
    const sentimentCounts = metrics.sentimentCounts || { positivo: 0, neutro: 0, negativo: 0, indeterminado: 0 };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Executive Status Banner */}
            <div className="bg-gradient-to-tr from-orange-500/10 to-amber-500/10 dark:from-orange-950/10 dark:to-amber-950/10 border border-orange-100 dark:border-orange-900/25 p-6 rounded-2xl shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                        <Award className="h-6 w-6 text-orange-500" />
                        <div>
                            <h3 className="font-extrabold text-slate-900 dark:text-white text-base">Diagnóstico de Reputación IA</h3>
                            <p className="text-[10px] text-slate-400">Total comentarios analizados: {metrics.totalComments || comments.length}</p>
                        </div>
                    </div>
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold ${statusObj.color}`}>
                        {statusObj.icon}
                        <span>{statusObj.label}</span>
                    </div>
                </div>

                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                    {summary}
                </p>
            </div>

            {/* Quantitative KPIs: Score, Stars, Volume */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Índice de Reputación</span>
                    <div className="mt-1 flex items-baseline justify-center gap-1">
                        <span className="text-2xl font-black text-slate-900 dark:text-white">{metrics.reputationIndex ?? 50}</span>
                        <span className="text-xs font-bold text-slate-400">/ 100</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Calificación Promedio</span>
                    <div className="mt-1 flex items-baseline justify-center gap-1">
                        <span className="text-2xl font-black text-amber-500">{metrics.averageRating !== null ? metrics.averageRating : 'N/A'}</span>
                        <Star className="h-4 w-4 fill-amber-500 text-amber-500 self-center" />
                    </div>
                    <span className="text-[9px] text-slate-400">{metrics.ratedCount || 0} reseñas con estrellas</span>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Desglose de Opiniones</span>
                    <div className="mt-1 text-xs font-bold text-slate-700 dark:text-slate-300">
                        {metrics.starOnlyCount || 0} solo estrellas • {metrics.totalComments - (metrics.starOnlyCount || 0)} con texto
                    </div>
                    <span className="text-[9px] text-slate-400">Deduplicadas por ID único</span>
                </div>
            </div>

            {/* Sentiment Breakdown */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-orange-500" /> Distribución de Sentimiento (Consistencia Matemática)
                </h4>

                <div className="space-y-4">
                    {[
                        { label: "Positivos", count: sentimentCounts.positivo, pct: sentimentPcts.positivo, barColor: "bg-emerald-500" },
                        { label: "Neutros", count: sentimentCounts.neutro, pct: sentimentPcts.neutro, barColor: "bg-amber-400" },
                        { label: "Negativos", count: sentimentCounts.negativo, pct: sentimentPcts.negativo, barColor: "bg-red-500" }
                    ].map((item, idx) => (
                        <div key={idx} className="space-y-1.5">
                            <div className="flex justify-between text-xs font-bold text-slate-650 dark:text-slate-350">
                                <span>{item.label} ({item.count} opiniones)</span>
                                <span>{item.pct}%</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                                <div 
                                    style={{ width: `${item.pct}%` }} 
                                    className={`${item.barColor} h-full rounded-full transition-all duration-500`}
                                ></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recurring Themes & Traceable Citing */}
            {Array.isArray(recurringThemes) && recurringThemes.length > 0 && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                    <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                        <Compass className="h-4 w-4 text-orange-500" /> Temas Recurrentes Auditados
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {recurringThemes.map((th, idx) => (
                            <div key={idx} className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 flex items-start justify-between gap-2">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className={`h-2 w-2 rounded-full ${th.sentiment === 'positivo' ? 'bg-emerald-500' : (th.sentiment === 'negativo' ? 'bg-red-500' : 'bg-amber-400')}`}></span>
                                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{th.theme}</span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 mt-1 block">Mencionado {th.frequency || 1} veces</span>
                                </div>
                                {Array.isArray(th.sampleCommentIds) && th.sampleCommentIds.length > 0 && (
                                    <button
                                        onClick={() => setShowOnlyCitations(th.sampleCommentIds)}
                                        className="text-[10px] text-orange-600 dark:text-orange-400 font-bold hover:underline shrink-0"
                                    >
                                        Ver citas ({th.sampleCommentIds.length})
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Suggestions & Action Plan */}
            {Array.isArray(actionableSuggestions) && actionableSuggestions.length > 0 && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                    <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                        <Target className="h-4 w-4 text-orange-500" /> Plan de Acción Recomendado
                    </h4>

                    <ul className="space-y-3">
                        {actionableSuggestions.map((s, idx) => (
                            <li key={idx} className="flex gap-3 text-xs text-slate-700 dark:text-slate-300 font-medium bg-slate-50/50 dark:bg-slate-900/50 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80">
                                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 font-bold text-[10px]">
                                    {idx + 1}
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-900 dark:text-white">{s.action}</span>
                                        {s.priority && (
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${s.priority === 'alta' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                                                {s.priority.toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-slate-500">{s.rationale}</p>
                                    {Array.isArray(s.backedByCommentIds) && s.backedByCommentIds.length > 0 && (
                                        <button
                                            onClick={() => setShowOnlyCitations(s.backedByCommentIds)}
                                            className="text-[10px] text-orange-600 dark:text-orange-400 font-bold hover:underline"
                                        >
                                            Ver {s.backedByCommentIds.length} opiniones que respaldan esto
                                        </button>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Drilldown Comments Viewer */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="h-4 w-4 text-orange-500" /> Detalle de Opiniones ({filteredComments.length})
                    </h4>
                    {showOnlyCitations && (
                        <button
                            onClick={() => setShowOnlyCitations(null)}
                            className="text-[11px] font-bold text-orange-600 flex items-center gap-1 hover:underline"
                        >
                            <X className="h-3 w-3" /> Quitar filtro de citas
                        </button>
                    )}
                </div>

                {/* Filters Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <select
                        value={selectedProvider}
                        onChange={(e) => setSelectedProvider(e.target.value)}
                        className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                        <option value="all">Todas las Plataformas</option>
                        <option value="google">Google Business</option>
                        <option value="facebook">Facebook</option>
                        <option value="instagram">Instagram</option>
                    </select>

                    <select
                        value={selectedSentiment}
                        onChange={(e) => setSelectedSentiment(e.target.value)}
                        className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                        <option value="all">Todos los Sentimientos</option>
                        <option value="positivo">Positivos</option>
                        <option value="neutro">Neutros</option>
                        <option value="negativo">Negativos</option>
                    </select>

                    <input
                        type="text"
                        placeholder="Buscar por texto o autor..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-300"
                    />
                </div>

                {/* List of comments */}
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {filteredComments.length === 0 ? (
                        <p className="text-xs text-slate-400 italic text-center py-6">No se encontraron comentarios para los filtros seleccionados.</p>
                    ) : (
                        filteredComments.map(c => (
                            <div key={c.id} className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                            c.provider === 'google' ? 'bg-blue-100 text-blue-700' : (c.provider === 'facebook' ? 'bg-indigo-100 text-indigo-700' : 'bg-pink-100 text-pink-700')
                                        }`}>
                                            {c.provider}
                                        </span>
                                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{c.author}</span>
                                        {c.rating && (
                                            <span className="flex items-center text-[10px] text-amber-500 font-bold">
                                                {c.rating} <Star className="h-3 w-3 fill-amber-500 ml-0.5" />
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-slate-400">{c.date}</span>
                                </div>

                                <p className="text-xs text-slate-700 dark:text-slate-300 italic">
                                    {c.isStarOnly ? <span className="text-slate-400">[Reseña de solo estrellas, sin comentario adicional]</span> : `"${c.text}"`}
                                </p>

                                <div className="flex items-center justify-between pt-1">
                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                        c.sentiment === 'positivo' ? 'bg-emerald-100 text-emerald-700' : (c.sentiment === 'negativo' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')
                                    }`}>
                                        {c.sentiment}
                                    </span>

                                    <button
                                        onClick={() => onSuggestResponse(c)}
                                        className="text-[10px] font-bold text-orange-600 dark:text-orange-400 hover:underline"
                                    >
                                        Sugerir Respuesta IA
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

/* RENDER COMPONENT: WEB AUDIT INSIGHTS */
function RenderWebAuditDashboard({ report, onExcludeSource, isRecalculating }) {
    const { brandScore, publicSentiment, summary, sources, reconciliations } = report.results || {};
    const metrics = report.metrics || {};
    const excludedSources = Array.isArray(report.excludedSources) ? report.excludedSources : [];

    const getScoreColor = (score) => {
        if (score >= 80) return "text-emerald-500";
        if (score >= 50) return "text-amber-500";
        return "text-red-500";
    };

    const isScoreAvailable = brandScore !== null && brandScore !== undefined && report.results?.aiValidated !== false;
    const scoreColor = isScoreAvailable ? getScoreColor(brandScore) : "text-slate-400";

    return (
        <div className="relative space-y-6 animate-fade-in">
            {/* Recalculating Loader Overlay */}
            {isRecalculating && (
                <div className="absolute inset-0 bg-white/60 dark:bg-slate-950/60 backdrop-blur-[2px] z-20 flex items-center justify-center rounded-2xl">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xl flex items-center gap-3">
                        <RefreshCw className="h-5 w-5 text-orange-500 animate-spin" />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Recalculando reputación web de manera determinista...</span>
                    </div>
                </div>
            )}

            {/* Score & Gauge */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center text-center">
                    <h4 className="font-bold text-[10px] text-slate-500 uppercase tracking-wider mb-4">Índice de Imagen Web</h4>
                    <div className="relative flex items-center justify-center">
                        <svg className="w-28 h-28 transform -rotate-90">
                            <circle cx="56" cy="56" r="48" strokeWidth="8" stroke="currentColor" className="text-slate-100 dark:text-slate-800" fill="transparent" />
                            <circle cx="56" cy="56" r="48" strokeWidth="8" stroke="currentColor" className={scoreColor} fill="transparent" 
                                    strokeDasharray="301.6" strokeDashoffset={isScoreAvailable ? (301.6 - (301.6 * brandScore) / 100) : 301.6} />
                        </svg>
                        <div className="absolute flex flex-col items-center">
                            <span className="text-3xl font-black text-slate-950 dark:text-white">{isScoreAvailable ? brandScore : "N/D"}</span>
                            <span className="text-[10px] font-bold text-slate-400">{isScoreAvailable ? "/ 100" : "Sin score"}</span>
                        </div>
                    </div>
                    {isScoreAvailable && report.scoreDelta !== undefined && report.scoreDelta !== null && (
                        <span className={`mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${report.scoreDelta >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {report.scoreDelta >= 0 ? `+${report.scoreDelta}` : report.scoreDelta} pts en última revisión
                        </span>
                    )}
                    {!isScoreAvailable && (
                        <span className="mt-2 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-900/40">
                            Validación IA pendiente
                        </span>
                    )}
                </div>

                {/* Sentiment breakdown */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm md:col-span-2 flex flex-col justify-center">
                    <h4 className="font-bold text-[10px] text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-1">
                        <TrendingUp className="h-3.5 w-3.5" /> Sentimiento en Buscadores
                    </h4>
                    {!isScoreAvailable || !publicSentiment ? (
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60 text-center space-y-1">
                            <AlertCircle className="h-5 w-5 text-amber-500 mx-auto" />
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Análisis de sentimiento no disponible</p>
                            <p className="text-[10px] text-slate-500">Se conservan las fuentes verificadas indexadas por el buscador sin estimaciones artificiales.</p>
                        </div>
                    ) : (
                        <div className="space-y-3.5">
                            {[
                                { label: "Menciones Positivas", value: publicSentiment?.positive || 0, color: "bg-emerald-500" },
                                { label: "Menciones Neutras", value: publicSentiment?.neutral || 0, color: "bg-amber-400" },
                                { label: "Menciones Negativas", value: publicSentiment?.negative || 0, color: "bg-red-500" }
                            ].map((s, idx) => (
                                <div key={idx} className="space-y-1">
                                    <div className="flex justify-between text-[11px] font-bold text-slate-650 dark:text-slate-350">
                                        <span>{s.label}</span>
                                        <span>{s.value}%</span>
                                    </div>
                                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                                        <div style={{ width: `${s.value}%` }} className={`${s.color} h-full rounded-full transition-all duration-500`}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Menciones Encontradas (Google list) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        Resultados Web Auditados ({sources?.length || 0})
                    </h4>
                    <span className="text-[10px] text-slate-400 font-bold">Motor: {report.coverage?.provider || 'Buscador Web'}</span>
                </div>
                
                <div className="space-y-4">
                    {Array.isArray(sources) && sources.map((src, idx) => (
                        <div key={idx} className="p-4 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-900/30 space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <a href={src.url} target="_blank" rel="noopener noreferrer" className="font-bold text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5 truncate max-w-md">
                                    <span className="truncate">{src.title}</span>
                                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                                </a>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500 uppercase">
                                            {src.category}
                                        </span>
                                        <span className={`h-2 w-2 rounded-full ${
                                            src.sentiment === 'positivo' 
                                                ? 'bg-emerald-500' 
                                                : src.sentiment === 'negativo' 
                                                    ? 'bg-red-500' 
                                                    : src.sentiment === 'neutro'
                                                        ? 'bg-amber-400'
                                                        : 'bg-slate-400'
                                        }`}></span>
                                    </div>
                                    
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
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 italic leading-relaxed">
                                "{src.snippet}"
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Excluded Sources History */}
            {excludedSources.length > 0 && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                    <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-3">
                        Fuentes Desestimadas ({excludedSources.length})
                    </h4>
                    <div className="space-y-2">
                        {excludedSources.map((ex, idx) => (
                            <div key={idx} className="text-[11px] text-slate-500 flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                                <span className="truncate max-w-sm">{ex.title || ex.url}</span>
                                <span className="text-[9px] text-slate-400 italic">{ex.exclusionReason}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Reconciliations */}
            {Array.isArray(reconciliations) && reconciliations.length > 0 && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                    <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                        <FileText className="h-4 w-4 text-orange-500" /> Plan Estratégico (SEO & PR Digital)
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
            )}
        </div>
    );
}
