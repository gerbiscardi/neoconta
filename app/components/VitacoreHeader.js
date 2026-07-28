"use client";
import Link from "next/link";
import { Users, Calendar, Stethoscope, HeartPulse } from "lucide-react";

export default function VitacoreHeader({ activeTab = 'pacientes', actionButton = null }) {
    const subtitles = {
        pacientes: "Fichero y registro de historias clínicas digitales para tus pacientes.",
        turnos: "Gestión de turnos diarios, orden de llegada en sala de espera y agenda médica.",
        profesionales: "Gestión del equipo médico, especialistas y personal de recepción."
    };

    return (
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-zinc-900/60 backdrop-blur-md p-6 rounded-3xl border border-gray-200/80 dark:border-zinc-800 shadow-sm">
            <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-gradient-to-tr from-teal-500 to-cyan-500 text-white rounded-2xl shadow-md shadow-teal-500/20">
                        <HeartPulse className="h-6 w-6" />
                    </div>
                    <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-teal-600 via-cyan-500 to-indigo-600 dark:from-teal-400 dark:to-cyan-300 bg-clip-text text-transparent">
                        Vitacore
                    </h1>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 pl-0.5 font-medium">
                    {subtitles[activeTab] || subtitles.pacientes}
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                {/* Segmented Control Nav Tabs */}
                <div className="flex items-center p-1.5 bg-slate-100 dark:bg-zinc-950/80 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 text-xs font-bold shadow-inner">
                    <Link
                        href="/dashboard/vitacore"
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
                            activeTab === 'pacientes'
                                ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-md shadow-teal-600/20'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-zinc-800/50'
                        }`}
                    >
                        <Users className="h-4 w-4" />
                        <span>Pacientes</span>
                    </Link>

                    <Link
                        href="/dashboard/vitacore/turnos"
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
                            activeTab === 'turnos'
                                ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-md shadow-teal-600/20'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-zinc-800/50'
                        }`}
                    >
                        <Calendar className="h-4 w-4" />
                        <span>Agenda de Turnos</span>
                    </Link>

                    <Link
                        href="/dashboard/vitacore/profesionales"
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
                            activeTab === 'profesionales'
                                ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-md shadow-teal-600/20'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-zinc-800/50'
                        }`}
                    >
                        <Stethoscope className="h-4 w-4" />
                        <span>Profesionales</span>
                    </Link>
                </div>

                {actionButton}
            </div>
        </div>
    );
}
