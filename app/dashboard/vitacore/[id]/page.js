"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
    ArrowLeft, User, Phone, Mail, Calendar, ShieldAlert, Award, 
    Plus, FileText, CheckCircle, Trash2, Edit2, Bookmark, BookmarkCheck, Printer 
} from "lucide-react";

export default function PatientDetail({ params }) {
    // React.use(params) to unwrap Next.js async params
    const { id: patientId } = React.use(params);

    const [patient, setPatient] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);

    // Modal state for editing patient
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState({
        name: "",
        dni: "",
        birthDate: "",
        phone: "",
        email: "",
        obraSocial: "",
        affiliateNumber: "",
        importantDetails: ""
    });

    // Modal state for new consultation
    const [isConsultationModalOpen, setIsConsultationModalOpen] = useState(false);
    const [newConsultation, setNewConsultation] = useState({
        date: new Date().toISOString().split("T")[0],
        reason: "",
        observations: "",
        prescription: "",
        tagsInput: "",
        isImportant: false
    });

    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    const router = useRouter();

    useEffect(() => {
        const userStr = localStorage.getItem("neoconta_user");
        if (!userStr) {
            router.push("/login");
        } else {
            const user = JSON.parse(userStr);
            setCurrentUser(user);
            fetchPatientData(user.id);
        }
    }, [router, patientId]);

    const fetchPatientData = async (userId) => {
        try {
            setLoading(true);
            const res = await fetch(`/api/vitacore/patients?userId=${userId}`);
            const data = await res.json();
            if (data.success) {
                const found = (data.patients || []).find(p => p.id === patientId);
                if (found) {
                    setPatient(found);
                    setEditForm({
                        name: found.name,
                        dni: found.dni,
                        birthDate: found.birthDate || "",
                        phone: found.phone || "",
                        email: found.email || "",
                        obraSocial: found.obraSocial || "",
                        affiliateNumber: found.affiliateNumber || "",
                        importantDetails: found.importantDetails || ""
                    });
                } else {
                    setErrorMsg("Paciente no encontrado en el fichero.");
                }
            }
        } catch (error) {
            console.error("Error loading patient:", error);
            setErrorMsg("Error al conectar con el servidor.");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePatient = async (e) => {
        e.preventDefault();
        setErrorMsg("");
        try {
            setSubmitting(true);
            const res = await fetch("/api/vitacore/patients", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: currentUser.id,
                    patientId: patient.id,
                    updatedData: editForm
                })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setIsEditModalOpen(false);
                fetchPatientData(currentUser.id);
            } else {
                setErrorMsg(data.error || "Error al actualizar los datos.");
            }
        } catch (error) {
            console.error("Error updating patient:", error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeletePatient = async () => {
        if (!confirm("¿Está seguro de que desea eliminar permanentemente este paciente y toda su historia clínica?")) {
            return;
        }

        try {
            const res = await fetch(`/api/vitacore/patients?userId=${currentUser.id}&patientId=${patient.id}`, {
                method: "DELETE"
            });
            if (res.ok) {
                router.push("/dashboard/vitacore");
            }
        } catch (error) {
            console.error("Error deleting patient:", error);
        }
    };

    const handleAddConsultation = async (e) => {
        e.preventDefault();
        setErrorMsg("");
        if (!newConsultation.reason.trim()) {
            setErrorMsg("El motivo de consulta es requerido.");
            return;
        }

        const tagsArray = newConsultation.tagsInput
            ? newConsultation.tagsInput.split(",").map(t => t.trim()).filter(t => t !== "")
            : [];

        try {
            setSubmitting(true);
            const res = await fetch("/api/vitacore/consultations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: currentUser.id,
                    patientId: patient.id,
                    consultation: {
                        date: new Date(newConsultation.date).toISOString(),
                        reason: newConsultation.reason,
                        observations: newConsultation.observations,
                        prescription: newConsultation.prescription,
                        tags: tagsArray,
                        isImportant: newConsultation.isImportant
                    }
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                setIsConsultationModalOpen(false);
                setNewConsultation({
                    date: new Date().toISOString().split("T")[0],
                    reason: "",
                    observations: "",
                    prescription: "",
                    tagsInput: "",
                    isImportant: false
                });
                fetchPatientData(currentUser.id);
            } else {
                setErrorMsg(data.error || "Error al registrar la consulta.");
            }
        } catch (error) {
            console.error("Error adding consultation:", error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleImportant = async (consultation) => {
        try {
            const res = await fetch("/api/vitacore/consultations", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: currentUser.id,
                    patientId: patient.id,
                    consultationId: consultation.id,
                    updatedData: {
                        isImportant: !consultation.isImportant
                    }
                })
            });
            if (res.ok) {
                fetchPatientData(currentUser.id);
            }
        } catch (error) {
            console.error("Error toggling important consultation status:", error);
        }
    };

    const handleDeleteConsultation = async (consultationId) => {
        if (!confirm("¿Desea eliminar este registro de consulta?")) return;

        try {
            const res = await fetch(`/api/vitacore/consultations?userId=${currentUser.id}&patientId=${patient.id}&consultationId=${consultationId}`, {
                method: "DELETE"
            });
            if (res.ok) {
                fetchPatientData(currentUser.id);
            }
        } catch (error) {
            console.error("Error deleting consultation:", error);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="flex h-screen bg-slate-50 dark:bg-black items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-teal-500"></div>
            </div>
        );
    }

    if (errorMsg && !patient) {
        return (
            <div className="p-8 max-w-lg mx-auto text-center space-y-4">
                <div className="p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 rounded-2xl border border-rose-200/50">
                    <span className="font-bold">{errorMsg}</span>
                </div>
                <button
                    onClick={() => router.push("/dashboard/vitacore")}
                    className="flex items-center gap-2 text-sm font-bold text-teal-600 hover:text-teal-700 mx-auto"
                >
                    <ArrowLeft className="h-4 w-4" /> Volver al Fichero
                </button>
            </div>
        );
    }

    const age = patient.birthDate
        ? new Date().getFullYear() - new Date(patient.birthDate).getFullYear()
        : null;

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 text-gray-900 dark:text-slate-100 print:p-0 print:bg-white print:text-black print:dark:text-black">
            {/* Top Nav & Action bar (hidden in print) */}
            <div className="flex items-center justify-between gap-4 print:hidden">
                <button
                    onClick={() => router.push("/dashboard/vitacore")}
                    className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Volver al Fichero
                </button>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold transition-all"
                    >
                        <Printer className="h-4 w-4" />
                        Imprimir / PDF
                    </button>
                    <button
                        onClick={() => setIsEditModalOpen(true)}
                        className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold transition-all text-teal-600 dark:text-teal-400"
                    >
                        <Edit2 className="h-4 w-4" />
                        Editar Ficha
                    </button>
                    <button
                        onClick={handleDeletePatient}
                        className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 dark:border-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl text-xs font-bold transition-all text-rose-600 dark:text-rose-400"
                    >
                        <Trash2 className="h-4 w-4" />
                        Eliminar
                    </button>
                </div>
            </div>

            {/* Print Header (Visible only in print) */}
            <div className="hidden print:block border-b-2 border-gray-300 pb-6 mb-8 text-black">
                <h1 className="text-3xl font-black">NeoConta - Ficha Clínica</h1>
                <p className="text-sm text-gray-500">Vitacore | Historial Clínico de Pacientes</p>
            </div>

            {/* Main Record Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Patient Personal Card & Medical Alerts */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Patient Information Box */}
                    <div className="bg-white dark:bg-slate-900/50 backdrop-blur-md rounded-2xl border border-gray-200/80 dark:border-slate-800 p-6 space-y-5 shadow-sm print:border-none print:shadow-none print:p-0">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-teal-50 dark:bg-teal-950/20 text-teal-600 dark:text-teal-400 rounded-xl">
                                <User className="h-7 w-7" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black">{patient.name}</h2>
                                <p className="text-xs text-gray-400 dark:text-gray-500 font-bold">DNI {patient.dni}</p>
                            </div>
                        </div>

                        <div className="border-t border-gray-100 dark:border-slate-800 my-4" />

                        <div className="space-y-4 text-xs font-medium">
                            {/* Age / Birthdate */}
                            {patient.birthDate && (
                                <div className="flex items-center gap-3">
                                    <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
                                    <span>
                                        {patient.birthDate.split("-").reverse().join("/")} ({age} años)
                                    </span>
                                </div>
                            )}

                            {/* Phone */}
                            {patient.phone && (
                                <div className="flex items-center gap-3">
                                    <Phone className="h-4 w-4 text-gray-400 shrink-0" />
                                    <span>{patient.phone}</span>
                                </div>
                            )}

                            {/* Email */}
                            {patient.email && (
                                <div className="flex items-center gap-3">
                                    <Mail className="h-4 w-4 text-gray-400 shrink-0" />
                                    <span className="break-all">{patient.email}</span>
                                </div>
                            )}

                            {/* Obra Social */}
                            <div className="flex items-start gap-3">
                                <Award className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <span className="font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">COBERTURA</span>
                                    <span>{patient.obraSocial || "Particular"}</span>
                                    {patient.affiliateNumber && (
                                        <span className="block text-gray-400 dark:text-gray-500 font-bold">N° {patient.affiliateNumber}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Medical Alerts (Critical Notes) */}
                    <div className="bg-rose-50/50 dark:bg-rose-950/10 rounded-2xl border border-rose-200/50 dark:border-rose-900/30 p-6 space-y-4 shadow-sm print:border-2 print:border-rose-400 print:bg-white print:text-black">
                        <div className="flex items-center gap-3 text-rose-700 dark:text-rose-400">
                            <ShieldAlert className="h-5 w-5 shrink-0" />
                            <h3 className="font-bold text-sm uppercase tracking-wider">Alertas Médicas / Alergias</h3>
                        </div>
                        <p className="text-xs md:text-sm font-semibold leading-relaxed text-rose-900 dark:text-rose-300 print:text-black">
                            {patient.importantDetails ? patient.importantDetails : "Sin alertas médicas cargadas."}
                        </p>
                    </div>
                </div>

                {/* Right Column: Timeline / Consultation Records */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between print:hidden">
                        <h3 className="text-lg font-bold">Historial de Evoluciones</h3>
                        <button
                            onClick={() => setIsConsultationModalOpen(true)}
                            className="flex items-center gap-1 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-teal-500/10"
                        >
                            <Plus className="h-4 w-4" />
                            Nueva Evolución
                        </button>
                    </div>

                    {/* Evoluciones list */}
                    {(!patient.consultations || patient.consultations.length === 0) ? (
                        <div className="text-center py-20 bg-white dark:bg-slate-900/40 rounded-3xl border border-gray-200 dark:border-slate-800">
                            <FileText className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                            <h3 className="text-base font-bold text-gray-700 dark:text-gray-300">No hay consultas registradas</h3>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-sm mx-auto">
                                Comenzá a registrar la historia médica del paciente haciendo clic en el botón de Nueva Evolución.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6 relative before:absolute before:left-4 before:top-4 before:bottom-4 before:w-[2px] before:bg-gray-200 dark:before:bg-slate-800 print:before:bg-gray-300">
                            {patient.consultations.map(consultation => (
                                <div 
                                    key={consultation.id}
                                    className={`relative pl-10 group transition-all ${
                                        consultation.isImportant 
                                            ? "scale-[1.01] print:scale-100" 
                                            : ""
                                    }`}
                                >
                                    {/* Timeline dot */}
                                    <div className={`absolute left-[10px] top-6 transform -translate-x-1/2 w-4.5 h-4.5 rounded-full border-4 border-slate-50 dark:border-black ${
                                        consultation.isImportant 
                                            ? "bg-rose-500 animate-pulse" 
                                            : "bg-teal-500"
                                    }`} />

                                    {/* Consultation card */}
                                    <div className={`bg-white dark:bg-slate-900/50 backdrop-blur-md rounded-2xl border p-6 space-y-4 shadow-sm hover:shadow-md transition-all duration-300 ${
                                        consultation.isImportant 
                                            ? "border-rose-400/50 bg-rose-500/[0.01] dark:border-rose-900/30" 
                                            : "border-gray-200/80 dark:border-slate-800"
                                    } print:border-gray-300 print:shadow-none print:p-4 print:bg-white`}>
                                        {/* Card Header */}
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider block">
                                                    {new Date(consultation.date).toLocaleDateString("es-AR", {
                                                        day: "numeric",
                                                        month: "long",
                                                        year: "numeric"
                                                    })}
                                                </span>
                                                <h4 className="font-extrabold text-base text-gray-900 dark:text-white mt-1 print:text-black">
                                                    {consultation.reason}
                                                </h4>
                                            </div>
                                            
                                            {/* Action icons (hidden in print) */}
                                            <div className="flex items-center gap-1.5 print:hidden">
                                                <button
                                                    onClick={() => handleToggleImportant(consultation)}
                                                    className={`p-1.5 rounded-lg border border-gray-100 dark:border-slate-800 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors ${
                                                        consultation.isImportant 
                                                            ? "text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/30 bg-rose-50/50 dark:bg-rose-950/10" 
                                                            : "text-gray-400 hover:text-gray-600"
                                                    }`}
                                                    title={consultation.isImportant ? "Quitar destaque" : "Marcar como importante"}
                                                >
                                                    {consultation.isImportant ? (
                                                        <BookmarkCheck className="h-4 w-4" />
                                                    ) : (
                                                        <Bookmark className="h-4 w-4" />
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteConsultation(consultation.id)}
                                                    className="p-1.5 text-gray-400 hover:text-rose-600 hover:border-rose-100 rounded-lg border border-gray-100 dark:border-slate-800 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all"
                                                    title="Eliminar consulta"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Observations / Observations Notes */}
                                        {consultation.observations && (
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Observaciones</span>
                                                <p className="text-xs md:text-sm text-gray-700 dark:text-gray-300 leading-relaxed print:text-black whitespace-pre-line">
                                                    {consultation.observations}
                                                </p>
                                            </div>
                                        )}

                                        {/* Prescriptions */}
                                        {consultation.prescription && (
                                            <div className="p-4 bg-teal-50/30 dark:bg-teal-950/10 border border-teal-100/30 dark:border-teal-900/30 rounded-xl space-y-1.5 print:bg-gray-100 print:text-black">
                                                <span className="text-[10px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-wider block">Indicaciones / Tratamiento</span>
                                                <p className="text-xs md:text-sm text-gray-700 dark:text-gray-300 font-bold whitespace-pre-line print:text-black">
                                                    {consultation.prescription}
                                                </p>
                                            </div>
                                        )}

                                        {/* Tags */}
                                        {consultation.tags && consultation.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 pt-2">
                                                {consultation.tags.map((tag, idx) => (
                                                    <span 
                                                        key={idx}
                                                        className="px-2 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 rounded text-[10px] font-bold"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de Editar Paciente */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div onClick={() => setIsEditModalOpen(false)} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                    <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl relative z-10 space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold">Editar Ficha Médica</h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="p-1 text-gray-400 hover:text-white">✕</button>
                        </div>
                        <form onSubmit={handleUpdatePatient} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Nombre Completo *</label>
                                    <input
                                        type="text"
                                        required
                                        value={editForm.name}
                                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-805/50 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">DNI / ID *</label>
                                    <input
                                        type="text"
                                        required
                                        value={editForm.dni}
                                        onChange={(e) => setEditForm({ ...editForm, dni: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-805/50 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Fecha de Nacimiento</label>
                                    <input
                                        type="date"
                                        value={editForm.birthDate}
                                        onChange={(e) => setEditForm({ ...editForm, birthDate: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-805/50 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Teléfono</label>
                                    <input
                                        type="tel"
                                        value={editForm.phone}
                                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-805/50 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Email</label>
                                    <input
                                        type="email"
                                        value={editForm.email}
                                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-805/50 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Obra Social / Cobertura</label>
                                    <input
                                        type="text"
                                        value={editForm.obraSocial}
                                        onChange={(e) => setEditForm({ ...editForm, obraSocial: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-805/50 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div className="space-y-1 sm:col-span-2">
                                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Número de afiliado</label>
                                    <input
                                        type="text"
                                        value={editForm.affiliateNumber}
                                        onChange={(e) => setEditForm({ ...editForm, affiliateNumber: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-805/50 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div className="space-y-1 sm:col-span-2">
                                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Detalles Médicos Críticos / Alergias</label>
                                    <textarea
                                        rows="2"
                                        value={editForm.importantDetails}
                                        onChange={(e) => setEditForm({ ...editForm, importantDetails: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-805/50 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white resize-none"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-bold text-gray-500 hover:text-gray-800"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-bold rounded-xl text-sm shadow-md"
                                >
                                    {submitting ? "Guardando..." : "Guardar Cambios"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Nueva Consulta/Evolución */}
            {isConsultationModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div onClick={() => setIsConsultationModalOpen(false)} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                    <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl relative z-10 space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold">Registrar Nueva Evolución</h3>
                            <button onClick={() => setIsConsultationModalOpen(false)} className="p-1 text-gray-400 hover:text-white">✕</button>
                        </div>
                        {errorMsg && (
                            <div className="p-3 bg-rose-50 text-rose-700 border border-rose-100 rounded-xl text-xs">
                                <span>{errorMsg}</span>
                            </div>
                        )}
                        <form onSubmit={handleAddConsultation} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Fecha *</label>
                                    <input
                                        type="date"
                                        required
                                        value={newConsultation.date}
                                        onChange={(e) => setNewConsultation({ ...newConsultation, date: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-805/50 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Motivo / Diagnóstico *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ej: Control de rutina, Angina, etc."
                                        value={newConsultation.reason}
                                        onChange={(e) => setNewConsultation({ ...newConsultation, reason: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-805/50 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div className="space-y-1 sm:col-span-2">
                                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Observaciones Clínicas</label>
                                    <textarea
                                        rows="4"
                                        placeholder="Escriba aquí los detalles del control médico o examen físico..."
                                        value={newConsultation.observations}
                                        onChange={(e) => setNewConsultation({ ...newConsultation, observations: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-805/50 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white resize-none"
                                    />
                                </div>
                                <div className="space-y-1 sm:col-span-2">
                                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Indicaciones / Receta / Tratamiento</label>
                                    <textarea
                                        rows="2"
                                        placeholder="Prescripción de medicamentos, indicaciones higiénico-dietéticas, etc."
                                        value={newConsultation.prescription}
                                        onChange={(e) => setNewConsultation({ ...newConsultation, prescription: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-805/50 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white resize-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Etiquetas (Separadas por comas)</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Control, Hipertensión, Receta"
                                        value={newConsultation.tagsInput}
                                        onChange={(e) => setNewConsultation({ ...newConsultation, tagsInput: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-805/50 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div className="flex items-center gap-2 pt-6">
                                    <input
                                        type="checkbox"
                                        id="modalImportant"
                                        checked={newConsultation.isImportant}
                                        onChange={(e) => setNewConsultation({ ...newConsultation, isImportant: e.target.checked })}
                                        className="h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                                    />
                                    <label htmlFor="modalImportant" className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase cursor-pointer">
                                        Destacar como importante
                                    </label>
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsConsultationModalOpen(false)}
                                    className="px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-bold text-gray-500 hover:text-gray-800"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-bold rounded-xl text-sm shadow-md"
                                >
                                    {submitting ? "Guardando..." : "Guardar Evolución"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
