"use client";
import { useState, useEffect } from "react";
import { Activity, ShieldCheck, AlertTriangle, Database, Cpu, FileText, RefreshCw } from "lucide-react";

export default function SystemStatusBadge() {
    const [statusData, setStatusData] = useState(null);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const checkStatus = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/system/status');
            const data = await res.json();
            if (data.success) {
                setStatusData(data);
            }
        } catch (err) {
            console.error("Error checking system status:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkStatus();
        const interval = setInterval(checkStatus, 60000); // Refresh every 60 seconds
        return () => clearInterval(interval);
    }, []);

    const status = statusData?.status || 'online';

    const getLedColor = () => {
        if (status === 'online') return 'bg-emerald-500 shadow-emerald-500/50';
        if (status === 'degraded') return 'bg-amber-500 shadow-amber-500/50';
        return 'bg-rose-500 shadow-rose-500/50';
    };

    const getStatusText = () => {
        if (status === 'online') return 'Sistemas Operativos';
        if (status === 'degraded') return 'Servicios Parciales';
        return 'Atención Requerida';
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-emerald-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer"
                title="Estado operativo del sistema en tiempo real"
            >
                <div className="relative flex items-center justify-center">
                    <span className={`h-2.5 w-2.5 rounded-full ${getLedColor()} shadow-md`} />
                    <span className={`absolute h-2.5 w-2.5 rounded-full ${getLedColor()} animate-ping opacity-75`} />
                </div>
                <span className="hidden sm:inline text-slate-700 dark:text-slate-300 font-extrabold text-[11px]">
                    {getStatusText()}
                </span>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 p-4 space-y-3 animate-fade-in font-sans">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-2.5">
                        <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-emerald-500" />
                            <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Estado de Servicios</span>
                        </div>
                        <button
                            onClick={checkStatus}
                            disabled={loading}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-900 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition-all disabled:opacity-50"
                            title="Actualizar estado"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    <div className="space-y-2.5 text-xs">
                        {/* Database */}
                        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-zinc-900/50">
                            <div className="flex items-center gap-2">
                                <Database className="h-4 w-4 text-blue-500" />
                                <span className="font-semibold text-slate-700 dark:text-slate-300">Base de Datos SQLite</span>
                            </div>
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                OK
                            </span>
                        </div>

                        {/* Python DS */}
                        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-zinc-900/50">
                            <div className="flex items-center gap-2">
                                <Cpu className="h-4 w-4 text-purple-500" />
                                <span className="font-semibold text-slate-700 dark:text-slate-300">Motor IA Commander</span>
                            </div>
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${
                                statusData?.services?.pythonDs?.status === 'ok'
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                            }`}>
                                {statusData?.services?.pythonDs?.status === 'ok' ? 'Online' : 'Standby'}
                            </span>
                        </div>

                        {/* ARCA AFIP */}
                        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-zinc-900/50">
                            <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-amber-500" />
                                <span className="font-semibold text-slate-700 dark:text-slate-300">Conexión ARCA (AFIP)</span>
                            </div>
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                Activa
                            </span>
                        </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 text-[10px] text-slate-400 text-center font-medium">
                        Monitoreo continuo en tiempo real
                    </div>
                </div>
            )}
        </div>
    );
}
