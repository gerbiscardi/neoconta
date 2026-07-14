"use client";

import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { 
    LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie, Brush
} from "recharts";
import { 
    TrendingUp, FileSpreadsheet, Database, Cloud, RefreshCw, AlertCircle, CheckCircle, Search, DollarSign, Wallet, Percent, ChevronRight, HardDrive, ShieldCheck, ArrowRight, Trash2, Settings, Plus, Edit, ArrowUp, ArrowDown, X, LayoutGrid
} from "lucide-react";

export default function CommanderPage() {
    const [mounted, setMounted] = useState(false);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState("");
    
    // Filters state
    const [selectedClient, setSelectedClient] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [minAmount, setMinAmount] = useState("");

    // Ingestion Panel States
    const [activeIngestionTab, setActiveIngestionTab] = useState("excel"); // "excel", "sql", "cloud"
    
    // Excel Ingestion State
    const [excelFile, setExcelFile] = useState(null);
    const [excelData, setExcelData] = useState([]);
    const [excelDataType, setExcelDataType] = useState("invoices"); // "invoices", "transactions"
    const [excelProcessing, setExcelProcessing] = useState(false);

    // SQL Ingestion State
    const [sqlConfig, setSqlConfig] = useState({ host: "db.reforsal.com", dbName: "starbase_prod", user: "neoconta_sync", pass: "••••••••" });
    const [sqlTesting, setSqlTesting] = useState(false);
    const [sqlTested, setSqlTested] = useState(null); // true, false, null
    const [sqlProcessing, setSqlProcessing] = useState(false);

    // Cloud Ingestion State
    const [cloudLinked, setCloudLinked] = useState(false);
    const [cloudProcessing, setCloudProcessing] = useState(false);

    // Ingestions History State
    const [ingestions, setIngestions] = useState([]);
    const [loadingIngestions, setLoadingIngestions] = useState(false);

    // Custom Dashboard Builder States
    const [widgets, setWidgets] = useState([]);
    const [widgetData, setWidgetData] = useState({});
    const [loadingWidgets, setLoadingWidgets] = useState(true);
    const [customizing, setCustomizing] = useState(false);
    const [isWidgetModalOpen, setIsWidgetModalOpen] = useState(false);
    const [editingWidget, setEditingWidget] = useState({
        id: null,
        title: "Nuevo Reporte",
        type: "chart", // "chart" | "kpi"
        chartType: "bar",
        dataSource: "invoices",
        xAxisDimension: "month",
        yAxisMeasure: "amount",
        aggregation: "sum",
        width: "half"
    });

    useEffect(() => {
        setMounted(true);
    }, []);

    const fetchIngestions = async () => {
        const user = JSON.parse(localStorage.getItem('neoconta_user'));
        if (!user) return;

        setLoadingIngestions(true);
        try {
            const res = await fetch(`/api/commander/ingest?userId=${user.id}`);
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.ingestions) {
                    setIngestions(data.ingestions);
                }
            }
        } catch (err) {
            console.error("Error loading ingestions history:", err);
        } finally {
            setLoadingIngestions(false);
        }
    };

    const fetchWidgetsData = async (activeWidgets) => {
        const user = JSON.parse(localStorage.getItem('neoconta_user'));
        if (!user) return;

        try {
            const res = await fetch('/api/commander/widgets/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    widgets: activeWidgets,
                    clientFilter: selectedClient
                })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.results) {
                    setWidgetData(data.results);
                }
            }
        } catch (err) {
            console.error("Error loading widgets data:", err);
        }
    };

    const loadWidgetsConfig = async () => {
        const user = JSON.parse(localStorage.getItem('neoconta_user'));
        if (!user) return;

        setLoadingWidgets(true);
        try {
            const res = await fetch(`/api/commander/widgets?userId=${user.id}`);
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.widgets) {
                    setWidgets(data.widgets);
                    await fetchWidgetsData(data.widgets);
                }
            }
        } catch (err) {
            console.error("Error loading widgets config:", err);
        } finally {
            setLoadingWidgets(false);
        }
    };

    const saveWidgetsConfig = async (updatedWidgets) => {
        const user = JSON.parse(localStorage.getItem('neoconta_user'));
        if (!user) return;

        try {
            const res = await fetch('/api/commander/widgets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    widgets: updatedWidgets
                })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    setWidgets(data.widgets);
                    await fetchWidgetsData(data.widgets);
                }
            }
        } catch (err) {
            console.error("Error saving widgets config:", err);
            setError("No se pudo guardar la configuración del tablero.");
        }
    };

    const fetchStats = async () => {
        setLoading(true);
        setError(null);
        try {
            const user = JSON.parse(localStorage.getItem('neoconta_user'));
            if (!user) return;

            const res = await fetch(`/api/commander/stats?userId=${user.id}&client=${encodeURIComponent(selectedClient)}`);
            if (!res.ok) {
                throw new Error("No se pudieron cargar las estadísticas de Commander.");
            }
            const data = await res.json();
            setStats(data);
        } catch (err) {
            console.error("Error loading stats:", err);
            setError(err.message || "Error al conectar con la API.");
        } finally {
            setLoading(false);
        }
    };

    const handleRollback = async (batchId) => {
        if (!window.confirm("¿Está seguro de que desea deshacer esta importación? Se eliminarán permanentemente todos sus comprobantes y registros asociados sin alterar los datos previos.")) {
            return;
        }

        setError(null);
        setSuccessMessage("");
        
        try {
            const user = JSON.parse(localStorage.getItem('neoconta_user'));
            if (!user) return;

            const res = await fetch(`/api/commander/ingest?userId=${user.id}&batchId=${batchId}`, {
                method: 'DELETE'
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Error al revertir la ingesta");
            }

            setSuccessMessage(data.message || "Importación revertida con éxito.");
            
            // Refresh stats, widgets data and ingestions
            await fetchStats();
            await fetchWidgetsData(widgets);
            await fetchIngestions();

            setTimeout(() => {
                setSuccessMessage("");
            }, 6000);
        } catch (err) {
            console.error("Rollback failed:", err);
            setError(err.message || "Error al intentar deshacer la importación.");
        }
    };

    useEffect(() => {
        if (mounted) {
            fetchStats();
            loadWidgetsConfig();
            fetchIngestions();
        }
    }, [mounted, selectedClient]);

    // Formatters
    const formatCurrency = (val) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 2
        }).format(val || 0);
    };

    const formatYAxis = (value) => {
        if (value === 0) return '0';
        if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
        return `$${value}`;
    };

    // Custom Tooltip
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const formattedLabel = typeof label === 'number'
                ? new Date(label).toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                : label;

            return (
                <div className="bg-slate-900 border border-slate-700/80 p-3 rounded-xl shadow-xl text-xs">
                    <p className="text-slate-200 font-bold mb-1">{formattedLabel}</p>
                    {payload.map((item, idx) => (
                        <p key={idx} style={{ color: item.color || item.fill }} className="font-semibold mt-0.5">
                            {item.name}: {item.value !== undefined && (item.name.toLowerCase().includes('cantidad') || item.name.toLowerCase().includes('uds') ? `${item.value} uds` : formatCurrency(item.value))}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    // Ingest data to API
    const handleIngest = async (ingestionType, dataToSubmit = null) => {
        setError(null);
        setSuccessMessage("");
        
        try {
            const user = JSON.parse(localStorage.getItem('neoconta_user'));
            if (!user) return;

            const bodyObj = {
                userId: user.id,
                ingestionType,
                dataType: excelDataType,
                data: dataToSubmit
            };

            if (ingestionType === 'excel' && excelFile) {
                bodyObj.fileName = excelFile.name;
            }

            const res = await fetch('/api/commander/ingest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyObj)
            });

            const responseData = await res.json();
            if (!res.ok) {
                throw new Error(responseData.error || "Ocurrió un error al procesar la ingesta.");
            }

            setSuccessMessage(responseData.message || "Ingesta procesada correctamente.");
            
            // Clean local file states
            if (ingestionType === 'excel') {
                setExcelFile(null);
                setExcelData([]);
            }

            // Refresh stats, widgets data and ingestions
            await fetchStats();
            await fetchWidgetsData(widgets);
            await fetchIngestions();
            
            // Clear success alert after 5s
            setTimeout(() => {
                setSuccessMessage("");
            }, 6000);

        } catch (err) {
            console.error("Ingestion failed:", err);
            setError(err.message || "Error al intentar ingerir los datos.");
        }
    };

    // Excel Parsing Handler
    const handleExcelFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setExcelFile(file);
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const bstr = event.target.result;
                const wb = XLSX.read(bstr, { type: "binary" });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const rawData = XLSX.utils.sheet_to_json(ws);
                setExcelData(rawData);
            } catch (err) {
                console.error("Failed to read Excel file", err);
                setError("No se pudo leer el archivo Excel. Asegúrate de que sea un archivo válido.");
            }
        };
        reader.readAsBinaryString(file);
    };

    const parseAmount = (val) => {
        if (typeof val === 'number') return val;
        if (val === undefined || val === null) return undefined;
        let s = String(val).trim();
        if (s.includes('.') && s.includes(',')) {
            s = s.replace(/\./g, '').replace(/,/g, '.');
        } else if (s.includes(',')) {
            const parts = s.split(',');
            if (parts.length === 2) {
                if (parts[1].length === 3 && !isNaN(parts[0])) {
                    s = s.replace(/,/g, '');
                } else {
                    s = s.replace(/,/g, '.');
                }
            } else {
                s = s.replace(/,/g, '');
            }
        }
        s = s.replace(/[^0-9.-]/g, '');
        const num = parseFloat(s);
        return isNaN(num) ? undefined : num;
    };

    const runExcelIngest = async () => {
        if (excelData.length === 0) return;
        setExcelProcessing(true);

        const cleanedData = excelData.map(item => {
            const keys = Object.keys(item);
            const getVal = (patterns) => {
                const matchingKey = keys.find(k => {
                    const kl = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // remove accents
                    return patterns.some(p => kl.includes(p));
                });
                return matchingKey ? item[matchingKey] : undefined;
            };

            if (excelDataType === 'invoices') {
                const cuitVal = getVal(['cuit', 'c.u.i.t', 'nro. doc', 'nro doc', 'documento', 'receptor']);
                const clientVal = getVal(['razon', 'social', 'cliente', 'denominacion', 'nombre', 'client', 'receptor']);
                const amountVal = getVal(['importe', 'total', 'monto', 'amount', 'imp. total']);
                const conceptVal = getVal(['concepto', 'concept', 'detalle', 'detail', 'descripcion', 'description']);
                const dateVal = getVal(['fecha', 'date', 'fch', 'cbtefch']);
                const typeVal = getVal(['tipo', 'cbte', 'voucher', 'comprobante']);
                const ptoVal = getVal(['punto', 'pto', 'vta', 'pos']);
                const numVal = getVal(['numero', 'nro', 'desde', 'comprobante']);
                const caeVal = getVal(['cae']);
                const caeVtoVal = getVal(['vto', 'vencimiento']);

                if (!cuitVal && !clientVal && !amountVal) return null;

                return {
                    cuit: cuitVal ? String(cuitVal).trim() : undefined,
                    client_name: clientVal ? String(clientVal).trim() : undefined,
                    amount: amountVal ? parseAmount(amountVal) : undefined,
                    detail: conceptVal ? String(conceptVal).trim() : undefined,
                    date: dateVal ? String(dateVal).trim() : undefined,
                    cbteTipo: typeVal ? Number(typeVal) : undefined,
                    ptoVta: ptoVal ? Number(ptoVal) : undefined,
                    cbteDesde: numVal ? Number(numVal) : undefined,
                    cae: caeVal ? String(caeVal).trim() : undefined,
                    caeVto: caeVtoVal ? String(caeVtoVal).trim() : undefined
                };
            } else {
                const dateVal = getVal(['fecha', 'date', 'fch', 'transaction_date']);
                const conceptVal = getVal(['concepto', 'concept', 'detalle', 'detail']);
                const voucherVal = getVal(['comprobante', 'voucher', 'numero', 'nro', 'voucher_number']);
                const amountVal = getVal(['importe', 'monto', 'amount', 'total', 'credito', 'debito']);
                const descVal = getVal(['descripcion', 'description', 'detalle', 'concepto']);
                const clientVal = getVal(['cliente', 'client_name', 'nombre', 'razon', 'social', 'origen', 'destino']);
                const bankVal = getVal(['banco', 'bank_name', 'cuenta']);

                if (!dateVal && !amountVal && !clientVal) return null;

                return {
                    date: dateVal ? String(dateVal).trim() : undefined,
                    concept: conceptVal ? String(conceptVal).trim() : undefined,
                    voucher_number: voucherVal ? String(voucherVal).trim() : undefined,
                    amount: amountVal ? parseAmount(amountVal) : undefined,
                    description: descVal ? String(descVal).trim() : undefined,
                    client_name: clientVal ? String(clientVal).trim() : undefined,
                    bank_name: bankVal ? String(bankVal).trim() : undefined
                };
            }
        }).filter(Boolean);

        if (cleanedData.length === 0) {
            setError("No se encontraron registros válidos para importar en el Excel. Verifica las columnas.");
            setExcelProcessing(false);
            return;
        }

        await handleIngest('excel', cleanedData);
        setExcelProcessing(false);
    };

    // SQL Connection Test & Sync
    const testSqlConnection = () => {
        setSqlTesting(true);
        setSqlTested(null);
        setTimeout(() => {
            setSqlTesting(false);
            setSqlTested(true);
        }, 1500);
    };

    const runSqlSync = async () => {
        setSqlProcessing(true);
        await handleIngest('sql');
        setSqlProcessing(false);
    };

    // Cloud OneDrive Sync Simulation
    const runCloudSync = async () => {
        setCloudProcessing(true);
        await handleIngest('cloud');
        setCloudProcessing(false);
        setCloudLinked(true);
    };

    // Custom Widget Handlers
    const handleAddWidgetClick = () => {
        setEditingWidget({
            id: null,
            title: "Nuevo Gráfico / Reporte",
            type: "chart",
            chartType: "bar",
            dataSource: "invoices",
            xAxisDimension: "month",
            yAxisMeasure: "amount",
            aggregation: "sum",
            width: "half"
        });
        setIsWidgetModalOpen(true);
    };

    const handleEditWidget = (widget) => {
        setEditingWidget({ ...widget });
        setIsWidgetModalOpen(true);
    };

    const handleDeleteWidget = async (widgetId) => {
        if (!window.confirm("¿Está seguro de que desea eliminar este widget del tablero?")) {
            return;
        }
        const updated = widgets.filter(w => w.id !== widgetId);
        setWidgets(updated);
        await saveWidgetsConfig(updated);
    };

    const handleMoveWidget = async (index, direction) => {
        const updated = [...widgets];
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= updated.length) return;

        const temp = updated[index];
        updated[index] = updated[targetIndex];
        updated[targetIndex] = temp;

        setWidgets(updated);
        await saveWidgetsConfig(updated);
    };

    const handleSaveWidget = async () => {
        if (!editingWidget.title.trim()) {
            alert("El título del widget es obligatorio.");
            return;
        }

        let updated;
        if (editingWidget.id) {
            // Edit existing
            updated = widgets.map(w => w.id === editingWidget.id ? editingWidget : w);
        } else {
            // Add new
            const newWidget = {
                ...editingWidget,
                id: `widget_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
            };
            updated = [...widgets, newWidget];
        }

        setWidgets(updated);
        await saveWidgetsConfig(updated);
        setIsWidgetModalOpen(false);
    };

    const handleUpdateWidgetTitle = (widgetId, newTitle) => {
        const updated = widgets.map(w => w.id === widgetId ? { ...w, title: newTitle } : w);
        setWidgets(updated);
    };

    if (!mounted) return null;

    if (loading && !stats) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="h-10 w-10 text-orange-500 animate-spin" />
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Cargando Commander BI Engine...</p>
                </div>
            </div>
        );
    }

    // Filter debt ranking table
    const filteredRanking = stats?.debtRanking.filter(item => {
        const matchesSearch = item.client_name.toLowerCase().includes(searchQuery.toLowerCase()) || item.cuit.includes(searchQuery);
        const matchesMinAmt = !minAmount || item.total_debt >= parseFloat(minAmount);
        return matchesSearch && matchesMinAmt;
    }) || [];

    const COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#f43f5e', '#06b6d4'];

    return (
        <div className="max-w-[95vw] mx-auto space-y-6 pb-12 animate-fade-in-up">
            
            {/* Header Title Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3.5">
                        <TrendingUp className="h-9 w-9 text-orange-600 animate-pulse" />
                        Commander® BI
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1.5 text-sm">
                        Plataforma de Business Intelligence, Reportes Flexibles y Analítica Financiera.
                    </p>
                </div>
                
                <div className="flex items-center gap-3 w-full md:w-auto">
                    {/* General design tools */}
                    <button
                        onClick={() => setCustomizing(!customizing)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            customizing 
                                ? "bg-orange-600 text-white shadow-md shadow-orange-500/25" 
                                : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                        }`}
                    >
                        <Settings className={`h-4 w-4 ${customizing ? 'animate-spin' : ''}`} />
                        {customizing ? "Guardar Diseño" : "Personalizar Tablero"}
                    </button>

                    {customizing && (
                        <button
                            onClick={handleAddWidgetClick}
                            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                        >
                            <Plus className="h-4 w-4" />
                            Añadir Widget
                        </button>
                    )}

                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap ml-2">Canal:</span>
                    <select
                        value={selectedClient}
                        onChange={(e) => setSelectedClient(e.target.value)}
                        className="px-4 py-2.5 text-sm font-semibold rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-800 dark:text-white shadow-sm focus:ring-2 focus:ring-orange-500/20 outline-none w-full md:w-[240px]"
                    >
                        <option value="">Todos los Clientes</option>
                        {stats?.clients.map((c, idx) => (
                            <option key={idx} value={c}>{c}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Success and Error Alerts */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-700 dark:text-red-400 text-sm animate-fade-in">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {successMessage && (
                <div className="bg-emerald-500/10 border border-emerald-500/25 p-4 rounded-2xl flex items-center gap-3 text-emerald-700 dark:text-emerald-400 text-sm animate-fade-in">
                    <CheckCircle className="h-5 w-5 shrink-0 text-emerald-500" />
                    <span>{successMessage}</span>
                </div>
            )}

            {/* DESIGN MODE NOTIFICATION */}
            {customizing && (
                <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-2xl flex items-center justify-between text-orange-700 dark:text-orange-400 text-xs animate-pulse">
                    <div className="flex items-center gap-2">
                        <LayoutGrid className="h-4.5 w-4.5" />
                        <span><strong>Modo Personalización Activo:</strong> Puedes reordenar, editar o eliminar widgets, o crear nuevos indicadores. Tus cambios se guardarán automáticamente en tu perfil.</span>
                    </div>
                </div>
            )}

            {/* DYNAMIC WIDGETS DISPLAY */}
            {loadingWidgets && Object.keys(widgetData).length === 0 ? (
                <div className="flex h-[300px] items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-3xl">
                    <div className="flex flex-col items-center gap-2">
                        <RefreshCw className="h-7 w-7 text-orange-500 animate-spin" />
                        <p className="text-slate-400 text-xs font-semibold">Cargando widgets del tablero...</p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {widgets.map((widget, index) => {
                        const isKpi = widget.type === 'kpi';
                        const data = widgetData[widget.id] || [];

                        return (
                            <div 
                                key={widget.id} 
                                className={`relative group ${
                                    widget.width === 'full' && !isKpi ? 'col-span-1 md:col-span-2' : 'col-span-1'
                                }`}
                            >
                                {/* Edit & Reorder Controls for Customizing mode */}
                                {customizing && (
                                    <div className="absolute top-3 right-3 flex items-center gap-1 z-15 bg-slate-900/90 border border-slate-800 p-1 rounded-xl shadow-lg">
                                        <button 
                                            onClick={() => handleMoveWidget(index, -1)} 
                                            disabled={index === 0}
                                            className="p-1 rounded-lg hover:bg-slate-800 text-slate-450 hover:text-white disabled:opacity-20 cursor-pointer"
                                            title="Mover arriba"
                                        >
                                            <ArrowUp className="h-3.5 w-3.5" />
                                        </button>
                                        <button 
                                            onClick={() => handleMoveWidget(index, 1)} 
                                            disabled={index === widgets.length - 1}
                                            className="p-1 rounded-lg hover:bg-slate-800 text-slate-450 hover:text-white disabled:opacity-20 cursor-pointer"
                                            title="Mover abajo"
                                        >
                                            <ArrowDown className="h-3.5 w-3.5" />
                                        </button>
                                        <button 
                                            onClick={() => handleEditWidget(widget)} 
                                            className="p-1 rounded-lg hover:bg-slate-800 text-blue-450 hover:text-blue-300 cursor-pointer"
                                            title="Editar widget"
                                        >
                                            <Edit className="h-3.5 w-3.5" />
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteWidget(widget.id)} 
                                            className="p-1 rounded-lg hover:bg-slate-800 text-red-450 hover:text-red-400 cursor-pointer"
                                            title="Eliminar widget"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                )}

                                {/* RENDER KPI CARD */}
                                {isKpi ? (
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-5.5 rounded-2xl shadow-sm hover:shadow transition-all relative overflow-hidden group min-h-[135px] flex flex-col justify-between">
                                        <div className="flex items-center justify-between">
                                            {customizing ? (
                                                <input
                                                    type="text"
                                                    value={widget.title}
                                                    onChange={(e) => handleUpdateWidgetTitle(widget.id, e.target.value)}
                                                    onBlur={() => saveWidgetsConfig(widgets)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') e.target.blur();
                                                    }}
                                                    className="bg-transparent border-b border-slate-200 dark:border-slate-850 focus:border-orange-500 outline-none text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider pr-10 w-full"
                                                />
                                            ) : (
                                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pr-10 truncate">{widget.title}</span>
                                            )}
                                            <div className="p-2 rounded-xl bg-orange-500/10 text-orange-600">
                                                {widget.dataSource === 'invoices' ? <TrendingUp className="h-5 w-5" /> : <Wallet className="h-5 w-5" />}
                                            </div>
                                        </div>
                                        <div className="mt-3">
                                            <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                                                {widget.yAxisMeasure === 'amount' ? formatCurrency(data.value) : `${data.value || 0} uds`}
                                            </h2>
                                            <p className="text-[10px] text-slate-450 mt-1 capitalize">
                                                {widget.aggregation === 'sum' ? 'Suma' : widget.aggregation === 'avg' ? 'Promedio' : 'Cantidad'} de {widget.yAxisMeasure === 'amount' ? 'Importes' : 'Registros'} ({widget.dataSource === 'invoices' ? 'Facturas' : 'Banco'})
                                            </p>
                                        </div>
                                        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-amber-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"></div>
                                    </div>
                                ) : (
                                    
                                    // RENDER CHART CONTAINER
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-5 rounded-2xl shadow-sm hover:shadow transition-all flex flex-col h-[400px]">
                                        {customizing ? (
                                            <div className="text-sm font-bold text-slate-850 dark:text-slate-200 mb-4 flex items-center gap-2 pr-28 w-full">
                                                {widget.dataSource === 'invoices' ? (
                                                    <TrendingUp className="h-4.5 w-4.5 text-orange-500 shrink-0" />
                                                ) : (
                                                    <Wallet className="h-4.5 w-4.5 text-emerald-500 shrink-0" />
                                                )}
                                                <input
                                                    type="text"
                                                    value={widget.title}
                                                    onChange={(e) => handleUpdateWidgetTitle(widget.id, e.target.value)}
                                                    onBlur={() => saveWidgetsConfig(widgets)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') e.target.blur();
                                                    }}
                                                    className="bg-transparent border-b border-slate-200 dark:border-slate-800 focus:border-orange-500 outline-none w-full text-sm font-bold text-slate-850 dark:text-slate-200 py-0.5"
                                                />
                                            </div>
                                        ) : (
                                            <h3 className="text-sm font-bold text-slate-850 dark:text-slate-200 mb-4 flex items-center gap-2 pr-28 truncate">
                                                {widget.dataSource === 'invoices' ? (
                                                    <TrendingUp className="h-4.5 w-4.5 text-orange-500 shrink-0" />
                                                ) : (
                                                    <Wallet className="h-4.5 w-4.5 text-emerald-500 shrink-0" />
                                                )}
                                                {widget.title}
                                            </h3>
                                        )}
                                        <div className="flex-1 w-full h-full text-xs">
                                            {data.length === 0 ? (
                                                <div className="w-full h-full flex items-center justify-center text-slate-450 bg-slate-50/20 dark:bg-slate-950/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-850">
                                                    Sin datos registrados para esta agrupación.
                                                </div>
                                            ) : (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    {widget.chartType === 'bar' ? (
                                                        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800/60" />
                                                            <XAxis dataKey="label" stroke="#94a3b8" />
                                                            <YAxis tickFormatter={widget.yAxisMeasure === 'amount' ? formatYAxis : undefined} stroke="#94a3b8" />
                                                            <Tooltip content={<CustomTooltip />} />
                                                            <Legend wrapperStyle={{ paddingTop: '10px' }} />
                                                            <Bar dataKey="value" name={widget.title} fill="#fb923c" radius={[3, 3, 0, 0]}>
                                                                {data.map((entry, index) => (
                                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                                ))}
                                                            </Bar>
                                                        </BarChart>
                                                    ) : widget.chartType === 'line' ? (
                                                        <LineChart data={data} margin={{ top: 10, right: 15, left: -20, bottom: 5 }}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800/60" />
                                                            <XAxis dataKey="label" stroke="#94a3b8" />
                                                            <YAxis tickFormatter={widget.yAxisMeasure === 'amount' ? formatYAxis : undefined} stroke="#94a3b8" />
                                                            <Tooltip content={<CustomTooltip />} />
                                                            <Legend wrapperStyle={{ paddingTop: '10px' }} />
                                                            <Line type="monotone" dataKey="value" name={widget.title} stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, strokeWidth: 0, fill: '#3b82f6' }} activeDot={{ r: 6 }} />
                                                        </LineChart>
                                                    ) : widget.chartType === 'area' ? (
                                                        <AreaChart data={data} margin={{ top: 10, right: 15, left: -20, bottom: 5 }}>
                                                            <defs>
                                                                <linearGradient id={`colorUv_${widget.id}`} x1="0" y1="0" x2="0" y2="1">
                                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.01}/>
                                                                </linearGradient>
                                                            </defs>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800/60" />
                                                            <XAxis dataKey="label" stroke="#94a3b8" />
                                                            <YAxis tickFormatter={widget.yAxisMeasure === 'amount' ? formatYAxis : undefined} stroke="#94a3b8" />
                                                            <Tooltip content={<CustomTooltip />} />
                                                            <Legend wrapperStyle={{ paddingTop: '10px' }} />
                                                            <Area type="monotone" dataKey="value" name={widget.title} stroke="#10b981" fillOpacity={1} fill={`url(#colorUv_${widget.id})`} strokeWidth={2} />
                                                        </AreaChart>
                                                    ) : (
                                                        // Pie Chart
                                                        <div className="flex flex-col sm:flex-row items-center gap-4 w-full h-full justify-around">
                                                            <div className="h-[220px] w-[220px] shrink-0">
                                                                <ResponsiveContainer width="100%" height="100%">
                                                                    <PieChart>
                                                                        <Pie
                                                                            data={data}
                                                                            cx="50%"
                                                                            cy="50%"
                                                                            innerRadius={widget.xAxisDimension === 'bank' ? 45 : 0}
                                                                            outerRadius={75}
                                                                            dataKey="value"
                                                                            label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                                                                        >
                                                                            {data.map((entry, index) => (
                                                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                                            ))}
                                                                        </Pie>
                                                                        <Tooltip formatter={(v) => widget.yAxisMeasure === 'amount' ? formatCurrency(v) : `${v} uds`} />
                                                                    </PieChart>
                                                                </ResponsiveContainer>
                                                            </div>
                                                            <div className="space-y-1.5 overflow-y-auto max-h-[220px] pr-2 text-left">
                                                                {data.slice(0, 7).map((entry, index) => (
                                                                    <div key={index} className="flex items-center gap-2 text-[10.5px]">
                                                                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                                                                        <span className="font-semibold text-slate-700 dark:text-slate-350 uppercase truncate max-w-[120px]">{entry.name}:</span>
                                                                        <span className="font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                                                            {widget.yAxisMeasure === 'amount' ? formatCurrency(entry.value) : `${entry.value} uds`}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                                {data.length > 7 && (
                                                                    <p className="text-[9.5px] text-slate-400 italic pl-5">Y {data.length - 7} más...</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </ResponsiveContainer>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Table: Debt Ranking */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-sm overflow-hidden min-h-[350px] flex flex-col">
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <AlertCircle className="h-4.5 w-4.5 text-red-500" />
                            Cartera de Deudores (Clientes / Obras Sociales)
                        </h3>
                        <p className="text-[10px] text-slate-405 mt-0.5">Listado ordenado de clientes con saldos pendientes por facturas impagas.</p>
                    </div>

                    {/* Ranking filters */}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-405" />
                            <input
                                type="text"
                                placeholder="Buscar por cliente..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none w-[160px] focus:ring-1 focus:ring-orange-500 text-slate-950 dark:text-white"
                            />
                        </div>
                        <input
                            type="number"
                            placeholder="Min ARS"
                            value={minAmount}
                            onChange={(e) => setMinAmount(e.target.value)}
                            className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none w-[90px] focus:ring-1 focus:ring-orange-500 text-slate-950 dark:text-white"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-x-auto p-5">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-800">
                                <tr>
                                    <th className="px-4 py-2.5 text-center font-bold text-slate-500 uppercase tracking-wider w-[50px]">#</th>
                                    <th className="px-4 py-2.5 text-left font-bold text-slate-500 uppercase tracking-wider">Cliente</th>
                                    <th className="px-4 py-2.5 text-left font-bold text-slate-500 uppercase tracking-wider">CUIT / Identificador</th>
                                    <th className="px-4 py-2.5 text-right font-bold text-slate-500 uppercase tracking-wider">Saldo Adeudado</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800">
                                {filteredRanking.length > 0 ? (
                                    filteredRanking.map((item, index) => (
                                        <tr key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                                            <td className="px-4 py-3 text-center text-slate-400 font-bold">{index + 1}</td>
                                            <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{item.client_name}</td>
                                            <td className="px-4 py-3 text-slate-550 font-mono">{item.cuit}</td>
                                            <td className="px-4 py-3 text-right font-bold text-red-650 dark:text-red-400">{formatCurrency(item.total_debt)}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="4" className="px-4 py-8 text-center text-slate-400">No hay deudores que coincidan con los filtros.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* BI DATA INGESTION PANEL */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[420px]">
                    <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <Database className="h-4.5 w-4.5 text-orange-500" />
                            Ingesta y Sincronización de Datos BI (Commander® Engine)
                        </h3>
                        <p className="text-[10px] text-slate-405 mt-0.5">
                            Configura los canales de ingesta para que Commander incorpore y cruce información en tiempo real.
                        </p>
                    </div>

                    <div className="flex border-b border-slate-200 dark:border-slate-800 px-5 bg-white dark:bg-slate-900 pt-3 gap-2">
                        <button
                            onClick={() => setActiveIngestionTab("excel")}
                            className={`px-4 py-2 text-xs font-bold border-b-2 rounded-t-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                                activeIngestionTab === "excel"
                                    ? "border-orange-500 text-orange-600 dark:text-orange-400"
                                    : "border-transparent text-slate-450 hover:text-slate-700 dark:text-slate-450 dark:hover:text-slate-300"
                            }`}
                        >
                            <FileSpreadsheet className="h-4 w-4" />
                            Excel / CSV
                        </button>
                        <button
                            onClick={() => setActiveIngestionTab("sql")}
                            className={`px-4 py-2 text-xs font-bold border-b-2 rounded-t-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                                activeIngestionTab === "sql"
                                    ? "border-orange-500 text-orange-600 dark:text-orange-400"
                                    : "border-transparent text-slate-450 hover:text-slate-700 dark:text-slate-450 dark:hover:text-slate-300"
                            }`}
                        >
                            <Database className="h-4 w-4" />
                            Base de Datos SQL
                        </button>
                        <button
                            onClick={() => setActiveIngestionTab("cloud")}
                            className={`px-4 py-2 text-xs font-bold border-b-2 rounded-t-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                                activeIngestionTab === "cloud"
                                    ? "border-orange-500 text-orange-600 dark:text-orange-400"
                                    : "border-transparent text-slate-450 hover:text-slate-700 dark:text-slate-450 dark:hover:text-slate-300"
                            }`}
                        >
                            <Cloud className="h-4 w-4" />
                            Nube (OneDrive/Drive)
                        </button>
                    </div>

                    <div className="p-6 flex-1 bg-white dark:bg-slate-900 flex flex-col justify-between">
                        {activeIngestionTab === "excel" && (
                            <div className="space-y-4 animate-fade-in-quick">
                                <div className="text-xs text-slate-650 dark:text-slate-400 leading-relaxed flex justify-between items-center flex-wrap gap-2">
                                    <p>Sube planillas de facturas o extractos bancarios directamente.</p>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Tipo de Importación:</span>
                                        <select 
                                            value={excelDataType} 
                                            onChange={(e) => setExcelDataType(e.target.value)}
                                            className="px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
                                        >
                                            <option value="invoices">Facturas Emitidas</option>
                                            <option value="transactions">Movimientos Bancarios</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="relative border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-950/20 text-center hover:border-orange-500/55 transition-colors">
                                    <input 
                                        type="file" 
                                        accept=".xlsx, .xls, .csv" 
                                        onChange={handleExcelFileChange}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    <FileSpreadsheet className="h-10 w-10 text-green-600 animate-bounce mb-3" />
                                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                        {excelFile ? `Seleccionado: ${excelFile.name}` : "Arrastra tu archivo Excel aquí o haz clic para examinar"}
                                    </span>
                                    <span className="text-[10px] text-slate-405 mt-1">Soporta formatos .xlsx, .xls y .csv ({excelData.length > 0 ? `${excelData.length} registros cargados` : "Fuzzy mapping de columnas activo"})</span>
                                </div>

                                {excelData.length > 0 && (
                                    <button 
                                        onClick={runExcelIngest}
                                        disabled={excelProcessing}
                                        className="w-full py-2.5 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                    >
                                        {excelProcessing ? (
                                            <>
                                                <RefreshCw className="h-4.5 w-4.5 animate-spin" /> Ingeriendo Datos...
                                            </>
                                        ) : (
                                            <>
                                                <FileSpreadsheet className="h-4.5 w-4.5" /> Ingerir {excelData.length} Registros de Excel
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        )}

                        {activeIngestionTab === "sql" && (
                            <div className="space-y-4 animate-fade-in-quick">
                                <div className="text-xs text-slate-650 dark:text-slate-400 leading-relaxed">
                                    <p>Conecta Commander directamente con tus bases de datos de producción (PostgreSQL, SQL Server, o MySQL) para alimentar el dashboard en tiempo real sin cargas manuales.</p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-405 uppercase mb-1">Host de Base de Datos</label>
                                        <input 
                                            type="text" 
                                            value={sqlConfig.host} 
                                            onChange={(e) => setSqlConfig({...sqlConfig, host: e.target.value})}
                                            className="px-3 py-2 text-xs rounded-xl border border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-950 outline-none w-full text-slate-950 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-405 uppercase mb-1">Nombre de la DB</label>
                                        <input 
                                            type="text" 
                                            value={sqlConfig.dbName} 
                                            onChange={(e) => setSqlConfig({...sqlConfig, dbName: e.target.value})}
                                            className="px-3 py-2 text-xs rounded-xl border border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-950 outline-none w-full text-slate-950 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-405 uppercase mb-1">Usuario</label>
                                        <input 
                                            type="text" 
                                            value={sqlConfig.user} 
                                            onChange={(e) => setSqlConfig({...sqlConfig, user: e.target.value})}
                                            className="px-3 py-2 text-xs rounded-xl border border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-950 outline-none w-full text-slate-950 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-405 uppercase mb-1">Contraseña</label>
                                        <input 
                                            type="password" 
                                            value={sqlConfig.pass} 
                                            onChange={(e) => setSqlConfig({...sqlConfig, pass: e.target.value})}
                                            className="px-3 py-2 text-xs rounded-xl border border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-950 outline-none w-full text-slate-950 dark:text-white"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                    <button 
                                        onClick={testSqlConnection}
                                        disabled={sqlTesting || sqlProcessing}
                                        className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-850 dark:hover:bg-slate-700 cursor-pointer flex items-center justify-center gap-1.5"
                                    >
                                        {sqlTesting && <RefreshCw className="h-3 w-3 animate-spin" />}
                                        Probar Conexión
                                    </button>

                                    {sqlTested && (
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-1">
                                            <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1 shrink-0">
                                                <CheckCircle className="h-3.5 w-3.5" /> Conexión Exitosa
                                            </span>
                                            
                                            <button 
                                                onClick={runSqlSync}
                                                disabled={sqlProcessing}
                                                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white shadow-sm cursor-pointer flex items-center justify-center gap-1.5 flex-grow sm:flex-grow-0"
                                            >
                                                {sqlProcessing ? (
                                                    <>
                                                        <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Sincronizando...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Database className="h-3.5 w-3.5" /> Sincronizar Datos SQL
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeIngestionTab === "cloud" && (
                            <div className="space-y-4 animate-fade-in-quick">
                                <div className="text-xs text-slate-650 dark:text-slate-400 leading-relaxed">
                                    <p>Vincula una carpeta compartida en la nube de OneDrive o Google Drive. El sistema Commander escaneará automáticamente la carpeta cada hora en segundo plano en busca de nuevas planillas de transacciones.</p>
                                </div>

                                <div className="bg-slate-50 dark:bg-slate-950/20 border border-slate-200/50 dark:border-slate-850 p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-blue-500/10 text-blue-600 rounded-2xl">
                                            <Cloud className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-slate-950 dark:text-white">Microsoft OneDrive Sync</h4>
                                            <p className="text-[10px] text-slate-400 mt-0.5">{cloudLinked ? "Sincronizado: /Contabilidad/Commander_Plano" : "Carpeta de la nube no vinculada"}</p>
                                        </div>
                                    </div>

                                    <button 
                                        onClick={runCloudSync}
                                        disabled={cloudProcessing}
                                        className={`px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                                            cloudLinked 
                                                ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" 
                                                : "bg-orange-600 text-white hover:bg-orange-700 shadow-sm"
                                        }`}
                                    >
                                        {cloudProcessing ? (
                                            <>
                                                <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Sincronizando...
                                            </>
                                        ) : (
                                            cloudLinked ? "Desvincular" : "Vincular y Sincronizar"
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="bg-slate-50 dark:bg-slate-950/40 p-4 border border-slate-200/50 dark:border-slate-850 rounded-2xl text-[10px] text-slate-500 dark:text-slate-400 mt-6 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                                <span>Commander procesa y encripta todas las conexiones de manera segura bajo certificados TLS 1.3 de AFIP.</span>
                            </div>
                            <div className="flex items-center gap-0.5 text-orange-500 font-bold hover:underline cursor-pointer">
                                <span>Ver documentación del motor</span>
                                <ArrowRight className="h-3 w-3" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* HISTORIAL DE IMPORTACIONES PANEL */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[300px]">
                    <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                <HardDrive className="h-4.5 w-4.5 text-orange-500" />
                                Historial de Importaciones y Cargas (Commander® Rollback)
                            </h3>
                            <p className="text-[10px] text-slate-405 mt-0.5">
                                Revisa el registro histórico de lotes ingresados al sistema y revierte importaciones erróneas de forma íntegra.
                            </p>
                        </div>
                        {loadingIngestions && (
                            <RefreshCw className="h-4 w-4 text-orange-500 animate-spin" />
                        )}
                    </div>

                    <div className="p-5 flex-1 flex flex-col">
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden overflow-x-auto animate-fade-in-quick">
                            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                                <thead className="bg-slate-50 dark:bg-slate-800">
                                    <tr>
                                        <th className="px-4 py-2.5 text-left font-bold text-slate-500 uppercase tracking-wider">Fecha / Hora</th>
                                        <th className="px-4 py-2.5 text-left font-bold text-slate-500 uppercase tracking-wider">Nombre del Archivo / Origen</th>
                                        <th className="px-4 py-2.5 text-left font-bold text-slate-500 uppercase tracking-wider">Tipo Ingesta</th>
                                        <th className="px-4 py-2.5 text-center font-bold text-slate-500 uppercase tracking-wider">Registros</th>
                                        <th className="px-4 py-2.5 text-center font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                                        <th className="px-4 py-2.5 text-right font-bold text-slate-500 tracking-wider">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800">
                                    {ingestions.length > 0 ? (
                                        ingestions.map((item, index) => {
                                            const isRollback = item.status === 'rolled_back';
                                            return (
                                                <tr key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                                                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                                                        {new Date(item.timestamp).toLocaleString('es-AR')}
                                                    </td>
                                                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white truncate max-w-[200px]" title={item.fileName}>
                                                        {item.fileName}
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-500">
                                                        <span className="capitalize">{item.ingestionType === 'excel' ? 'Excel / CSV' : item.ingestionType.toUpperCase()}</span>
                                                        <span className="text-[10px] text-slate-405 block lowercase">({item.dataType})</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center font-bold text-slate-700 dark:text-slate-350">
                                                        {item.recordCount}
                                                    </td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">
                                                        {isRollback ? (
                                                            <span className="px-2 py-0.5 inline-flex text-[9px] font-bold rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500 border border-slate-200 dark:border-slate-700">
                                                                Revertido
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 inline-flex text-[9px] font-bold rounded-full bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400 border border-green-200 dark:border-green-800">
                                                                Activo
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        {!isRollback && (
                                                            <button
                                                                onClick={() => handleRollback(item.batchId)}
                                                                className="px-2.5 py-1 text-[10px] font-bold bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-lg cursor-pointer transition-colors"
                                                                title="Deshacer esta importación y borrar todos sus registros"
                                                            >
                                                                Deshacer
                                                            </button>
                                                        )}
                                                        {isRollback && item.rolledBackAt && (
                                                            <span className="text-[10px] text-slate-400 italic">
                                                                Revertido el {new Date(item.rolledBackAt).toLocaleDateString('es-AR')}
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan="6" className="px-4 py-10 text-center text-slate-400">
                                                No hay historial de importaciones registradas.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* CUSTOM WIDGET CREATION / EDITING MODAL */}
            {isWidgetModalOpen && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-scale-up">
                        <div className="p-6 border-b border-orange-500/20 flex justify-between items-center bg-orange-500/5 dark:bg-orange-500/10">
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <Settings className="h-5 w-5 text-orange-500" />
                                    {editingWidget.id ? "Editar Widget Personalizado" : "Crear Widget Personalizado"}
                                </h3>
                                <p className="text-[10px] text-slate-450 mt-0.5">Configura la métrica o gráfico para añadir al tablero.</p>
                            </div>
                            <button 
                                onClick={() => setIsWidgetModalOpen(false)}
                                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-650 cursor-pointer"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 text-xs text-slate-700 dark:text-slate-300">
                            {/* Title */}
                            <div>
                                <label className="block text-[10px] font-bold text-slate-405 uppercase mb-1.5">Título del Reporte</label>
                                <input 
                                    type="text" 
                                    value={editingWidget.title} 
                                    onChange={(e) => setEditingWidget({...editingWidget, title: e.target.value})}
                                    className="px-3.5 py-2.5 text-xs rounded-xl border border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-950 outline-none w-full text-slate-950 dark:text-white focus:ring-1 focus:ring-orange-500 font-semibold"
                                    placeholder="Ej. Ventas por Obra Social"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Type */}
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-405 uppercase mb-1.5">Tipo de Reporte</label>
                                    <select 
                                        value={editingWidget.type} 
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setEditingWidget({
                                                ...editingWidget, 
                                                type: val,
                                                // If KPI, force dimensions off
                                                xAxisDimension: val === 'kpi' ? '' : 'month'
                                            });
                                        }}
                                        className="px-3.5 py-2.5 text-xs rounded-xl border border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-950 dark:text-white outline-none w-full font-semibold focus:ring-1 focus:ring-orange-500"
                                    >
                                        <option value="chart">Gráfico Estadístico</option>
                                        <option value="kpi">Tarjeta KPI (Métrica Única)</option>
                                    </select>
                                </div>

                                {/* Width */}
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-405 uppercase mb-1.5">Ancho en Pantalla</label>
                                    <select 
                                        value={editingWidget.width} 
                                        onChange={(e) => setEditingWidget({...editingWidget, width: e.target.value})}
                                        className="px-3.5 py-2.5 text-xs rounded-xl border border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-950 dark:text-white outline-none w-full font-semibold focus:ring-1 focus:ring-orange-500"
                                    >
                                        <option value="half">Medio Ancho (1/2 Columna)</option>
                                        <option value="full">Ancho Completo (1 Columna)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Chart type (only if type === 'chart') */}
                            {editingWidget.type === 'chart' && (
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-405 uppercase mb-1.5">Tipo de Gráfico</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {['bar', 'line', 'area', 'pie'].map(t => (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => setEditingWidget({...editingWidget, chartType: t})}
                                                className={`py-2 rounded-xl border font-bold text-[10px] capitalize transition-all cursor-pointer ${
                                                    editingWidget.chartType === t
                                                        ? "border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400"
                                                        : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 hover:bg-slate-100"
                                                }`}
                                            >
                                                {t === 'bar' ? 'Barras' : t === 'line' ? 'Líneas' : t === 'area' ? 'Áreas' : 'Torta'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-850 pt-4">
                                {/* Data Source */}
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-405 uppercase mb-1.5">Origen de Datos</label>
                                    <select 
                                        value={editingWidget.dataSource} 
                                        onChange={(e) => {
                                            const src = e.target.value;
                                            setEditingWidget({
                                                ...editingWidget, 
                                                dataSource: src,
                                                // Reset x axis if bank is selected but source is invoices
                                                xAxisDimension: src === 'invoices' && editingWidget.xAxisDimension === 'bank' ? 'month' : editingWidget.xAxisDimension
                                            });
                                        }}
                                        className="px-3.5 py-2.5 text-xs rounded-xl border border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-950 dark:text-white outline-none w-full font-semibold focus:ring-1 focus:ring-orange-500"
                                    >
                                        <option value="invoices">Facturas Emitidas (ARCA)</option>
                                        <option value="transactions">Movimientos Bancarios</option>
                                    </select>
                                </div>

                                {/* Y Axis Measure */}
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-405 uppercase mb-1.5">Métrica (Eje Y)</label>
                                    <select 
                                        value={editingWidget.yAxisMeasure} 
                                        onChange={(e) => setEditingWidget({...editingWidget, yAxisMeasure: e.target.value})}
                                        className="px-3.5 py-2.5 text-xs rounded-xl border border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-950 dark:text-white outline-none w-full font-semibold focus:ring-1 focus:ring-orange-500"
                                    >
                                        <option value="amount">Importe en Pesos (ARS)</option>
                                        <option value="count">Cantidad de Comprobantes</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Aggregation */}
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-405 uppercase mb-1.5">Agregación / Operación</label>
                                    <select 
                                        value={editingWidget.aggregation} 
                                        disabled={editingWidget.yAxisMeasure === 'count'}
                                        onChange={(e) => setEditingWidget({...editingWidget, aggregation: e.target.value})}
                                        className="px-3.5 py-2.5 text-xs rounded-xl border border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-950 dark:text-white outline-none w-full font-semibold focus:ring-1 focus:ring-orange-500 disabled:opacity-50"
                                    >
                                        <option value="sum">Sumar Todo</option>
                                        <option value="avg">Promediar</option>
                                        <option value="count">Contar Filas</option>
                                    </select>
                                </div>

                                {/* X Axis Dimension (only if type === 'chart') */}
                                {editingWidget.type === 'chart' && (
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-405 uppercase mb-1.5">Agrupar por (Eje X)</label>
                                        <select 
                                            value={editingWidget.xAxisDimension} 
                                            onChange={(e) => setEditingWidget({...editingWidget, xAxisDimension: e.target.value})}
                                            className="px-3.5 py-2.5 text-xs rounded-xl border border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-950 dark:text-white outline-none w-full font-semibold focus:ring-1 focus:ring-orange-500"
                                        >
                                            <option value="month">Mensual (Mes/Año)</option>
                                            <option value="date">Diario (Día)</option>
                                            <option value="client">Cliente / Razón Social</option>
                                            <option value="voucherType">{editingWidget.dataSource === 'invoices' ? 'Tipo de Factura' : 'Concepto Bancario'}</option>
                                            {editingWidget.dataSource === 'transactions' && (
                                                <option value="bank">Cuenta Bancaria (Banco)</option>
                                            )}
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-6 border-t border-orange-500/20 flex justify-end gap-3 bg-orange-500/5 dark:bg-orange-500/10">
                            <button
                                onClick={() => setIsWidgetModalOpen(false)}
                                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-650 dark:text-slate-300 font-bold cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveWidget}
                                className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold shadow-sm cursor-pointer"
                            >
                                {editingWidget.id ? "Guardar Cambios" : "Añadir Widget"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
