"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { LayoutDashboard, FileText, Wallet, Settings, Menu, X, Bell, User, LogOut, Users, MessageSquare, LineChart, HeartPulse } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";

export default function DashboardLayout({ children }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [userConfig, setUserConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const userStr = localStorage.getItem('neoconta_user');
        if (!userStr) {
            router.push("/login");
            setLoading(false);
        } else {
            const user = JSON.parse(userStr);
            setCurrentUser(user);
            
            if (user.role === 'cliente') {
                fetch(`/api/user/config?userId=${user.id}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            setUserConfig(data);
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

    useEffect(() => {
        if (!loading && currentUser && currentUser.role === 'cliente' && userConfig) {
            const features = userConfig.features || {};
            const path = pathname;
            if (path === '/dashboard/commentor' && !features.moduloImagenWeb) {
                router.push('/dashboard');
            } else if (path === '/dashboard/commander' && !(features.biBasico || features.biAvanzado || features.biPremium)) {
                router.push('/dashboard');
            } else if (path === '/dashboard/banco' && !features.moduloBanco) {
                router.push('/dashboard');
            } else if (path === '/dashboard/facturacion' && !(features.facturacionManual || features.facturacionMasiva)) {
                router.push('/dashboard');
            } else if (path.startsWith('/dashboard/vitacore') && !features.moduloVitacore) {
                router.push('/dashboard');
            }
        }
    }, [pathname, loading, currentUser, userConfig, router]);

    const handleLogout = () => {
        localStorage.removeItem('neoconta_user');
        router.push("/login");
    };

    const getNavItems = () => {
        if (!currentUser) return [];
        const role = currentUser.role;

        if (role === 'no-cliente') {
            return [
                { 
                    name: "Dashboard", 
                    icon: <LayoutDashboard className="h-5 w-5" />, 
                    href: "/dashboard",
                    gradient: "from-emerald-500 to-teal-500",
                    activeStyle: "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm",
                    inactiveHoverStyle: "hover:border-emerald-500/20 hover:bg-emerald-500/5 dark:hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400"
                },
                { 
                    name: "Configuración", 
                    icon: <Settings className="h-5 w-5" />, 
                    href: "/dashboard/configuracion",
                    gradient: "from-slate-400 to-slate-500",
                    activeStyle: "border-slate-500/30 bg-slate-500/5 dark:bg-slate-500/10 text-slate-600 dark:text-slate-400 shadow-sm",
                    inactiveHoverStyle: "hover:border-slate-500/20 hover:bg-slate-500/5 dark:hover:bg-slate-500/10 hover:text-slate-600 dark:hover:text-slate-400"
                },
            ];
        }

        const items = [
            { 
                name: "Dashboard", 
                icon: <LayoutDashboard className="h-5 w-5" />, 
                href: "/dashboard",
                gradient: "from-emerald-500 to-teal-500",
                activeStyle: "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm",
                inactiveHoverStyle: "hover:border-emerald-500/20 hover:bg-emerald-500/5 dark:hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400"
            }
        ];

        const features = userConfig?.features || {
            facturacionManual: true,
            facturacionMasiva: true,
            moduloBanco: true,
            biBasico: true,
            biAvanzado: true,
            biPremium: true,
            moduloImagenWeb: true,
            moduloVitacore: true
        };

        if (features.facturacionManual || features.facturacionMasiva) {
            items.push({ 
                name: features.facturacionMasiva ? "Facturación Masiva" : "Facturación Manual", 
                icon: <FileText className="h-5 w-5" />, 
                href: "/dashboard/facturacion",
                gradient: "from-blue-500 to-indigo-500",
                activeStyle: "border-blue-500/30 bg-blue-500/5 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-sm",
                inactiveHoverStyle: "hover:border-blue-500/20 hover:bg-blue-500/5 dark:hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400"
            });
        }

        if (features.biBasico || features.biAvanzado || features.biPremium) {
            items.push({ 
                name: "Commander BI", 
                icon: <LineChart className="h-5 w-5" />, 
                href: "/dashboard/commander",
                gradient: "from-rose-500 to-pink-500",
                activeStyle: "border-rose-500/30 bg-rose-500/5 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-sm",
                inactiveHoverStyle: "hover:border-rose-500/20 hover:bg-rose-500/5 dark:hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
            });
        }

        if (features.moduloBanco) {
            items.push({ 
                name: "Banco", 
                icon: <Wallet className="h-5 w-5" />, 
                href: "/dashboard/banco",
                gradient: "from-violet-500 to-fuchsia-500",
                activeStyle: "border-violet-500/30 bg-violet-500/5 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 shadow-sm",
                inactiveHoverStyle: "hover:border-violet-500/20 hover:bg-violet-500/5 dark:hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-400"
            });
        }

        if (features.moduloImagenWeb) {
            items.push({ 
                name: "Commentor", 
                icon: <MessageSquare className="h-5 w-5" />, 
                href: "/dashboard/commentor",
                gradient: "from-orange-500 to-amber-500",
                activeStyle: "border-orange-500/30 bg-orange-500/5 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 shadow-sm",
                inactiveHoverStyle: "hover:border-orange-500/20 hover:bg-orange-500/5 dark:hover:bg-emerald-500/10 hover:text-orange-600 dark:hover:text-orange-400"
            });
        }

        if (features.moduloVitacore || features.moduloVitacore === undefined) {
            items.push({ 
                name: "Vitacore", 
                icon: <HeartPulse className="h-5 w-5" />, 
                href: "/dashboard/vitacore",
                gradient: "from-teal-500 to-cyan-500",
                activeStyle: "border-teal-500/30 bg-teal-500/5 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 shadow-sm",
                inactiveHoverStyle: "hover:border-teal-500/20 hover:bg-teal-500/5 dark:hover:bg-teal-500/10 hover:text-teal-600 dark:hover:text-teal-400"
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
            case 'no-cliente': return 'No Cliente';
            default: return 'Usuario';
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen w-screen bg-slate-50 dark:bg-black items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-orange-500"></div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-black font-sans">
            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transform transition-transform duration-200 ease-in-out ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"
                    } md:relative md:translate-x-0`}
            >
                <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200 dark:border-slate-800">
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
                                className={`relative flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900/40 border transition-all duration-300 hover:-translate-y-0.5 overflow-hidden group mb-2 rounded-xl ${
                                    isActive
                                        ? item.activeStyle
                                        : `border-slate-200/60 dark:border-slate-800/40 text-slate-600 dark:text-slate-400 ${item.inactiveHoverStyle}`
                                }`}
                            >
                                <div className="group-hover:scale-110 transition-transform duration-200">
                                    {item.icon}
                                </div>
                                <span className="font-medium">{item.name}</span>
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
                        className="relative flex items-center gap-3 w-full px-4 py-3 bg-white dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/40 text-slate-600 dark:text-slate-400 hover:border-red-500/20 hover:bg-red-500/5 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 rounded-xl transition-all duration-300 hover:-translate-y-0.5 overflow-hidden group"
                    >
                        <LogOut className="h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
                        <span className="font-medium">Cerrar Sesión</span>
                        {/* Red Bottom Glow Line */}
                        <div className="absolute bottom-0 left-0 w-full h-[3px] bg-gradient-to-r from-red-500 to-rose-500 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-out"></div>
                    </button>
                </div>
            </aside>

            {/* Main Content Wrapper */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top Header */}
                <header className="flex items-center justify-between h-16 px-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40">
                    <button
                        className="md:hidden p-2 -ml-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                        onClick={() => setIsSidebarOpen(true)}
                    >
                        <Menu className="h-6 w-6" />
                    </button>

                    <div className="flex items-center gap-4 ml-auto">
                        <button className="p-2 text-slate-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors relative">
                            <Bell className="h-5 w-5" />
                            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 border-2 border-white dark:border-slate-900"></span>
                        </button>

                        <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>

                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-medium text-slate-900 dark:text-white">{currentUser?.nombre || "Usuario"}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{getRoleBadge(currentUser?.role)}</p>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                                <User className="h-5 w-5" />
                            </div>
                        </div>
                    </div>
                </header>

                {/* Scrollable Page Content */}
                <main className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-black/50">
                    {children}
                </main>
            </div>
        </div>
    );
}
