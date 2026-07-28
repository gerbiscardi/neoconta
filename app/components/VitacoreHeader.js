"use client";
import Link from "next/link";
import { HeartPulse, Users, Calendar, Award } from "lucide-react";

export default function VitacoreHeader({ 
    activeTab = "pacientes", // 'pacientes' | 'turnos' | 'profesionales'
    actionButton = null,
    subTitle = null 
}) {
    return (
        <div className="bg-white dark:bg-zinc-900/50 backdrop-blur-md p-6 rounded-3xl border border-slate-200/80 dark:border-zinc-800 shadow-sm space-y-4">
            {/* Top Row: Title, Nav Tabs & Action Button */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-tr from-teal-600 to-emerald-600 text-white rounded-2xl shadow-md shrink-0">
                        <HeartPulse className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                            <span>Vitacore</span>
                            <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                                Medical
                            </span>
                        </h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                            Fichero y registro de historias clínicas digitales para tus pacientes.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0">
                    {/* Fixed Navigation Tabs */}
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-900 p-1.5 rounded-2xl border border-slate-200 dark:border-zinc-800 text-xs font-extrabold">
                        <Link 
                            href="/dashboard/vitacore" 
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
                                activeTab === 'pacientes'
                                    ? 'bg-teal-600 text-white shadow-md'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <Users className="h-3.5 w-3.5" />
                            <span>Pacientes</span>
                        </Link>
                        <Link 
                            href="/dashboard/vitacore/turnos" 
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
                                activeTab === 'turnos'
                                    ? 'bg-teal-600 text-white shadow-md'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <Calendar className="h-3.5 w-3.5" />
                            <span>Agenda de Turnos</span>
                        </Link>
                        <Link 
                            href="/dashboard/vitacore/profesionales" 
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
                                activeTab === 'profesionales'
                                    ? 'bg-teal-600 text-white shadow-md'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <Award className="h-3.5 w-3.5" />
                            <span>Profesionales</span>
                        </Link>
                    </div>

                    {/* Primary Action Button */}
                    {actionButton}
                </div>
            </div>

            {/* Sub-Header Context Line */}
            {subTitle && (
                <div className="pt-3 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between text-xs text-slate-400 font-extrabold uppercase tracking-wider">
                    <span>{subTitle}</span>
                </div>
            )}
        </div>
    );
}
