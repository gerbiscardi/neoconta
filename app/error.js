"use client";
import { useEffect } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function GlobalError({ error, reset }) {
    useEffect(() => {
        console.error("Unhandled Global React Error:", error);
    }, [error]);

    return (
        <div className="min-h-screen bg-[#0b1329] text-slate-100 flex items-center justify-center p-6 font-sans">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-lg w-full text-center space-y-6 shadow-2xl">
                <div className="p-4 bg-red-500/10 text-red-500 rounded-full inline-flex border border-red-500/20">
                    <AlertCircle className="h-12 w-12" />
                </div>

                <div className="space-y-2">
                    <h2 className="text-2xl font-extrabold text-white">¡Ups! Ocurrió un inconveniente técnico</h2>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        El sistema ha protegido tu sesión e información. Podés intentar recargar este componente o regresar al inicio.
                    </p>
                </div>

                <div className="flex gap-3 pt-2 justify-center">
                    <button
                        onClick={() => reset()}
                        className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
                    >
                        <RefreshCw className="h-4 w-4" />
                        <span>Reintentar</span>
                    </button>

                    <Link
                        href="/"
                        className="flex items-center gap-2 px-5 py-3 border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold text-xs rounded-xl transition-all"
                    >
                        <Home className="h-4 w-4" />
                        <span>Volver al Inicio</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
