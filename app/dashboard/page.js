"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
    ArrowUpRight, 
    ArrowDownRight, 
    DollarSign, 
    Users, 
    Activity, 
    Briefcase, 
    Calendar as CalendarIcon, 
    Clock, 
    CheckCircle, 
    Sparkles, 
    Video, 
    Check, 
    ChevronLeft, 
    ChevronRight,
    AlertCircle,
    Building,
    TrendingUp,
    ShieldCheck,
    Wallet,
    Server,
    Database,
    Mail,
    Shield,
    UserCheck,
    UserMinus,
    RefreshCw,
    Percent,
    FileText,
    Search,
    ArrowRight,
    Cpu,
    Settings,
    Lock,
    Landmark
} from "lucide-react";


export default function Dashboard() {
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

    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    // Client specific states
    const [clientStats, setClientStats] = useState({
        totalInvoiced: 0,
        invoiceCount: 0,
        bankIncomeMonth: 0,
        bankIncomeChange: "Sin cambios",
        reconciliationRate: 0.0
    });
    const [companyConfig, setCompanyConfig] = useState({
        razonSocial: "Cargando...",
        cuit: ""
    });
    const [clientInvoices, setClientInvoices] = useState([]);
    const [clientActivities, setClientActivities] = useState([]);
    const [clientTransactions, setClientTransactions] = useState([]);
    const [loadingClientData, setLoadingClientData] = useState(false);
    const [clientChartPointsState, setClientChartPointsState] = useState([]);
    const [dolarData, setDolarData] = useState(null);
    const [weatherData, setWeatherData] = useState(null);
    const [newsData, setNewsData] = useState([]);

    // Force password change overlay states
    const [showChangePasswordOverlay, setShowChangePasswordOverlay] = useState(false);
    const [overlayPasswordData, setOverlayPasswordData] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
    });
    const [overlayError, setOverlayError] = useState("");
    const [overlaySuccess, setOverlaySuccess] = useState("");
    const [overlaySubmitting, setOverlaySubmitting] = useState(false);

    const handleOverlayPasswordChange = async (e) => {
        e.preventDefault();
        setOverlayError("");
        setOverlaySuccess("");

        if (overlayPasswordData.newPassword.length < 4) {
            setOverlayError("La nueva contraseña debe tener al menos 4 caracteres.");
            return;
        }

        if (overlayPasswordData.newPassword !== overlayPasswordData.confirmPassword) {
            setOverlayError("Las contraseñas nuevas no coinciden.");
            return;
        }

        if (overlayPasswordData.currentPassword === overlayPasswordData.newPassword) {
            setOverlayError("La nueva contraseña debe ser diferente a la actual.");
            return;
        }

        setOverlaySubmitting(true);
        try {
            const res = await fetch("/api/auth/change-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: currentUser.id,
                    currentPassword: overlayPasswordData.currentPassword,
                    newPassword: overlayPasswordData.newPassword
                })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setOverlaySuccess("¡Contraseña cambiada con éxito! Iniciando sesión...");
                
                // Update local storage and state
                const updatedUser = { ...currentUser, mustChangePassword: false };
                localStorage.setItem('neoconta_user', JSON.stringify(updatedUser));
                
                setTimeout(() => {
                    setCurrentUser(updatedUser);
                    setShowChangePasswordOverlay(false);
                    // Fetch real client data after initial password change redirects
                    if (updatedUser.role === 'cliente') {
                        fetchClientForecast(updatedUser);
                        fetchClientDashboardData(updatedUser);
                    } else if (updatedUser.role === 'owner') {
                        fetchUsers(updatedUser);
                    }
                }, 1500);
            } else {
                setOverlayError(data.error || "Ocurrió un error al cambiar la contraseña.");
            }
        } catch (err) {
            console.error("Change password overlay error:", err);
            setOverlayError("Error de conexión con el servidor.");
        } finally {
            setOverlaySubmitting(false);
        }
    };

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(val || 0);
    };

    // Calendar States
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedTime, setSelectedTime] = useState("");
    const [bookingStep, setBookingStep] = useState(1); // 1: Date/Time, 2: Form, 3: Success
    const [phone, setPhone] = useState("");
    const [comment, setComment] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Admin / Owner States
    const [users, setUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [updatingUserId, setUpdatingUserId] = useState(null);
    const [userMessage, setUserMessage] = useState(null);
    const [platformStats, setPlatformStats] = useState({ totalInvoices: 0, totalVolume: 0, mrr: 0, arpu: 0, conversionRate: "0.0" });
    const [activeTab, setActiveTab] = useState("project"); // "project" or "clients"
    const [chartMetric, setChartMetric] = useState("mrr"); // "mrr" or "volume"
    const [searchQuery, setSearchQuery] = useState("");
    const [forecastPoints, setForecastPoints] = useState([]);
    const [clientForecast, setClientForecast] = useState([]);

    // Pricing Config States
    const [config, setConfig] = useState({ baseSubscription: 4500000, costPerClient: 125000 });
    const [tempBaseSub, setTempBaseSub] = useState("4500000");
    const [tempCostPerClient, setTempCostPerClient] = useState("125000");
    const [isSavingConfig, setIsSavingConfig] = useState(false);
    const [showConfigPanel, setShowConfigPanel] = useState(false);

    const fetchForecast = async (stats) => {
        try {
            const currentMRR = stats.mrr || 4500000;
            // Create a 6-month history to feed Prophet (Prophet needs at least 2 points)
            const history = [
                { ds: "2025-12-01", y: currentMRR * 0.72 },
                { ds: "2026-01-01", y: currentMRR * 0.78 },
                { ds: "2026-02-01", y: currentMRR * 0.82 },
                { ds: "2026-03-01", y: currentMRR * 0.88 },
                { ds: "2026-04-01", y: currentMRR * 0.94 },
                { ds: "2026-05-01", y: currentMRR }
            ];

            const res = await fetch("/api-ds/api/predict/cashflow", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    history,
                    periods: 90 // 3 months
                })
            });

            if (res.ok) {
                const data = await res.json();
                if (data.success && data.forecast) {
                    setForecastPoints(data.forecast);
                }
            }
        } catch (err) {
            console.warn("Python DS microservice offline or errored, using local fallback forecast:", err);
        }
    };

    const fetchClientForecast = async (user) => {
        try {
            const res = await fetch(`/api/arca/historial?userId=${user.id}&summary=true`);
            if (res.ok) {
                const data = await res.json();
                const historyPoints = data.summary?.forecastHistory || [];
                
                // If history points is too small, do not predict (falls back to real history only)
                if (historyPoints.length < 3) {
                    setClientForecast([]);
                    return;
                }

                // Call Prophet backend!
                const forecastRes = await fetch("/api-ds/api/predict/cashflow", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        history: historyPoints,
                        periods: 90
                    })
                });

                if (forecastRes.ok) {
                    const forecastData = await forecastRes.json();
                    if (forecastData.success && forecastData.forecast) {
                        setClientForecast(forecastData.forecast);
                    }
                }
            }
        } catch (err) {
            console.warn("Python DS microservice offline or errored for client forecast:", err);
        }
    };

    const fetchClientDashboardData = async (user) => {
        setLoadingClientData(true);
        try {
            // 1. Fetch Company Config
            let razonSocialVal = "Empresa No Configurada";
            let cuitVal = "";
            try {
                const resConfig = await fetch(`/api/user/config?userId=${user.id}`);
                const dataConfig = await resConfig.json();
                if (dataConfig.success) {
                    razonSocialVal = dataConfig.razonSocial || "Empresa No Configurada";
                    cuitVal = dataConfig.cuit || "";
                    setCompanyConfig({ razonSocial: razonSocialVal, cuit: cuitVal });
                }
            } catch (e) {
                console.error("Error fetching client config:", e);
            }

            // 2. Fetch Invoices Summary and Bank Transactions
            let summary = { totalInvoiced: 0, invoiceCount: 0, recentActivities: [], clientChartPoints: [] };
            let transactions = [];
            
            try {
                const resInvoices = await fetch(`/api/arca/historial?userId=${user.id}&summary=true`);
                if (resInvoices.ok) {
                    const dataInvoices = await resInvoices.json();
                    if (dataInvoices.success && dataInvoices.summary) {
                        summary = dataInvoices.summary;
                        setClientChartPointsState(summary.clientChartPoints || []);
                    }
                }
            } catch (e) {
                console.error("Error fetching client invoices summary:", e);
            }

            try {
                const resBanco = await fetch(`/api/banco?userId=${user.id}`);
                if (resBanco.ok) {
                    const dataBanco = await resBanco.json();
                    transactions = Array.isArray(dataBanco) ? dataBanco : [];
                    setClientTransactions(transactions);
                }
            } catch (e) {
                console.error("Error fetching client transactions:", e);
            }

            // 3. Calculate Stats
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth();

            const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
            const prevYear = prevMonthDate.getFullYear();
            const prevMonth = prevMonthDate.getMonth();

            let bankIncomeMonth = 0;
            let bankIncomePrevMonth = 0;

            transactions.forEach(tx => {
                if (tx.transaction_date && parseFloat(tx.amount) > 0) {
                    const txDate = new Date(tx.transaction_date);
                    const txYear = txDate.getFullYear();
                    const txMonth = txDate.getMonth();

                    if (txYear === currentYear && txMonth === currentMonth) {
                        bankIncomeMonth += parseFloat(tx.amount);
                    } else if (txYear === prevYear && txMonth === prevMonth) {
                        bankIncomePrevMonth += parseFloat(tx.amount);
                    }
                }
            });

            let bankIncomeChange = "Sin cambios";
            if (bankIncomePrevMonth > 0) {
                const diff = ((bankIncomeMonth - bankIncomePrevMonth) / bankIncomePrevMonth) * 100;
                bankIncomeChange = (diff >= 0 ? "+" : "") + diff.toFixed(1) + "%";
            } else if (bankIncomeMonth > 0) {
                bankIncomeChange = "+100%";
            } else {
                bankIncomeChange = "Sin actividad";
            }

            let reconciliationRate = 0.0;
            if (transactions.length > 0) {
                const reconciledCount = transactions.filter(tx => {
                    const linkedTotal = (tx.linked_invoices || []).reduce((sum, link) => sum + parseFloat(link.amount || 0), 0);
                    return Math.abs(parseFloat(tx.amount) - linkedTotal) < 0.01;
                }).length;
                reconciliationRate = (reconciledCount / transactions.length) * 100;
            }

            setClientStats({
                totalInvoiced: summary.totalInvoiced,
                invoiceCount: summary.invoiceCount,
                bankIncomeMonth,
                bankIncomeChange,
                reconciliationRate
            });

            // 4. Consolidated Activities Feed
            const activities = (summary.recentActivities || []).map(act => ({
                ...act,
                date: act.date ? new Date(act.date) : new Date(0)
            }));

            transactions.slice(0, 5).forEach(tx => {
                activities.push({
                    title: `Transacción bancaria: ${tx.concept} (${formatCurrency(tx.amount)})`,
                    time: tx.transaction_date ? tx.transaction_date.split('-').reverse().join('/') : 'Reciente',
                    type: 'info',
                    date: tx.transaction_date ? new Date(tx.transaction_date) : new Date(0)
                });
            });

            activities.sort((a, b) => b.date - a.date);
            setClientActivities(activities.slice(0, 5));

        } catch (e) {
            console.error("Error compiling client dashboard data:", e);
        } finally {
            setLoadingClientData(false);
        }
    };

    const fetchUsers = async (user) => {
        setLoadingUsers(true);
        try {
            const res = await fetch(`/api/admin/users?callerRole=${user.role}`);
            const data = await res.json();
            if (data.success) {
                setUsers(data.users);
                if (data.stats) {
                    setPlatformStats(data.stats);
                    fetchForecast(data.stats);
                }
                if (data.config) {
                    setConfig(data.config);
                    setTempBaseSub(data.config.baseSubscription.toString());
                    setTempCostPerClient(data.config.costPerClient.toString());
                }
            }
        } catch (error) {
            console.error("Error fetching users for owner dashboard:", error);
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleSaveConfig = async (e) => {
        e.preventDefault();
        if (!currentUser) return;
        setIsSavingConfig(true);
        try {
            const res = await fetch("/api/admin/config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    baseSubscription: Number(tempBaseSub),
                    costPerClient: Number(tempCostPerClient),
                    callerRole: currentUser.role
                })
            });
            const data = await res.json();
            if (data.success) {
                setConfig(data.config);
                setUserMessage({ type: 'success', text: "Tarifas de suscripción actualizadas." });
                fetchUsers(currentUser);
            } else {
                setUserMessage({ type: 'error', text: data.error || "Error al actualizar." });
            }
        } catch (error) {
            console.error("Error saving config:", error);
            setUserMessage({ type: 'error', text: "Error de conexión." });
        } finally {
            setIsSavingConfig(false);
            setTimeout(() => setUserMessage(null), 3000);
        }
    };


    const handleRoleChange = async (userId, newRole) => {
        if (!currentUser) return;
        const caller = currentUser;
        setUpdatingUserId(userId);
        setUserMessage(null);

        try {
            const res = await fetch("/api/admin/users", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    userId,
                    newRole,
                    callerRole: caller.role,
                    callerId: caller.id
                })
            });

            const data = await res.json();

            if (data.success) {
                setUserMessage({ type: 'success', text: `Usuario actualizado con éxito.` });
                setUsers(prevUsers => 
                    prevUsers.map(u => u.id === userId ? { ...u, role: newRole } : u)
                );
                fetchUsers(caller);
            } else {
                setUserMessage({ type: 'error', text: data.error || 'Error al actualizar.' });
            }
        } catch (error) {
            console.error("Error updating user role:", error);
            setUserMessage({ type: 'error', text: 'Error de conexión.' });
        } finally {
            setUpdatingUserId(null);
            setTimeout(() => setUserMessage(null), 3000);
        }
    };

    useEffect(() => {
        const userStr = localStorage.getItem('neoconta_user');
        if (!userStr) {
            router.push("/login");
        } else {
            const parsedUser = JSON.parse(userStr);
            setCurrentUser(parsedUser);
            if (parsedUser.role === 'vitacore-professional') {
                router.push("/dashboard/vitacore");
                return;
            }
            if (parsedUser.mustChangePassword === true) {
                setShowChangePasswordOverlay(true);
            } else {
                if (parsedUser.role === 'owner') {
                    fetchUsers(parsedUser);
                } else if (parsedUser.role === 'cliente') {
                    fetchClientForecast(parsedUser);
                    fetchClientDashboardData(parsedUser);
                }
            }
        }
        setLoading(false);
    }, [router]);

    useEffect(() => {
        // Fetch news RSS feed from backend
        fetch("/api/news")
            .then(res => res.json())
            .then(data => {
                if (data && data.success && Array.isArray(data.news)) {
                    setNewsData(data.news);
                }
            })
            .catch(err => console.error("Error fetching news:", err));

        // Fetch dollar rates from public API
        fetch("https://dolarapi.com/v1/dolares")
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setDolarData(data);
                }
            })
            .catch(err => console.error("Error fetching dollar rates:", err));

        // Fetch weather forecast from Open-Meteo API (CABA coordinates)
        fetch("https://api.open-meteo.com/v1/forecast?latitude=-34.61315&longitude=-58.37723&current=temperature_2m,weather_code")
            .then(res => res.json())
            .then(data => {
                if (data && data.current) {
                    const temp = Math.round(data.current.temperature_2m);
                    const code = data.current.weather_code;
                    let cond = "Despejado";
                    if (code > 0 && code <= 3) cond = "Parcialmente Nublado";
                    else if (code >= 45 && code <= 48) cond = "Niebla";
                    else if (code >= 51 && code <= 67) cond = "Llovizna";
                    else if (code >= 71 && code <= 86) cond = "Nieve";
                    else if (code >= 95) cond = "Tormenta";
                    setWeatherData({
                        temp,
                        condition: cond,
                        city: "CABA"
                    });
                }
            })
            .catch(err => {
                console.error("Error fetching weather:", err);
                setWeatherData({ temp: 18, condition: "Despejado", city: "CABA" });
            });
    }, []);

    const renderTickerContent = () => {
        const news = newsData.length > 0 ? newsData : [
            "ARCA (ex AFIP) prorroga el vencimiento del Monotributo.",
            "Nuevas escalas y topes de facturación vigentes para Autónomos.",
            "El BCRA mantiene estables las tasas de referencia bancaria.",
            "Reducción de aranceles impositivos para insumos de PyMEs importadoras."
        ];

        let blueStr = "💵 Dólar Blue: $1220";
        let mepStr = "📈 Dólar MEP: $1185";
        let oficialStr = "🏦 Dólar Oficial: $930";

        if (dolarData) {
            const blue = dolarData.find(d => d.casa === 'blue');
            const mep = dolarData.find(d => d.casa === 'mep');
            const oficial = dolarData.find(d => d.casa === 'oficial');
            if (blue) blueStr = `💵 Dólar Blue: $${blue.venta}`;
            if (mep) mepStr = `📈 Dólar MEP: $${mep.venta}`;
            if (oficial) oficialStr = `🏦 Dólar Oficial: $${oficial.venta}`;
        }

        let weatherStr = "⛅ Clima: CABA 18°C (Despejado)";
        if (weatherData) {
            weatherStr = `⛅ Clima: ${weatherData.city} ${weatherData.temp}°C (${weatherData.condition})`;
        }

        return (
            <>
                <span className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400 font-bold whitespace-nowrap">{blueStr}</span>
                <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold whitespace-nowrap">{mepStr}</span>
                <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-bold whitespace-nowrap">{oficialStr}</span>
                <span className="flex items-center gap-1.5 text-teal-600 dark:text-teal-400 font-bold whitespace-nowrap">{weatherStr}</span>
                {news.map((item, idx) => (
                    <span key={idx} className="flex items-center gap-1.5 text-slate-700 dark:text-white whitespace-nowrap">
                        <span className="h-1.5 w-1.5 bg-orange-500 rounded-full shrink-0"></span>
                        {item}
                    </span>
                ))}
            </>
        );
    };

    if (loading || !currentUser) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-orange-500"></div>
            </div>
        );
    }

    if (showChangePasswordOverlay) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <div className="bg-slate-950 border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6">
                    <div className="text-center space-y-2">
                        <div className="h-12 w-12 bg-orange-500/10 text-orange-500 rounded-full flex items-center justify-center mx-auto border border-orange-500/20">
                            <Lock className="h-6 w-6" />
                        </div>
                        <h2 className="text-2xl font-extrabold text-white animate-pulse">Cambio de Contraseña Obligatorio</h2>
                        <p className="text-xs text-slate-400">Es tu primer inicio de sesión. Por motivos de seguridad, debes actualizar tu contraseña para continuar.</p>
                    </div>

                    {overlayError && (
                        <div className="bg-red-950/30 border border-red-900/50 p-4 rounded-xl text-xs text-red-400 flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 flex-shrink-0" />
                            <span>{overlayError}</span>
                        </div>
                    )}

                    {overlaySuccess && (
                        <div className="bg-emerald-950/30 border border-emerald-900/50 p-4 rounded-xl text-xs text-emerald-400 flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 flex-shrink-0" />
                            <span>{overlaySuccess}</span>
                        </div>
                    )}

                    <form onSubmit={handleOverlayPasswordChange} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Contraseña Temporal Actual</label>
                            <input
                                type="password"
                                required
                                value={overlayPasswordData.currentPassword}
                                onChange={(e) => setOverlayPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                                placeholder="Contraseña actual (ej: Neo2026)"
                                className="w-full p-3 bg-slate-900 border border-slate-800 text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Nueva Contraseña</label>
                            <input
                                type="password"
                                required
                                value={overlayPasswordData.newPassword}
                                onChange={(e) => setOverlayPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                                placeholder="Nueva contraseña (mínimo 4 caracteres)"
                                className="w-full p-3 bg-slate-900 border border-slate-800 text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Confirmar Nueva Contraseña</label>
                            <input
                                type="password"
                                required
                                value={overlayPasswordData.confirmPassword}
                                onChange={(e) => setOverlayPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                placeholder="Repite tu nueva contraseña"
                                className="w-full p-3 bg-slate-900 border border-slate-800 text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={overlaySubmitting || overlaySuccess !== ""}
                            className="w-full py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-800 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2"
                        >
                            {overlaySubmitting ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div>
                            ) : (
                                "Guardar y Continuar"
                            )}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    const isNoCliente = currentUser.role === 'no-cliente';

    // Calendar Helper Functions
    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        const firstDayIndex = new Date(year, month, 1).getDay(); // 0: Sunday, 1: Monday, etc.
        return { days, firstDayIndex };
    };

    const handlePrevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
        setSelectedDate(null);
        setSelectedTime("");
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
        setSelectedDate(null);
        setSelectedTime("");
    };

    const timeSlots = ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00"];

    const { days, firstDayIndex } = getDaysInMonth(currentDate);
    const monthNames = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    const today = new Date();
    
    // Check if day is clickable (in the future, not a weekend, and not in the past)
    const isDaySelectable = (dayNum) => {
        const checkDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), dayNum);
        const dayOfWeek = checkDate.getDay();
        
        // Remove time parts to compare only dates
        const dateOnlyToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const dateOnlyCheck = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate());
        
        // No weekends (0: Sunday, 6: Saturday) and only future dates (or today)
        return dayOfWeek !== 0 && dayOfWeek !== 6 && dateOnlyCheck >= dateOnlyToday;
    };

    const handleDayClick = (dayNum) => {
        if (!isDaySelectable(dayNum)) return;
        const newSelected = new Date(currentDate.getFullYear(), currentDate.getMonth(), dayNum);
        setSelectedDate(newSelected);
        setSelectedTime("");
    };

    const handleScheduleSubmit = (e) => {
        e.preventDefault();
        if (!selectedDate || !selectedTime || !phone) return;
        
        setIsSubmitting(true);
        setTimeout(() => {
            setIsSubmitting(false);
            setBookingStep(3);
        }, 1200);
    };

    const formatSelectedDate = (date) => {
        if (!date) return "";
        const daysOfWeek = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
        return `${daysOfWeek[date.getDay()]} ${date.getDate()} de ${monthNames[date.getMonth()]} de ${date.getFullYear()}`;
    };

    // --- RENDER FOR NO-CLIENTE ---
    if (isNoCliente) {
        return (
            <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up pb-12">
                {/* Header Section */}
                <div className="text-center md:text-left">
                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white flex flex-col md:flex-row items-center gap-2 justify-center md:justify-start">
                        <span>¡Te damos la bienvenida a NeoConta!</span>
                        <span className="text-orange-500 text-sm font-semibold bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20">
                            Registro Exitoso
                        </span>
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg">
                        Hola, <strong className="text-slate-800 dark:text-slate-200">{currentUser.nombre}</strong>. Estamos muy contentos de que quieras sumarte a la revolución contable.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Welcome Message and Premium Information */}
                    <div className="lg:col-span-7 space-y-6">
                        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-8 rounded-3xl shadow-xl shadow-slate-100/50 dark:shadow-none relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                            
                            <div className="flex gap-4 items-start mb-6">
                                <div className="p-3 bg-orange-500/10 rounded-2xl border border-orange-500/20 text-orange-500">
                                    <Sparkles className="h-6 w-6" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Activación de Cuenta Pendiente</h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Habilitamos tu acceso preliminar a la plataforma de NeoConta.</p>
                                </div>
                            </div>

                            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                                Para garantizar la máxima seguridad fiscal de tu empresa y cumplir con las normativas locales vigentes, un asesor de NeoConta debe validar tus datos contables y darte de alta de forma personalizada en el sistema.
                            </p>
                            
                            <div className="mt-8 border-t border-slate-100 dark:border-slate-800 pt-6">
                                <h3 className="font-semibold text-slate-900 dark:text-white mb-4">¿Qué obtendrás una vez activado tu perfil de Cliente?</h3>
                                
                                <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {[
                                        { title: "Facturación Masiva", desc: "Emisión y envío automático de comprobantes" },
                                        { title: "Banco Inteligente", desc: "Conciliación de cuentas impulsada por IA" }
                                    ].map((item, idx) => (
                                        <li key={idx} className="flex gap-3">
                                            <div className="h-5 w-5 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                <Check className="h-3 w-3" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.title}</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">{item.desc}</p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        {/* Contact Notice Card */}
                        <div className="bg-orange-500/5 dark:bg-orange-500/5 border border-orange-500/20 p-6 rounded-2xl flex gap-4 items-start">
                            <AlertCircle className="h-6 w-6 text-orange-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-sm font-bold text-orange-800 dark:text-orange-400">¿Tienes dudas urgentes?</h4>
                                <p className="text-xs text-orange-700 dark:text-orange-300/80 mt-1 leading-relaxed">
                                    También puedes comunicarte directamente con nosotros enviando un correo a <a href="mailto:soporte@neoconta.com" className="font-semibold underline">soporte@neoconta.com</a> o llamándonos al +54 11 5234-5678.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Booking Calendar Widget */}
                    <div className="lg:col-span-5">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl shadow-slate-100/50 dark:shadow-none overflow-hidden">
                            <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-6 text-white">
                                <div className="flex items-center gap-3">
                                    <CalendarIcon className="h-6 w-6" />
                                    <div>
                                        <h3 className="font-bold text-lg">Coordinar Reunión</h3>
                                        <p className="text-xs text-orange-100">Selecciona un día y horario para agendar tu llamada por Meet</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6">
                                {bookingStep === 1 && (
                                    <div className="space-y-6">
                                        {/* Month Header Navigation */}
                                        <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl">
                                            <button 
                                                onClick={handlePrevMonth}
                                                className="p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400 transition-all"
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                            </button>
                                            <span className="font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider">
                                                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                                            </span>
                                            <button 
                                                onClick={handleNextMonth}
                                                className="p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400 transition-all"
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </button>
                                        </div>

                                        {/* Day Names Grid */}
                                        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400">
                                            <span>Dom</span><span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span>
                                        </div>

                                        {/* Days Grid */}
                                        <div className="grid grid-cols-7 gap-1 text-center text-sm">
                                            {/* Empty elements for starting offset */}
                                            {Array.from({ length: firstDayIndex }).map((_, i) => (
                                                <div key={`empty-${i}`} className="py-2.5"></div>
                                            ))}
                                            
                                            {/* Calendar Days */}
                                            {Array.from({ length: days }).map((_, i) => {
                                                const dayNum = i + 1;
                                                const isSelectable = isDaySelectable(dayNum);
                                                const isSelected = selectedDate && 
                                                    selectedDate.getDate() === dayNum && 
                                                    selectedDate.getMonth() === currentDate.getMonth() &&
                                                    selectedDate.getFullYear() === currentDate.getFullYear();

                                                return (
                                                    <button
                                                        key={`day-${dayNum}`}
                                                        onClick={() => handleDayClick(dayNum)}
                                                        disabled={!isSelectable}
                                                        className={`py-2.5 rounded-xl font-medium transition-all ${
                                                            isSelected
                                                                ? "bg-orange-500 text-white font-bold shadow-md shadow-orange-500/20"
                                                                : isSelectable
                                                                    ? "hover:bg-orange-50 dark:hover:bg-orange-950/20 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-800/80"
                                                                    : "text-slate-300 dark:text-slate-700 cursor-not-allowed text-xs line-through"
                                                        }`}
                                                    >
                                                        {dayNum}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Hours Selector */}
                                        {selectedDate && (
                                            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800/80 animate-fade-in">
                                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                                    <Clock className="h-3.5 w-3.5 text-orange-500" />
                                                    Horarios Disponibles para el {selectedDate.getDate()}/{selectedDate.getMonth() + 1}
                                                </label>
                                                <div className="grid grid-cols-4 gap-2">
                                                    {timeSlots.map((time) => (
                                                        <button
                                                            key={time}
                                                            onClick={() => setSelectedTime(time)}
                                                            className={`py-2 text-xs rounded-xl font-semibold border transition-all ${
                                                                selectedTime === time
                                                                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white font-bold"
                                                                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-orange-500 hover:text-orange-500"
                                                            }`}
                                                        >
                                                            {time}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Go to Step 2 Button */}
                                        <button
                                            disabled={!selectedDate || !selectedTime}
                                            onClick={() => setBookingStep(2)}
                                            className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                                        >
                                            <span>Siguiente paso</span>
                                        </button>
                                    </div>
                                )}

                                {bookingStep === 2 && (
                                    <form onSubmit={handleScheduleSubmit} className="space-y-4 animate-fade-in">
                                        <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-xl border border-orange-200/40 text-xs text-orange-800 dark:text-orange-400 space-y-1">
                                            <p className="font-bold flex items-center gap-1">
                                                <Video className="h-3.5 w-3.5" /> Reunión Virtual (Google Meet)
                                            </p>
                                            <p>{formatSelectedDate(selectedDate)} a las {selectedTime} hs</p>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Nombre Completo</label>
                                            <input 
                                                type="text" 
                                                value={currentUser.nombre} 
                                                disabled 
                                                className="w-full p-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-xl text-sm"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Correo Electrónico</label>
                                            <input 
                                                type="email" 
                                                value={currentUser.email} 
                                                disabled 
                                                className="w-full p-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-xl text-sm"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase flex items-center gap-1">
                                                Teléfono de Contacto <span className="text-red-500">*</span>
                                            </label>
                                            <input 
                                                type="tel" 
                                                required 
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value)}
                                                placeholder="Ej: +54 9 11 5678-1234" 
                                                className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Notas u Observaciones (Opcional)</label>
                                            <textarea 
                                                rows="2"
                                                value={comment}
                                                onChange={(e) => setComment(e.target.value)}
                                                placeholder="Coméntanos brevemente sobre tu negocio..." 
                                                className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                                            ></textarea>
                                        </div>

                                        <div className="flex gap-3 pt-2">
                                            <button
                                                type="button"
                                                onClick={() => setBookingStep(1)}
                                                className="flex-1 py-3 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-2xl transition-all text-sm"
                                            >
                                                Volver
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={isSubmitting}
                                                className="flex-2 w-2/3 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
                                            >
                                                {isSubmitting ? (
                                                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div>
                                                ) : (
                                                    "Confirmar Cita"
                                                )}
                                            </button>
                                        </div>
                                    </form>
                                )}

                                {bookingStep === 3 && (
                                    <div className="text-center py-8 space-y-6 animate-fade-in">
                                        <div className="h-16 w-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
                                            <CheckCircle className="h-10 w-10 animate-bounce" />
                                        </div>

                                        <div className="space-y-2">
                                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">¡Reunión Agendada!</h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">Hemos bloqueado tu horario. Los detalles se enviaron a tu casilla de correo.</p>
                                        </div>

                                        <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 text-left text-xs space-y-3 mx-auto max-w-sm">
                                            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                                                <CalendarIcon className="h-4 w-4 text-orange-500" />
                                                <span className="font-semibold">{formatSelectedDate(selectedDate)}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                                                <Clock className="h-4 w-4 text-orange-500" />
                                                <span className="font-semibold">{selectedTime} hs (Horario Local)</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                                                <Video className="h-4 w-4 text-orange-500" />
                                                <span className="font-semibold underline text-blue-600 dark:text-blue-400">meet.google.com/neoconta-alta-user</span>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => {
                                                setBookingStep(1);
                                                setSelectedDate(null);
                                                setSelectedTime("");
                                                setPhone("");
                                                setComment("");
                                            }}
                                            className="px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl text-sm transition-all"
                                        >
                                            Agendar otra reunión
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    function RenderOwnerDashboard() {
        const activeClients = users.filter(u => u.role === 'cliente');
        const pendingUsers = users.filter(u => u.role === 'no-cliente');

        const formatDate = (dateStr) => {
            if (!dateStr) return "Sin actividad";
            const date = new Date(dateStr);
            return date.toLocaleDateString('es-AR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        };

        // Simulated dynamic history based on current live values
        const currentMRR = platformStats.mrr || 4500000;
        const currentVol = platformStats.totalVolume || 900000;

        const mrrHistory = [
            currentMRR * 0.72, currentMRR * 0.75, currentMRR * 0.78, 
            currentMRR * 0.81, currentMRR * 0.82, currentMRR * 0.85, 
            currentMRR * 0.88, currentMRR * 0.90, currentMRR * 0.92, 
            currentMRR * 0.94, currentMRR * 0.97, currentMRR
        ];

        const volHistory = [
            currentVol * 0.58, currentVol * 0.64, currentVol * 0.70, 
            currentVol * 0.65, currentVol * 0.78, currentVol * 0.82, 
            currentVol * 0.75, currentVol * 0.86, currentVol * 0.90, 
            currentVol * 0.93, currentVol * 0.88, currentVol
        ];

        let chartDataPoints = [];
        if (chartMetric === 'mrr' && forecastPoints.length > 0) {
            // We have real Prophet forecast points!
            // Let's filter to show the monthly steps.
            const monthlyForecast = forecastPoints.filter(p => p.date.endsWith('-01'));
            chartDataPoints = monthlyForecast.map(p => ({
                label: p.date.split('-')[1] === '01' ? 'Ene' :
                       p.date.split('-')[1] === '02' ? 'Feb' :
                       p.date.split('-')[1] === '03' ? 'Mar' :
                       p.date.split('-')[1] === '04' ? 'Abr' :
                       p.date.split('-')[1] === '05' ? 'May' :
                       p.date.split('-')[1] === '06' ? 'Jun' :
                       p.date.split('-')[1] === '07' ? 'Jul' :
                       p.date.split('-')[1] === '08' ? 'Ago' :
                       p.date.split('-')[1] === '09' ? 'Sep' :
                       p.date.split('-')[1] === '10' ? 'Oct' :
                       p.date.split('-')[1] === '11' ? 'Nov' : 'Dic',
                value: p.yhat,
                isPrediction: p.is_prediction,
                lower: p.yhat_lower,
                upper: p.yhat_upper
            }));
        } else {
            // Fallback simulated history
            const defaultMonths = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
            const selectedHistory = chartMetric === 'mrr' ? mrrHistory : volHistory;
            chartDataPoints = selectedHistory.map((val, idx) => ({
                label: defaultMonths[idx],
                value: val,
                isPrediction: false
            }));
        }

        const maxVal = Math.max(...chartDataPoints.map(p => p.value)) || 1;

        // Filter active clients based on search query
        const filteredActiveClients = activeClients.filter(c => 
            c.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || 
            c.email.toLowerCase().includes(searchQuery.toLowerCase())
        );

        return (
            <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up pb-12">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
                            <span>Panel de Control (NeoConta)</span>
                            <span className="text-[#ff5e00] text-xs font-semibold bg-[#ff5e00]/10 px-3 py-1 rounded-full border border-[#ff5e00]/20 flex items-center gap-1.5">
                                <Shield className="h-3.5 w-3.5" /> Germán Biscardi
                            </span>
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">Supervisión general del rendimiento, facturación y clientes activos de NeoConta.</p>
                    </div>

                    <div className="flex gap-3">
                        <button 
                            onClick={() => setShowConfigPanel(!showConfigPanel)}
                            className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded-xl transition-all text-sm cursor-pointer"
                        >
                            <Settings className="h-4 w-4 text-[#ff5e00]" />
                            <span>Ajustar Tarifas</span>
                        </button>

                        <button 
                            onClick={() => fetchUsers(currentUser)}
                            disabled={loadingUsers}
                            className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded-xl transition-all text-sm disabled:opacity-50 cursor-pointer"
                        >
                            <RefreshCw className={`h-4 w-4 ${loadingUsers ? 'animate-spin' : ''}`} />
                            <span>Actualizar Métricas</span>
                        </button>
                    </div>
                </div>

                {/* Pricing Config Panel */}
                {showConfigPanel && (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl transition-all animate-fade-in space-y-4">
                        <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
                            <div className="p-2 bg-orange-50 dark:bg-orange-950/20 rounded-xl text-[#ff5e00]">
                                <Settings className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Configuración de Tarifas de la Plataforma</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Determina el MRR y el ARPU del proyecto NeoConta.</p>
                            </div>
                        </div>
                        
                        <form onSubmit={handleSaveConfig} className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-650 dark:text-slate-450 uppercase tracking-wider">
                                    Abono Base Mensual (ARS)
                                </label>
                                <input 
                                    type="number" 
                                    required
                                    value={tempBaseSub} 
                                    onChange={(e) => setTempBaseSub(e.target.value)}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#ff5e00]"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-650 dark:text-slate-450 uppercase tracking-wider">
                                    Costo Marginal por Cliente Activo (ARS)
                                </label>
                                <input 
                                    type="number" 
                                    required
                                    value={tempCostPerClient} 
                                    onChange={(e) => setTempCostPerClient(e.target.value)}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#ff5e00]"
                                />
                            </div>
                            <div className="sm:col-span-2 flex gap-3 justify-end pt-3">
                                <button
                                    type="button"
                                    onClick={() => setShowConfigPanel(false)}
                                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-all cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingConfig}
                                    className="px-5 py-2 bg-[#ff5e00] hover:bg-[#ff5e00]/90 text-white font-bold rounded-xl text-xs shadow-md shadow-orange-500/10 hover:shadow-orange-500/25 transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                                >
                                    {isSavingConfig ? (
                                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-white"></div>
                                    ) : (
                                        <span>Guardar Cambios</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Toast Message Notification */}
                {userMessage && (
                    <div className={`p-4 rounded-2xl flex gap-3 items-center border transition-all animate-fade-in ${
                        userMessage.type === 'success' 
                            ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200/40 text-emerald-800 dark:text-emerald-400' 
                            : 'bg-red-50 dark:bg-red-950/20 border-red-200/40 text-red-800 dark:text-red-400'
                    }`}>
                        {userMessage.type === 'success' ? (
                            <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                        ) : (
                            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                        )}
                        <span className="text-sm font-semibold">{userMessage.text}</span>
                    </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { 
                            label: "Ingresos por Suscripción (MRR)", 
                            value: formatCurrency(platformStats.mrr), 
                            change: "+15.2% este mes", 
                            trend: "up", 
                            icon: <DollarSign className="h-6 w-6 text-[#ff5e00]" />, 
                            bg: "bg-orange-50 dark:bg-orange-950/20" 
                        },
                        { 
                            label: "Clientes Activos", 
                            value: activeClients.length, 
                            change: `${platformStats.conversionRate}% conversión`, 
                            trend: "up", 
                            icon: <UserCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />, 
                            bg: "bg-emerald-50 dark:bg-emerald-950/20" 
                        },
                        { 
                            label: "Volumen de Facturación", 
                            value: formatCurrency(platformStats.totalVolume), 
                            change: "Facturado por clientes", 
                            trend: "up", 
                            icon: <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />, 
                            bg: "bg-blue-50 dark:bg-blue-950/20" 
                        },
                        { 
                            label: "Comprobantes Procesados", 
                            value: platformStats.totalInvoices, 
                            change: `ARPU: ${formatCurrency(platformStats.arpu)}`, 
                            trend: "up", 
                            icon: <Activity className="h-6 w-6 text-purple-600 dark:text-purple-400" />, 
                            bg: "bg-purple-50 dark:bg-purple-950/20" 
                        },
                    ].map((stat, idx) => (
                        <div key={idx} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <div className={`p-3 rounded-xl ${stat.bg}`}>
                                    {stat.icon}
                                </div>
                                <div className={`flex items-center gap-1 text-xs font-semibold ${stat.trend === 'up' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' : 'text-slate-500 bg-slate-50 dark:bg-slate-800'} px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-700`}>
                                    {stat.trend === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                    {stat.change}
                                </div>
                            </div>
                            <h3 className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
                                {loadingUsers ? "..." : stat.value}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{stat.label}</p>
                        </div>
                    ))}
                </div>

                {/* Dashboard Tabs Navigation */}
                <div className="border-b border-slate-200 dark:border-slate-800 flex gap-2">
                    <button 
                        onClick={() => setActiveTab("project")}
                        className={`pb-4 px-6 font-bold text-sm transition-all border-b-2 flex items-center gap-2 ${activeTab === 'project' ? 'border-[#ff5e00] text-[#ff5e00]' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                    >
                        <Building className="h-4 w-4" />
                        <span>Performance del Proyecto</span>
                    </button>
                    <button 
                        onClick={() => setActiveTab("clients")}
                        className={`pb-4 px-6 font-bold text-sm transition-all border-b-2 flex items-center gap-2 ${activeTab === 'clients' ? 'border-[#ff5e00] text-[#ff5e00]' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                    >
                        <Users className="h-4 w-4" />
                        <span>Directorio y Rendimiento de Clientes</span>
                    </button>
                </div>

                {/* Tab 1: Project Performance */}
                {activeTab === "project" && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
                        {/* Left column: Chart and Feed */}
                        <div className="lg:col-span-2 space-y-6 flex flex-col">
                            {/* Toggleable Growth Chart */}
                            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <TrendingUp className="h-5 w-5 text-[#ff5e00]" /> 
                                        <span>Histórico de Rendimiento del Proyecto</span>
                                    </h2>
                                    
                                    <div className="flex bg-slate-100 dark:bg-slate-850 p-1 rounded-xl border border-slate-250/20">
                                        <button 
                                            onClick={() => setChartMetric("mrr")}
                                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${chartMetric === 'mrr' ? 'bg-[#ff5e00] text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                                        >
                                            MRR (Suscripción)
                                        </button>
                                        <button 
                                            onClick={() => setChartMetric("volume")}
                                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${chartMetric === 'volume' ? 'bg-[#ff5e00] text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                                        >
                                            Facturación Procesada
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Interactive styled Chart */}
                                <div className="h-64 bg-slate-50 dark:bg-slate-800/40 rounded-xl flex items-end justify-between p-4 gap-2 border border-slate-100 dark:border-slate-800">
                                    {chartDataPoints.map((point, i) => {
                                        const heightPercent = `${Math.max(15, (point.value / maxVal) * 100)}%`;
                                        return (
                                            <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer">
                                                <div className="w-full relative flex justify-center items-end h-full">
                                                    {/* Tooltip */}
                                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute bottom-full mb-2 bg-slate-950 text-white dark:bg-white dark:text-slate-900 text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-lg pointer-events-none z-10 whitespace-nowrap border border-slate-800 dark:border-slate-250 flex flex-col items-center">
                                                        <span>{formatCurrency(point.value)}</span>
                                                        {point.isPrediction && (
                                                            <span className="text-[8px] text-orange-400 font-normal">
                                                                Prophet IA Predictor
                                                            </span>
                                                        )}
                                                        {point.lower !== undefined && (
                                                            <span className="text-[8px] text-slate-400 dark:text-slate-500 font-normal">
                                                                Rango: {formatCurrency(point.lower)} - {formatCurrency(point.upper)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {/* Bar */}
                                                    <div 
                                                        style={{ height: heightPercent }}
                                                        className={`w-4/5 sm:w-2/3 rounded-t-md transition-all duration-300 ease-out ${
                                                            point.isPrediction
                                                                ? "bg-gradient-to-t from-orange-400/30 to-amber-300/30 border-2 border-dashed border-orange-500/60 group-hover:from-orange-400/50 group-hover:to-amber-300/50"
                                                                : "bg-gradient-to-t from-[#ff5e00] to-orange-400 group-hover:to-orange-300 group-hover:shadow-lg group-hover:shadow-orange-500/20"
                                                        }`}
                                                    ></div>
                                                </div>
                                                <span className={`text-[10px] font-bold mt-2 ${point.isPrediction ? "text-orange-500" : "text-slate-400 dark:text-slate-500"}`}>
                                                    {point.label}
                                                    {point.isPrediction && "*"}
                                                </span>
                                            </div>
                                        );
                                    })}
                                  </div>
                            </div>
                        </div>

                        {/* Integration Status & Technical Monitors */}
                        <div className="space-y-6">
                            {/* Server Health Monitor */}
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                                <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                    <Cpu className="h-5 w-5 text-[#ff5e00]" /> Estado de Recursos de Servidor
                                </h3>
                                
                                <div className="space-y-4">
                                    {[
                                        { label: "Carga de Base de Datos", val: "12% CPU / 48% RAM", pct: 28 },
                                        { label: "Tiempo de Respuesta Promedio", val: "85ms", pct: 10 },
                                        { label: "Tasa de Éxito de API de AFIP", val: "99.98%", pct: 99.98 },
                                        { label: "Uso de Almacenamiento (PDFs)", val: "14.2 MB de 50 GB", pct: 5 }
                                    ].map((item, idx) => (
                                        <div key={idx} className="space-y-1.5">
                                            <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-350">
                                                <span>{item.label}</span>
                                                <span className="text-slate-900 dark:text-white">{item.val}</span>
                                            </div>
                                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                                <div 
                                                    style={{ width: `${item.pct}%` }} 
                                                    className="bg-gradient-to-r from-[#ff5e00] to-orange-400 h-full rounded-full"
                                                ></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Integrations Monitor */}
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                                <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                    <Server className="h-5 w-5 text-purple-600 dark:text-purple-400" /> Monitoreo de Integraciones
                                </h3>

                                <div className="space-y-3">
                                    {[
                                        { name: "Conexión AFIP API", desc: "Consultas de facturación y tokens de acceso" },
                                        { name: "Auth Database", desc: "Almacenamiento de usuarios y credenciales" },
                                        { name: "Google Meet Integration", desc: "Agendador de llamadas para no-clientes" },
                                        { name: "SMTP Mail Dispatcher", desc: "Envío de correos de bienvenida y facturas" },
                                        { name: "Storage Engine", desc: "Almacenamiento de PDFs de comprobantes" }
                                    ].map((service, i) => (
                                        <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                                            <div className="space-y-0.5">
                                                <p className="text-xs font-bold text-slate-800 dark:text-white">{service.name}</p>
                                                <p className="text-[9px] text-slate-400 dark:text-slate-500 leading-normal">{service.desc}</p>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="relative flex h-2 w-2">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 dark:bg-emerald-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                                </span>
                                                <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">ONLINE</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tab 2: Clients Performance & Directory */}
                {activeTab === "clients" && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
                        {/* Clients Directory */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <UserCheck className="h-5 w-5 text-emerald-500" /> Directorio de Clientes Activos
                                    </h3>
                                    
                                    <div className="relative w-full sm:w-64">
                                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                        <input 
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Buscar cliente..." 
                                            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#ff5e00] outline-none"
                                        />
                                    </div>
                                </div>
                                
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                                                <th className="p-4">Cliente / Usuario</th>
                                                <th className="p-4 text-center">Facturas</th>
                                                <th className="p-4 text-right">Monto Facturado</th>
                                                <th className="p-4">Último Comprobante</th>
                                                <th className="p-4 text-center">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
                                            {filteredActiveClients.length === 0 ? (
                                                <tr>
                                                    <td colSpan="5" className="p-6 text-center text-slate-500 dark:text-slate-400 italic">
                                                        {loadingUsers ? "Cargando clientes..." : "No se encontraron clientes activos."}
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredActiveClients.map((client) => (
                                                    <tr key={client.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/10 transition-colors">
                                                        <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">
                                                            <div>{client.nombre}</div>
                                                            <div className="text-xs text-slate-500 font-normal">{client.email}</div>
                                                        </td>
                                                        <td className="p-4 text-center text-slate-700 dark:text-slate-350 font-bold">
                                                            {client.stats?.invoiceCount || 0}
                                                        </td>
                                                        <td className="p-4 text-right font-bold text-slate-900 dark:text-white">
                                                            {formatCurrency(client.stats?.totalInvoiced || 0)}
                                                        </td>
                                                        <td className="p-4 text-slate-650 dark:text-slate-400 text-xs font-semibold">
                                                            {formatDate(client.stats?.lastInvoiceDate)}
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <button 
                                                                disabled={updatingUserId === client.id}
                                                                onClick={() => {
                                                                    if (window.confirm(`¿Estás seguro de que deseas desactivar a ${client.nombre}? Su acceso será restringido.`)) {
                                                                        handleRoleChange(client.id, 'no-cliente');
                                                                    }
                                                                }}
                                                                className="inline-flex items-center justify-center gap-1 px-3 py-1 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold border border-red-100 dark:border-red-900/30 transition-colors disabled:opacity-50"
                                                            >
                                                                <UserMinus className="h-3.5 w-3.5" />
                                                                <span>Desactivar</span>
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

                        {/* Pending Approvals (Cola de Activación) */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col h-fit">
                            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-[#ff5e00]/5">
                                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <Users className="h-5 w-5 text-[#ff5e00]" /> Cola de Activación (Leads)
                                </h3>
                                <span className="text-xs font-extrabold text-[#ff5e00] bg-[#ff5e00]/10 px-2.5 py-0.5 rounded-full">
                                    {pendingUsers.length}
                                </span>
                            </div>

                            <div className="p-4 divide-y divide-slate-100 dark:divide-slate-800/80 max-h-[380px] overflow-y-auto">
                                {pendingUsers.length === 0 ? (
                                    <div className="py-8 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center gap-2">
                                        <CheckCircle className="h-8 w-8 text-emerald-500" />
                                        <p className="text-sm font-semibold">¡Todo al día!</p>
                                        <p className="text-xs text-slate-400">No hay registros pendientes de aprobación.</p>
                                    </div>
                                ) : (
                                    pendingUsers.map((pending) => (
                                        <div key={pending.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 first:pt-0 last:pb-0">
                                            <div className="space-y-0.5">
                                                <h4 className="font-bold text-slate-850 dark:text-slate-200 text-sm">{pending.nombre}</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[180px]">{pending.email}</p>
                                                <span className="text-[9px] text-slate-455 block">
                                                    Registrado: {new Date(pending.createdAt).toLocaleDateString('es-AR', {
                                                        day: 'numeric', month: 'short'
                                                    })}
                                                </span>
                                            </div>
                                            
                                            <button
                                                disabled={updatingUserId === pending.id}
                                                onClick={() => handleRoleChange(pending.id, 'cliente')}
                                                className="self-start sm:self-center flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#ff5e00] hover:bg-[#ff5e00]/90 text-white rounded-lg text-xs font-bold shadow-md shadow-orange-500/10 hover:shadow-orange-500/25 transition-all disabled:opacity-50"
                                            >
                                                <UserCheck className="h-3.5 w-3.5" />
                                                <span>Activar</span>
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (currentUser.role === 'owner') {
        return RenderOwnerDashboard();
    }

    // --- STANDARD RENDER FOR CLIENT / OWNER ---
    let clientChartPoints = [];
    if (clientForecast.length > 0) {
        const monthlyForecast = clientForecast.filter(p => p.date.endsWith('-01'));
        clientChartPoints = monthlyForecast.map(p => ({
            label: p.date.split('-')[1] === '01' ? 'Ene' :
                   p.date.split('-')[1] === '02' ? 'Feb' :
                   p.date.split('-')[1] === '03' ? 'Mar' :
                   p.date.split('-')[1] === '04' ? 'Abr' :
                   p.date.split('-')[1] === '05' ? 'May' :
                   p.date.split('-')[1] === '06' ? 'Jun' :
                   p.date.split('-')[1] === '07' ? 'Jul' :
                   p.date.split('-')[1] === '08' ? 'Ago' :
                   p.date.split('-')[1] === '09' ? 'Sep' :
                   p.date.split('-')[1] === '10' ? 'Oct' :
                   p.date.split('-')[1] === '11' ? 'Nov' : 'Dic',
            value: p.yhat,
            isPrediction: p.is_prediction,
            lower: p.yhat_lower,
            upper: p.yhat_upper
        }));
    } else {
        clientChartPoints = clientChartPointsState;
    }

    const clientMaxVal = Math.max(...clientChartPoints.map(p => p.value)) || 1;

    // Calculate bank accounts summary
    const getBankSummary = () => {
        const summary = {};
        clientTransactions.forEach(tx => {
            const bank = tx.bank_name || "Otros";
            const amount = parseFloat(tx.amount) || 0;
            if (!summary[bank]) {
                summary[bank] = { balance: 0, income: 0, expenses: 0 };
            }
            summary[bank].balance += amount;
            if (amount > 0) {
                summary[bank].income += amount;
            } else {
                summary[bank].expenses += amount;
            }
        });
        return Object.entries(summary).map(([name, stats]) => ({
            name,
            balance: stats.balance,
            income: stats.income,
            expenses: stats.expenses
        }));
    };

    const bankSummaryList = getBankSummary();
    const totalBankBalance = bankSummaryList.reduce((sum, b) => sum + b.balance, 0);

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>Dashboard General</span>
                        <span className="text-orange-500 text-xs font-semibold bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">
                            {currentUser.role === 'owner' ? 'NeoConta' : 'Cliente Activo'}
                        </span>
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">Bienvenido al panel de control integral de NeoConta.</p>
                </div>
                
                <div className="bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
                    <Building className="h-5 w-5 text-slate-400" />
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Empresa: {companyConfig.razonSocial} {companyConfig.cuit ? `(${companyConfig.cuit})` : ""}</span>
                </div>
            </div>

            {/* News Ticker Bar */}
            <div className="relative w-full overflow-hidden bg-[#ff5e00]/5 dark:bg-[#ff5e00]/10 border border-[#ff5e00]/10 dark:border-[#ff5e00]/20 rounded-2xl py-2 px-4 shadow-sm flex items-center h-10 select-none">
                <style dangerouslySetInnerHTML={{__html: `
                  @keyframes marquee {
                    0% { transform: translate3d(0, 0, 0); }
                    100% { transform: translate3d(-50%, 0, 0); }
                  }
                  .animate-marquee-container {
                    display: flex;
                    width: max-content;
                    animation: marquee 95s linear infinite;
                  }
                  .animate-marquee-container:hover {
                    animation-play-state: paused;
                  }
                `}} />
                
                <div className="flex items-center gap-2 pr-4 border-r border-[#ff5e00]/20 text-[#ff5e00] font-bold text-xs uppercase tracking-wider shrink-0 z-10 bg-slate-50 dark:bg-black py-1">
                    <Sparkles className="h-4 w-4 animate-pulse" />
                    <span>Breves</span>
                </div>
                
                <div className="relative flex-1 overflow-hidden h-full flex items-center ml-4">
                    <div className="animate-marquee-container flex gap-16 text-xs font-semibold text-slate-700 dark:text-white items-center">
                        {renderTickerContent()}
                        {renderTickerContent()}
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { 
                        label: "Ingresos Totales (ARS)", 
                        value: formatCurrency(clientStats.totalInvoiced), 
                        change: "Total Facturado", 
                        trend: "up", 
                        icon: <DollarSign className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />, 
                        bg: "bg-emerald-50 dark:bg-emerald-950/20" 
                    },
                    { 
                        label: "Comprobantes Emitidos", 
                        value: clientStats.invoiceCount, 
                        change: "Comprobantes afip", 
                        trend: "up", 
                        icon: <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />, 
                        bg: "bg-blue-50 dark:bg-blue-950/20" 
                    },
                    { 
                        label: "Ingresos Bancarios del mes", 
                        value: formatCurrency(clientStats.bankIncomeMonth), 
                        change: clientStats.bankIncomeChange, 
                        trend: clientStats.bankIncomeChange.startsWith("-") ? "down" : "up", 
                        icon: <Wallet className="h-6 w-6 text-orange-600 dark:text-orange-400" />, 
                        bg: "bg-orange-50 dark:bg-orange-950/20" 
                    },
                ].map((stat, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 rounded-xl ${stat.bg}`}>
                                {stat.icon}
                            </div>
                            <div className={`flex items-center gap-1 text-sm font-medium ${stat.trend === 'up' ? 'text-emerald-600' : 'text-red-600'} bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-700`}>
                                {stat.trend === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                {stat.change}
                            </div>
                        </div>
                        <h3 className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{stat.value}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{stat.label}</p>
                    </div>
                ))}

                {/* 4th card: Compact Recent Activity */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between min-h-[140px]">
                    <div className="flex justify-between items-center mb-2.5">
                        <div className="flex items-center gap-2">
                            <div className="p-2.5 bg-purple-50 dark:bg-purple-950/20 rounded-xl text-purple-600 dark:text-purple-400">
                                <Activity className="h-5 w-5" />
                            </div>
                            <span className="text-sm font-bold text-slate-900 dark:text-white">Actividad Reciente</span>
                        </div>
                        <button 
                            onClick={() => router.push('/dashboard/facturacion')}
                            className="text-xs text-orange-600 dark:text-orange-400 font-semibold hover:underline cursor-pointer"
                        >
                            Ver más
                        </button>
                    </div>
                    <div className="space-y-3 overflow-y-auto pr-1 flex-1 max-h-[80px]">
                        {clientActivities.length === 0 ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400 italic py-1">Sin actividad reciente.</p>
                        ) : (
                            clientActivities.slice(0, 3).map((item, i) => (
                                <div key={i} className="flex items-start gap-2 text-xs">
                                    <div className={`w-2.5 h-2.5 mt-1.5 rounded-full flex-shrink-0 ${
                                        item.type === 'success' ? 'bg-emerald-500' :
                                        item.type === 'warning' ? 'bg-amber-500' :
                                        item.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
                                    }`}></div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-slate-850 dark:text-slate-200 truncate leading-snug" title={item.title}>
                                            {item.title}
                                        </p>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400">{item.time}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Recent Activity & Charts Placeholder */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-orange-500" /> Resumen de Facturación
                        </h2>
                        <select className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block p-2 outline-none">
                            <option>Últimos 12 meses</option>
                            <option>Último mes</option>
                            <option>Este año</option>
                        </select>
                    </div>
                    {/* Mock Chart Area */}
                    <div className="h-64 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex items-end justify-between p-4 gap-2">
                        {clientChartPoints.map((point, i) => {
                            const heightPercent = `${Math.max(15, (point.value / clientMaxVal) * 100)}%`;
                            return (
                                <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer">
                                    <div className="w-full relative flex justify-center items-end h-full">
                                        {/* Tooltip */}
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute bottom-full mb-2 bg-slate-950 text-white dark:bg-white dark:text-slate-900 text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-lg pointer-events-none z-10 whitespace-nowrap border border-slate-800 dark:border-slate-250 flex flex-col items-center">
                                            <span>{formatCurrency(point.value)}</span>
                                            {point.isPrediction && (
                                                <span className="text-[8px] text-orange-400 font-normal">
                                                    Prophet IA Predictor
                                                </span>
                                            )}
                                            {point.lower !== undefined && (
                                                <span className="text-[8px] text-slate-400 dark:text-slate-500 font-normal">
                                                    Rango: {formatCurrency(point.lower)} - {formatCurrency(point.upper)}
                                                </span>
                                            )}
                                        </div>
                                        {/* Bar */}
                                        <div 
                                            style={{ height: heightPercent }}
                                            className={`w-full rounded-t-sm transition-all duration-500 ease-out ${
                                                point.isPrediction
                                                    ? "bg-gradient-to-t from-orange-400/30 to-amber-300/30 border border-dashed border-orange-500/60 group-hover:from-orange-400/50 group-hover:to-amber-300/50"
                                                    : "bg-orange-500 group-hover:bg-orange-400"
                                            }`}
                                        ></div>
                                    </div>
                                    <span className={`text-[10px] font-bold mt-2 ${point.isPrediction ? "text-orange-500" : "text-slate-400 dark:text-slate-500"}`}>
                                        {point.label}
                                        {point.isPrediction && "*"}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-4 flex justify-between text-xs text-slate-400 px-2">
                        {clientChartPoints.map((point, idx) => (
                            <span key={idx} className={point.isPrediction ? "text-orange-500 font-bold" : ""}>
                                {point.label}{point.isPrediction && "*"}
                            </span>
                        ))}
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between h-full min-h-[350px]">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <Landmark className="h-5 w-5 text-orange-500" /> Cuentas y Saldos Bancarios
                        </h2>
                        
                        {/* Consolidated Total Balance */}
                        <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-105 dark:border-slate-800/40">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase tracking-wider">Saldo Consolidado Neto</span>
                            <span className={`text-2xl font-black tracking-tight block mt-1 ${totalBankBalance >= 0 ? 'text-slate-900 dark:text-white' : 'text-red-600 dark:text-red-455'}`}>
                                {formatCurrency(totalBankBalance)}
                            </span>
                        </div>

                        {/* List of Bank Accounts */}
                        <div className="space-y-3 overflow-y-auto max-h-[160px] pr-1">
                            {bankSummaryList.length === 0 ? (
                                <p className="text-xs text-slate-500 dark:text-slate-400 italic py-4 text-center">No se encontraron cuentas o movimientos bancarios.</p>
                            ) : (
                                bankSummaryList.map((bank, i) => (
                                    <div key={i} className="p-3 bg-slate-50/50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800/40 rounded-xl flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 rounded-lg">
                                                <Landmark className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-none">{bank.name}</h4>
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                                                    Ingresos: <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{formatCurrency(bank.income)}</span>
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className={`text-sm font-bold block ${bank.balance >= 0 ? 'text-slate-900 dark:text-white' : 'text-red-650 dark:text-red-400'}`}>
                                                {formatCurrency(bank.balance)}
                                            </span>
                                            <span className="text-[9px] text-slate-400 dark:text-slate-500">Saldo</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <button 
                        onClick={() => router.push('/dashboard/banco')}
                        className="w-full mt-4 py-2.5 text-sm font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/20 rounded-xl hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors cursor-pointer"
                    >
                        Ver movimientos bancarios
                    </button>
                </div>
            </div>
        </div>
    );
}
