"use client";
import { useState, useEffect } from "react";
import { Search, HeartPulse, FileText, Wallet, LineChart, Settings, Users, ArrowRight, X } from "lucide-react";
import { useRouter } from "next/navigation";

export default function QuickSearchModal({ isOpen, onClose }) {
    const [query, setQuery] = useState("");
    const router = useRouter();

    const modules = [
        { name: "Vitacore - Fichero y Registro Clínico", href: "/dashboard/vitacore", icon: <HeartPulse className="h-4 w-4 text-emerald-500" />, section: "Salud" },
        { name: "Vitacore - Agenda de Turnos", href: "/dashboard/vitacore/turnos", icon: <Users className="h-4 w-4 text-teal-500" />, section: "Salud" },
        { name: "Vitacore - Profesionales y Especialistas", href: "/dashboard/vitacore/profesionales", icon: <Users className="h-4 w-4 text-cyan-500" />, section: "Salud" },
        { name: "Facturación ARCA (ex AFIP)", href: "/dashboard/facturacion", icon: <FileText className="h-4 w-4 text-blue-500" />, section: "Comprobantes" },
        { name: "Commander BI - Pronóstico y Finanzas", href: "/dashboard/commander", icon: <LineChart className="h-4 w-4 text-rose-500" />, section: "Inteligencia" },
        { name: "Banco y Conciliación", href: "/dashboard/banco", icon: <Wallet className="h-4 w-4 text-violet-500" />, section: "Finanzas" },
        { name: "Configuración del Sistema", href: "/dashboard/configuracion", icon: <Settings className="h-4 w-4 text-slate-500" />, section: "Ajustes" },
    ];

    const filtered = modules.filter(m => 
        m.name.toLowerCase().includes(query.toLowerCase()) || 
        m.section.toLowerCase().includes(query.toLowerCase())
    );

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape") onClose();
        };
        if (isOpen) {
            window.addEventListener("keydown", handleKeyDown);
        }
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-start justify-center pt-20 p-4 animate-fade-in font-sans">
            <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl space-y-0">
                
                {/* Search Bar Input */}
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50">
                    <Search className="h-5 w-5 text-slate-400" />
                    <input
                        type="text"
                        autoFocus
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar módulo, pantalla o función (Ej: Pacientes, Facturar)..."
                        className="w-full bg-transparent text-sm text-slate-900 dark:text-white outline-none placeholder:text-slate-400"
                    />
                    <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold text-slate-400 bg-slate-200 dark:bg-zinc-800 rounded-md border border-slate-300 dark:border-zinc-700">
                        ESC
                    </kbd>
                    <button onClick={onClose} className="sm:hidden text-slate-400">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Results List */}
                <div className="max-h-80 overflow-y-auto p-2 space-y-1">
                    {filtered.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-400 font-bold">
                            No se encontraron resultados para "{query}"
                        </div>
                    ) : (
                        filtered.map((item, idx) => (
                            <div
                                key={idx}
                                onClick={() => {
                                    router.push(item.href);
                                    onClose();
                                }}
                                className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-zinc-900 cursor-pointer transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-slate-100 dark:bg-zinc-800 rounded-xl group-hover:scale-105 transition-transform">
                                        {item.icon}
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-500 transition-colors">
                                            {item.name}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                                            {item.section}
                                        </div>
                                    </div>
                                </div>
                                <ArrowRight className="h-4 w-4 text-slate-300 dark:text-zinc-700 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                            </div>
                        ))
                    )}
                </div>

                {/* Footer instructions */}
                <div className="px-4 py-2.5 bg-slate-50 dark:bg-zinc-900 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                    <span>Navegación Rápida NeoConta</span>
                    <span className="flex items-center gap-1">
                        Presioná <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-zinc-800 rounded border border-slate-300 dark:border-zinc-700 text-[10px]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-zinc-800 rounded border border-slate-300 dark:border-zinc-700 text-[10px]">K</kbd> en cualquier lugar
                    </span>
                </div>
            </div>
        </div>
    );
}
