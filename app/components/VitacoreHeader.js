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
        <div className="space-y-4">
            {/* Header Card: Title + Dynamic Subtitle + Action Button */}
            <div className="bg-white dark:bg-zinc-900/60 backdrop-blur-md p-6 rounded-3xl border border-gray-200/80 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-tr from-teal-500 to-cyan-500 text-white rounded-2xl shadow-md shadow-teal-500/20">
                            <HeartPulse className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-teal-600 via-cyan-500 to-indigo-600 dark:from-teal-400 dark:to-cyan-300 bg-clip-text text-transparent">
                                Vitacore
                            </h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                                {subtitles[activeTab] || subtitles.pacientes}
                            </p>
                        </div>
                    </div>
                </div>

                {actionButton && (
                    <div className="flex items-center gap-3">
                        {actionButton}
                    </div>
                )}
            </div>

            {/* Sub-Navigation Tabs Bar */}
            <div className="flex items-center gap-2 p-1.5 bg-white dark:bg-zinc-900/80 rounded-2xl border border-gray-200/80 dark:border-zinc-800 shadow-sm text-xs font-bold w-fit">
                <Link
                    href="/dashboard/vitacore"
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all ${
                        activeTab === 'pacientes'
                            ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-md shadow-teal-600/20 font-bold scale-[1.02]'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800/60'
                    }`}
                >
                    <Users className="h-4 w-4" />
                    <span>Pacientes</span>
                </Link>

                <Link
                    href="/dashboard/vitacore/turnos"
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all ${
                        activeTab === 'turnos'
                            ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-md shadow-teal-600/20 font-bold scale-[1.02]'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800/60'
                    }`}
                >
                    <Calendar className="h-4 w-4" />
                    <span>Agenda de Turnos</span>
                </Link>

                <Link
                    href="/dashboard/vitacore/profesionales"
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all ${
                        activeTab === 'profesionales'
                            ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-md shadow-teal-600/20 font-bold scale-[1.02]'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800/60'
                    }`}
                >
                    <Stethoscope className="h-4 w-4" />
                    <span>Profesionales</span>
                </Link>
            </div>
        </div>
    );
}
