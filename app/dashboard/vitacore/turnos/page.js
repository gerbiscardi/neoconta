"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
    Calendar as CalendarIcon, Clock, User, Phone, Plus, Search, Filter, 
    CheckCircle2, AlertCircle, MessageCircle, X, ChevronLeft, ChevronRight, 
    Award, ArrowRight, HeartPulse, Users, ShieldAlert, Sparkles, Check, Trash2, Receipt
} from "lucide-react";
import MedicalInvoiceModal from "@/app/components/MedicalInvoiceModal";
import WhatsAppModal from "@/app/components/WhatsAppModal";

export default function VitacoreTurnosPage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Data states
    const [appointments, setAppointments] = useState([]);
    const [patients, setPatients] = useState([]);
    const [professionals, setProfessionals] = useState([]);

    // Filters
    const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [selectedProfessional, setSelectedProfessional] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [patientSearch, setPatientSearch] = useState("");
    const [showPatientDropdown, setShowPatientDropdown] = useState(false);

    // ARCA Invoicing states
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
    const [selectedPatientForInvoice, setSelectedPatientForInvoice] = useState(null);
    const [invoiceReason, setInvoiceReason] = useState("Consulta Médica");

    // WhatsApp Modal states
    const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
    const [selectedAppForWhatsApp, setSelectedAppForWhatsApp] = useState(null);

    const [newAppointment, setNewAppointment] = useState({
        patientId: "",
        patientName: "",
        patientDni: "",
        patientPhone: "",
        patientObraSocial: "Particular",
        professionalId: "",
        professionalName: "",
        professionalSpecialty: "",
        date: new Date().toISOString().split('T')[0],
        time: "09:00",
        consultationType: "Consulta General",
        reason: ""
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const userStr = localStorage.getItem("neoconta_user");
        if (!userStr) {
            router.push("/login");
        } else {
            const user = JSON.parse(userStr);
            setCurrentUser(user);
            const targetUserId = user.role === 'vitacore-professional' ? user.parentId : user.id;
            fetchInitialData(targetUserId, selectedDate);
        }
    }, [router, selectedDate]);

    const fetchInitialData = async (userId, dateStr) => {
        try {
            setLoading(true);
            const [appRes, patRes, profRes] = await Promise.all([
                fetch(`/api/vitacore/appointments?userId=${userId}&date=${dateStr}`),
                fetch(`/api/vitacore/patients?userId=${userId}`),
                fetch(`/api/vitacore/professionals?userId=${userId}`)
            ]);

            const appData = await appRes.json();
            const patData = await patRes.json();
            const profData = await profRes.json();

            if (appData.success) setAppointments(appData.appointments || []);
            if (patData.success) setPatients(patData.patients || []);
            if (profData.success) setProfessionals(profData.professionals || []);
        } catch (error) {
            console.error("Error loading Vitacore turnos data:", error);
        } finally {
            setLoading(false);
        }
    };

    const targetUserId = currentUser?.role === 'vitacore-professional' ? currentUser.parentId : currentUser?.id;

    // Handle status change
    const handleStatusChange = async (appointmentId, newStatus) => {
        try {
            const res = await fetch('/api/vitacore/appointments', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: targetUserId,
                    appointmentId,
                    updatedData: { status: newStatus }
                })
            });

            if (res.ok) {
                setAppointments(prev => prev.map(a => a.id === appointmentId ? { ...a, status: newStatus } : a));
            }
        } catch (error) {
            console.error("Error updating appointment status:", error);
        }
    };

    // Handle Delete Turno
    const handleDeleteAppointment = async (appointmentId) => {
        if (!confirm("¿Está seguro de eliminar este turno de la agenda?")) return;
        try {
            const res = await fetch(`/api/vitacore/appointments?userId=${targetUserId}&appointmentId=${appointmentId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                setAppointments(prev => prev.filter(a => a.id !== appointmentId));
            }
        } catch (error) {
            console.error("Error deleting appointment:", error);
        }
    };

    // Create Appointment
    const handleCreateAppointment = async (e) => {
        e.preventDefault();
        if (!newAppointment.patientName || !newAppointment.date || !newAppointment.time) {
            alert("Por favor complete el nombre del paciente, fecha y horario.");
            return;
        }

        setSubmitting(true);
        try {
            const prof = professionals.find(p => p.id === newAppointment.professionalId) || currentUser;

            const payload = {
                userId: targetUserId,
                appointment: {
                    ...newAppointment,
                    professionalName: prof.nombre || currentUser.nombre,
                    professionalSpecialty: prof.specialty || 'Médico'
                }
            };

            const res = await fetch('/api/vitacore/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (res.ok && data.success) {
                if (newAppointment.date === selectedDate) {
                    setAppointments(prev => [...prev, data.appointment].sort((a, b) => a.time.localeCompare(b.time)));
                }
                setIsModalOpen(false);
                setNewAppointment({
                    patientId: "",
                    patientName: "",
                    patientDni: "",
                    patientPhone: "",
                    patientObraSocial: "Particular",
                    professionalId: "",
                    professionalName: "",
                    professionalSpecialty: "",
                    date: selectedDate,
                    time: "09:00",
                    consultationType: "Consulta General",
                    reason: ""
                });
                setPatientSearch("");
            } else {
                alert(data.error || "Error al crear el turno.");
            }
        } catch (error) {
            console.error("Error creating appointment:", error);
            alert("Error de conexión al guardar el turno.");
        } finally {
            setSubmitting(false);
        }
    };

    // Filter appointments
    const filteredAppointments = appointments.filter(a => {
        if (selectedProfessional && a.professionalId !== selectedProfessional) return false;
        if (statusFilter !== "all" && a.status !== statusFilter) return false;
        return true;
    });

    // Counts
    const countTotal = filteredAppointments.length;
    const countEspera = filteredAppointments.filter(a => a.status === 'en_espera').length;
    const countConfirmados = filteredAppointments.filter(a => a.status === 'confirmado').length;
    const countAtendidos = filteredAppointments.filter(a => a.status === 'atendido').length;
    const countCancelados = filteredAppointments.filter(a => a.status === 'cancelado').length;

    // Send WhatsApp Recordatorio
    const handleSendWhatsApp = (appointment) => {
        if (!appointment.patientPhone) {
            alert("El paciente no tiene un número de teléfono cargado.");
            return;
        }
        const phoneClean = appointment.patientPhone.replace(/\D/g, '');
        const text = `Hola ${appointment.patientName}, te recordamos tu turno médico para el día ${appointment.date.split('-').reverse().join('/')} a las ${appointment.time} hs con ${appointment.professionalName}. En caso de no poder asistir, por favor infórmanos. ¡Gracias!`;
        window.open(`https://wa.me/${phoneClean}?text=${encodeURIComponent(text)}`, '_blank');
    };

    // Helper date shift
    const shiftDate = (days) => {
        const d = new Date(selectedDate + 'T00:00:00');
        d.setDate(d.getDate() + days);
        setSelectedDate(d.toISOString().split('T')[0]);
    };

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 text-slate-900 dark:text-slate-100 font-sans">
            
            {/* Header & Vitacore Navigation Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-900/50 backdrop-blur-md p-6 rounded-3xl border border-slate-200/80 dark:border-zinc-800 shadow-sm">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-tr from-teal-600 to-cyan-600 text-white rounded-2xl shadow-md">
                            <CalendarIcon className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Vitacore | Agenda Médica</h1>
                            <p className="text-xs text-slate-400 font-medium">Gestión de turnos diarios, salaf de espera y recordatorios automatizados.</p>
                        </div>
                    </div>
                </div>

                {/* Vitacore Sub-Navigation */}
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-zinc-900 p-1.5 rounded-2xl border border-slate-200 dark:border-zinc-800">
                    <Link
                        href="/dashboard/vitacore"
                        className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all"
                    >
                        👥 Pacientes
                    </Link>
                    <Link
                        href="/dashboard/vitacore/turnos"
                        className="px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold shadow-md transition-all"
                    >
                        📅 Agenda de Turnos
                    </Link>
                    <Link
                        href="/dashboard/vitacore/profesionales"
                        className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all"
                    >
                        🩺 Profesionales
                    </Link>
                </div>
            </div>

            {/* Date & Professional Bar + Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                {/* Control Panel / Date Picker */}
                <div className="lg:col-span-1 bg-white dark:bg-zinc-900/50 backdrop-blur-md p-5 rounded-3xl border border-slate-200/80 dark:border-zinc-800 space-y-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Fecha Seleccionada</span>
                        <button
                            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                            className="text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:underline"
                        >
                            Hoy
                        </button>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                        <button onClick={() => shiftDate(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-500">
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-center"
                        />
                        <button onClick={() => shiftDate(1)} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-500">
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Professional Filter */}
                    {professionals.length > 0 && (
                        <div className="space-y-1 pt-2">
                            <label className="text-xs font-bold text-slate-400 uppercase">Filtrar por Profesional</label>
                            <select
                                value={selectedProfessional}
                                onChange={(e) => setSelectedProfessional(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-bold"
                            >
                                <option value="">-- Todos los Médicos --</option>
                                {professionals.map(p => (
                                    <option key={p.id} value={p.id}>{p.nombre} ({p.specialty || 'Especialista'})</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="w-full py-3 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-extrabold rounded-2xl text-xs shadow-md shadow-teal-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.02]"
                    >
                        <Plus className="h-4 w-4" />
                        <span>Nuevo Turno Médico</span>
                    </button>
                </div>

                {/* Metrics Cards */}
                <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-4 bg-white dark:bg-zinc-900/50 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase">Total Agenda</span>
                        <div className="flex items-baseline justify-between mt-2">
                            <span className="text-2xl font-black text-slate-900 dark:text-white">{countTotal}</span>
                            <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400">Turnos</span>
                        </div>
                    </div>

                    <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl border border-amber-200/50 dark:border-amber-900/30 shadow-sm flex flex-col justify-between">
                        <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase">En Sala de Espera</span>
                        <div className="flex items-baseline justify-between mt-2">
                            <span className="text-2xl font-black text-amber-800 dark:text-amber-300">{countEspera}</span>
                            <span className="text-[10px] font-bold text-amber-600">Aguardando</span>
                        </div>
                    </div>

                    <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200/50 dark:border-emerald-900/30 shadow-sm flex flex-col justify-between">
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase">Atendidos</span>
                        <div className="flex items-baseline justify-between mt-2">
                            <span className="text-2xl font-black text-emerald-800 dark:text-emerald-300">{countAtendidos}</span>
                            <span className="text-[10px] font-bold text-emerald-600">Finalizados</span>
                        </div>
                    </div>

                    <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl border border-blue-200/50 dark:border-blue-900/30 shadow-sm flex flex-col justify-between">
                        <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase">Confirmados</span>
                        <div className="flex items-baseline justify-between mt-2">
                            <span className="text-2xl font-black text-blue-800 dark:text-blue-300">{countConfirmados}</span>
                            <span className="text-[10px] font-bold text-blue-600">Listos</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Turnos Schedule Timeline List */}
            <div className="bg-white dark:bg-zinc-900/50 backdrop-blur-md rounded-3xl border border-slate-200/80 dark:border-zinc-800 p-6 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-zinc-800 pb-4">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>Turnos del Día:</span>
                        <span className="text-teal-600 dark:text-teal-400 font-extrabold">{new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                    </h3>

                    {/* Filter Status Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
                        {['all', 'reservado', 'confirmado', 'en_espera', 'atendido', 'cancelado'].map(st => (
                            <button
                                key={st}
                                onClick={() => setStatusFilter(st)}
                                className={`px-3 py-1.5 rounded-xl font-bold capitalize transition-all cursor-pointer ${
                                    statusFilter === st 
                                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm' 
                                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-slate-900'
                                }`}
                            >
                                {st === 'all' ? 'Todos' : st.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="py-16 text-center text-slate-400 text-xs font-bold flex flex-col items-center gap-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-teal-500" />
                        <span>Cargando agenda de turnos...</span>
                    </div>
                ) : filteredAppointments.length === 0 ? (
                    <div className="py-16 text-center space-y-3">
                        <CalendarIcon className="h-12 w-12 text-slate-300 dark:text-zinc-700 mx-auto" />
                        <p className="text-sm font-bold text-slate-600 dark:text-slate-400">No hay turnos programados para los filtros seleccionados.</p>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs shadow-md"
                        >
                            <Plus className="h-4 w-4" /> Programar Primer Turno
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredAppointments.map(app => {
                            const foundPatient = patients.find(p => p.id === app.patientId || p.dni === app.patientDni);

                            return (
                                <div
                                    key={app.id}
                                    className="p-4 bg-slate-50/70 dark:bg-zinc-900/80 rounded-2xl border border-slate-200/60 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm hover:border-teal-500/40 transition-all"
                                >
                                    {/* Left: Time & Patient Info */}
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 bg-teal-50 dark:bg-teal-950/40 border border-teal-200/60 dark:border-teal-900/40 rounded-2xl text-center shrink-0 min-w-[70px]">
                                            <span className="text-xs font-black text-teal-700 dark:text-teal-300 block">{app.time} hs</span>
                                            <span className="text-[10px] text-teal-600/80 font-bold block">{app.duration || 30} min</span>
                                        </div>

                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{app.patientName}</h4>
                                                {app.patientDni && <span className="text-xs text-slate-400 font-bold">DNI {app.patientDni}</span>}
                                            </div>

                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                                                <span>🩺 {app.professionalName} ({app.professionalSpecialty || 'Médico'})</span>
                                                <span>•</span>
                                                <span>{app.consultationType}</span>
                                                {app.patientObraSocial && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="font-bold text-blue-600 dark:text-blue-400">{app.patientObraSocial}</span>
                                                    </>
                                                )}
                                            </div>

                                            {app.reason && (
                                                <p className="text-xs text-slate-400 italic">Motivo: {app.reason}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right: Status Switcher & Action Buttons */}
                                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                                        {/* Status Selector */}
                                        <select
                                            value={app.status}
                                            onChange={(e) => handleStatusChange(app.id, e.target.value)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-black border cursor-pointer ${
                                                app.status === 'en_espera' ? 'bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' :
                                                app.status === 'confirmado' ? 'bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300' :
                                                app.status === 'atendido' ? 'bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' :
                                                app.status === 'cancelado' ? 'bg-red-100 border-red-300 text-red-800 dark:bg-red-950/40 dark:text-red-300' :
                                                'bg-slate-200 border-slate-300 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                            }`}
                                        >
                                            <option value="reservado">Reservado</option>
                                            <option value="confirmado">Confirmado</option>
                                            <option value="en_espera">En Sala de Espera</option>
                                            <option value="atendido">Atendido / Finalizado</option>
                                            <option value="ausente">Ausente</option>
                                            <option value="cancelado">Cancelado</option>
                                        </select>

                                        {/* Send WhatsApp button */}
                                        <button
                                            onClick={() => {
                                                setSelectedAppForWhatsApp(app);
                                                setIsWhatsAppModalOpen(true);
                                            }}
                                            className="p-2 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-800 transition-all cursor-pointer"
                                            title="Enviar recordatorio de turno por WhatsApp"
                                        >
                                            <MessageCircle className="h-4 w-4" />
                                        </button>

                                        {/* Direct to Clinical Record (Atender) */}
                                        {foundPatient && (
                                            <Link
                                                href={`/dashboard/vitacore/${foundPatient.id}`}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all"
                                            >
                                                <span>Atender Ficha</span>
                                                <ArrowRight className="h-3.5 w-3.5" />
                                            </Link>
                                        )}

                                        {/* ARCA Invoicing button */}
                                        <button
                                            onClick={() => {
                                                setSelectedPatientForInvoice(foundPatient || { name: app.patientName, dni: app.patientDni, obraSocial: app.patientObraSocial });
                                                setInvoiceReason(`Consulta Médica - Turno ${app.time} hs (${app.professionalName})`);
                                                setIsInvoiceModalOpen(true);
                                            }}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all cursor-pointer"
                                            title="Facturar esta consulta con ARCA / AFIP"
                                        >
                                            <Receipt className="h-3.5 w-3.5" />
                                            <span>Facturar</span>
                                        </button>

                                        <button
                                            onClick={() => handleDeleteAppointment(app.id)}
                                            className="p-2 bg-slate-100 dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-400 hover:text-red-600 rounded-xl border border-slate-200 dark:border-zinc-800 transition-all"
                                            title="Eliminar turno"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* MODAL: NUEVO TURNO MÉDICO */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                    <div className="bg-white dark:bg-zinc-950 border border-teal-500/30 rounded-3xl w-full max-w-xl p-6 shadow-2xl relative z-10 space-y-6 overflow-hidden">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-teal-600 text-white rounded-2xl shadow-md">
                                    <CalendarIcon className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-900 dark:text-white">Programar Nuevo Turno Médicos</h3>
                                    <p className="text-xs text-slate-400">Asigne cita médica para paciente registrado o ingrese los datos directos.</p>
                                </div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
                        </div>

                        <form onSubmit={handleCreateAppointment} className="space-y-4">
                            {/* Patient Search Autocomplete */}
                            <div className="space-y-1 relative">
                                <label className="text-xs font-bold text-slate-400 uppercase">Paciente *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Buscar paciente por Nombre o DNI..."
                                    value={newAppointment.patientName}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setNewAppointment(prev => ({ ...prev, patientName: val }));
                                        setShowPatientDropdown(val.length >= 1);
                                    }}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-bold"
                                />

                                {showPatientDropdown && patients.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl max-h-40 overflow-y-auto">
                                        {patients.filter(p => p.name.toLowerCase().includes(newAppointment.patientName.toLowerCase()) || p.dni.includes(newAppointment.patientName)).map(p => (
                                            <div
                                                key={p.id}
                                                onClick={() => {
                                                    setNewAppointment(prev => ({
                                                        ...prev,
                                                        patientId: p.id,
                                                        patientName: p.name,
                                                        patientDni: p.dni,
                                                        patientPhone: p.phone || '',
                                                        patientObraSocial: p.obraSocial || 'Particular'
                                                    }));
                                                    setShowPatientDropdown(false);
                                                }}
                                                className="p-2 hover:bg-teal-50 dark:hover:bg-teal-950/40 cursor-pointer text-xs flex justify-between items-center"
                                            >
                                                <span className="font-bold">{p.name} (DNI: {p.dni})</span>
                                                <span className="text-[10px] text-teal-600 font-bold">{p.obraSocial || 'Particular'}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase">Teléfono / WhatsApp</label>
                                    <input
                                        type="tel"
                                        placeholder="Ej: +5491122334455"
                                        value={newAppointment.patientPhone}
                                        onChange={(e) => setNewAppointment(prev => ({ ...prev, patientPhone: e.target.value }))}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase">Cobertura / Obra Social</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: OSDE, Swiss Medical, Particular"
                                        value={newAppointment.patientObraSocial}
                                        onChange={(e) => setNewAppointment(prev => ({ ...prev, patientObraSocial: e.target.value }))}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold"
                                    />
                                </div>
                            </div>

                            {/* Professional Selector */}
                            {professionals.length > 0 && (
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase">Profesional Asignado *</label>
                                    <select
                                        value={newAppointment.professionalId}
                                        onChange={(e) => setNewAppointment(prev => ({ ...prev, professionalId: e.target.value }))}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-bold"
                                    >
                                        <option value="">-- {currentUser?.nombre} (Director Clínico) --</option>
                                        {professionals.map(p => (
                                            <option key={p.id} value={p.id}>{p.nombre} ({p.specialty || 'Médico'})</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Date & Time */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase">Fecha *</label>
                                    <input
                                        type="date"
                                        required
                                        value={newAppointment.date}
                                        onChange={(e) => setNewAppointment(prev => ({ ...prev, date: e.target.value }))}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-bold"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase">Horario *</label>
                                    <input
                                        type="time"
                                        required
                                        value={newAppointment.time}
                                        onChange={(e) => setNewAppointment(prev => ({ ...prev, time: e.target.value }))}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-bold"
                                    />
                                </div>
                            </div>

                            {/* Consultation Type & Reason */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase">Tipo de Cita</label>
                                    <select
                                        value={newAppointment.consultationType}
                                        onChange={(e) => setNewAppointment(prev => ({ ...prev, consultationType: e.target.value }))}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold"
                                    >
                                        <option value="Consulta General">Consulta General</option>
                                        <option value="Primera Vez">Primera Vez</option>
                                        <option value="Control de Rutina">Control de Rutina</option>
                                        <option value="Urgencia / Demanda Espontánea">Urgencia / Demanda Espontánea</option>
                                        <option value="Receta / Estudio">Receta / Estudio</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase">Motivo / Observación</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Dolor lumbar, Chequeo..."
                                        value={newAppointment.reason}
                                        onChange={(e) => setNewAppointment(prev => ({ ...prev, reason: e.target.value }))}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-zinc-800">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-slate-500"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs shadow-md cursor-pointer disabled:opacity-50"
                                >
                                    {submitting ? "Guardando..." : "Confirmar y Guardar Turno"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: FACTURACIÓN ELECTRÓNICA ARCA */}
            <MedicalInvoiceModal
                isOpen={isInvoiceModalOpen}
                onClose={() => setIsInvoiceModalOpen(false)}
                patient={selectedPatientForInvoice}
                currentUser={currentUser}
                consultationReason={invoiceReason}
                onSuccess={(result) => {
                    alert(`¡Factura de consulta médica autorizada por ARCA! CAE: ${result.cae}`);
                }}
            />

            {/* Modal: NOTIFICACIONES DE WHATSAPP INSTITUCIONAL */}
            <WhatsAppModal
                isOpen={isWhatsAppModalOpen}
                onClose={() => setIsWhatsAppModalOpen(false)}
                patientName={selectedAppForWhatsApp?.patientName}
                patientPhone={selectedAppForWhatsApp?.patientPhone}
                appointmentData={selectedAppForWhatsApp}
                currentUser={currentUser}
            />
        </div>
    );
}
