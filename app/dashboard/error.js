"use client";
import { useEffect } from "react";
import { AlertCircle, RefreshCw, LayoutDashboard } from "lucide-react";
import Link from "next/link";

export default function DashboardError({ error, reset }) {
    useEffect(() => {
        console.error("Unhandled Dashboard React Error:", error);
    }, [error]);

    return (
        <div className="p-8 max-w-2xl mx-auto space-y-6 text-slate-900 dark:text-slate-100 font-sans">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 text-center space-y-6 shadow-xl">
                <div className="p-4 bg-orange-500/10 text-orange-500 rounded-full inline-flex border border-orange-500/20">
                    <AlertCircle className="h-10 w-10" />
                </div>

                <div className="space-y-2">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Algo no salió como esperábamos en esta sección</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Los datos generales de tu cuenta permanecen intactos. Intentá reintentar la acción o volver al resumen.
                    </p>
                </div>

                <div className="flex gap-3 justify-center pt-2">
                    <button
                        onClick={() => reset()}
                        className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                    >
                        <RefreshCw className="h-4 w-4" />
                        <span>Reintentar Carga</span>
                    </button>

                    <Link
                        href="/dashboard"
                        className="flex items-center gap-2 px-5 py-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all"
                    >
                        <LayoutDashboard className="h-4 w-4" />
                        <span>Ir al Panel Principal</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
