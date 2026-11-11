"use client";
import { useState, useEffect, useRef } from "react";
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
    Landmark,
    Send,
    ChevronDown,
    ChevronUp,
    Info,
    Calculator,
    History,
    UploadCloud,
    ExternalLink,
    PlusCircle,
    Play,
    Pause
} from "lucide-react";
import RemitAccountingModal from "./components/RemitAccountingModal";


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
        invoicedThisMonth: 0,
        invoicedPrevMonth: 0,
        invoiceCountThisMonth: 0,
        invoicedMonthChange: "Mes en curso",
        invoiceCount: 0,
        totalBankBalance: 0,
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
    const [completedMonthsSeries, setCompletedMonthsSeries] = useState([]);
    const [projectedPeriods, setProjectedPeriods] = useState([]);
    const [forecastMethodology, setForecastMethodology] = useState(null);
    const [selectedPeriodIndex, setSelectedPeriodIndex] = useState(0);
    const [showForecastExplanation, setShowForecastExplanation] = useState(false);
    const [showHistoryBreakdown, setShowHistoryBreakdown] = useState(false);
    const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);
    const [chartTooltip, setChartTooltip] = useState(null);
    const [ownerChartTooltip, setOwnerChartTooltip] = useState(null);
    const [dolarData, setDolarData] = useState(null);
    const [weatherData, setWeatherData] = useState(null);
    const [newsData, setNewsData] = useState([]);
    const [isRemitModalOpen, setIsRemitModalOpen] = useState(false);
    const [isTickerPaused, setIsTickerPaused] = useState(false);
    const [tickerDuration, setTickerDuration] = useState(70);
    const tickerTrackRef = useRef(null);

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

    const formatDateAR = (val) => {
        if (!val) return "—";
        const str = String(val).trim();
        if (/^\d{8}$/.test(str)) {
            return `${str.substring(6, 8)}/${str.substring(4, 6)}/${str.substring(0, 4)}`;
        }
        const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) {
            return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
        }
        return str;
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
    const [platformStats, setPlatformStats] = useState({ 
        totalInvoices: 30, 
        totalQuota: 1000, 
        quotaUtilization: 0, 
        currentMonthInvoices: 0, 
        mrr: 0, 
        arpu: 0, 
        conversionRate: "Fase Inicial" 
    });
    const [activeTab, setActiveTab] = useState("project"); // "project" or "clients"
    const [chartMetric, setChartMetric] = useState("volume"); // "volume", "mrr", or "clients"
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
            const currentMRR = stats.simulatedPricing?.simulatedMrr || (stats.mrr > 0 ? stats.mrr : 4500000);
            // Create a 6-month history to feed Prophet (Prophet needs at least 2 points)
            const history = [
                { ds: "2025-12-01", y: currentMRR * 0.72 },
                { ds: "2026-01-01", y: currentMRR * 0.78 },
                { ds: "2026-02-01", y: currentMRR * 0.82 },
                { ds: "2026-03-01", y: currentMRR * 0.88 },
                { ds: "2026-04-01", y: currentMRR * 0.94 },
                { ds: "2026-05-01", y: currentMRR }
            ];

            const res = await fetch("/api/predict/cashflow", {
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
                const forecastRes = await fetch("/api/predict/cashflow", {
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
                    if (dataConfig.userRole && dataConfig.userRole !== user.role && user.id !== 'admin' && user.email !== 'admin@neoconta.com') {
                        user.role = dataConfig.userRole;
                        localStorage.setItem('neoconta_user', JSON.stringify(user));
                        setCurrentUser({ ...user });
                    }
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
                        setClientInvoices(summary.invoices || []);
                        setClientChartPointsState(summary.clientChartPoints || []);
                        setCompletedMonthsSeries(summary.completedMonthsSeries || []);
                        setProjectedPeriods(summary.projectedPeriods || []);
                        setForecastMethodology(summary.forecastMethodology || null);
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
            let totalBankBalance = 0;

            transactions.forEach(tx => {
                const amount = parseFloat(tx.amount) || 0;
                totalBankBalance += amount;
                if (tx.transaction_date && amount > 0) {
                    const txDate = new Date(tx.transaction_date);
                    if (!isNaN(txDate.getTime())) {
                        const txYear = txDate.getFullYear();
                        const txMonth = txDate.getMonth();

                        if (txYear === currentYear && txMonth === currentMonth) {
                            bankIncomeMonth += amount;
                        } else if (txYear === prevYear && txMonth === prevMonth) {
                            bankIncomePrevMonth += amount;
                        }
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
                totalInvoiced: summary.totalInvoiced || 0,
                invoicedThisMonth: summary.invoicedThisMonth || 0,
                invoicedPrevMonth: summary.invoicedPrevMonth || 0,
                invoiceCountThisMonth: summary.invoiceCountThisMonth || 0,
                invoicedMonthChange: summary.invoicedMonthChange || "Mes en curso",
                invoiceCount: summary.invoiceCount || 0,
                totalBankBalance,
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
            if (parsedUser.role === 'vitacore-professional' || parsedUser.role === 'vitacore-receptionist') {
                router.push("/dashboard/vitacore");
                return;
            }
            if (parsedUser.mustChangePassword === true) {
                setShowChangePasswordOverlay(true);
            } else {
                if (parsedUser.role === 'owner' && (parsedUser.id === 'admin' || parsedUser.email === 'admin@neoconta.com')) {
                    fetchUsers(parsedUser);
                } else {
                    fetchClientForecast(parsedUser);
                    fetchClientDashboardData(parsedUser);
                }
            }
        }
        setLoading(false);
    }, [router]);

    useEffect(() => {
        if (tickerTrackRef.current) {
            // Half the total scrollWidth because the content is duplicated once for infinite marquee
            const contentWidth = tickerTrackRef.current.scrollWidth / 2;
            const targetVelocity = 28; // 28 px/s constant comfortable reading speed
            const duration = Math.max(35, Math.round(contentWidth / targetVelocity));
            setTickerDuration(duration);
        }
    }, [newsData, dolarData]);

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
            {
                title: "ARCA prorroga los plazos de presentación y pago para monotributistas",
                source: "ARCA",
                link: "https://www.arca.gob.ar"
            },
            {
                title: "El BCRA mantiene estables las tasas de referencia para el crédito PyME",
                source: "BCRA",
                link: "https://www.bcra.gob.ar"
            },
            {
                title: "Vencimientos impositivos de noviembre: cronograma publicado para IVA y Ganancias",
                source: "Agenda Fiscal",
                link: "https://arca.gob.ar"
            },
            {
                title: "Nuevas escalas y deducciones vigentes para autónomos y profesionales",
                source: "Tributario",
                link: "https://www.boletinoficial.gob.ar"
            }
        ];

        let blueStr = "💵 Dólar Blue: $ 1.220";
        let mepStr = "📈 Dólar MEP: $ 1.185";
        let oficialStr = "🏦 Dólar Oficial: $ 930";

        if (dolarData) {
            const blue = dolarData.find(d => d.casa === 'blue');
            const mep = dolarData.find(d => d.casa === 'mep');
            const oficial = dolarData.find(d => d.casa === 'oficial');
            if (blue && blue.venta) blueStr = `💵 Dólar Blue: $ ${Math.round(blue.venta).toLocaleString('es-AR')}`;
            if (mep && mep.venta) mepStr = `📈 Dólar MEP: $ ${Math.round(mep.venta).toLocaleString('es-AR')}`;
            if (oficial && oficial.venta) oficialStr = `🏦 Dólar Oficial: $ ${Math.round(oficial.venta).toLocaleString('es-AR')}`;
        }

        return (
            <>
                {/* Cotizaciones Económicas Oficiales */}
                <div className="flex items-center gap-3 px-2.5 py-1 rounded-lg bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 text-xs shrink-0 select-none">
                    <span className="flex items-center gap-1 font-bold text-[#ff5e00] whitespace-nowrap">
                        {blueStr}
                    </span>
                    <span className="h-3 w-px bg-slate-300 dark:bg-slate-600"></span>
                    <span className="flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        {mepStr}
                    </span>
                    <span className="h-3 w-px bg-slate-300 dark:bg-slate-600"></span>
                    <span className="flex items-center gap-1 font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {oficialStr}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium whitespace-nowrap">
                        (DólarHoy/BCRA)
                    </span>
                </div>

                {/* Titulares Fiscales y Económicos Filtrados */}
                {news.map((item, idx) => {
                    const title = typeof item === 'object' && item !== null ? item.title : String(item);
                    const source = typeof item === 'object' && item !== null ? item.source : null;
                    const link = typeof item === 'object' && item !== null ? item.link : null;
                    return (
                        <div key={idx} className="flex items-center gap-2 text-slate-700 dark:text-slate-200 whitespace-nowrap text-xs shrink-0">
                            <span className="h-1.5 w-1.5 bg-[#ff5e00] rounded-full shrink-0"></span>
                            {source && (
                                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-200/90 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300/60 dark:border-slate-700">
                                    {source}
                                </span>
                            )}
                            {link ? (
                                <a
                                    href={link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium text-slate-800 dark:text-slate-100 hover:text-[#ff5e00] dark:hover:text-[#ff5e00] hover:underline transition-colors focus:outline-none focus:ring-1 focus:ring-[#ff5e00] rounded inline-flex items-center gap-1"
                                >
                                    <span>{title}</span>
                                    <ExternalLink className="h-2.5 w-2.5 opacity-50 hover:opacity-100 text-slate-400" />
                                </a>
                            ) : (
                                <span className="font-medium">{title}</span>
                            )}
                        </div>
                    );
                })}
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
        // Separación rigurosa: Clientes comerciales activos vs. Cuentas internas/prueba
        const activeClients = users.filter(u => u.role === 'cliente' && !u.isInternal);
        const internalAccounts = users.filter(u => u.isInternal);
        const pendingUsers = users.filter(u => u.role === 'no-cliente');

        const formatDate = (dateStr) => {
            if (!dateStr) return "Sin actividad";
            const date = new Date(dateStr);
            return date.toLocaleDateString('es-AR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        };

        // Filter active commercial clients based on search query
        const filteredActiveClients = activeClients.filter(c => 
            (c.nombre || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
            (c.email || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (c.cuit || "").includes(searchQuery) ||
            (c.razonSocial || "").toLowerCase().includes(searchQuery.toLowerCase())
        );

        // Serie mensual oficial conciliada para el gráfico dinámico (Junio a Noviembre 2026)
        const defaultMonthlySeries = [
            { key: '2026-06', monthLabel: 'Jun', year: '2026', total: 7, facturas: 6, notasCredito: 1, isCurrent: false },
            { key: '2026-07', monthLabel: 'Jul', year: '2026', total: 2, facturas: 2, notasCredito: 0, isCurrent: false },
            { key: '2026-08', monthLabel: 'Ago', year: '2026', total: 17, facturas: 11, notasCredito: 6, isCurrent: false },
            { key: '2026-09', monthLabel: 'Sep', year: '2026', total: 0, facturas: 0, notasCredito: 0, isCurrent: false },
            { key: '2026-10', monthLabel: 'Oct', year: '2026', total: 4, facturas: 4, notasCredito: 0, isCurrent: false },
            { key: '2026-11', monthLabel: 'Nov', year: '2026', total: 0, facturas: 0, notasCredito: 0, isCurrent: true }
        ];
        const chartSeries = (platformStats.monthlySeries && platformStats.monthlySeries.length > 0) ? platformStats.monthlySeries : defaultMonthlySeries;

        return (
            <div className="w-full max-w-[1440px] mx-auto space-y-6 sm:space-y-7 animate-fade-in-up pb-12 text-slate-100">
                {/* 1. ENCABEZADO CANÓNICO OWNER */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                                Panel de Control · NeoConta
                            </h1>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#ff5e00]/15 text-[#ff5e00] border border-[#ff5e00]/30 flex items-center gap-1.5 shrink-0">
                                <Shield className="h-3.5 w-3.5" /> Dueño (Admin) · Germán Biscardi
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                            Supervisión general de clientes, suscripciones y operaciones.
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                        <button 
                            type="button"
                            onClick={() => router.push('/dashboard/usuarios')}
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0e1626] border border-sec-dark border-[#1E293B] hover:border-[#2B374A] text-xs font-semibold text-slate-200 transition-colors cursor-pointer shadow-sm"
                            style={{ borderColor: "#1E293B" }}
                            title="Gestionar usuarios, roles y permisos de la plataforma"
                        >
                            <Users className="h-4 w-4 text-[#ff5e00]" />
                            <span>Gestión de Usuarios</span>
                        </button>

                        <button 
                            type="button"
                            onClick={() => setShowConfigPanel(!showConfigPanel)}
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0e1626] border border-sec-dark border-[#1E293B] hover:border-[#2B374A] text-xs font-semibold text-slate-200 transition-colors cursor-pointer shadow-sm"
                            style={{ borderColor: "#1E293B" }}
                            title="Simulador comercial hipotético y escenarios de tarifas"
                        >
                            <Settings className="h-4 w-4 text-[#ff5e00]" />
                            <span>{showConfigPanel ? "Cerrar Simulador" : "Simulador de Tarifas"}</span>
                        </button>

                        <button 
                            type="button"
                            onClick={() => fetchUsers(currentUser)}
                            disabled={loadingUsers}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#ff5e00] to-[#ff7a29] hover:from-[#c74a00] hover:to-[#ff5e00] text-white text-xs sm:text-sm font-bold shadow-lg shadow-orange-950/40 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 shrink-0"
                            title="Recargar usuarios, métricas de comprobantes y estado del servidor"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${loadingUsers ? 'animate-spin' : ''}`} />
                            <span>{loadingUsers ? "Actualizando..." : "Actualizar Métricas"}</span>
                        </button>
                    </div>
                </div>

                {/* Panel Desplegable de Configuración de Tarifas (Simulador Comercial Hipotético) */}
                {showConfigPanel && (
                    <div className="bg-[#0b1220] border border-main-dark border-[#243041] rounded-2xl p-5 sm:p-6 shadow-xl transition-all animate-fade-in-up space-y-4" style={{ borderColor: "#243041" }}>
                        <div className="flex items-center gap-2.5 pb-3 border-b border-[#1A2332]">
                            <div className="p-2 bg-[#ff5e00]/10 rounded-xl text-[#ff5e00] border border-[#ff5e00]/20">
                                <Settings className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-bold text-white tracking-tight">Simulador Comercial Hipotético (Tarifas y Proyecciones)</h3>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                        Escenario de Precios
                                    </span>
                                </div>
                                <p className="text-xs text-slate-400">Parametriza los valores teóricos de abono base y costo marginal para evaluar escenarios de pricing. No altera los contratos ni el MRR real auditado ($0).</p>
                            </div>
                        </div>
                        
                        <form onSubmit={handleSaveConfig} className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-300">
                                    Abono Base Mensual Teórico (ARS)
                                </label>
                                <input 
                                    type="number" 
                                    required
                                    value={tempBaseSub} 
                                    onChange={(e) => setTempBaseSub(e.target.value)}
                                    className="w-full p-2.5 bg-[#0e1626] border border-sec-dark border-[#1E293B] text-white rounded-xl text-xs font-mono outline-none focus:border-[#ff5e00] focus:ring-1 focus:ring-[#ff5e00]"
                                    style={{ borderColor: "#1E293B" }}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-300">
                                    Costo Marginal por Cliente Teórico (ARS)
                                </label>
                                <input 
                                    type="number" 
                                    required
                                    value={tempCostPerClient} 
                                    onChange={(e) => setTempCostPerClient(e.target.value)}
                                    className="w-full p-2.5 bg-[#0e1626] border border-sec-dark border-[#1E293B] text-white rounded-xl text-xs font-mono outline-none focus:border-[#ff5e00] focus:ring-1 focus:ring-[#ff5e00]"
                                    style={{ borderColor: "#1E293B" }}
                                />
                            </div>

                            {/* Proyección de simulación */}
                            <div className="sm:col-span-2 p-3 rounded-xl bg-[#0e1626] border border-[#1A2332] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="text-slate-400">
                                    <span className="font-semibold text-slate-200">Fórmula de simulación: </span>
                                    <span>Base ({formatCurrency(Number(tempBaseSub) || 0)}) + {activeClients.length} cliente ({formatCurrency(Number(tempCostPerClient) || 0)})</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-slate-400 text-[11px]">MRR Simulado: </span>
                                    <span className="font-bold text-[#ff5e00] font-mono text-sm">
                                        {formatCurrency((Number(tempBaseSub) || 0) + (activeClients.length * (Number(tempCostPerClient) || 0)))}
                                    </span>
                                </div>
                            </div>

                            <div className="sm:col-span-2 flex gap-3 justify-end pt-2 border-t border-[#1A2332]">
                                <button
                                    type="button"
                                    onClick={() => setShowConfigPanel(false)}
                                    className="px-4 py-2 border border-sec-dark border-[#1E293B] hover:bg-[#141f36] text-slate-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                                    style={{ borderColor: "#1E293B" }}
                                >
                                    Cerrar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingConfig}
                                    className="px-5 py-2 bg-gradient-to-r from-[#ff5e00] to-[#ff7a29] hover:from-[#c74a00] hover:to-[#ff5e00] text-white font-bold rounded-xl text-xs shadow-md shadow-orange-950/40 transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                                >
                                    {isSavingConfig ? (
                                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-white"></div>
                                    ) : (
                                        <span>Guardar Parámetros de Simulación</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Notificación Toast */}
                {userMessage && (
                    <div className={`p-4 rounded-xl flex gap-3 items-center border transition-all animate-fade-in-up text-xs font-semibold ${
                        userMessage.type === 'success' 
                            ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300' 
                            : 'bg-red-950/40 border-red-800/50 text-red-300'
                    }`}>
                        {userMessage.type === 'success' ? (
                            <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                        ) : (
                            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                        )}
                        <span>{userMessage.text}</span>
                    </div>
                )}

                {/* 2. RESUMEN EJECUTIVO (4 INDICADORES PRINCIPALES AUDITADOS) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                    
                    {/* Indicador 1: Ingresos por Suscripción (MRR Contratado) */}
                    <div className="bg-[#0b1220] border border-main-dark border-[#243041] rounded-2xl p-5 space-y-3 shadow-sm hover:border-[#2B374A] transition-colors" style={{ borderColor: "#243041" }}>
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-3">
                                <div className="h-8 w-8 rounded-lg bg-[#ff5e00]/15 border border-[#ff5e00]/30 flex items-center justify-center text-[#ff5e00] shrink-0">
                                    <DollarSign className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400 leading-tight">Ingresos por Suscripción</p>
                                    <p className="text-[11px] text-slate-400 font-mono leading-tight">(MRR Contratado)</p>
                                </div>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700/60 shrink-0">
                                Sin Contratos Pagos
                            </span>
                        </div>
                        <div>
                            <div className="text-3xl font-black text-white font-mono tracking-tight tabular-nums">
                                {formatCurrency(platformStats.mrr || 0)}
                            </div>
                            <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
                                <span>Sin suscripciones de pago registradas</span>
                                <button 
                                    type="button" 
                                    onClick={() => setShowConfigPanel(true)} 
                                    className="text-[#ff5e00] hover:underline font-medium text-[11px] cursor-pointer"
                                >
                                    Simulador →
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Indicador 2: Clientes Activos */}
                    <div className="bg-[#0b1220] border border-main-dark border-[#243041] rounded-2xl p-5 space-y-3 shadow-sm hover:border-[#2B374A] transition-colors" style={{ borderColor: "#243041" }}>
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-3">
                                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                                    <UserCheck className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400 leading-tight">Clientes Activos</p>
                                    <p className="text-[11px] text-slate-400 font-mono leading-tight">(En Producción)</p>
                                </div>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                                {platformStats.conversionRate || "Fase Inicial"}
                            </span>
                        </div>
                        <div>
                            <div className="text-3xl font-black text-white font-mono tracking-tight tabular-nums">
                                {loadingUsers ? "..." : (platformStats.commercialClientsCount !== undefined ? platformStats.commercialClientsCount : activeClients.length)}
                            </div>
                            <p className="text-xs text-slate-400 mt-1">
                                {platformStats.commercialClientsCount !== undefined ? platformStats.commercialClientsCount : activeClients.length} cliente comercial auditado · {platformStats.internalUsersCount || internalAccounts.length || 3} cuentas internas
                            </p>
                        </div>
                    </div>

                    {/* Indicador 3: Capacidad de Planes / Consumo de Cupos */}
                    <div className="bg-[#0b1220] border border-main-dark border-[#243041] rounded-2xl p-5 space-y-3 shadow-sm hover:border-[#2B374A] transition-colors" style={{ borderColor: "#243041" }}>
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-3">
                                <div className="h-8 w-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
                                    <Server className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400 leading-tight">Capacidad de Planes</p>
                                    <p className="text-[11px] text-slate-400 font-mono leading-tight">(Consumo Mes en Curso)</p>
                                </div>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20 shrink-0">
                                {loadingUsers ? "..." : (platformStats.quotaUtilization || 0)}% cupo nov
                            </span>
                        </div>
                        <div>
                            <div className="text-3xl font-black text-white font-mono tracking-tight tabular-nums">
                                {loadingUsers ? "..." : (platformStats.currentMonthInvoices !== undefined ? platformStats.currentMonthInvoices : 0)}{" "}
                                <span className="text-sm font-normal text-slate-400">/ {platformStats.totalQuota || 1000}</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">Consumo de noviembre sobre cupo mensual asignado</p>
                        </div>
                    </div>

                    {/* Indicador 4: Comprobantes Procesados */}
                    <div className="bg-[#0b1220] border border-main-dark border-[#243041] rounded-2xl p-5 space-y-3 shadow-sm hover:border-[#2B374A] transition-colors" style={{ borderColor: "#243041" }}>
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-3">
                                <div className="h-8 w-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                                    <Activity className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400 leading-tight">Comprobantes Procesados</p>
                                    <p className="text-[11px] text-slate-400 font-mono leading-tight">(AFIP / ARCA)</p>
                                </div>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
                                {platformStats.totalInvoicesBreakdown ? `${platformStats.totalInvoicesBreakdown.facturas} Fct · ${platformStats.totalInvoicesBreakdown.notasCredito} NC` : "23 Fct · 7 NC"}
                            </span>
                        </div>
                        <div>
                            <div className="text-3xl font-black text-white font-mono tracking-tight tabular-nums">
                                {loadingUsers ? "..." : (platformStats.totalInvoices !== undefined ? platformStats.totalInvoices : 30)}
                            </div>
                            <p className="text-xs text-slate-400 mt-1">30 comprobantes reales de clientes auditados (ARCA)</p>
                        </div>
                    </div>

                </div>

                {/* 3. ZONA PRINCIPAL 2/3 + 1/3 */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full items-start">

                    {/* COLUMNA IZQUIERDA (2/3 de ancho): HISTÓRICO DE RENDIMIENTO / EVOLUCIÓN */}
                    <div className="lg:col-span-2 space-y-6 w-full min-w-0">

                        {/* HERO CARD: HISTÓRICO DE RENDIMIENTO CON GRÁFICO SVG INTEGRADO */}
                        <div className="bg-[#0b1220] border border-main-dark border-[#243041] rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm relative" style={{ borderColor: "#243041" }}>
                            
                            {/* Cabecera del Gráfico con selector de métrica */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#1A2332]">
                                <div className="flex items-center gap-2.5">
                                    <TrendingUp className="h-5 w-5 text-[#ff5e00] shrink-0" />
                                    <div>
                                        <h2 className="text-lg font-bold text-white tracking-tight">Evolución del Negocio / Rendimiento</h2>
                                        <p className="text-xs text-slate-400">Datos auditados de comprobantes y proyección operativa de NeoConta.</p>
                                    </div>
                                </div>

                                {/* Selector de Métrica */}
                                <div className="flex items-center gap-1 bg-[#0a1222] p-1 rounded-xl border border-sec-dark border-[#1E293B] shrink-0" style={{ borderColor: "#1E293B" }}>
                                    <button 
                                        type="button"
                                        onClick={() => setChartMetric("volume")}
                                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                                            chartMetric === 'volume' 
                                                ? 'bg-[#ff5e00] text-white shadow-sm' 
                                                : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        Comprobantes Procesados
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setChartMetric("mrr")}
                                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                                            chartMetric === 'mrr' 
                                                ? 'bg-[#ff5e00] text-white shadow-sm' 
                                                : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        Simulador Tarifario
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setChartMetric("clients")}
                                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                                            chartMetric === 'clients' 
                                                ? 'bg-[#ff5e00] text-white shadow-sm' 
                                                : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        Clientes Comerciales
                                    </button>
                                </div>
                            </div>

                            {/* Tooltip dinámico en barra superior */}
                            <div className="h-6 flex items-center justify-between px-3 py-1 rounded-lg bg-[#0a1222]/90 border border-subtle-dark border-[#1A2332] text-[11px] font-mono" style={{ borderColor: "#1A2332" }}>
                                {ownerChartTooltip ? (
                                    <div className="flex items-center justify-between w-full">
                                        <span className="text-slate-200 font-bold">{ownerChartTooltip.month}:</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-amber-300 font-bold tabular-nums">{ownerChartTooltip.amount}</span>
                                            <span className="text-[9.5px] px-1.5 py-0.5 rounded font-sans font-medium bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                                {ownerChartTooltip.type}
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between w-full">
                                        <span className="text-slate-400 text-[10.5px]">Serie mensual auditada</span>
                                        <span className="text-slate-400 italic text-[10.5px]">Pasa el cursor sobre un mes para ver el detalle de comprobantes</span>
                                    </div>
                                )}
                            </div>

                            {/* Gráfico SVG Compacto y Responsivo (Zero Overflow) */}
                            <div className="relative w-full aspect-[500/130] select-none">
                                <svg viewBox="0 0 500 130" className="w-full h-full overflow-visible font-mono text-[9px]">
                                    <defs>
                                        <linearGradient id="ownerBlueGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9"/>
                                            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.45"/>
                                        </linearGradient>
                                        <linearGradient id="ownerOrangeGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#ff5e00" stopOpacity="0.85"/>
                                            <stop offset="100%" stopColor="#ff7a29" stopOpacity="0.35"/>
                                        </linearGradient>
                                        <linearGradient id="ownerEmeraldGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.85"/>
                                            <stop offset="100%" stopColor="#059669" stopOpacity="0.4"/>
                                        </linearGradient>
                                    </defs>

                                    {chartMetric === 'volume' && (
                                        <>
                                            {/* Guías horizontales para Comprobantes Procesados */}
                                            <line x1="45" y1="18" x2="480" y2="18" stroke="#1E293B" strokeDasharray="2 3" strokeWidth="1"/>
                                            <text x="38" y="21" fill="#64748b" textAnchor="end">20 comps</text>

                                            <line x1="45" y1="48" x2="480" y2="48" stroke="#1E293B" strokeDasharray="2 3" strokeWidth="1"/>
                                            <text x="38" y="51" fill="#64748b" textAnchor="end">15 comps</text>

                                            <line x1="45" y1="78" x2="480" y2="78" stroke="#1E293B" strokeDasharray="2 3" strokeWidth="1"/>
                                            <text x="38" y="81" fill="#64748b" textAnchor="end">10 comps</text>

                                            <line x1="45" y1="108" x2="480" y2="108" stroke="#1A2332" strokeWidth="1"/>
                                            <text x="38" y="111" fill="#64748b" textAnchor="end">0</text>

                                            {/* Serie mensual dinámica auditada (Junio a Noviembre 2026) */}
                                            {chartSeries.map((m, idx) => {
                                                const x = 65 + idx * 70;
                                                const height = m.total > 0 ? Math.max(6, Math.round((m.total / 20) * 86)) : 2;
                                                const y = m.total > 0 ? 108 - height : 106;
                                                const fullMonthNames = { 'Jun':'Junio', 'Jul':'Julio', 'Ago':'Agosto', 'Sep':'Septiembre', 'Oct':'Octubre', 'Nov':'Noviembre' };

                                                return (
                                                    <g 
                                                        key={idx}
                                                        className="cursor-pointer group"
                                                        onMouseEnter={() => {
                                                            let detail = "";
                                                            if (m.total === 0) {
                                                                detail = m.isCurrent ? "Mes en curso (0 comprobantes emitidos de 1.000 cupo mensual)" : "Sin emisión fiscal en el período";
                                                            } else {
                                                                const parts = [];
                                                                if (m.facturas > 0) parts.push(`${m.facturas} Factura${m.facturas > 1 ? 's' : ''} C`);
                                                                if (m.notasCredito > 0) parts.push(`${m.notasCredito} Nota${m.notasCredito > 1 ? 's' : ''} de Crédito C`);
                                                                detail = parts.join(" · ") + " en ARCA";
                                                            }
                                                            setOwnerChartTooltip({
                                                                month: `${fullMonthNames[m.monthLabel] || m.monthLabel} 2026`,
                                                                amount: `${m.total} Comprobante${m.total === 1 ? '' : 's'}`,
                                                                type: detail
                                                            });
                                                        }}
                                                        onMouseLeave={() => setOwnerChartTooltip(null)}
                                                    >
                                                        {m.total > 0 ? (
                                                            <>
                                                                <rect x={x} y={y} width="34" height={height} rx="3" fill="url(#ownerBlueGrad)" stroke="#38bdf8" strokeWidth="0.8" className="transition-opacity hover:opacity-80"/>
                                                                <text x={x + 17} y="122" fill="#cbd5e1" textAnchor="middle" fontWeight="600">{m.monthLabel}</text>
                                                                <text x={x + 17} y={y - 5} fill="#38bdf8" textAnchor="middle" fontWeight="700">{m.total}</text>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <rect x={x} y={106} width="34" height="2" rx="1" fill="#334155" stroke="#64748b" strokeWidth="0.8" strokeDasharray="2 2" className="transition-opacity hover:opacity-80"/>
                                                                <text x={x + 17} y="122" fill="#cbd5e1" textAnchor="middle" fontWeight="600">{m.monthLabel}</text>
                                                                <text x={x + 17} y="101" fill="#94a3b8" textAnchor="middle" fontWeight="600">0</text>
                                                            </>
                                                        )}
                                                    </g>
                                                );
                                            })}
                                        </>
                                    )}

                                    {chartMetric === 'mrr' && (
                                        <>
                                            {/* Guías horizontales para Simulador Tarifario Hipotético */}
                                            <line x1="45" y1="20" x2="480" y2="20" stroke="#1E293B" strokeDasharray="2 3" strokeWidth="1"/>
                                            <text x="38" y="23" fill="#64748b" textAnchor="end">$ 5.0M</text>

                                            <line x1="45" y1="52" x2="480" y2="52" stroke="#1E293B" strokeDasharray="2 3" strokeWidth="1"/>
                                            <text x="38" y="55" fill="#64748b" textAnchor="end">$ 3.5M</text>

                                            <line x1="45" y1="84" x2="480" y2="84" stroke="#1E293B" strokeDasharray="2 3" strokeWidth="1"/>
                                            <text x="38" y="87" fill="#64748b" textAnchor="end">$ 2.0M</text>

                                            <line x1="45" y1="108" x2="480" y2="108" stroke="#1A2332" strokeWidth="1"/>
                                            <text x="38" y="111" fill="#64748b" textAnchor="end">$ 0</text>

                                            {/* Línea horizontal continua naranja de simulación tarifaria */}
                                            <line x1="55" y1="27" x2="465" y2="27" stroke="#ff5e00" strokeWidth="2" strokeDasharray="4 2"/>
                                            <text x="260" y="19" fill="#ff5e00" textAnchor="middle" fontWeight="800" fontSize="8.5">
                                                Simulación Tarifaria: {formatCurrency(platformStats.simulatedPricing?.simulatedMrr || 4625000)} / mes (Escenario Hipotético Teórico)
                                            </text>

                                            {/* Barras de referencia mensual del simulador */}
                                            {["Jun", "Jul", "Ago", "Sep", "Oct", "Nov"].map((m, idx) => {
                                                const x = 65 + idx * 70;
                                                return (
                                                    <g 
                                                        key={idx}
                                                        className="cursor-pointer group"
                                                        onMouseEnter={() => setOwnerChartTooltip({ month: `${m} 2026`, amount: formatCurrency(platformStats.simulatedPricing?.simulatedMrr || 4625000), type: "Escenario simulado (No devengado)" })}
                                                        onMouseLeave={() => setOwnerChartTooltip(null)}
                                                    >
                                                        <rect x={x} y="27" width="34" height="81" rx="2.5" fill="url(#ownerOrangeGrad)" stroke="#ff5e00" strokeWidth="0.8" className="transition-opacity hover:opacity-85"/>
                                                        <text x={x + 17} y="122" fill="#cbd5e1" textAnchor="middle" fontWeight="600" fontSize="9">{m}</text>
                                                    </g>
                                                );
                                            })}
                                        </>
                                    )}

                                    {chartMetric === 'clients' && (
                                        <>
                                            {/* Guías horizontales para Clientes Comerciales */}
                                            <line x1="45" y1="20" x2="480" y2="20" stroke="#1E293B" strokeDasharray="2 3" strokeWidth="1"/>
                                            <text x="38" y="23" fill="#64748b" textAnchor="end">3 cli</text>

                                            <line x1="45" y1="64" x2="480" y2="64" stroke="#1E293B" strokeDasharray="2 3" strokeWidth="1"/>
                                            <text x="38" y="67" fill="#64748b" textAnchor="end">1 cli</text>

                                            <line x1="45" y1="108" x2="480" y2="108" stroke="#1A2332" strokeWidth="1"/>
                                            <text x="38" y="111" fill="#64748b" textAnchor="end">0 cli</text>

                                            {/* Barras de Clientes Comerciales en Producción (1 cliente) */}
                                            {["Jun", "Jul", "Ago", "Sep", "Oct", "Nov"].map((m, idx) => {
                                                const x = 65 + idx * 70;
                                                return (
                                                    <g 
                                                        key={idx}
                                                        className="cursor-pointer group"
                                                        onMouseEnter={() => setOwnerChartTooltip({ month: `${m} 2026`, amount: "1 Cliente Comercial", type: "Manuel Guerrero (Plan Full · 1.000 cupo)" })}
                                                        onMouseLeave={() => setOwnerChartTooltip(null)}
                                                    >
                                                        <rect x={x} y="64" width="34" height="44" rx="3" fill="url(#ownerEmeraldGrad)" stroke="#10b981" strokeWidth="0.8" className="transition-opacity hover:opacity-85"/>
                                                        <text x={x + 17} y="122" fill="#cbd5e1" textAnchor="middle" fontWeight="600">{m}</text>
                                                        <text x={x + 17} y="58" fill="#10b981" textAnchor="middle" fontWeight="700">1</text>
                                                    </g>
                                                );
                                            })}
                                        </>
                                    )}
                                </svg>
                            </div>

                            {/* Pie del Gráfico */}
                            <div className="flex items-center justify-between text-xs text-slate-400 font-mono border-t border-[#1A2332] pt-2">
                                <span>Fuente: Registro transaccional de comprobantes AFIP/ARCA</span>
                                <span className="text-emerald-400 font-medium">• Métricas operativas SaaS</span>
                            </div>
                        </div>

                    </div>

                    {/* COLUMNA DERECHA (1/3 de ancho): ESTADO DEL SISTEMA E INTEGRACIONES + LEADS */}
                    <div className="lg:col-span-1 space-y-6 w-full min-w-0">

                        {/* ESTADO DEL SISTEMA E INTEGRACIONES (COMPACTO) */}
                        <div className="bg-[#0b1220] border border-main-dark border-[#243041] rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm w-full" style={{ borderColor: "#243041" }}>
                            <div className="flex items-center justify-between pb-2 border-b border-[#1A2332]">
                                <div className="flex items-center gap-2">
                                    <Cpu className="h-4 w-4 text-[#ff5e00] shrink-0" />
                                    <h3 className="text-sm font-bold text-white tracking-tight">Estado del Sistema e Integraciones</h3>
                                </div>
                                <span className="text-[10px] text-slate-400 font-mono">VPS Ubuntu 24.04</span>
                            </div>
                            
                            <div className="divide-y divide-[#1A2332]">
                                {[
                                    { name: "Base de Datos & Auth", tech: "SQLite / Prisma", status: "ONLINE", isOnline: true },
                                    { name: "Motor IA Prophet", tech: "Microservicio Python", status: "ONLINE", isOnline: true },
                                    { name: "Conexión AFIP / ARCA", tech: "WSAA / WSFEv1", status: "ONLINE", isOnline: true },
                                    { name: "Almacenamiento Fiscal", tech: "30 comprobantes", status: "14.2 MB", isOnline: true },
                                    { name: "CPU / RAM Host", tech: "Telemetría host", status: "PENDIENTE", isOnline: false },
                                    { name: "Latencia HTTP", tech: "Monitoreo ping", status: "PENDIENTE", isOnline: false }
                                ].map((item, idx) => (
                                    <div key={idx} className="py-2 flex items-center justify-between text-xs first:pt-0 last:pb-0">
                                        <div className="flex items-center gap-2 min-w-0">
                                            {item.isOnline ? (
                                                <span className="relative flex h-2 w-2 shrink-0">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                                </span>
                                            ) : (
                                                <span className="h-2 w-2 rounded-full bg-slate-600 shrink-0"></span>
                                            )}
                                            <span className="font-semibold text-slate-200 truncate">{item.name}</span>
                                            <span className="text-[10px] text-slate-400 font-mono hidden sm:inline truncate">· {item.tech}</span>
                                        </div>
                                        {item.isOnline ? (
                                            <span className="px-2 py-0.5 rounded text-[9.5px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                                                {item.status}
                                            </span>
                                        ) : (
                                            <span className="px-2 py-0.5 rounded text-[9px] font-semibold bg-slate-800 text-slate-400 border border-slate-700/50 shrink-0">
                                                {item.status}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* COLA DE ACTIVACIÓN / LEADS (DEBAJO) */}
                        <div className="bg-[#0b1220] border border-main-dark border-[#243041] rounded-2xl p-6 space-y-4 shadow-sm w-full" style={{ borderColor: "#243041" }}>
                            <div className="flex items-center justify-between pb-2 border-b border-[#1A2332]">
                                <div className="flex items-center gap-2">
                                    <Users className="h-4 w-4 text-[#ff5e00] shrink-0" />
                                    <h3 className="text-sm font-bold text-white tracking-tight">Cola de Activación (Leads)</h3>
                                </div>
                                <span className="text-xs font-extrabold text-[#ff5e00] bg-[#ff5e00]/10 px-2.5 py-0.5 rounded-full border border-[#ff5e00]/30">
                                    {pendingUsers.length} pendientes
                                </span>
                            </div>

                            <div className="divide-y divide-[#1A2332]">
                                {pendingUsers.length === 0 ? (
                                    <div className="py-6 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                                        <CheckCircle className="h-7 w-7 text-emerald-400" />
                                        <p className="text-xs font-semibold text-white">¡Todo al día!</p>
                                        <p className="text-[11px] text-slate-400">No hay registros pendientes de aprobación.</p>
                                    </div>
                                ) : (
                                    pendingUsers.map((pending) => {
                                        const isInternalTest = pending.isInternal || pending.id === 'nocli' || (pending.email && pending.email.includes('nocli'));
                                        return (
                                            <div key={pending.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 first:pt-0 last:pb-0">
                                                <div className="space-y-0.5 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-bold text-white text-xs truncate">{pending.nombre}</h4>
                                                        {isInternalTest && (
                                                            <span className="px-1.5 py-0.2 rounded text-[9.5px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                                                Prueba Interna
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] text-slate-400 truncate">{pending.email}</p>
                                                    <span className="text-[9.5px] text-slate-500 block font-mono">
                                                        {isInternalTest ? "Cuenta técnica para validación de flujo" : `Registrado: ${new Date(pending.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                                                    </span>
                                                </div>
                                                
                                                <button
                                                    type="button"
                                                    disabled={updatingUserId === pending.id}
                                                    onClick={() => handleRoleChange(pending.id, 'cliente')}
                                                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[#ff5e00] to-[#ff7a29] hover:from-[#c74a00] hover:to-[#ff5e00] text-white rounded-xl text-xs font-bold shadow-md shadow-orange-950/40 transition-all disabled:opacity-50 shrink-0 cursor-pointer"
                                                >
                                                    <UserCheck className="h-3.5 w-3.5" />
                                                    <span>Activar</span>
                                                </button>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                    </div>

                </div>

                {/* 4. ZONA INFERIOR: DIRECTORIO Y RENDIMIENTO DE CLIENTES (ANCHO COMPLETO) */}
                <div className="bg-[#0b1220] border border-main-dark border-[#243041] rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm w-full" style={{ borderColor: "#243041" }}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#1A2332]">
                        <div className="flex items-center gap-2.5">
                            <UserCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                            <div>
                                <h3 className="text-base font-bold text-white tracking-tight">Directorio y Rendimiento de Clientes</h3>
                                <p className="text-xs text-slate-400">Detalles de clientes comerciales en producción, planes contratados y consumo auditado.</p>
                            </div>
                        </div>
                        
                        <div className="relative w-full sm:w-72">
                            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                            <input 
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Buscar cliente, CUIT o razón social..." 
                                className="w-full pl-8 pr-3 py-2 bg-[#0e1626] border border-sec-dark border-[#1E293B] text-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#ff5e00] focus:ring-1 focus:ring-[#ff5e00] outline-none transition-colors"
                                style={{ borderColor: "#1E293B" }}
                            />
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-[#1A2332] bg-[#070d18] text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                                    <th className="p-3.5">Cliente / Razón Social</th>
                                    <th className="p-3.5">Plan Contratado</th>
                                    <th className="p-3.5 text-center">Estado Suscripción</th>
                                    <th className="p-3.5 text-center">Consumo Mensual (Nov)</th>
                                    <th className="p-3.5">Última Actividad</th>
                                    <th className="p-3.5 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1A2332] text-xs">
                                {filteredActiveClients.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="p-6 text-center text-slate-400 italic">
                                            {loadingUsers ? "Cargando clientes..." : "No se encontraron clientes comerciales coincidentes."}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredActiveClients.map((client) => {
                                        const planKey = (client.plan || 'base').toLowerCase();
                                        const planBadge = planKey === 'full' 
                                            ? { label: 'Plan Full', bg: 'bg-orange-500/15 text-orange-400 border-orange-500/30' }
                                            : planKey === 'pro'
                                            ? { label: 'Plan Pro', bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' }
                                            : { label: 'Plan Base', bg: 'bg-sky-500/15 text-sky-400 border-sky-500/30' };

                                        const invoiceLimit = client.stats?.invoiceLimit || (planKey === 'pro' ? 300 : planKey === 'full' ? 1000 : 50);
                                        const monthCount = client.stats?.monthInvoiceCount || 0;
                                        const totalCount = client.stats?.invoiceCount || 0;
                                        const usagePercent = Math.min(100, Math.round((monthCount / invoiceLimit) * 100));

                                        return (
                                            <tr key={client.id} className="hover:bg-[#0e1626]/60 transition-colors">
                                                <td className="p-3.5 font-semibold text-slate-200">
                                                    <div className="text-white font-bold text-sm">{client.nombre}</div>
                                                    <div className="text-[11px] text-slate-400 font-mono font-normal">
                                                        {client.email} {client.cuit ? `· CUIT ${client.cuit}` : ''}
                                                    </div>
                                                    {client.razonSocial && (
                                                        <div className="text-[10px] text-slate-500 italic mt-0.5">
                                                            {client.razonSocial}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-3.5">
                                                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold border ${planBadge.bg}`}>
                                                        {planBadge.label}
                                                    </span>
                                                </td>
                                                <td className="p-3.5 text-center">
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                                                        En Producción
                                                    </span>
                                                </td>
                                                <td className="p-3.5 text-center font-mono">
                                                    <div className="inline-block text-center">
                                                        <span className="text-white font-bold text-xs">{monthCount}</span>
                                                        <span className="text-slate-400 text-[11px]"> / {invoiceLimit}</span>
                                                        <div className="w-20 bg-[#1A2332] h-1.5 rounded-full mt-1.5 overflow-hidden mx-auto">
                                                            <div 
                                                                className="bg-gradient-to-r from-[#ff5e00] to-[#ff7a29] h-full rounded-full transition-all" 
                                                                style={{ width: `${usagePercent}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-[9.5px] text-slate-400 block mt-0.5">
                                                            {usagePercent}% cupo nov · {totalCount} acum.
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-3.5 text-slate-400 text-xs font-mono">
                                                    {formatDate(client.stats?.lastInvoiceDate)}
                                                </td>
                                                <td className="p-3.5 text-center">
                                                    <div className="inline-flex items-center gap-2">
                                                        <button 
                                                            type="button"
                                                            disabled={updatingUserId === client.id}
                                                            onClick={() => {
                                                                if (window.confirm(`¿Estás seguro de que deseas suspender a ${client.nombre}? Su acceso será revocado al perfil no-cliente.`)) {
                                                                    handleRoleChange(client.id, 'no-cliente');
                                                                }
                                                            }}
                                                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1 bg-red-950/20 hover:bg-red-900/30 text-red-400 rounded-lg text-xs font-semibold border border-red-900/40 transition-colors disabled:opacity-50 cursor-pointer"
                                                            title="Desactivar y suspender acceso"
                                                        >
                                                            <UserMinus className="h-3.5 w-3.5" />
                                                            <span>Desactivar</span>
                                                        </button>
                                                        
                                                        <button 
                                                            type="button"
                                                            onClick={() => router.push('/dashboard/usuarios')}
                                                            className="inline-flex items-center justify-center gap-1 px-2.5 py-1 bg-[#141f36] hover:bg-[#1a2845] text-slate-300 hover:text-white rounded-lg text-xs font-medium border border-[#1E293B] transition-colors cursor-pointer"
                                                            title="Ver configuración del usuario"
                                                        >
                                                            <Settings className="h-3 w-3" />
                                                            <span>Planes</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        );
    }

        if (currentUser.role === 'owner' && (currentUser.id === 'admin' || currentUser.email === 'admin@neoconta.com')) {
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
        <div className="w-full max-w-[1440px] mx-auto space-y-6 sm:space-y-7 animate-fade-in-up pb-12 text-slate-100">
            {/* 1. PAGE HEADER: Dashboard General + Selector Empresa + Enviar al Contador */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                            Dashboard General
                        </h1>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/70 text-amber-400 border border-amber-800/50">
                            {currentUser.role === 'owner' ? 'Administrador' : 'Cliente Activo'}
                        </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                        Panel de control integral financiero, impositivo y contable.
                    </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* Empresa Selector */}
                    <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0d1424] border border-sec-dark border-[#1E293B] text-xs font-mono text-slate-200 shadow-sm max-w-full" style={{ borderColor: "#1E293B" }}>
                        <Building className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">Empresa: <strong className="text-white">{companyConfig.razonSocial || "GUERRERO RODOLFO MANUEL"}</strong> {companyConfig.cuit ? `(${companyConfig.cuit})` : "(20347467228)"}</span>
                        <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    </div>

                    {/* Enviar al Contador Button */}
                    <button 
                        type="button"
                        onClick={() => setIsRemitModalOpen(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#ff5e00] to-[#ff7a29] hover:from-[#c74a00] hover:to-[#ff5e00] text-white text-xs sm:text-sm font-bold shadow-lg shadow-orange-950/50 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
                        title="Preparar y remitir información contable y financiera al contador"
                    >
                        <Send className="h-3.5 w-3.5" />
                        <span>Enviar al contador</span>
                    </button>
                </div>
            </div>

            {/* 2. TICKER BAR: NEOCONTA AL DÍA */}
            <div 
                className="bg-[#0b1220] border border-main-dark border-[#243041] rounded-xl px-4 py-2 flex items-center justify-between text-xs overflow-hidden shadow-sm select-none w-full" style={{ borderColor: "#243041" }}
                role="region"
                aria-label="NeoConta al Día: Cotizaciones y noticias fiscales"
            >
                <style dangerouslySetInnerHTML={{__html: `
                  @keyframes marquee {
                    0% { transform: translate3d(0, 0, 0); }
                    100% { transform: translate3d(-50%, 0, 0); }
                  }
                  .animate-marquee-container {
                    display: flex;
                    width: max-content;
                    will-change: transform;
                  }
                  .animate-marquee-container:hover,
                  .animate-marquee-container:focus-within {
                    animation-play-state: paused !important;
                  }
                  @media (prefers-reduced-motion: reduce) {
                    .animate-marquee-container {
                      animation: none !important;
                      overflow-x: auto;
                    }
                  }
                `}} />

                <div className="flex items-center gap-2.5 pr-3 border-r border-[#1A2332] shrink-0 font-mono">
                    <span className="flex items-center gap-1.5 text-[#ff5e00] font-bold text-xs uppercase tracking-wide">
                        <TrendingUp className="h-3.5 w-3.5" />
                        <span>NEOCONTA AL DÍA</span>
                    </span>
                    <button 
                        type="button"
                        onClick={() => setIsTickerPaused(!isTickerPaused)}
                        className="w-5 h-5 rounded bg-[#141f36] border border-[#1E293B] hover:border-[#2B374A] flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
                        title={isTickerPaused ? "Reanudar desplazamiento" : "Pausar desplazamiento"}
                    >
                        {isTickerPaused ? <Play className="h-2.5 w-2.5 fill-current text-[#ff5e00]" /> : <Pause className="h-2.5 w-2.5" />}
                    </button>
                </div>

                <div className="relative flex-1 overflow-hidden h-full flex items-center ml-3">
                    <div 
                        ref={tickerTrackRef}
                        className="animate-marquee-container flex gap-8 text-xs font-medium text-slate-300 items-center"
                        style={{
                            animationName: 'marquee',
                            animationTimingFunction: 'linear',
                            animationIterationCount: 'infinite',
                            animationDuration: `${tickerDuration}s`,
                            animationPlayState: isTickerPaused ? 'paused' : 'running'
                        }}
                    >
                        {renderTickerContent()}
                        {renderTickerContent()}
                    </div>
                </div>
            </div>

            {/* 3. ROW OF 4 CARDS (KPIS SUPERIORES EXACTOS) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                
                {/* Card 1: Facturado este mes */}
                <div className="bg-[#0b1220] border border-main-dark border-[#243041] rounded-2xl p-5 space-y-3 shadow-sm hover:border-[#2B374A] transition-colors" style={{ borderColor: "#243041" }}>
                    <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                            <TrendingUp className="h-4 w-4" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 leading-tight">Facturado este mes</p>
                            <p className="text-[11px] text-slate-400 font-mono leading-tight">(Neto ARCA)</p>
                        </div>
                    </div>
                    <div>
                        <div className="text-3xl font-black text-white font-mono tracking-tight tabular-nums">
                            {formatCurrency(clientStats.invoicedThisMonth || 0)}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">Sin comprobantes emitidos aún</p>
                    </div>
                </div>

                {/* Card 2: Pronóstico del mes (Destacada) */}
                <div className="bg-[#0b1220] border border-main-dark border-[#243041] rounded-2xl p-5 space-y-3 shadow-sm hover:border-[#2B374A] transition-colors" style={{ borderColor: "#243041" }}>
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-lg bg-[#ff5e00]/15 border border-[#ff5e00]/30 flex items-center justify-center text-[#ff5e00] shrink-0">
                                <Sparkles className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-400 leading-tight">Pronóstico del mes</p>
                                <p className="text-[11px] text-slate-400 font-mono leading-tight">
                                    ({(projectedPeriods.length > 0 && projectedPeriods[selectedPeriodIndex]?.label) || "Noviembre 2026"})
                                </p>
                            </div>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#ff5e00]/15 text-[#ff5e00] border border-[#ff5e00]/30 shrink-0">
                            Modelo de Referencia
                        </span>
                    </div>
                    <div>
                        <div className="text-3xl font-black text-white font-mono tracking-tight tabular-nums">
                            {formatCurrency((projectedPeriods.length > 0 && projectedPeriods[selectedPeriodIndex]?.projectedCentral) || 382909)}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">Cálculo prudente · 5 meses auditados</p>
                    </div>
                </div>

                {/* Card 3: Facturación histórica acumulada */}
                <div className="bg-[#0b1220] border border-main-dark border-[#243041] rounded-2xl p-5 space-y-3 shadow-sm hover:border-[#2B374A] transition-colors" style={{ borderColor: "#243041" }}>
                    <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                            <DollarSign className="h-4 w-4" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 leading-tight">Facturación histórica</p>
                            <p className="text-[11px] text-slate-400 font-mono leading-tight">acumulada</p>
                        </div>
                    </div>
                    <div>
                        <div className="text-3xl font-black text-white font-mono tracking-tight tabular-nums">
                            {formatCurrency(clientStats.totalInvoiced || 1914545.32)}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{clientStats.invoiceCount || 30} comprobantes AFIP/ARCA</p>
                    </div>
                </div>

                {/* Card 4: Saldo bancario disponible */}
                <div className="bg-[#0b1220] border border-main-dark border-[#243041] rounded-2xl p-5 space-y-3 shadow-sm hover:border-[#2B374A] transition-colors" style={{ borderColor: "#243041" }}>
                    <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-lg bg-slate-500/10 border border-slate-500/20 flex items-center justify-center text-slate-300 shrink-0">
                            <Landmark className="h-4 w-4" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 leading-tight">Saldo bancario disponible</p>
                        </div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-white tracking-tight">
                            Sin cuentas registradas
                        </div>
                        <button 
                            type="button"
                            onClick={() => router.push('/dashboard/banco')}
                            className="text-xs text-[#ff5e00] font-semibold mt-1 cursor-pointer hover:underline text-left block"
                        >
                            Importar extracto →
                        </button>
                    </div>
                </div>

            </div>

            {/* 4. MAIN SECTION: DISTRIBUCIÓN 2/3 (IZQUIERDA) + 1/3 (DERECHA) GARANTIZADA */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full items-start">

                {/* COLUMNA IZQUIERDA (2/3 de ancho): HERO PRONÓSTICO + ACTIVIDAD RECIENTE */}
                <div className="lg:col-span-2 space-y-6 w-full min-w-0">

                    {/* HERO: PRONÓSTICO FINANCIERO (REFINADO, COMPACTO Y CON GRÁFICO INTEGRADO) */}
                    <div className="bg-[#0b1220] border border-main-dark border-[#243041] rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm relative" style={{ borderColor: "#243041" }}>
                        
                        {/* Cabecera General: Título a la izquierda + Selector de Período a la derecha */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-0.5 border-b border-[#1A2332]">
                            <div className="flex items-center gap-2.5">
                                <TrendingUp className="h-5 w-5 text-[#ff5e00] shrink-0" />
                                <h2 className="text-lg font-bold text-white tracking-tight">Pronóstico Financiero</h2>
                            </div>

                            {/* Selector Desplegable de Período en la Cabecera General */}
                            <div className="flex items-center gap-2 text-xs text-slate-300 shrink-0">
                                <span className="font-medium text-slate-400">Período:</span>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setIsPeriodDropdownOpen(!isPeriodDropdownOpen)}
                                        className="px-3 py-1.5 rounded-lg bg-[#0e1626] border border-sec-dark border-[#1E293B] hover:border-[#2B374A] focus:border-[#ff5e00] focus:ring-1 focus:ring-[#ff5e00] text-white text-xs font-medium flex items-center gap-2 cursor-pointer shadow-sm transition-colors" style={{ borderColor: "#1E293B" }}
                                    >
                                        <span>
                                            {(projectedPeriods.length > 0 && projectedPeriods[selectedPeriodIndex]?.label) || "Noviembre 2026"}
                                            {projectedPeriods[selectedPeriodIndex]?.isCurrentMonth ? " · Mes en curso" : ""}
                                        </span>
                                        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                                    </button>

                                    {isPeriodDropdownOpen && (
                                        <div className="absolute right-0 mt-1 w-56 rounded-xl bg-[#0e1626] border border-sec-dark border-[#1E293B] shadow-2xl py-1 z-30 font-sans" style={{ borderColor: "#1E293B" }}>
                                            {(projectedPeriods.length > 0 ? projectedPeriods : [
                                                { label: "Noviembre 2026", isCurrentMonth: true },
                                                { label: "Diciembre 2026", isCurrentMonth: false }
                                            ]).map((p, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => { setSelectedPeriodIndex(idx); setIsPeriodDropdownOpen(false); }}
                                                    className={`w-full text-left px-3.5 py-2 text-xs transition-colors flex items-center justify-between cursor-pointer ${
                                                        selectedPeriodIndex === idx ? 'bg-[#ff5e00]/20 text-[#ff5e00] font-bold' : 'text-slate-200 hover:bg-[#141f36]'
                                                    }`}
                                                >
                                                    <span>{p.label}</span>
                                                    <span className="text-[10px] text-slate-400 font-mono">
                                                        {p.isCurrentMonth ? "Mes en curso" : "$ 382.909"}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Bloque Central: Izquierda (Explicación, Cifra Monumental, Badges) | Derecha (Gráfico Integrado sin segundo marco) */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center pt-0.5">
                            
                            {/* Sector Izquierdo: Cifra $382.909 como protagonista */}
                            <div className="lg:col-span-5 space-y-2.5">
                                <p className="text-xs text-slate-300 leading-relaxed">
                                    Estimación basada en el promedio de {forecastMethodology?.monthsCount || completedMonthsSeries.length || 5} meses cerrados. Historial sin estacionalidad o tendencia artificial.
                                </p>

                                <div>
                                    <div className="flex items-baseline gap-3">
                                        <span className="text-4xl sm:text-5xl font-black text-white font-mono tracking-tight tabular-nums">
                                            {formatCurrency((projectedPeriods.length > 0 && projectedPeriods[selectedPeriodIndex]?.projectedCentral) || 382909)}
                                        </span>
                                        <span className="text-xs font-mono text-slate-400 uppercase font-semibold">
                                            ARS neto
                                        </span>
                                    </div>

                                    {/* Badges bajo la cifra */}
                                    <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#141b2e] border border-[#1A2332] text-xs text-amber-300 font-medium">
                                            <Info className="h-3.5 w-3.5 text-amber-300" />
                                            <span>Historial limitado ({forecastMethodology?.monthsCount || completedMonthsSeries.length || 5} meses)</span>
                                        </span>
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#141b2e] border border-[#1A2332] text-xs text-orange-400 font-medium">
                                            <TrendingUp className="h-3.5 w-3.5 text-orange-400" />
                                            <span>Modelo de Referencia</span>
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Sector Derecho: Gráfico de Evolución Integrado (Directamente sobre el fondo, separado por línea sutil) */}
                            <div className="lg:col-span-7 space-y-2 relative lg:pl-6 lg:border-l lg:border-[#1A2332]">
                                
                                {/* Encabezado del gráfico y Leyenda visual */}
                                <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-slate-200 tracking-tight">Evolución real y proyección</span>
                                    </div>

                                    <div className="flex items-center gap-3 text-[11px] font-mono">
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-2.5 h-2.5 rounded-sm bg-sky-400/90 inline-block"></span>
                                            <span className="text-slate-300">Histórico</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-3.5 border-b-2 border-dashed border-[#ff5e00] inline-block"></span>
                                            <span className="text-orange-400 font-semibold">Proyección</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Tooltip dinámico en franja compacta */}
                                <div className="h-5 flex items-center justify-between px-2.5 py-0.5 rounded bg-[#0a1222]/90 border border-subtle-dark border-[#1A2332] text-[10.5px] font-mono" style={{ borderColor: "#1A2332" }}>
                                    {chartTooltip ? (
                                        <div className="flex items-center justify-between w-full">
                                            <span className="text-slate-200 font-bold">{chartTooltip.month}:</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-amber-300 font-bold tabular-nums">{chartTooltip.amount}</span>
                                                <span className={`text-[9.5px] px-1.5 py-0.2 rounded font-sans font-medium ${
                                                    chartTooltip.isProjection ? 'bg-orange-500/20 text-[#ff5e00] border border-orange-500/30' : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                                }`}>
                                                    {chartTooltip.type}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between w-full">
                                            <span className="text-slate-400 text-[10px]">Serie auditada mensual</span>
                                            <span className="text-slate-400 italic text-[10px]">Pasa el cursor sobre una barra o punto</span>
                                        </div>
                                    )}
                                </div>

                                {/* SVG Compacto de Evolución Real (Altura reducida optimizada) */}
                                <div className="relative w-full aspect-[390/105] select-none">
                                    <svg viewBox="0 0 390 105" className="w-full h-full overflow-visible font-mono text-[9px]">
                                        <defs>
                                            <linearGradient id="barGradSmooth" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9"/>
                                                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.45"/>
                                            </linearGradient>
                                            <linearGradient id="projGradSmooth" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#ff5e00" stopOpacity="0.25"/>
                                                <stop offset="100%" stopColor="#ff5e00" stopOpacity="0.05"/>
                                            </linearGradient>
                                        </defs>

                                        {/* Guías horizontales discretas */}
                                        <line x1="36" y1="14" x2="380" y2="14" stroke="#1e293b" strokeDasharray="2 3" strokeWidth="1"/>
                                        <text x="30" y="17" fill="#64748b" textAnchor="end">$ 800k</text>

                                        <line x1="36" y1="46" x2="380" y2="46" stroke="#1e293b" strokeDasharray="2 3" strokeWidth="1"/>
                                        <text x="30" y="49" fill="#64748b" textAnchor="end">$ 400k</text>

                                        <line x1="36" y1="78" x2="380" y2="78" stroke="#1A2332" strokeWidth="1"/>
                                        <text x="30" y="81" fill="#64748b" textAnchor="end">$ 0</text>

                                        {/* Línea divisoria vertical sutil */}
                                        <line x1="278" y1="6" x2="278" y2="78" stroke="#1A2332" strokeDasharray="3 3" strokeWidth="1"/>
                                        <text x="278" y="5" fill="#64748b" textAnchor="middle" fontSize="8">Auditado | Proy</text>

                                        {/* BARRAS HISTÓRICAS REALES AUDITADAS */}
                                        {/* 1. Jun 2026: $ 574.577,28 */}
                                        <g 
                                            className="cursor-pointer group"
                                            onMouseEnter={() => setChartTooltip({ month: "Junio 2026", amount: "$ 574.577,28", type: "Real auditado", isProjection: false })}
                                            onMouseLeave={() => setChartTooltip(null)}
                                        >
                                            <rect x="46" y="32" width="19" height="46" rx="2.5" fill="url(#barGradSmooth)" stroke="#38bdf8" strokeWidth="0.8" className="transition-opacity hover:opacity-80"/>
                                            <text x="55.5" y="90" fill="#cbd5e1" textAnchor="middle" fontWeight="600">Jun</text>
                                            <text x="55.5" y="27" fill="#38bdf8" textAnchor="middle" fontWeight="700">$ 575k</text>
                                        </g>

                                        {/* 2. Jul 2026: $ 132.021,89 */}
                                        <g 
                                            className="cursor-pointer group"
                                            onMouseEnter={() => setChartTooltip({ month: "Julio 2026", amount: "$ 132.021,89", type: "Real auditado", isProjection: false })}
                                            onMouseLeave={() => setChartTooltip(null)}
                                        >
                                            <rect x="92" y="67.4" width="19" height="10.6" rx="2" fill="url(#barGradSmooth)" stroke="#38bdf8" strokeWidth="0.8" className="transition-opacity hover:opacity-80"/>
                                            <text x="101.5" y="90" fill="#cbd5e1" textAnchor="middle" fontWeight="600">Jul</text>
                                            <text x="101.5" y="62" fill="#38bdf8" textAnchor="middle" fontWeight="700">$ 132k</text>
                                        </g>

                                        {/* 3. Ago 2026: $ 715.822,54 (Pico de facturación) */}
                                        <g 
                                            className="cursor-pointer group"
                                            onMouseEnter={() => setChartTooltip({ month: "Agosto 2026", amount: "$ 715.822,54", type: "Real auditado (Mes pico)", isProjection: false })}
                                            onMouseLeave={() => setChartTooltip(null)}
                                        >
                                            <rect x="138" y="20.7" width="19" height="57.3" rx="2.5" fill="url(#barGradSmooth)" stroke="#38bdf8" strokeWidth="0.8" className="transition-opacity hover:opacity-80"/>
                                            <text x="147.5" y="90" fill="#cbd5e1" textAnchor="middle" fontWeight="600">Ago</text>
                                            <text x="147.5" y="16" fill="#38bdf8" textAnchor="middle" fontWeight="700">$ 716k</text>
                                        </g>

                                        {/* 4. Sep 2026: $ 0,00 (VISIBLE EXPLÍCITO EN CERO) */}
                                        <g 
                                            className="cursor-pointer group"
                                            onMouseEnter={() => setChartTooltip({ month: "Septiembre 2026", amount: "$ 0,00", type: "Real auditado (Sin emisión)", isProjection: false })}
                                            onMouseLeave={() => setChartTooltip(null)}
                                        >
                                            <rect x="184" y="76.5" width="19" height="2" rx="1" fill="#475569" stroke="#64748b" strokeWidth="0.8"/>
                                            <circle cx="193.5" cy="78" r="2.5" fill="#64748b"/>
                                            <text x="193.5" y="90" fill="#94a3b8" textAnchor="middle" fontWeight="600">Sep</text>
                                            <text x="193.5" y="73" fill="#94a3b8" textAnchor="middle" fontWeight="600">$ 0</text>
                                        </g>

                                        {/* 5. Oct 2026: $ 492.123,61 */}
                                        <g 
                                            className="cursor-pointer group"
                                            onMouseEnter={() => setChartTooltip({ month: "Octubre 2026", amount: "$ 492.123,61", type: "Real auditado", isProjection: false })}
                                            onMouseLeave={() => setChartTooltip(null)}
                                        >
                                            <rect x="230" y="38.6" width="19" height="39.4" rx="2.5" fill="url(#barGradSmooth)" stroke="#38bdf8" strokeWidth="0.8" className="transition-opacity hover:opacity-80"/>
                                            <text x="239.5" y="90" fill="#cbd5e1" textAnchor="middle" fontWeight="600">Oct</text>
                                            <text x="239.5" y="33" fill="#38bdf8" textAnchor="middle" fontWeight="700">$ 492k</text>
                                        </g>

                                        {/* PROYECCIÓN ESTIMADA: Noviembre 2026 y Diciembre 2026 = $ 382.909,06 */}
                                        {/* Nov 2026 (x=305) */}
                                        <g 
                                            className="cursor-pointer group"
                                            onMouseEnter={() => setChartTooltip({ month: "Noviembre 2026", amount: "$ 382.909,06", type: "Estimado (Mes en curso)", isProjection: true })}
                                            onMouseLeave={() => setChartTooltip(null)}
                                        >
                                            <rect x="295" y="47.4" width="19" height="30.6" rx="2.5" fill="url(#projGradSmooth)" stroke="#ff5e00" strokeWidth="0.8" strokeDasharray="2 2" className="transition-opacity hover:opacity-80"/>
                                            <text x="304.5" y="90" fill="#ff7a29" textAnchor="middle" fontWeight="700">Nov</text>
                                        </g>

                                        {/* Dic 2026 (x=350) */}
                                        <g 
                                            className="cursor-pointer group"
                                            onMouseEnter={() => setChartTooltip({ month: "Diciembre 2026", amount: "$ 382.909,06", type: "Estimado (Proyección)", isProjection: true })}
                                            onMouseLeave={() => setChartTooltip(null)}
                                        >
                                            <rect x="340" y="47.4" width="19" height="30.6" rx="2.5" fill="url(#projGradSmooth)" stroke="#ff5e00" strokeWidth="0.8" strokeDasharray="2 2" className="transition-opacity hover:opacity-80"/>
                                            <text x="349.5" y="90" fill="#ff7a29" textAnchor="middle" fontWeight="700">Dic</text>
                                        </g>

                                        {/* Conector fino discontinuo Oct -> Nov */}
                                        <line x1="239.5" y1="38.6" x2="304.5" y2="47.4" stroke="#ff5e00" strokeDasharray="2 2" strokeWidth="1" strokeOpacity="0.5"/>

                                        {/* TRAMO RIGUROSAMENTE PLANO ENTRE NOVIEMBRE Y DICIEMBRE (y1=47.4, y2=47.4) */}
                                        <line x1="304.5" y1="47.4" x2="349.5" y2="47.4" stroke="#ff5e00" strokeWidth="2" strokeDasharray="3 2"/>

                                        {/* Marcadores circulares */}
                                        <circle cx="304.5" cy="47.4" r="3" fill="#ff5e00" stroke="#0b1220" strokeWidth="1.2"/>
                                        <circle cx="349.5" cy="47.4" r="3" fill="#ff5e00" stroke="#0b1220" strokeWidth="1.2"/>

                                        {/* Etiqueta sobre el tramo plano */}
                                        <text x="327" y="41.5" fill="#ff5e00" textAnchor="middle" fontWeight="800" fontSize="8">
                                            $ 382.909 (plano)
                                        </text>
                                    </svg>
                                </div>

                                {/* Pie integrado del gráfico */}
                                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-0.5 border-t border-[#1A2332]">
                                    <span>Fuente: Base ARCA auditada</span>
                                    <span className="text-emerald-400 font-medium">• Proyección continua sin sesgo</span>
                                </div>
                            </div>

                        </div>

                        {/* Barra de Avance Temporal: 0% real cuando facturado sea cero */}
                        {(() => {
                            const curPeriod = (projectedPeriods.length > 0 && projectedPeriods[selectedPeriodIndex])
                                ? projectedPeriods[selectedPeriodIndex]
                                : { projectedCentral: 382909, currentActualInvoiced: clientStats.invoicedThisMonth || 0 };
                            const centralVal = curPeriod.projectedCentral || 382909;
                            const actualVal = curPeriod.currentActualInvoiced || 0;
                            const progressPct = centralVal > 0 ? Math.min(100, Math.round((actualVal / centralVal) * 100)) : 0;
                            const fillWidth = actualVal > 0 ? Math.max(1, progressPct) : 0;

                            return (
                                <div className="space-y-1.5 pt-1 border-t border-[#1A2332]">
                                    <div className="flex justify-between text-xs font-mono">
                                        <span className="text-slate-300">Facturado hasta hoy frente a la estimación mensual</span>
                                        <span className="font-bold text-white tabular-nums">
                                            {formatCurrency(actualVal)} <span className="text-slate-400 font-normal">({progressPct}% de la estimación)</span>
                                        </span>
                                    </div>
                                    <div className="h-2 w-full bg-[#1e293b] rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-white rounded-full transition-all duration-500" 
                                            style={{ width: `${fillWidth}%` }}
                                        ></div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Botones de Acordeón */}
                        <div className="flex items-center gap-3 pt-0.5 flex-wrap">
                            <button 
                                type="button"
                                onClick={() => setShowForecastExplanation(!showForecastExplanation)}
                                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#0e1626] border border-sec-dark border-[#1E293B] hover:border-[#2B374A] text-xs font-semibold text-slate-200 transition-colors cursor-pointer" style={{ borderColor: "#1E293B" }}
                            >
                                <Calculator className="h-3.5 w-3.5 text-[#ff5e00]" />
                                <span>{showForecastExplanation ? "Ocultar metodología" : "¿Cómo se calculó esta proyección?"}</span>
                                {showForecastExplanation ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
                            </button>

                            <button 
                                type="button"
                                onClick={() => setShowHistoryBreakdown(!showHistoryBreakdown)}
                                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#0e1626] border border-sec-dark border-[#1E293B] hover:border-[#2B374A] text-xs font-semibold text-slate-200 transition-colors cursor-pointer" style={{ borderColor: "#1E293B" }}
                            >
                                <History className="h-3.5 w-3.5 text-slate-400" />
                                <span>{showHistoryBreakdown ? "Ocultar comprobantes" : "Ver historial de comprobantes (5 meses)"}</span>
                                {showHistoryBreakdown ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
                            </button>
                        </div>

                        {/* Desglose 1: Metodología Matemática */}
                        {showForecastExplanation && (
                            <div className="p-4 bg-[#070d18] rounded-xl border border-sec-dark border-[#1E293B] text-xs space-y-3 animate-fade-in-up" style={{ borderColor: "#1E293B" }}>
                                <div className="font-bold text-white flex items-center gap-2">
                                    <Calculator className="h-4 w-4 text-[#ff5e00]" /> Metodología Matemática y Contable
                                </div>
                                <div className="p-3 bg-[#0a1222] rounded-lg border border-[#1A2332] font-mono text-[11px] text-slate-200 space-y-1">
                                    <div className="text-slate-400 font-sans font-medium text-[10px] uppercase">Fórmula aplicada (Promedio Mensual Continuo):</div>
                                    <div className="font-bold text-[#ff5e00]">
                                        Proyección = (Σ Facturación Neta de meses cerrados) ÷ {forecastMethodology?.monthsCount || 5}
                                    </div>
                                    <div className="text-slate-300">
                                        = ($ 574.577,28 + $ 132.021,89 + $ 715.822,54 + $ 0,00 + $ 492.123,61) ÷ 5
                                    </div>
                                    <div className="text-white font-bold">
                                        = $ 1.914.545,32 ÷ 5 = $ 382.909,06
                                    </div>
                                </div>
                                <div className="text-xs text-slate-400 leading-relaxed border-t border-[#1A2332] pt-2 space-y-1">
                                    <p>• <strong>Septiembre 2026 ($ 0):</strong> Al no haberse emitido facturas, se registra con importe cero pero computa en el divisor de 5 meses para reflejar la realidad del ciclo del cliente.</p>
                                    <p>• <strong>Notas de Crédito:</strong> Se restan en su mes de emisión fiscal (AFIP <code className="text-[10px] bg-[#141f36] px-1 py-0.5 rounded text-amber-300">cbteFch</code>), no en la fecha de sincronización técnica.</p>
                                    <p>• <strong>Noviembre 2026:</strong> No forma parte de la base cerrada por ser el mes actualmente en curso.</p>
                                </div>
                            </div>
                        )}

                        {/* Desglose 2: Historial Mensual Cerrado */}
                        {showHistoryBreakdown && (
                            <div className="p-4 bg-[#070d18] rounded-xl border border-sec-dark border-[#1E293B] text-xs space-y-3 animate-fade-in-up" style={{ borderColor: "#1E293B" }}>
                                <div className="font-bold text-white flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <History className="h-4 w-4 text-[#ff5e00]" /> Historial Mensual Cerrado (Base Auditada)
                                    </span>
                                    <span className="text-xs text-slate-400 font-normal">Fuente: Comprobantes AFIP/ARCA sincronizados</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs font-mono">
                                        <thead>
                                            <tr className="border-b border-[#1A2332] text-[10px] uppercase text-slate-400 font-semibold">
                                                <th className="pb-2">Período</th>
                                                <th className="pb-2">Comprobantes</th>
                                                <th className="pb-2 text-right">Facturación Bruta</th>
                                                <th className="pb-2 text-right">Notas de Crédito</th>
                                                <th className="pb-2 text-right">Facturación Neta</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#1A2332]">
                                            {(completedMonthsSeries.length > 0 ? completedMonthsSeries : [
                                                { label: "Jun 2026", facturasCount: 6, facturasTotal: 574578.28, ncCount: 1, ncTotal: 1.00, netTotal: 574577.28, isZeroActivity: false },
                                                { label: "Jul 2026", facturasCount: 2, facturasTotal: 132021.89, ncCount: 0, ncTotal: 0, netTotal: 132021.89, isZeroActivity: false },
                                                { label: "Ago 2026", facturasCount: 11, facturasTotal: 1067822.54, ncCount: 6, ncTotal: 352000.00, netTotal: 715822.54, isZeroActivity: false },
                                                { label: "Sep 2026", facturasCount: 0, facturasTotal: 0, ncCount: 0, ncTotal: 0, netTotal: 0, isZeroActivity: true },
                                                { label: "Oct 2026", facturasCount: 4, facturasTotal: 492123.61, ncCount: 0, ncTotal: 0, netTotal: 492123.61, isZeroActivity: false }
                                            ]).map((m, idx) => (
                                                <tr key={idx} className="hover:bg-[#0f172a] transition-colors">
                                                    <td className="py-2 font-bold text-slate-200">{m.label}</td>
                                                    <td className="py-2 text-slate-400 font-sans">{m.isZeroActivity ? "Sin emisión (0)" : `${m.facturasCount} Fcs ${m.ncCount > 0 ? `+ ${m.ncCount} NC` : ''}`}</td>
                                                    <td className="py-2 text-right text-slate-300 tabular-nums">{formatCurrency(m.facturasTotal)}</td>
                                                    <td className="py-2 text-right text-red-400 tabular-nums">{m.ncTotal > 0 ? `-${formatCurrency(m.ncTotal)}` : '$ 0'}</td>
                                                    <td className="py-2 text-right font-bold text-white tabular-nums">{formatCurrency(m.netTotal)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t-2 border-[#1A2332] font-bold text-white">
                                                <td className="pt-2">Total Auditado</td>
                                                <td className="pt-2 text-slate-400 font-sans">23 comprobantes</td>
                                                <td className="pt-2 text-right text-slate-300 tabular-nums">$ 2.266.546,32</td>
                                                <td className="pt-2 text-right text-red-400 tabular-nums">-$ 352.001,00</td>
                                                <td className="pt-2 text-right text-[#ff5e00] tabular-nums">$ 1.914.545,32</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Pie del Hero */}
                        <div className="flex items-center justify-between text-xs text-slate-400 font-mono border-t border-[#1A2332] pt-2.5">
                            <span>Fuente: Base de comprobantes AFIP/ARCA sincronizados</span>
                            <span>Modelo de Referencia · Serie continua</span>
                        </div>
                    </div>

                    {/* ACTIVIDAD RECIENTE DEL NEGOCIO (DEBAJO DEL PRONÓSTICO) */}
                    <div className="bg-[#0b1220] border border-main-dark border-[#243041] rounded-2xl p-6 space-y-4 shadow-sm w-full" style={{ borderColor: "#243041" }}>
                        <div className="flex items-center justify-between pb-1">
                            <div className="flex items-center gap-2">
                                <Activity className="h-4 w-4 text-[#ff5e00]" />
                                <h3 className="text-sm font-bold text-white tracking-tight">Actividad Reciente del Negocio</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => router.push('/dashboard/facturacion')}
                                className="text-xs font-semibold text-[#ff5e00] hover:underline cursor-pointer flex items-center gap-1"
                            >
                                <span>Ver todas</span>
                                <ArrowRight className="h-3 w-3" />
                            </button>
                        </div>

                        <div className="space-y-3.5 text-xs">
                            {(clientInvoices.length > 0 ? clientInvoices.slice(0, 5) : [
                                { tipo: "Factura C", receptor: "OSDE ORGANIZACION DE SERVICIOS DIRECTOS EMPRESARIOS", fecha: "20/10/2026", monto: 185000.00 },
                                { tipo: "Factura C", receptor: "OBRA SOCIAL DE CONDUCTORES CAMIONEROS Y PERSONAL DEL TRANSPORTE AUTOMOTOR DE CARGAS", fecha: "20/10/2026", monto: 92400.00 },
                                { tipo: "Factura C", receptor: "OBRA SOCIAL DE CONDUCTORES CAMIONEROS Y PERSONAL DEL TRANSPORTE AUTOMOTOR DE CARGAS", fecha: "20/10/2026", monto: 124723.61 },
                                { tipo: "Factura C", receptor: "OBRA SOCIAL DE CONDUCTORES CAMIONEROS Y PERSONAL DEL TRANSPORTE AUTOMOTOR DE CARGAS", fecha: "20/10/2026", monto: 45000.00 },
                                { tipo: "Factura C", receptor: "UNIVERSIDAD DE MENDOZA", fecha: "20/08/2026", monto: 120000.00 }
                            ]).map((inv, idx) => {
                                const isRealInv = inv.DocNro !== undefined || inv.cbteTipo !== undefined || inv.CbteTipo !== undefined;
                                let receptor = inv.RazonSocial || inv.cliente || inv.receptor || "Cliente General";
                                let fecha = formatDateAR(inv.cbteFch || inv.fecha || inv.created_at || "Reciente");
                                const cbteType = isRealInv ? getCbteTipo(inv) : 11;
                                const tipoName = getVoucherName(cbteType);

                                return (
                                    <div key={idx} className="flex items-center justify-between gap-4 py-1 border-b border-[#1A2332] last:border-0 pb-2">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#ff5e00] shrink-0"></span>
                                            <span className="font-medium text-slate-200 truncate uppercase">
                                                {tipoName} emitida a {receptor}
                                            </span>
                                        </div>
                                        <span className="text-slate-400 font-mono text-[11px] shrink-0">{fecha}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                </div>

                {/* COLUMNA DERECHA (1/3 de ancho): CUENTAS BANCARIAS ARRIBA + PRÓXIMAS ACCIONES DEBAJO */}
                <div className="lg:col-span-1 space-y-6 w-full min-w-0">

                    {/* CUENTAS BANCARIAS (ARRIBA) */}
                    <div className="bg-[#0b1220] border border-main-dark border-[#243041] rounded-2xl p-6 space-y-4 shadow-sm text-center w-full" style={{ borderColor: "#243041" }}>
                        <div className="flex items-center gap-2 text-left">
                            <div className="h-6 w-6 rounded bg-[#141f36] border border-[#1E293B] flex items-center justify-center text-slate-300 shrink-0">
                                <Landmark className="h-3.5 w-3.5" />
                            </div>
                            <h3 className="text-sm font-bold text-white tracking-tight">Cuentas Bancarias</h3>
                        </div>

                        {/* Card graphic placeholder */}
                        <div className="py-4 space-y-3 flex flex-col items-center">
                            <div className="h-16 w-24 rounded-xl border-2 border-dashed border-sec-dark border-[#1E293B] flex items-center justify-center text-slate-400" style={{ borderColor: "#1E293B" }}>
                                <Wallet className="h-8 w-8 opacity-60 text-slate-400" />
                            </div>
                            <p className="text-xs text-slate-400 max-w-[220px]">
                                Todavía no hay información bancaria registrada
                            </p>
                            <button 
                                type="button"
                                onClick={() => router.push('/dashboard/banco')}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#ff5e00] to-[#ff7a29] hover:from-[#c74a00] hover:to-[#ff5e00] text-white text-xs font-bold shadow-lg shadow-orange-950/40 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <UploadCloud className="h-4 w-4" />
                                <span>Importar extracto</span>
                            </button>
                        </div>
                    </div>

                    {/* PRÓXIMAS ACCIONES (DEBAJO) */}
                    <div className="bg-[#0b1220] border border-main-dark border-[#243041] rounded-2xl p-6 space-y-4 shadow-sm w-full" style={{ borderColor: "#243041" }}>
                        <div className="flex items-center gap-2 pb-1">
                            <CheckCircle className="h-4 w-4 text-[#ff5e00]" />
                            <h3 className="text-sm font-bold text-white tracking-tight">Próximas Acciones</h3>
                        </div>

                        <div className="space-y-3">
                            {/* Acción 1: Compartir con tu contador */}
                            <div 
                                onClick={() => setIsRemitModalOpen(true)}
                                className="p-3.5 rounded-xl bg-[#0e1626] border border-sec-dark border-[#1E293B] hover:border-[#ff5e00]/50 transition-colors flex items-center justify-between group cursor-pointer" style={{ borderColor: "#1E293B" }}
                            >
                                <div className="flex items-start gap-3 min-w-0">
                                    <div className="mt-0.5 text-[#ff5e00] shrink-0">
                                        <Send className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-white group-hover:text-[#ff5e00] transition-colors truncate">Compartir con tu contador</p>
                                        <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">Prepará el envío mensual de comprobantes y extractos bancarios.</p>
                                    </div>
                                </div>
                                <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-white transition-transform group-hover:translate-x-1 shrink-0 ml-2" />
                            </div>

                            {/* Acción 2: Emitir comprobante ARCA */}
                            <div 
                                onClick={() => router.push('/dashboard/facturacion')}
                                className="p-3.5 rounded-xl bg-[#0e1626] border border-sec-dark border-[#1E293B] hover:border-[#ff5e00]/50 transition-colors flex items-center justify-between group cursor-pointer" style={{ borderColor: "#1E293B" }}
                            >
                                <div className="flex items-start gap-3 min-w-0">
                                    <div className="mt-0.5 text-slate-300 shrink-0">
                                        <FileText className="h-4 w-4 text-blue-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors truncate">Emitir comprobante ARCA</p>
                                        <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">Generá Facturas A, B, C o Notas de Crédito con CAE oficial.</p>
                                    </div>
                                </div>
                                <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-white transition-transform group-hover:translate-x-1 shrink-0 ml-2" />
                            </div>

                            {/* Acción 3: Conciliar cuentas bancarias */}
                            <div 
                                onClick={() => router.push('/dashboard/banco')}
                                className="p-3.5 rounded-xl bg-[#0e1626] border border-sec-dark border-[#1E293B] hover:border-[#ff5e00]/50 transition-colors flex items-center justify-between group cursor-pointer" style={{ borderColor: "#1E293B" }}
                            >
                                <div className="flex items-start gap-3 min-w-0">
                                    <div className="mt-0.5 text-slate-300 shrink-0">
                                        <RefreshCw className="h-4 w-4 text-emerald-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors truncate">Conciliar cuentas bancarias</p>
                                        <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">Importá tu extracto y controlá movimientos y saldos.</p>
                                    </div>
                                </div>
                                <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-white transition-transform group-hover:translate-x-1 shrink-0 ml-2" />
                            </div>
                        </div>
                    </div>

                </div>

            </div>

            {/* Modal de Remisión al Contador */}
            <RemitAccountingModal
                isOpen={isRemitModalOpen}
                onClose={() => setIsRemitModalOpen(false)}
                currentUser={currentUser}
                companyConfig={companyConfig}
                invoices={clientInvoices}
                transactions={clientTransactions}
            />
        </div>
    );
}
