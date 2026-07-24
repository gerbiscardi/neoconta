"use client";
import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Calendar, Clock, User, Award, HeartPulse, Check, ShieldCheck } from "lucide-react";

export default function ConfirmarTurnoPage({ params }) {
    const { id: appointmentId } = React.use(params);
    const searchParams = useSearchParams();
    const userId = searchParams.get("userId");

    const [appointment, setAppointment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [statusSubmitted, setStatusSubmitted] = useState(null); // 'confirm' | 'cancel'
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const fetchAppointment = async () => {
            try {
                const res = await fetch(`/api/vitacore/appointments/confirm?id=${appointmentId}${userId ? `&userId=${userId}` : ''}`);
                const data = await res.json();
                if (res.ok && data.success) {
                    setAppointment(data.appointment);
                } else {
                    setError(data.error || "Turno no encontrado o expirado.");
                }
            } catch (err) {
                console.error("Error fetching appointment:", err);
                setError("Error de conexión al cargar la información del turno.");
            } finally {
                setLoading(false);
            }
        };

        if (appointmentId) {
            fetchAppointment();
        }
    }, [appointmentId, userId]);

    const handleUpdateStatus = async (action) => {
        setSubmitting(true);
        try {
            const res = await fetch("/api/vitacore/appointments/confirm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    appointmentId,
                    userId,
                    action
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                setStatusSubmitted(action);
                setAppointment(data.appointment);
            } else {
                alert(data.error || "No se pudo actualizar el estado del turno.");
            }
        } catch (err) {
            console.error("Error updating appointment status:", err);
            alert("Error de conexión al responder la confirmación.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col justify-center items-center p-4 font-sans text-slate-900 dark:text-slate-100">
            {/* Header / Brand Logo */}
            <div className="text-center mb-8 space-y-2">
                <div className="inline-flex items-center gap-2 text-teal-600 dark:text-teal-400 font-extrabold text-2xl">
                    <HeartPulse className="h-8 w-8 text-teal-500 animate-pulse" />
                    <span>Vitacore</span>
                </div>
                <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Gestión Sanitaria & Agenda Médica</p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl w-full max-w-md p-6 shadow-xl relative overflow-hidden space-y-6">
                {loading ? (
                    <div className="py-16 text-center text-slate-400 space-y-3">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-teal-500 mx-auto" />
                        <p className="text-xs font-bold">Buscando información de tu turno...</p>
                    </div>
                ) : error ? (
                    <div className="py-8 text-center space-y-4">
                        <div className="inline-flex p-3 bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-full">
                            <XCircle className="h-10 w-10" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Aviso del Sistema</h2>
                        <p className="text-xs text-slate-500 max-w-xs mx-auto">{error}</p>
                    </div>
                ) : statusSubmitted === 'confirm' || appointment.status === 'confirmado' ? (
                    /* Confirmed Success State */
                    <div className="py-6 text-center space-y-5">
                        <div className="inline-flex p-4 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-300 dark:border-emerald-800">
                            <CheckCircle2 className="h-12 w-12" />
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-xl font-black text-emerald-600 dark:text-emerald-400">¡Turno Confirmado con Éxito!</h2>
                            <p className="text-xs text-slate-400">El centro médico ha recibido tu confirmación de asistencia.</p>
                        </div>

                        {/* Appointment Summary Box */}
                        <div className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-2xl border border-slate-200 dark:border-zinc-800 text-left space-y-3 text-xs">
                            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold">
                                <User className="h-4 w-4 text-teal-500" />
                                <span>Paciente: {appointment.patientName}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                <Calendar className="h-4 w-4 text-teal-500" />
                                <span>Fecha: {appointment.date.split('-').reverse().join('/')} a las {appointment.time} hs</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                <Award className="h-4 w-4 text-teal-500" />
                                <span>Profesional: {appointment.professionalName} ({appointment.professionalSpecialty || 'Médico'})</span>
                            </div>
                        </div>

                        <p className="text-[11px] text-slate-400 italic">Te recomendamos presentarte 10 minutos antes de la hora estipulada.</p>
                    </div>
                ) : statusSubmitted === 'cancel' || appointment.status === 'cancelado' ? (
                    /* Cancelled State */
                    <div className="py-6 text-center space-y-4">
                        <div className="inline-flex p-4 bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-full">
                            <XCircle className="h-10 w-10" />
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Turno Cancelado</h2>
                            <p className="text-xs text-slate-400">Has cancelado la solicitud de turno. El centro médico liberará este horario.</p>
                        </div>
                    </div>
                ) : (
                    /* Action Request View */
                    <div className="space-y-6">
                        <div className="text-center space-y-1 border-b border-slate-100 dark:border-zinc-800 pb-4">
                            <span className="text-[11px] font-extrabold text-teal-600 dark:text-teal-400 uppercase tracking-widest">Confirmación de Cita Médica</span>
                            <h2 className="text-lg font-black text-slate-900 dark:text-white">¿Confirmás tu asistencia al turno?</h2>
                        </div>

                        {/* Appointment Details */}
                        <div className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3 text-xs">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-teal-100 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 rounded-xl">
                                    <User className="h-4 w-4" />
                                </div>
                                <div>
                                    <span className="text-slate-400 font-bold block text-[10px] uppercase">Paciente</span>
                                    <span className="font-extrabold text-slate-900 dark:text-white">{appointment.patientName}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-teal-100 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 rounded-xl">
                                    <Calendar className="h-4 w-4" />
                                </div>
                                <div>
                                    <span className="text-slate-400 font-bold block text-[10px] uppercase">Fecha y Hora</span>
                                    <span className="font-extrabold text-slate-900 dark:text-white">
                                        {appointment.date.split('-').reverse().join('/')} • {appointment.time} hs
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-teal-100 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 rounded-xl">
                                    <Award className="h-4 w-4" />
                                </div>
                                <div>
                                    <span className="text-slate-400 font-bold block text-[10px] uppercase">Atención Médica</span>
                                    <span className="font-extrabold text-slate-900 dark:text-white">
                                        {appointment.professionalName} ({appointment.professionalSpecialty || 'Médico'})
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Interactive Action Buttons */}
                        <div className="space-y-3 pt-2">
                            <button
                                onClick={() => handleUpdateStatus('confirm')}
                                disabled={submitting}
                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-extrabold rounded-2xl text-xs shadow-md shadow-emerald-500/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <CheckCircle2 className="h-4 w-4" />
                                <span>{submitting ? "Confirmando..." : "✅ Sí, Confirmar mi Asistencia"}</span>
                            </button>

                            <button
                                onClick={() => handleUpdateStatus('cancel')}
                                disabled={submitting}
                                className="w-full py-2.5 bg-slate-100 dark:bg-zinc-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 dark:text-slate-400 hover:text-rose-600 font-bold rounded-2xl text-xs transition-all cursor-pointer flex items-center justify-center gap-2 border border-slate-200 dark:border-zinc-800 disabled:opacity-50"
                            >
                                <XCircle className="h-4 w-4" />
                                <span>Cancelar Turno</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="mt-8 text-center text-slate-400 text-[11px] font-medium flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-teal-500" />
                <span>Confirmación oficial y segura garantizada por Vitacore NeoConta</span>
            </div>
        </div>
    );
}
