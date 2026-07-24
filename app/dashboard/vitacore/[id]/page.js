"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
    ArrowLeft, User, Phone, Mail, Calendar, ShieldAlert, Award, 
    Plus, FileText, CheckCircle, Trash2, Edit2, Bookmark, BookmarkCheck, Printer,
    Sparkles, Bot, Brain, Copy, Check, Pill, FileSignature, QrCode, Download, CheckSquare, Square
} from "lucide-react";
import SignatureCanvas from "@/app/components/SignatureCanvas";
import { generatePrescriptionPDF } from "@/app/lib/generatePrescriptionPDF";

export default function PatientDetail({ params }) {
    // React.use(params) to unwrap Next.js async params
    const { id: patientId } = React.use(params);

    const [patient, setPatient] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    const [professionals, setProfessionals] = useState([]);

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
        isImportant: false,
        professionalId: "",
        professionalName: "",
        professionalSpecialty: "",
        professionalMatricula: ""
    });
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    // Gemini AI States
    const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
    const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
    const [aiSummaryData, setAiSummaryData] = useState(null);

    const [aiSoepLoading, setAiSoepLoading] = useState(false);

    const [aiGuideLoading, setAiGuideLoading] = useState(false);
    const [aiGuideData, setAiGuideData] = useState(null);
    const [copiedGuide, setCopiedGuide] = useState(false);

    // Medical Glossary Autocomplete States
    const [diagSuggestions, setDiagSuggestions] = useState([]);
    const [diagLoading, setDiagLoading] = useState(false);
    const [showDiagDropdown, setShowDiagDropdown] = useState(false);

    const [rxSuggestions, setRxSuggestions] = useState([]);
    const [rxLoading, setRxLoading] = useState(false);
    const [showRxDropdown, setShowRxDropdown] = useState(false);

    // Recetario Digital States
    const [prescriptions, setPrescriptions] = useState([]);
    const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false);
    const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
    const [profSignature, setProfSignature] = useState(null);
    const [newPrescription, setNewPrescription] = useState({
        medications: [{ name: '', dosage: '', quantity: '1', instructions: '' }],
        diagnosis: '',
        observations: '',
        useDigitalSignature: true,
        professionalId: '',
        professionalName: '',
        professionalSpecialty: '',
        professionalMatricula: ''
    });
    const [prescriptionSubmitting, setPrescriptionSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState('evoluciones');

    const router = useRouter();

    const targetUserId = currentUser?.role === 'vitacore-professional' ? currentUser.parentId : currentUser?.id;

    useEffect(() => {
        const userStr = localStorage.getItem("neoconta_user");
        if (!userStr) {
            router.push("/login");
        } else {
            const user = JSON.parse(userStr);
            setCurrentUser(user);
            const targetId = user.role === 'vitacore-professional' ? user.parentId : user.id;
            fetchPatientData(targetId);
            fetchProfessionals(targetId);
            fetchPrescriptions(targetId, patientId);
        }
    }, [router, patientId]);

    const fetchPrescriptions = async (userId, patId) => {
        try {
            const res = await fetch(`/api/vitacore/prescriptions?userId=${userId}&patientId=${patId}`);
            const data = await res.json();
            if (data.success) {
                setPrescriptions(data.prescriptions || []);
            }
        } catch (error) {
            console.error("Error fetching prescriptions:", error);
        }
    };

    const fetchProfessionals = async (userId) => {
        try {
            const res = await fetch(`/api/vitacore/professionals?userId=${userId}`);
            const data = await res.json();
            if (data.success) {
                setProfessionals(data.professionals || []);
            }
        } catch (error) {
            console.error("Error fetching professionals:", error);
        }
    };

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
                    userId: targetUserId,
                    patientId: patient.id,
                    updatedData: editForm
                })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setIsEditModalOpen(false);
                fetchPatientData(targetUserId);
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
            const res = await fetch(`/api/vitacore/patients?userId=${targetUserId}&patientId=${patient.id}`, {
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

        let pId = newConsultation.professionalId;
        let pName = newConsultation.professionalName;
        let pSpec = newConsultation.professionalSpecialty;
        let pMat = newConsultation.professionalMatricula;

        if (currentUser.role === 'vitacore-professional') {
            pId = currentUser.id;
            pName = currentUser.nombre;
            pSpec = currentUser.specialty;
            pMat = currentUser.matricula;
        } else {
            // Main client log, if they didn't select any professional, default to themselves
            if (!pId) {
                pId = currentUser.id;
                pName = currentUser.nombre;
                pSpec = "Director Clínico";
                pMat = "";
            }
        }

        try {
            setSubmitting(true);
            const res = await fetch("/api/vitacore/consultations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: targetUserId,
                    patientId: patient.id,
                    consultation: {
                        date: new Date(newConsultation.date).toISOString(),
                        reason: newConsultation.reason,
                        observations: newConsultation.observations,
                        prescription: newConsultation.prescription,
                        tags: tagsArray,
                        isImportant: newConsultation.isImportant,
                        professionalId: pId,
                        professionalName: pName,
                        professionalSpecialty: pSpec,
                        professionalMatricula: pMat
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
                    isImportant: false,
                    professionalId: "",
                    professionalName: "",
                    professionalSpecialty: "",
                    professionalMatricula: ""
                });
                fetchPatientData(targetUserId);
            } else {
                setErrorMsg(data.error || "Error al registrar la consulta.");
            }
        } catch (error) {
            console.error("Error adding consultation:", error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleFetchAiSummary = async () => {
        setIsSummaryModalOpen(true);
        if (aiSummaryData) return; // Cached for current view

        try {
            setAiSummaryLoading(true);
            const res = await fetch("/api/vitacore/ai", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "summary",
                    patient
                })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setAiSummaryData(data.data);
            } else {
                alert(data.error || "No se pudo generar el resumen de IA.");
            }
        } catch (err) {
            console.error("AI summary error:", err);
        } finally {
            setAiSummaryLoading(false);
        }
    };

    const handleFormatSoep = async () => {
        if (!newConsultation.observations.trim()) {
            alert("Por favor escribe un borrador o notas breves en Observaciones Clínicas primero.");
            return;
        }

        try {
            setAiSoepLoading(true);
            const res = await fetch("/api/vitacore/ai", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "soep",
                    reason: newConsultation.reason,
                    draftText: newConsultation.observations
                })
            });
            const data = await res.json();
            if (res.ok && data.success && data.data.formattedSOEP) {
                setNewConsultation(prev => ({
                    ...prev,
                    observations: data.data.formattedSOEP
                }));
            } else {
                alert(data.error || "No se pudo formatear el texto.");
            }
        } catch (err) {
            console.error("AI SOEP error:", err);
        } finally {
            setAiSoepLoading(false);
        }
    };

    const handleGeneratePatientGuide = async () => {
        if (!newConsultation.prescription.trim() && !newConsultation.observations.trim()) {
            alert("Por favor ingrese la prescripción u observaciones antes de solicitar la guía.");
            return;
        }

        try {
            setAiGuideLoading(true);
            const res = await fetch("/api/vitacore/ai", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "patient_instructions",
                    patient,
                    prescription: newConsultation.prescription,
                    observations: newConsultation.observations
                })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setAiGuideData(data.data);
            } else {
                alert(data.error || "No se pudo generar la guía del paciente.");
            }
        } catch (err) {
            console.error("AI Guide error:", err);
        } finally {
            setAiGuideLoading(false);
        }
    };

    const handleReasonChange = async (val) => {
        setNewConsultation(prev => ({ ...prev, reason: val }));
        if (val.trim().length >= 2) {
            setShowDiagDropdown(true);
            setDiagLoading(true);
            try {
                const res = await fetch(`/api/vitacore/medical-terms?q=${encodeURIComponent(val.trim())}&source=ICD-11&limit=8`);
                const data = await res.json();
                if (data.success) {
                    setDiagSuggestions(data.terms || []);
                }
            } catch (err) {
                console.error("Error fetching diagnosis terms:", err);
            } finally {
                setDiagLoading(false);
            }
        } else {
            setShowDiagDropdown(false);
            setDiagSuggestions([]);
        }
    };

    const handlePrescriptionChange = async (val) => {
        setNewConsultation(prev => ({ ...prev, prescription: val }));
        const lines = val.split("\n");
        const currentLine = lines[lines.length - 1].trim();
        if (currentLine.length >= 3) {
            setShowRxDropdown(true);
            setRxLoading(true);
            try {
                const res = await fetch(`/api/vitacore/medical-terms?q=${encodeURIComponent(currentLine)}&limit=8`);
                const data = await res.json();
                if (data.success) {
                    setRxSuggestions(data.terms || []);
                }
            } catch (err) {
                console.error("Error fetching Rx terms:", err);
            } finally {
                setRxLoading(false);
            }
        } else {
            setShowRxDropdown(false);
            setRxSuggestions([]);
        }
    };

    const handleAddMedicationLine = () => {
        setNewPrescription(prev => ({
            ...prev,
            medications: [...prev.medications, { name: '', dosage: '', quantity: '1', instructions: '' }]
        }));
    };

    const handleRemoveMedicationLine = (index) => {
        setNewPrescription(prev => ({
            ...prev,
            medications: prev.medications.filter((_, i) => i !== index)
        }));
    };

    const handleMedicationChange = (index, field, value) => {
        setNewPrescription(prev => {
            const updatedMeds = [...prev.medications];
            updatedMeds[index] = { ...updatedMeds[index], [field]: value };
            return { ...prev, medications: updatedMeds };
        });
    };

    const handleSavePrescription = async (e) => {
        e.preventDefault();
        if (!newPrescription.medications || newPrescription.medications.length === 0 || !newPrescription.medications[0].name.trim()) {
            alert("Por favor ingrese al menos un medicamento a prescribir.");
            return;
        }

        setPrescriptionSubmitting(true);
        try {
            const prof = currentUser.role === 'vitacore-professional' ? currentUser : professionals.find(p => p.id === newPrescription.professionalId) || currentUser;

            const payload = {
                userId: targetUserId,
                prescription: {
                    patientId: patient.id,
                    patientName: patient.name,
                    patientDni: patient.dni,
                    patientSocialSecurity: patient.obraSocial,
                    patientAffiliateNumber: patient.affiliateNumber,

                    professionalId: prof.id || targetUserId,
                    professionalName: prof.nombre || currentUser.nombre,
                    professionalSpecialty: prof.specialty || 'Director Clínico',
                    professionalMatricula: prof.matricula || '',
                    professionalCuit: prof.cuit || '',

                    diagnosis: newPrescription.diagnosis,
                    medications: newPrescription.medications,
                    observations: newPrescription.observations,

                    useDigitalSignature: newPrescription.useDigitalSignature,
                    signatureUrl: profSignature || prof.signature || null
                }
            };

            const res = await fetch("/api/vitacore/prescriptions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (res.ok && data.success) {
                setPrescriptions(prev => [data.prescription, ...prev]);
                setIsPrescriptionModalOpen(false);
                setNewPrescription({
                    medications: [{ name: '', dosage: '', quantity: '1', instructions: '' }],
                    diagnosis: '',
                    observations: '',
                    useDigitalSignature: true,
                    professionalId: '',
                    professionalName: '',
                    professionalSpecialty: '',
                    professionalMatricula: ''
                });
                alert("Receta generada exitosamente.");
            } else {
                alert(data.error || "Error al generar la receta.");
            }
        } catch (error) {
            console.error("Error saving prescription:", error);
            alert("Error de conexión al guardar la receta.");
        } finally {
            setPrescriptionSubmitting(false);
        }
    };

    const handleToggleImportant = async (consultation) => {
        try {
            const res = await fetch("/api/vitacore/consultations", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: targetUserId,
                    patientId: patient.id,
                    consultationId: consultation.id,
                    updatedData: {
                        isImportant: !consultation.isImportant
                    }
                })
            });
            if (res.ok) {
                fetchPatientData(targetUserId);
            }
        } catch (error) {
            console.error("Error toggling important consultation status:", error);
        }
    };

    const handleDeleteConsultation = async (consultationId) => {
        if (!confirm("¿Desea eliminar este registro de consulta?")) return;

        try {
            const res = await fetch(`/api/vitacore/consultations?userId=${targetUserId}&patientId=${patient.id}&consultationId=${consultationId}`, {
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
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 text-gray-900 dark:text-slate-100 print:p-0 print:bg-white print:text-black print:dark:text-black">
            {/* Top Nav (hidden in print) */}
            <div className="flex items-center justify-between gap-4 print:hidden">
                <button
                    onClick={() => router.push("/dashboard/vitacore")}
                    className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Volver al Fichero
                </button>
            </div>

            {/* Premium Patient Header Card (model screenshot style) */}
            <div className="bg-white dark:bg-zinc-900/50 backdrop-blur-md rounded-3xl border border-gray-200/80 dark:border-zinc-800 p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-sm print:hidden">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Initials Avatar */}
                    <div className="w-14 h-14 bg-teal-50 dark:bg-teal-950/20 text-teal-600 dark:text-teal-400 font-extrabold text-lg rounded-full flex items-center justify-center shrink-0 uppercase border border-teal-100 dark:border-teal-900/30">
                        {patient.name ? patient.name.split(" ").map(w => w[0]).join("").slice(0, 2) : "P"}
                    </div>
                    
                    <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-xl font-black text-gray-900 dark:text-slate-100">{patient.name}</h2>
                            <span className="px-2 py-0.5 bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400 rounded-full text-[9px] font-black uppercase tracking-wider">
                                Paciente
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-gray-400 dark:text-gray-500 font-bold">
                            <span>DNI {patient.dni}</span>
                            <span>•</span>
                            <span>{age} años</span>
                            {patient.phone && (
                                <>
                                    <span>•</span>
                                    <span>{patient.phone}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Cobertura & Emergencias badges */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-blue-50/50 dark:bg-blue-950/10 text-blue-700 dark:text-blue-400 border border-blue-100/50 dark:border-blue-900/20 px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-sm">
                        <Award className="h-4 w-4 shrink-0 text-blue-500" />
                        <span>COBERTURA: {patient.obraSocial || "Particular"}</span>
                        {patient.affiliateNumber && <span className="opacity-75">#{patient.affiliateNumber}</span>}
                    </div>

                    {patient.importantDetails && (
                        <div className="flex items-center gap-2 bg-rose-50/50 dark:bg-rose-950/10 text-rose-700 dark:text-rose-400 border border-rose-200/35 dark:border-rose-900/20 px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-sm">
                            <ShieldAlert className="h-4 w-4 shrink-0 text-rose-500" />
                            <span>ALERTA MÉDICA: {patient.importantDetails}</span>
                        </div>
                    )}
                </div>

                {/* Circular action buttons & AI button */}
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={handleFetchAiSummary}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-extrabold rounded-full text-xs shadow-md shadow-indigo-500/20 transition-all cursor-pointer hover:scale-105 active:scale-95"
                        title="Generar Resumen de Historia Clínica con Gemini AI"
                    >
                        <Sparkles className="h-4 w-4 text-amber-300 animate-pulse" />
                        <span>Resumen IA</span>
                    </button>
                    <button
                        onClick={() => setIsPrescriptionModalOpen(true)}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-extrabold rounded-full text-xs shadow-md shadow-teal-500/20 transition-all cursor-pointer hover:scale-105 active:scale-95"
                        title="Emitir nueva receta o prescripción médica"
                    >
                        <Pill className="h-4 w-4" />
                        <span>Nueva Receta</span>
                    </button>
                    <button
                        onClick={() => setIsSignatureModalOpen(true)}
                        className="p-2.5 bg-slate-50 dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 text-cyan-600 dark:text-cyan-400 rounded-full transition-all border border-gray-200 dark:border-zinc-800"
                        title="Configurar mi Firma & Sello Digitalizado"
                    >
                        <FileSignature className="h-4 w-4" />
                    </button>
                    <button
                        onClick={handlePrint}
                        className="p-2.5 bg-slate-50 dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-400 rounded-full transition-all border border-gray-200 dark:border-zinc-800"
                        title="Imprimir / PDF"
                    >
                        <Printer className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => setIsEditModalOpen(true)}
                        className="p-2.5 bg-slate-50 dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 text-teal-600 dark:text-teal-400 rounded-full transition-all border border-gray-200 dark:border-zinc-800"
                        title="Editar Ficha"
                    >
                        <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                        onClick={handleDeletePatient}
                        className="p-2.5 bg-slate-50 dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 text-rose-600 dark:text-rose-400 rounded-full transition-all border border-gray-200 dark:border-zinc-800"
                        title="Eliminar Paciente"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Navigation Tabs (Evoluciones vs Recetario) */}
            <div className="flex items-center gap-3 border-b border-gray-200 dark:border-zinc-800 pb-3 print:hidden">
                <button
                    onClick={() => setActiveTab('evoluciones')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                        activeTab === 'evoluciones'
                            ? 'bg-teal-600 text-white shadow-md shadow-teal-500/20'
                            : 'bg-white dark:bg-zinc-900/60 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-zinc-800 border border-gray-200 dark:border-zinc-800'
                    }`}
                >
                    <FileText className="h-4 w-4" />
                    <span>Evoluciones Clínicas ({patient.consultations?.length || 0})</span>
                </button>
                <button
                    onClick={() => setActiveTab('recetario')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                        activeTab === 'recetario'
                            ? 'bg-teal-600 text-white shadow-md shadow-teal-500/20'
                            : 'bg-white dark:bg-zinc-900/60 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-zinc-800 border border-gray-200 dark:border-zinc-800'
                    }`}
                >
                    <Pill className="h-4 w-4" />
                    <span>Recetario Digital ({prescriptions.length})</span>
                </button>
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

                {/* Right Column: Timeline / Consultation Records OR Recetario Digital */}
                <div className="lg:col-span-2 space-y-6">
                    {activeTab === 'recetario' ? (
                        /* Recetario Digital View */
                        <div className="space-y-6">
                            <div className="flex items-center justify-between print:hidden">
                                <div>
                                    <h3 className="text-lg font-bold">Recetario Digital & Prescripciones</h3>
                                    <p className="text-xs text-gray-400">Prescripciones médicas oficiales registradas con código QR y Hash SHA-256 (Ley 27.553).</p>
                                </div>
                                <button
                                    onClick={() => setIsPrescriptionModalOpen(true)}
                                    className="flex items-center gap-1.5 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-teal-500/10 cursor-pointer"
                                >
                                    <Pill className="h-4 w-4" />
                                    Nueva Receta
                                </button>
                            </div>

                            {prescriptions.length === 0 ? (
                                <div className="text-center py-20 bg-white dark:bg-slate-900/40 rounded-3xl border border-gray-200 dark:border-slate-800">
                                    <Pill className="h-12 w-12 text-teal-500/40 mx-auto mb-4" />
                                    <h3 className="text-base font-bold text-gray-700 dark:text-gray-300">No hay recetas emitidas aún</h3>
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-sm mx-auto">
                                        Generá prescripciones médicas estandarizadas con firma digitalizada o manual listas para imprimir.
                                    </p>
                                    <button
                                        onClick={() => setIsPrescriptionModalOpen(true)}
                                        className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all"
                                    >
                                        <Plus className="h-4 w-4" /> Emitir Primera Receta
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {prescriptions.map((presc) => (
                                        <div 
                                            key={presc.id}
                                            className="bg-white dark:bg-slate-900/50 backdrop-blur-md rounded-2xl border border-gray-200/80 dark:border-slate-800 p-6 space-y-4 shadow-sm hover:shadow-md transition-all"
                                        >
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 dark:border-slate-800 pb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2.5 bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400 rounded-xl">
                                                        <Pill className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-extrabold text-sm text-gray-900 dark:text-slate-100 flex items-center gap-2">
                                                            <span>Receta ID: {presc.id}</span>
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                                                presc.status === 'anulada' 
                                                                    ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' 
                                                                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                                            }`}>
                                                                {presc.status === 'anulada' ? 'Anulada' : 'Emitida / Oficial'}
                                                            </span>
                                                        </h4>
                                                        <p className="text-xs text-gray-400">
                                                            {presc.professionalName} ({presc.professionalSpecialty || 'Médico'}) • M.N./M.P. N° {presc.professionalMatricula || 'S/D'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right text-xs text-gray-400 font-medium">
                                                    <p>Emisión: {new Date(presc.issuedAt).toLocaleDateString('es-AR')}</p>
                                                    <p className="text-[11px] text-teal-600 dark:text-teal-400 font-bold">Vence: {new Date(presc.expiresAt).toLocaleDateString('es-AR')}</p>
                                                </div>
                                            </div>

                                            {/* Medications list */}
                                            <div className="space-y-2">
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Medicamentos Prescritos (Rp/):</p>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {presc.medications.map((m, idx) => (
                                                        <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-gray-100 dark:border-slate-800 text-xs flex justify-between items-center">
                                                            <div>
                                                                <p className="font-bold text-gray-900 dark:text-slate-100">{idx + 1}. {m.name}</p>
                                                                <p className="text-gray-500 text-[11px]">Dosis: {m.dosage || 'Según indicación'} {m.instructions ? `• Indicación: ${m.instructions}` : ''}</p>
                                                            </div>
                                                            <span className="px-2.5 py-1 bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 font-bold rounded-lg text-[11px] shrink-0">
                                                                Cant: {m.quantity}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {presc.diagnosis && (
                                                <p className="text-xs text-gray-500">
                                                    <strong className="text-gray-700 dark:text-slate-300">Diagnóstico OMS:</strong> {presc.diagnosis}
                                                </p>
                                            )}

                                            {/* Security Footer & Buttons */}
                                            <div className="pt-2 border-t border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                                                <div className="flex items-center gap-1.5 text-gray-400 font-mono text-[10px]">
                                                    <QrCode className="h-4 w-4 text-teal-500 shrink-0" />
                                                    <span className="truncate max-w-xs">Hash: {presc.hash}</span>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => generatePrescriptionPDF(presc)}
                                                        className="flex items-center gap-1 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-sm text-xs cursor-pointer"
                                                    >
                                                        <Download className="h-3.5 w-3.5" />
                                                        <span>Descargar PDF</span>
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            const origin = window.location.origin;
                                                            navigator.clipboard.writeText(`${origin}/validar-receta/${presc.id}`);
                                                            alert("Link público de verificación QR copiado al portapapeles.");
                                                        }}
                                                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 font-semibold rounded-xl text-xs cursor-pointer"
                                                    >
                                                        <Copy className="h-3.5 w-3.5" />
                                                        <span>Copiar QR</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
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
                                    <div className={`bg-white dark:bg-slate-900/50 backdrop-blur-md rounded-2xl border p-6 space-y-5 shadow-sm hover:shadow-md transition-all duration-300 ${
                                        consultation.isImportant 
                                            ? "border-rose-400/50 bg-rose-500/[0.01] dark:border-rose-900/30" 
                                            : "border-gray-200/80 dark:border-slate-800"
                                    } print:border-gray-300 print:shadow-none print:p-4 print:bg-white`}>
                                        
                                        {/* Professional Header */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 dark:border-slate-800 pb-3">
                                            <div className="flex items-center gap-2.5">
                                                <div className="p-2 bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400 rounded-lg shrink-0">
                                                    <User className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <span className="font-extrabold text-xs text-gray-800 dark:text-slate-200 uppercase tracking-wider block">
                                                        {consultation.professionalName || currentUser?.razonSocial || currentUser?.name || "Profesional de la Salud"}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400 dark:text-gray-500 block">
                                                        {consultation.professionalSpecialty ? `${consultation.professionalSpecialty} • ` : ""}
                                                        {consultation.professionalMatricula ? `Mat. ${consultation.professionalMatricula} • ` : ""}
                                                        Firma Electrónica Autorizada
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-left sm:text-right shrink-0">
                                                <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider block">
                                                    {new Date(consultation.date).toLocaleDateString("es-AR", {
                                                        day: "numeric",
                                                        month: "long",
                                                        year: "numeric"
                                                    })}
                                                </span>
                                                <span className="text-[10px] text-gray-400 dark:text-gray-500 block">
                                                    {new Date(consultation.date).toLocaleTimeString("es-AR", {
                                                        hour: "2-digit",
                                                        minute: "2-digit"
                                                    })} hs
                                                </span>
                                            </div>
                                        </div>

                                        {/* Error indicator banner */}
                                        {consultation.isError && (
                                            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs font-bold">
                                                <ShieldAlert className="h-4 w-4 shrink-0 animate-bounce" />
                                                <span>REGISTRO ANULADO POR ERROR POR {consultation.errorMarkedBy || "Profesional"} el {new Date(consultation.errorMarkedAt || consultation.date).toLocaleDateString("es-AR")}</span>
                                            </div>
                                        )}

                                        {/* Reason & Diagnostics */}
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Motivo / Diagnóstico</span>
                                                <h4 className={`font-black text-base text-teal-600 dark:text-teal-400 print:text-black ${consultation.isError ? 'line-through text-gray-400 dark:text-gray-500' : ''}`}>
                                                    {consultation.reason}
                                                </h4>
                                            </div>
                                            
                                            {/* Action icons (hidden in print) */}
                                            <div className="flex items-center gap-1.5 print:hidden shrink-0">
                                                {!consultation.isError && (
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
                                                )}
                                                
                                                {/* Allow marking as error only for clinic owner/client OR the specific professional who logged it */}
                                                {!consultation.isError && (currentUser?.role === 'cliente' || currentUser?.role === 'owner' || consultation.professionalId === currentUser?.id) && (
                                                    <button
                                                        onClick={async () => {
                                                            if (!confirm("¿Desea anular este registro y marcarlo como ERRÓNEO? Esta acción no se puede deshacer de acuerdo con la legislación vigente.")) return;
                                                            try {
                                                                const res = await fetch("/api/vitacore/consultations", {
                                                                    method: "PUT",
                                                                    headers: { "Content-Type": "application/json" },
                                                                    body: JSON.stringify({
                                                                        userId: targetUserId,
                                                                        patientId: patient.id,
                                                                        consultationId: consultation.id,
                                                                        updatedData: {
                                                                            isError: true,
                                                                            errorMarkedBy: currentUser.nombre,
                                                                            errorMarkedAt: new Date().toISOString()
                                                                        }
                                                                    })
                                                                });
                                                                if (res.ok) {
                                                                    fetchPatientData(targetUserId);
                                                                }
                                                            } catch (e) {
                                                                console.error(e);
                                                            }
                                                        }}
                                                        className="p-1.5 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg border border-rose-100 dark:border-rose-900/30 transition-all text-xs font-bold flex items-center gap-1"
                                                        title="Marcar como Erróneo"
                                                    >
                                                        <ShieldAlert className="h-4.5 w-4.5" />
                                                        <span>Anular por Error</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Observations / Observations Notes */}
                                        {consultation.observations && (
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Evolución Clínica</span>
                                                <p className={`text-xs md:text-sm leading-relaxed whitespace-pre-line bg-white dark:bg-zinc-900 p-4 rounded-xl border border-gray-200 dark:border-zinc-800 text-[#4a5568] dark:text-[#a0aec0] font-medium print:bg-white print:p-0 print:border-none ${
                                                    consultation.isError ? 'line-through opacity-40' : ''
                                                }`}>
                                                    {consultation.observations}
                                                </p>
                                            </div>
                                        )}

                                        {/* Recetario / Prescriptions */}
                                        {consultation.prescription && (
                                            <div className={`relative p-6 bg-white dark:bg-zinc-950 border-2 border-dashed border-teal-500/20 dark:border-teal-500/30 rounded-2xl space-y-4 print:bg-white print:border-2 print:border-dashed print:border-gray-400 overflow-hidden ${
                                                consultation.isError ? 'opacity-40' : ''
                                            }`}>
                                                {/* Dotted/dashed card decoration mimicking physical prescription */}
                                                <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 dark:bg-teal-400/5 rounded-full blur-2xl pointer-events-none" />
                                                
                                                <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-2">
                                                    <span className="text-xs font-black text-teal-600 dark:text-teal-400 tracking-wider">Rp/ Prescripción</span>
                                                    <span className="text-[9px] text-gray-400 dark:text-gray-500 font-bold">VALIDEZ NACIONAL</span>
                                                </div>
                                                
                                                <p className={`text-xs md:text-sm text-gray-800 dark:text-slate-200 font-bold whitespace-pre-line leading-relaxed min-h-[50px] print:text-black ${
                                                    consultation.isError ? 'line-through' : ''
                                                }`}>
                                                    {consultation.prescription}
                                                </p>

                                                {/* Stamp & Signature area */}
                                                <div className="flex flex-col items-end text-[9px] text-gray-400 pt-2">
                                                    <div className="w-36 border-t border-gray-300 dark:border-slate-700/80 my-1.5" />
                                                    <span className="font-bold text-gray-400 dark:text-gray-500">{consultation.professionalName || currentUser?.razonSocial || currentUser?.name || "Profesional Firmante"}</span>
                                                    <span>Firma y Sello Electrónico</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Tags */}
                                        {consultation.tags && consultation.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 pt-1">
                                                {consultation.tags.map((tag, idx) => (
                                                    <span 
                                                        key={idx}
                                                        className={`px-2.5 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 rounded text-[9px] font-bold ${
                                                            consultation.isError ? 'line-through opacity-45' : ''
                                                        }`}
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
                                        className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">DNI / ID *</label>
                                    <input
                                        type="text"
                                        required
                                        value={editForm.dni}
                                        onChange={(e) => setEditForm({ ...editForm, dni: e.target.value })}
                                        className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Fecha de Nacimiento</label>
                                    <input
                                        type="date"
                                        value={editForm.birthDate}
                                        onChange={(e) => setEditForm({ ...editForm, birthDate: e.target.value })}
                                        className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Teléfono</label>
                                    <input
                                        type="tel"
                                        value={editForm.phone}
                                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                        className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Email</label>
                                    <input
                                        type="email"
                                        value={editForm.email}
                                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                        className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Obra Social / Cobertura</label>
                                    <input
                                        type="text"
                                        value={editForm.obraSocial}
                                        onChange={(e) => setEditForm({ ...editForm, obraSocial: e.target.value })}
                                        className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
                                    />
                                </div>
                                <div className="space-y-1 sm:col-span-2">
                                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Número de afiliado</label>
                                    <input
                                        type="text"
                                        value={editForm.affiliateNumber}
                                        onChange={(e) => setEditForm({ ...editForm, affiliateNumber: e.target.value })}
                                        className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
                                    />
                                </div>
                                <div className="space-y-1 sm:col-span-2">
                                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Detalles Médicos Críticos / Alergias</label>
                                    <textarea
                                        rows="2"
                                        value={editForm.importantDetails}
                                        onChange={(e) => setEditForm({ ...editForm, importantDetails: e.target.value })}
                                        className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 resize-none"
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
                                        className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
                                    />
                                </div>
                                <div className="space-y-1 relative">
                                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Motivo / Diagnóstico *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Tippee síntoma o diagnóstico (ej: Diabetes, Angina)..."
                                        value={newConsultation.reason}
                                        onChange={(e) => handleReasonChange(e.target.value)}
                                        onFocus={() => { if (diagSuggestions.length > 0) setShowDiagDropdown(true); }}
                                        className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
                                    />
                                    {/* Dropdown de Autocompletado CIE-11 / OMS */}
                                    {showDiagDropdown && (
                                        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white dark:bg-zinc-900 border border-teal-200 dark:border-teal-900/50 rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-gray-100 dark:divide-zinc-800">
                                            {diagLoading ? (
                                                <div className="p-3 text-xs text-teal-600 dark:text-teal-400 animate-pulse font-medium">Buscando en catálogo OMS CIE-11...</div>
                                            ) : diagSuggestions.length > 0 ? (
                                                diagSuggestions.map((item) => (
                                                    <div
                                                        key={item.id}
                                                        onClick={() => {
                                                            const text = item.icdCode ? `${item.term} (CIE-11: ${item.icdCode})` : item.term;
                                                            setNewConsultation(prev => ({ ...prev, reason: text }));
                                                            setShowDiagDropdown(false);
                                                        }}
                                                        className="p-2.5 hover:bg-teal-50/60 dark:hover:bg-teal-950/30 cursor-pointer text-xs flex items-center justify-between transition-colors"
                                                    >
                                                        <div className="font-semibold text-gray-800 dark:text-slate-200 pr-2">
                                                            {item.term}
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            {item.icdCode && (
                                                                <span className="px-2 py-0.5 bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 font-extrabold rounded text-[10px]">
                                                                    OMS CIE-11: {item.icdCode}
                                                                </span>
                                                            )}
                                                            <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-zinc-800 text-gray-500 text-[10px] rounded uppercase">
                                                                {item.source}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="p-3 text-xs text-gray-400 italic">Sin sugerencias exactas en catálogo OMS.</div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {currentUser?.role === 'cliente' && (
                                    <div className="space-y-1 sm:col-span-2">
                                        <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Profesional a cargo *</label>
                                        <select
                                            required
                                            value={newConsultation.professionalId}
                                            onChange={(e) => {
                                                const p = professionals.find(pr => pr.id === e.target.value);
                                                setNewConsultation({
                                                    ...newConsultation,
                                                    professionalId: e.target.value,
                                                    professionalName: p ? p.nombre : currentUser.nombre,
                                                    professionalSpecialty: p ? p.specialty : "Director Clínico",
                                                    professionalMatricula: p ? p.matricula : ""
                                                });
                                            }}
                                            className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                                        >
                                            <option value="">-- Seleccionar Profesional --</option>
                                            <option value={currentUser.id}>{currentUser.nombre} (Director Clínico)</option>
                                            {professionals.map(p => (
                                                <option key={p.id} value={p.id}>{p.nombre} ({p.specialty || "Médico"})</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="space-y-1 sm:col-span-2">
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Observaciones Clínicas</label>
                                        <button
                                            type="button"
                                            onClick={handleFormatSoep}
                                            disabled={aiSoepLoading}
                                            className="flex items-center gap-1 text-[11px] font-bold text-violet-600 dark:text-violet-400 hover:text-violet-700 bg-violet-50 dark:bg-violet-950/30 px-2.5 py-1 rounded-lg border border-violet-200 dark:border-violet-800 transition-all cursor-pointer disabled:opacity-50"
                                        >
                                            <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                                            <span>{aiSoepLoading ? "Formateando SOEP..." : "Formatear SOEP con IA"}</span>
                                        </button>
                                    </div>
                                    <textarea
                                        rows="4"
                                        placeholder="Escriba borrador o examen físico y presione 'Formatear SOEP con IA'..."
                                        value={newConsultation.observations}
                                        onChange={(e) => setNewConsultation({ ...newConsultation, observations: e.target.value })}
                                        className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 resize-none font-mono text-xs"
                                    />
                                </div>
                                <div className="space-y-1 sm:col-span-2 relative">
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Indicaciones / Receta / Tratamiento</label>
                                        <button
                                            type="button"
                                            onClick={handleGeneratePatientGuide}
                                            disabled={aiGuideLoading}
                                            className="flex items-center gap-1 text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:text-teal-700 bg-teal-50 dark:bg-teal-950/30 px-2.5 py-1 rounded-lg border border-teal-200 dark:border-teal-800 transition-all cursor-pointer disabled:opacity-50"
                                        >
                                            <Sparkles className="h-3.5 w-3.5 text-teal-500" />
                                            <span>{aiGuideLoading ? "Analizando..." : "Chequear Alergias & Guía Paciente"}</span>
                                        </button>
                                    </div>
                                    <textarea
                                        rows="2"
                                        placeholder="Prescripción de medicamentos (ej: Ibuprofeno), laboratorios (LOINC), etc."
                                        value={newConsultation.prescription}
                                        onChange={(e) => handlePrescriptionChange(e.target.value)}
                                        onFocus={() => { if (rxSuggestions.length > 0) setShowRxDropdown(true); }}
                                        className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 resize-none"
                                    />
                                    {/* Dropdown de Autocompletado Vademecum RxNorm / LOINC */}
                                    {showRxDropdown && (
                                        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-900/50 rounded-xl shadow-xl max-h-52 overflow-y-auto divide-y divide-gray-100 dark:divide-zinc-800">
                                            {rxLoading ? (
                                                <div className="p-3 text-xs text-blue-600 dark:text-blue-400 animate-pulse font-medium">Buscando en Vademécum RxNorm / LOINC...</div>
                                            ) : rxSuggestions.length > 0 ? (
                                                rxSuggestions.map((item) => (
                                                    <div
                                                        key={item.id}
                                                        onClick={() => {
                                                            const lines = newConsultation.prescription.split("\n");
                                                            lines[lines.length - 1] = item.term;
                                                            setNewConsultation(prev => ({ ...prev, prescription: lines.join("\n") }));
                                                            setShowRxDropdown(false);
                                                        }}
                                                        className="p-2.5 hover:bg-blue-50/60 dark:hover:bg-blue-950/30 cursor-pointer text-xs flex items-center justify-between transition-colors"
                                                    >
                                                        <div className="font-semibold text-gray-800 dark:text-slate-200 pr-2">
                                                            {item.term}
                                                        </div>
                                                        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-extrabold rounded text-[10px] uppercase">
                                                            {item.source}
                                                        </span>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="p-3 text-xs text-gray-400 italic">Sin sugerencias en Vademécum.</div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Display AI Safety Alert or Patient Guide if generated */}
                                {aiGuideData && (
                                    <div className="sm:col-span-2 space-y-3 pt-2">
                                        {aiGuideData.hasSafetyWarning && aiGuideData.safetyWarning && (
                                            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 rounded-xl text-xs flex items-start gap-2.5 font-bold">
                                                <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                                                <span>⚠️ ALERTA DE SEGURIDAD IA: {aiGuideData.safetyWarning}</span>
                                            </div>
                                        )}

                                        {aiGuideData.patientGuide && (
                                            <div className="p-4 bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/40 rounded-xl space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-black text-teal-700 dark:text-teal-300 uppercase tracking-wider">Guía de Tratamiento para el Paciente (Gemini AI)</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(aiGuideData.patientGuide);
                                                            setCopiedGuide(true);
                                                            setTimeout(() => setCopiedGuide(false), 2000);
                                                        }}
                                                        className="flex items-center gap-1 text-[11px] font-bold text-teal-700 dark:text-teal-300 hover:text-teal-900 bg-white dark:bg-zinc-900 px-2 py-1 rounded-md border border-teal-200 dark:border-teal-800"
                                                    >
                                                        {copiedGuide ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                                                        <span>{copiedGuide ? "Copiado!" : "Copiar Texto"}</span>
                                                    </button>
                                                </div>
                                                <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-medium whitespace-pre-wrap">
                                                    {aiGuideData.patientGuide}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Etiquetas (Separadas por comas)</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Control, Hipertensión, Receta"
                                        value={newConsultation.tagsInput}
                                        onChange={(e) => setNewConsultation({ ...newConsultation, tagsInput: e.target.value })}
                                        className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
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

            {/* Modal de Resumen Clínico Inteligente (Gemini AI) */}
            {isSummaryModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div onClick={() => setIsSummaryModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                    <div className="bg-white dark:bg-zinc-950 border border-violet-500/30 rounded-3xl w-full max-w-2xl p-6 shadow-2xl relative z-10 space-y-6 overflow-hidden">
                        {/* Glow element */}
                        <div className="absolute top-0 right-0 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

                        <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-gradient-to-tr from-violet-600 to-indigo-600 text-white rounded-2xl shadow-md">
                                    <Brain className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-gray-900 dark:text-slate-100">Resumen Clínico Inteligente</h3>
                                    <p className="text-xs text-violet-600 dark:text-violet-400 font-bold">Generado con Google Gemini 2.5 Flash</p>
                                </div>
                            </div>
                            <button onClick={() => setIsSummaryModalOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg">✕</button>
                        </div>

                        {aiSummaryLoading ? (
                            <div className="py-12 text-center space-y-3">
                                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-violet-600 mx-auto"></div>
                                <p className="text-xs font-bold text-gray-500 animate-pulse">Analizando historial médico y evoluciones clínicas con Gemini AI...</p>
                            </div>
                        ) : aiSummaryData ? (
                            <div className="space-y-5 text-sm max-h-[65vh] overflow-y-auto pr-1">
                                {/* Summary Box */}
                                <div className="p-4 bg-violet-50/50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/30 rounded-2xl space-y-2">
                                    <span className="text-xs font-black text-violet-700 dark:text-violet-300 uppercase tracking-wider block">Síntesis General del Paciente</span>
                                    <p className="text-xs md:text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                                        {aiSummaryData.summary}
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Active Conditions */}
                                    <div className="p-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl space-y-2">
                                        <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Diagnósticos / Condiciones Activas</span>
                                        <ul className="space-y-1.5 text-xs">
                                            {aiSummaryData.activeConditions && aiSummaryData.activeConditions.length > 0 ? (
                                                aiSummaryData.activeConditions.map((cond, idx) => (
                                                    <li key={idx} className="flex items-start gap-2 text-gray-800 dark:text-slate-200 font-semibold">
                                                        <span className="text-teal-500">•</span>
                                                        <span>{cond}</span>
                                                    </li>
                                                ))
                                            ) : (
                                                <li className="text-gray-400 text-xs italic">Sin condiciones crónicas registradas.</li>
                                            )}
                                        </ul>
                                    </div>

                                    {/* Current Treatments */}
                                    <div className="p-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl space-y-2">
                                        <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Tratamientos Prescritos</span>
                                        <ul className="space-y-1.5 text-xs">
                                            {aiSummaryData.currentTreatments && aiSummaryData.currentTreatments.length > 0 ? (
                                                aiSummaryData.currentTreatments.map((treat, idx) => (
                                                    <li key={idx} className="flex items-start gap-2 text-gray-800 dark:text-slate-200 font-semibold">
                                                        <span className="text-indigo-500">•</span>
                                                        <span>{treat}</span>
                                                    </li>
                                                ))
                                            ) : (
                                                <li className="text-gray-400 text-xs italic">Sin tratamientos activos.</li>
                                            )}
                                        </ul>
                                    </div>
                                </div>

                                {/* Key Alerts */}
                                {aiSummaryData.keyAlerts && aiSummaryData.keyAlerts.length > 0 && (
                                    <div className="p-4 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/50 dark:border-rose-900/30 rounded-2xl space-y-2">
                                        <span className="text-[11px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider block">Alertas Clínicas y Recomendaciones</span>
                                        <ul className="space-y-1 text-xs">
                                            {aiSummaryData.keyAlerts.map((alertItem, idx) => (
                                                <li key={idx} className="flex items-start gap-2 text-rose-700 dark:text-rose-300 font-bold">
                                                    <ShieldAlert className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
                                                    <span>{alertItem}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        ) : null}

                        <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-slate-800">
                            <button
                                onClick={() => setIsSummaryModalOpen(false)}
                                className="px-5 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl text-xs cursor-pointer"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: EMITIR NUEVA RECETA MÉDICA */}
            {isPrescriptionModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div onClick={() => setIsPrescriptionModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                    <div className="bg-white dark:bg-zinc-950 border border-teal-500/30 rounded-3xl w-full max-w-3xl p-6 shadow-2xl relative z-10 space-y-6 overflow-hidden max-h-[92vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-gradient-to-tr from-teal-600 to-cyan-600 text-white rounded-2xl shadow-md">
                                    <Pill className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-gray-900 dark:text-slate-100">Emitir Receta Médica Digital</h3>
                                    <p className="text-xs text-gray-400">Prescripción estandarizada de medicamentos con validez legal QR (Ley 27.553).</p>
                                </div>
                            </div>
                            <button onClick={() => setIsPrescriptionModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white font-bold">✕</button>
                        </div>

                        <form onSubmit={handleSavePrescription} className="space-y-6">
                            {/* Professional Selector (if Client Owner) */}
                            {currentUser?.role === 'cliente' && professionals.length > 0 && (
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Profesional Emisor *</label>
                                    <select
                                        value={newPrescription.professionalId}
                                        onChange={(e) => setNewPrescription({ ...newPrescription, professionalId: e.target.value })}
                                        className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-gray-900 dark:text-slate-100"
                                    >
                                        <option value="">-- {currentUser.nombre} (Director Clínico) --</option>
                                        {professionals.map(p => (
                                            <option key={p.id} value={p.id}>{p.nombre} ({p.specialty || 'Médico'}) - Mat. {p.matricula}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Patient Info Summary */}
                            <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-gray-200/80 dark:border-slate-800 text-xs flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-gray-900 dark:text-slate-100">Paciente: {patient.name} (DNI: {patient.dni})</p>
                                    <p className="text-gray-500 text-[11px]">Cobertura: {patient.obraSocial || 'Particular'} {patient.affiliateNumber ? `#${patient.affiliateNumber}` : ''}</p>
                                </div>
                                <span className="px-2.5 py-1 bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 font-bold rounded-lg text-[10px] uppercase">
                                    Vencimiento: 30 Días
                                </span>
                            </div>

                            {/* Prescribed Medications Repeater */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Medicamentos / Prescripción (Rp/) *</label>
                                    <button
                                        type="button"
                                        onClick={handleAddMedicationLine}
                                        className="flex items-center gap-1 text-xs font-bold text-teal-600 dark:text-teal-400 hover:text-teal-700 cursor-pointer"
                                    >
                                        <Plus className="h-3.5 w-3.5" /> Agregar Medicamento
                                    </button>
                                </div>

                                {newPrescription.medications.map((med, index) => (
                                    <div key={index} className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-gray-200/80 dark:border-slate-800 space-y-3 relative">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-extrabold text-teal-600 dark:text-teal-400">Medicamento N° {index + 1}</span>
                                            {newPrescription.medications.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveMedicationLine(index)}
                                                    className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" /> Quitar
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div className="sm:col-span-2 space-y-1">
                                                <label className="text-[11px] font-bold text-gray-400 uppercase">Nombre / Principio Activo *</label>
                                                <input
                                                    type="text"
                                                    required
                                                    placeholder="Tippee medicamento (ej: Ibuprofeno 600mg, Amoxicilina 500mg)..."
                                                    value={med.name}
                                                    onChange={(e) => handleMedicationChange(index, 'name', e.target.value)}
                                                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-xs font-semibold"
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[11px] font-bold text-gray-400 uppercase">Cantidad</label>
                                                <input
                                                    type="text"
                                                    placeholder="Ej: 1 caja / 20 comp."
                                                    value={med.quantity}
                                                    onChange={(e) => handleMedicationChange(index, 'quantity', e.target.value)}
                                                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-xs font-semibold"
                                                />
                                            </div>

                                            <div className="sm:col-span-2 space-y-1">
                                                <label className="text-[11px] font-bold text-gray-400 uppercase">Dosis y Posología</label>
                                                <input
                                                    type="text"
                                                    placeholder="Ej: 1 comprimido cada 8 horas por 7 días"
                                                    value={med.dosage}
                                                    onChange={(e) => handleMedicationChange(index, 'dosage', e.target.value)}
                                                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-xs"
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[11px] font-bold text-gray-400 uppercase">Indicación Especial</label>
                                                <input
                                                    type="text"
                                                    placeholder="Ej: Tomar con las comidas"
                                                    value={med.instructions}
                                                    onChange={(e) => handleMedicationChange(index, 'instructions', e.target.value)}
                                                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-xs"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Diagnosis & Observations */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 uppercase">Diagnóstico OMS (CIE-11)</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Diabetes mellitus (5A11), Infección aguda..."
                                        value={newPrescription.diagnosis}
                                        onChange={(e) => setNewPrescription(prev => ({ ...prev, diagnosis: e.target.value }))}
                                        className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-xs"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 uppercase">Observaciones Médicas</label>
                                    <input
                                        type="text"
                                        placeholder="Indicaciones higiénico-dietéticas o de control"
                                        value={newPrescription.observations}
                                        onChange={(e) => setNewPrescription(prev => ({ ...prev, observations: e.target.value }))}
                                        className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-xs"
                                    />
                                </div>
                            </div>

                            {/* Digital Signature Preference Toggle */}
                            <div className="p-4 bg-teal-50/70 dark:bg-teal-950/30 rounded-2xl border border-teal-200/60 dark:border-teal-900/40 space-y-2">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={newPrescription.useDigitalSignature}
                                        onChange={(e) => setNewPrescription(prev => ({ ...prev, useDigitalSignature: e.target.checked }))}
                                        className="h-4 w-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500"
                                    />
                                    <span className="text-xs font-bold text-gray-800 dark:text-slate-200">
                                        Incrustar mi Firma & Sello Digitalizado en el PDF generado
                                    </span>
                                </label>
                                <p className="text-[11px] text-gray-500 pl-7">
                                    {newPrescription.useDigitalSignature 
                                        ? "El PDF se generará con su firma y sello estampados digitalmente listos para descargar o enviar." 
                                        : "El PDF se generará con un recuadro delimitado para que imprima y firme holográficamente a mano."}
                                </p>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsPrescriptionModalOpen(false)}
                                    className="px-4 py-2 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold text-gray-500"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={prescriptionSubmitting}
                                    className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs shadow-md cursor-pointer disabled:opacity-50"
                                >
                                    {prescriptionSubmitting ? "Emitiendo..." : "Emitir y Generar Receta PDF"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: CONFIGURAR FIRMA & SELLO DIGITALIZADO */}
            {isSignatureModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div onClick={() => setIsSignatureModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                    <div className="bg-white dark:bg-zinc-950 border border-cyan-500/30 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative z-10 space-y-6 overflow-hidden">
                        <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-cyan-600 text-white rounded-2xl shadow-md">
                                    <FileSignature className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-gray-900 dark:text-slate-100">Firma & Sello Digitalizado</h3>
                                    <p className="text-xs text-gray-400">Configure su estampa médica para recetas digitales (Ley 27.553).</p>
                                </div>
                            </div>
                            <button onClick={() => setIsSignatureModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white font-bold">✕</button>
                        </div>

                        <SignatureCanvas
                            initialImage={profSignature}
                            onSave={(imgData) => setProfSignature(imgData)}
                        />

                        <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-slate-800">
                            <button
                                onClick={() => {
                                    setIsSignatureModalOpen(false);
                                    alert("Firma digitalizada guardada correctamente para sus próximas recetas.");
                                }}
                                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs cursor-pointer"
                            >
                                Confirmar y Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
