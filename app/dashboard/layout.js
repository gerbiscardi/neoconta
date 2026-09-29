"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { LayoutDashboard, FileText, Wallet, Settings, Menu, X, Bell, User, LogOut, Users, MessageSquare, LineChart, HeartPulse, Sun, Moon, Palette } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import OnboardingWizard from "../components/OnboardingWizard";
import SystemStatusBadge from "../components/SystemStatusBadge";
import QuickSearchModal from "../components/QuickSearchModal";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";

export default function DashboardLayout({ children }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [userConfig, setUserConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [theme, setTheme] = useState('pizarra'); // 'pizarra' | 'claro' | 'oscuro'
    const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
    const [showOnboardingModal, setShowOnboardingModal] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    
    const router = useRouter();
    const pathname = usePathname();

    useKeyboardShortcuts({
        onSearch: () => setIsSearchOpen(true),
        onNewPatient: () => router.push('/dashboard/vitacore'),
        onNewAppointment: () => router.push('/dashboard/vitacore/turnos')
    });

    useEffect(() => {
        // Load saved theme
        const savedTheme = localStorage.getItem('neoconta_theme');
        if (savedTheme) {
            setTheme(savedTheme);
        }

        const userStr = localStorage.getItem('neoconta_user');
        if (!userStr) {
            router.push("/login");
            setLoading(false);
        } else {
            const user = JSON.parse(userStr);
            setCurrentUser(user);
            
            const targetUserId = (user.role === 'vitacore-professional' || user.role === 'vitacore-receptionist') ? user.parentId : user.id;
            if (user.role === 'cliente' || user.role === 'vitacore-professional' || user.role === 'vitacore-receptionist') {
                fetch(`/api/user/config?userId=${targetUserId}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            setUserConfig(data);
                            if (user.role === 'cliente' && (!data.onboardingCompleted || !data.razonSocial)) {
                                setShowOnboardingModal(true);
                            }
                        }
                        setLoading(false);
                    })
                    .catch(err => {
                        console.error("Error loading config:", err);
                        setLoading(false);
                    });
            } else {
                setLoading(false);
            }
        }
    }, [router]);

    const handleThemeChange = (newTheme) => {
        setTheme(newTheme);
        localStorage.setItem('neoconta_theme', newTheme);
        setIsThemeMenuOpen(false);
    };

    useEffect(() => {
        const root = document.documentElement;
        if (theme === 'claro') {
            root.classList.remove('dark');
            root.classList.add('light');
        } else {
            root.classList.remove('light');
            root.classList.add('dark');
        }
    }, [theme]);

    useEffect(() => {
        if (!loading && currentUser && (currentUser.role === 'cliente' || currentUser.role === 'vitacore-professional' || currentUser.role === 'vitacore-receptionist') && userConfig) {
            const features = userConfig.features || {};
            const path = pathname;
            if (currentUser.role === 'vitacore-professional' || currentUser.role === 'vitacore-receptionist') {
                if (!path.startsWith('/dashboard/vitacore')) {
                    router.push('/dashboard/vitacore');
                }
            } else {
                if (path === '/dashboard/commentor' && !features.moduloImagenWeb) {
                    router.push('/dashboard');
                } else if (path === '/dashboard/commander' && !(features.biBasico || features.biAvanzado || features.biPremium)) {
                    router.push('/dashboard');
                } else if (path === '/dashboard/banco' && !features.moduloBanco) {
                    router.push('/dashboard');
                } else if (path === '/dashboard/facturacion' && !(features.facturacionManual || features.facturacionMasiva)) {
                    router.push('/dashboard');
                }
            }
        }
    }, [loading, currentUser, userConfig, pathname, router]);

    const handleLogout = () => {
        localStorage.removeItem('neoconta_user');
        router.push("/login");
    };

    const getNavItems = () => {
        const items = [
            { 
                name: "Inicio", 
                icon: <LayoutDashboard className="h-5 w-5" />, 
                href: "/dashboard",
                gradient: "from-orange-500 to-amber-500",
                activeStyle: "border-orange-500/30 bg-orange-500/5 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 shadow-sm",
                inactiveHoverStyle: "hover:border-orange-500/20 hover:bg-orange-500/5 dark:hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400"
            }
        ];

        if (!currentUser) return items;

        const role = currentUser.role;
        const features = userConfig?.features || {};

        if (role === 'vitacore-professional' || role === 'vitacore-receptionist') {
            return [
                { 
                    name: "Vitacore Medical", 
                    icon: <HeartPulse className="h-5 w-5" />, 
                    href: "/dashboard/vitacore",
                    gradient: "from-emerald-500 to-teal-500",
                    activeStyle: "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm",
                    inactiveHoverStyle: "hover:border-emerald-500/20 hover:bg-emerald-500/5 dark:hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400"
                }
            ];
        }

        if (role === 'owner' || features.facturacionManual || features.facturacionMasiva) {
            items.push({ 
                name: (features.facturacionMasiva || role === 'owner') ? "Facturación Masiva" : "Facturación Manual", 
                icon: <FileText className="h-5 w-5" />, 
                href: "/dashboard/facturacion",
                gradient: "from-blue-500 to-indigo-500",
                activeStyle: "border-blue-500/30 bg-blue-500/5 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-sm",
                inactiveHoverStyle: "hover:border-blue-500/20 hover:bg-blue-500/5 dark:hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400"
            });
        }

        if (role === 'owner' || features.biBasico || features.biAvanzado || features.biPremium) {
            items.push({ 
                name: "Commander BI", 
                icon: <LineChart className="h-5 w-5" />, 
                href: "/dashboard/commander",
                gradient: "from-rose-500 to-pink-500",
                activeStyle: "border-rose-500/30 bg-rose-500/5 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-sm",
                inactiveHoverStyle: "hover:border-rose-500/20 hover:bg-rose-500/5 dark:hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
            });
        }

        if (role === 'owner' || features.moduloBanco) {
            items.push({ 
                name: "Banco", 
                icon: <Wallet className="h-5 w-5" />, 
                href: "/dashboard/banco",
                gradient: "from-violet-500 to-fuchsia-500",
                activeStyle: "border-violet-500/30 bg-violet-500/5 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 shadow-sm",
                inactiveHoverStyle: "hover:border-violet-500/20 hover:bg-violet-500/5 dark:hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-400"
            });
        }

        if (role === 'owner' || features.moduloImagenWeb) {
            items.push({ 
                name: "Commentor", 
                icon: <MessageSquare className="h-5 w-5" />, 
                href: "/dashboard/commentor",
                gradient: "from-orange-500 to-amber-500",
                activeStyle: "border-orange-500/30 bg-orange-500/5 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 shadow-sm",
                inactiveHoverStyle: "hover:border-orange-500/20 hover:bg-orange-500/5 dark:hover:bg-emerald-500/10 hover:text-orange-600 dark:hover:text-orange-400"
            });
        }

        if (role === 'owner' || features.moduloVitacore || features.moduloVitacore === undefined) {
            items.push({ 
                name: "Vitacore", 
                icon: <HeartPulse className="h-5 w-5" />, 
                href: "/dashboard/vitacore",
                gradient: "from-emerald-500 to-teal-500",
                activeStyle: "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm",
                inactiveHoverStyle: "hover:border-emerald-500/20 hover:bg-emerald-500/5 dark:hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400"
            });
        }

        items.push({ 
            name: "Configuración", 
            icon: <Settings className="h-5 w-5" />, 
            href: "/dashboard/configuracion",
            gradient: "from-slate-400 to-slate-500",
            activeStyle: "border-slate-500/30 bg-slate-500/5 dark:bg-slate-500/10 text-slate-600 dark:text-slate-400 shadow-sm",
            inactiveHoverStyle: "hover:border-slate-500/20 hover:bg-slate-500/5 dark:hover:bg-slate-500/10 hover:text-slate-600 dark:hover:text-slate-400"
        });

        if (role === 'owner') {
            items.push({
                name: "Usuarios",
                icon: <Users className="h-5 w-5" />,
                href: "/dashboard/usuarios",
                gradient: "from-cyan-500 to-sky-500",
                activeStyle: "border-cyan-500/30 bg-cyan-500/5 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 shadow-sm",
                inactiveHoverStyle: "hover:border-cyan-500/20 hover:bg-cyan-500/5 dark:hover:bg-cyan-500/10 hover:text-cyan-600 dark:hover:text-cyan-400"
            });
        }

        return items;
    };

    const navItems = getNavItems();

    const getRoleBadge = (role) => {
        switch (role) {
            case 'owner': return 'Dueño (Admin)';
            case 'cliente': return 'Cliente';
            case 'vitacore-professional': return 'Médico';
            case 'vitacore-receptionist': return 'Recepción';
            case 'no-cliente': return 'No Cliente';
            default: return 'Usuario';
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen w-screen bg-[#0b1329] items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-emerald-500"></div>
            </div>
        );
    }

    // Dynamic Theme Classes
    const rootBg = theme === 'claro' ? 'bg-slate-100 text-slate-900' : theme === 'oscuro' ? 'bg-black text-slate-100' : 'bg-[#0b1329] text-slate-100';
    const sidebarBg = theme === 'claro' ? 'bg-white border-slate-200' : theme === 'oscuro' ? 'bg-zinc-950 border-zinc-900' : 'bg-[#0f172a] border-slate-800/80';
    const headerBg = theme === 'claro' ? 'bg-white/90 border-slate-200' : theme === 'oscuro' ? 'bg-zinc-950/90 border-zinc-900' : 'bg-[#0f172a]/90 border-slate-800/80';
    const mainBg = theme === 'claro' ? 'bg-slate-100' : theme === 'oscuro' ? 'bg-black' : 'bg-[#0b1329]';

    return (
        <div className={`flex h-screen ${rootBg} font-sans transition-colors duration-300`}>
            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-64 ${sidebarBg} border-r transform transition-transform duration-200 ease-in-out ${
                    isSidebarOpen ? "translate-x-0" : "-translate-x-full"
                } md:relative md:translate-x-0`}
            >
                <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200 dark:border-slate-800/80">
                    <Link href="/dashboard" className="flex items-center gap-2">
                        <img src="/assets/navbar_logo.png" alt="NeoConta" className="h-8 w-auto object-contain" />
                    </Link>
                    <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-500">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <nav className="p-4 space-y-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`relative flex items-center gap-3 px-4 py-3 border transition-all duration-300 hover:-translate-y-0.5 overflow-hidden group mb-2 rounded-xl ${
                                    isActive
                                        ? item.activeStyle
                                        : theme === 'claro'
                                            ? 'border-slate-200 text-slate-700 hover:bg-slate-50'
                                            : 'border-slate-800/40 text-slate-300 hover:bg-slate-800/40'
                                }`}
                            >
                                <div className="group-hover:scale-110 transition-transform duration-200">
                                    {item.icon}
                                </div>
                                <span className="font-medium text-sm">{item.name}</span>
                                {/* Bottom Glow Line */}
                                <div className={`absolute bottom-0 left-0 w-full h-[3px] bg-gradient-to-r ${item.gradient} transform origin-left transition-transform duration-300 ease-out ${
                                    isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                                }`}></div>
                            </Link>
                        );
                    })}
                </nav>

                <div className="absolute bottom-4 left-4 right-4">
                    <button
                        onClick={handleLogout}
                        className={`relative flex items-center gap-3 w-full px-4 py-3 border rounded-xl transition-all duration-300 hover:-translate-y-0.5 overflow-hidden group ${
                            theme === 'claro' 
                                ? 'bg-white border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-600' 
                                : 'bg-slate-900/40 border-slate-800/40 text-slate-400 hover:bg-red-500/10 hover:text-red-400'
                        }`}
                    >
                        <LogOut className="h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
                        <span className="font-medium text-sm">Cerrar Sesión</span>
                        <div className="absolute bottom-0 left-0 w-full h-[3px] bg-gradient-to-r from-red-500 to-rose-500 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-out"></div>
                    </button>
                </div>
            </aside>

            {/* Main Content Wrapper */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top Header */}
                <header className={`flex items-center justify-between h-16 px-6 ${headerBg} backdrop-blur-sm sticky top-0 z-40 transition-colors`}>
                    <button
                        className="md:hidden p-2 -ml-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                        onClick={() => setIsSidebarOpen(true)}
                    >
                        <Menu className="h-6 w-6" />
                    </button>

                    <div className="flex items-center gap-3 ml-auto">
                        {/* Quick Search Spotlight Button */}
                        <button
                            onClick={() => setIsSearchOpen(true)}
                            className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-emerald-500/30 rounded-xl text-xs font-bold text-slate-500 transition-all cursor-pointer"
                        >
                            <span>🔍 Buscar...</span>
                            <kbd className="px-1.5 py-0.5 text-[10px] font-bold text-slate-400 bg-slate-200 dark:bg-zinc-800 rounded border border-slate-300 dark:border-zinc-700">Ctrl K</kbd>
                        </button>

                        {/* Live Status LED Badge */}
                        <SystemStatusBadge />

                        {/* Selector de Tema Personalizable */}
                        <div className="relative">
                            <button
                                onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                                    theme === 'claro'
                                        ? 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
                                        : theme === 'oscuro'
                                            ? 'bg-zinc-900 border-zinc-800 text-slate-200 hover:bg-zinc-800'
                                            : 'bg-slate-800/80 border-slate-700 text-emerald-400 hover:bg-slate-800'
                                }`}
                                title="Cambiar tema visual del sistema"
                            >
                                <Palette className="h-4 w-4 text-emerald-500" />
                                <span className="capitalize font-extrabold">
                                    {theme === 'pizarra' ? '🌙 Pizarra Nocturna' : theme === 'claro' ? '☀️ Modo Claro' : '🖤 Modo Oscuro'}
                                </span>
                            </button>

                            {isThemeMenuOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 p-1.5 space-y-1">
                                    <button
                                        onClick={() => handleThemeChange('pizarra')}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                                            theme === 'pizarra' 
                                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400' 
                                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-900'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Moon className="h-4 w-4 text-emerald-500" />
                                            <span>Pizarra Nocturna</span>
                                        </div>
                                        {theme === 'pizarra' && <span className="text-emerald-500 font-extrabold">✓</span>}
                                    </button>

                                    <button
                                        onClick={() => handleThemeChange('claro')}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                                            theme === 'claro' 
                                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400' 
                                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-900'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Sun className="h-4 w-4 text-amber-500" />
                                            <span>Modo Claro Médico</span>
                                        </div>
                                        {theme === 'claro' && <span className="text-emerald-500 font-extrabold">✓</span>}
                                    </button>

                                    <button
                                        onClick={() => handleThemeChange('oscuro')}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                                            theme === 'oscuro' 
                                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400' 
                                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-900'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Moon className="h-4 w-4 text-slate-400" />
                                            <span>Oscuro Puro</span>
                                        </div>
                                        {theme === 'oscuro' && <span className="text-emerald-500 font-extrabold">✓</span>}
                                    </button>
                                </div>
                            )}
                        </div>

                        <button className="p-2 text-slate-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors relative">
                            <Bell className="h-5 w-5" />
                            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 border-2 border-white dark:border-slate-900"></span>
                        </button>

                        <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-1"></div>

                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <p className={`text-sm font-bold ${theme === 'claro' ? 'text-slate-900' : 'text-white'}`}>{currentUser?.nombre || "Usuario"}</p>
                                <p className="text-xs text-slate-400 font-medium">{getRoleBadge(currentUser?.role)}</p>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-500 flex items-center justify-center text-white shadow-lg shadow-teal-500/20 font-black">
                                <User className="h-5 w-5" />
                            </div>
                        </div>
                    </div>
                </header>

                {/* Scrollable Page Content */}
                <main className={`flex-1 overflow-y-auto p-6 ${mainBg} transition-colors duration-300`}>
                    {children}
                </main>
            </div>

            {showOnboardingModal && (
                <OnboardingWizard
                    currentUser={currentUser}
                    onComplete={(updatedConfig) => {
                        setUserConfig(prev => ({ ...prev, ...(updatedConfig?.config || updatedConfig), onboardingCompleted: true }));
                        setShowOnboardingModal(false);
                    }}
                />
            )}

            <QuickSearchModal
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
            />
        </div>
    );
}
