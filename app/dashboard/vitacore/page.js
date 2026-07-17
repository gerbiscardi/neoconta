"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users, ClipboardList, ShieldAlert, Plus, Search, User, Filter, AlertCircle, RefreshCw, X } from "lucide-react";

export default function VitacoreDirectory() {
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    
    // Search and filters
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedObraSocial, setSelectedObraSocial] = useState("");

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newPatient, setNewPatient] = useState({
        name: "",
        dni: "",
        birthDate: "",
        phone: "",
        email: "",
        obraSocial: "",
        affiliateNumber: "",
        importantDetails: ""
    });
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState("");

    const router = useRouter();

    useEffect(() => {
        const userStr = localStorage.getItem("neoconta_user");
        if (!userStr) {
            router.push("/login");
        } else {
            const user = JSON.parse(userStr);
            setCurrentUser(user);
            fetchPatients(user.id);
        }
    }, [router]);

    const fetchPatients = async (userId) => {
        try {
            setLoading(true);
            const res = await fetch(`/api/vitacore/patients?userId=${userId}`);
            const data = await res.json();
            if (data.success) {
                setPatients(data.patients || []);
            }
        } catch (error) {
            console.error("Error fetching patients:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreatePatient = async (e) => {
        e.preventDefault();
        setFormError("");
        if (!newPatient.name.trim() || !newPatient.dni.trim()) {
            setFormError("El nombre completo y el DNI son requeridos.");
            return;
        }

        try {
            setSubmitting(true);
            const res = await fetch("/api/vitacore/patients", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: currentUser.id,
                    patient: newPatient
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                setIsModalOpen(false);
                setNewPatient({
                    name: "",
                    dni: "",
                    birthDate: "",
                    phone: "",
                    email: "",
                    obraSocial: "",
                    affiliateNumber: "",
                    importantDetails: ""
                });
                fetchPatients(currentUser.id);
            } else {
                setFormError(data.error || "Ocurrió un error al registrar el paciente.");
            }
        } catch (error) {
            console.error("Error creating patient:", error);
            setFormError("Error de conexión. Intente de nuevo.");
        } finally {
            setSubmitting(false);
        }
    };

    // Calculate metrics
    const totalPatients = patients.length;
    const totalConsultations = patients.reduce((acc, p) => acc + (p.consultations?.length || 0), 0);
    const criticalPatientsCount = patients.filter(p => p.importantDetails && p.importantDetails.trim().length > 0).length;

    // Get unique Obras Sociales for filter dropdown
    const obrasSocialesList = Array.from(
        new Set(patients.map(p => p.obraSocial).filter(os => os && os.trim() !== ""))
    ).sort();

    // Filter patients list
    const filteredPatients = patients.filter(p => {
        const matchesSearch = 
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.dni.includes(searchQuery) ||
            (p.obraSocial && p.obraSocial.toLowerCase().includes(searchQuery.toLowerCase()));
        
        const matchesObraSocial = 
            !selectedObraSocial || p.obraSocial === selectedObraSocial;

        return matchesSearch && matchesObraSocial;
    });

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in text-gray-900 dark:text-slate-100">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-teal-600 via-cyan-500 to-indigo-600 dark:from-teal-400 dark:to-cyan-300 bg-clip-text text-transparent">
                        Vitacore
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Fichero y registro de historias clínicas digitales para tus pacientes.
                    </p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center justify-center gap-2 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-teal-500/10 hover:shadow-teal-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                    <Plus className="h-5 w-5" />
                    Nuevo Paciente
                </button>
            </div>

            {/* Metrics cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {/* Total Patients */}
                <div className="bg-white dark:bg-slate-900/50 backdrop-blur-md rounded-2xl border border-gray-200/80 dark:border-slate-800 p-6 flex items-center justify-between shadow-sm">
                    <div className="space-y-1">
                        <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Total Pacientes</span>
                        <h3 className="text-2xl font-black">{totalPatients}</h3>
                    </div>
                    <div className="p-3 bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400 rounded-2xl">
                        <Users className="h-6 w-6" />
                    </div>
                </div>

                {/* Total Consultas */}
                <div className="bg-white dark:bg-slate-900/50 backdrop-blur-md rounded-2xl border border-gray-200/80 dark:border-slate-800 p-6 flex items-center justify-between shadow-sm">
                    <div className="space-y-1">
                        <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Consultas Registradas</span>
                        <h3 className="text-2xl font-black">{totalConsultations}</h3>
                    </div>
                    <div className="p-3 bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400 rounded-2xl">
                        <ClipboardList className="h-6 w-6" />
                    </div>
                </div>

                {/* Critical Details count */}
                <div className="bg-white dark:bg-slate-900/50 backdrop-blur-md rounded-2xl border border-gray-200/80 dark:border-slate-800 p-6 flex items-center justify-between shadow-sm">
                    <div className="space-y-1">
                        <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Alertas Médicas</span>
                        <h3 className="text-2xl font-black">{criticalPatientsCount}</h3>
                    </div>
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-2xl">
                        <ShieldAlert className="h-6 w-6" />
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white dark:bg-slate-900/50 backdrop-blur-md rounded-2xl border border-gray-200/80 dark:border-slate-800 p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
                {/* Search */}
                <div className="relative w-full md:max-w-md">
                    <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, DNI o obra social..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-805/50 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 dark:focus:ring-teal-500/30 focus:border-teal-500 transition-all text-gray-900 dark:text-white"
                    />
                </div>

                {/* Filters */}
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <Filter className="h-4 w-4 text-gray-400" />
                    <select
                        value={selectedObraSocial}
                        onChange={(e) => setSelectedObraSocial(e.target.value)}
                        className="w-full md:w-48 py-2 px-3 bg-gray-50 dark:bg-slate-805/50 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all text-gray-900 dark:text-white"
                    >
                        <option value="">Todas las Coberturas</option>
                        {obrasSocialesList.map(os => (
                            <option key={os} value={os}>{os}</option>
                        ))}
                    </select>

                    <button
                        onClick={() => fetchPatients(currentUser?.id)}
                        className="p-2 bg-gray-50 hover:bg-gray-100 dark:bg-slate-805/50 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-500 hover:text-gray-800 transition-all"
                        title="Actualizar Fichero"
                    >
                        <RefreshCw className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Patients Grid */}
            {loading ? (
                <div className="flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-teal-500"></div>
                </div>
            ) : filteredPatients.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-slate-900/40 rounded-3xl border border-gray-200 dark:border-slate-800">
                    <AlertCircle className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300">No se encontraron pacientes</h3>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 max-w-md mx-auto">
                        Probá ajustando los términos de búsqueda o agregá un nuevo paciente al fichero utilizando el botón de arriba.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredPatients.map(patient => (
                        <div 
                            key={patient.id}
                            className="bg-white dark:bg-slate-900/50 backdrop-blur-md rounded-2xl border border-gray-200/80 dark:border-slate-800 p-6 flex flex-col justify-between hover:shadow-md hover:border-teal-500/35 transition-all duration-300 relative group overflow-hidden"
                        >
                            {/* Accent line on hover */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 to-cyan-500 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out" />
                            
                            <div className="space-y-4">
                                {/* Identity info */}
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-teal-50 dark:bg-teal-950/20 text-teal-600 dark:text-teal-400 rounded-xl">
                                        <User className="h-6 w-6" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <h4 className="font-extrabold text-lg line-clamp-1 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                                            {patient.name}
                                        </h4>
                                        <p className="text-xs text-gray-400 dark:text-gray-500 font-bold">
                                            DNI {patient.dni}
                                        </p>
                                    </div>
                                </div>

                                {/* Obra Social */}
                                <div className="text-xs space-y-1">
                                    <span className="text-gray-400 dark:text-gray-500 font-bold block">COBERTURA / OS</span>
                                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                                        {patient.obraSocial ? `${patient.obraSocial} (N° ${patient.affiliateNumber || 'S/N'})` : 'Particular'}
                                    </span>
                                </div>

                                {/* Alertas Médicas (Crucial details) */}
                                {patient.importantDetails && (
                                    <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-700 dark:text-rose-400 rounded-xl text-xs flex items-start gap-2">
                                        <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                                        <span className="font-medium line-clamp-2">{patient.importantDetails}</span>
                                    </div>
                                )}
                            </div>

                            {/* Divider */}
                            <div className="my-5 border-t border-gray-100 dark:border-slate-800" />

                            <div className="flex items-center justify-between gap-4">
                                <span className="text-xs text-gray-400 dark:text-gray-500 font-bold">
                                    {patient.consultations?.length || 0} consultas
                                </span>
                                <Link
                                    href={`/dashboard/vitacore/${patient.id}`}
                                    className="px-4 py-2 bg-gray-50 hover:bg-teal-50 dark:bg-slate-800 dark:hover:bg-teal-950/20 text-gray-700 dark:text-slate-200 hover:text-teal-600 dark:hover:text-teal-400 font-bold rounded-xl text-xs transition-colors border border-gray-200 dark:border-slate-700 hover:border-teal-500/20"
                                >
                                    Ver Ficha Clínica
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal de Nuevo Paciente */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div 
                        onClick={() => setIsModalOpen(false)} 
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                    />

                    {/* Form Card */}
                    <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl relative z-10 space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold">Dar de alta Paciente</h3>
                            <button 
                                onClick={() => setIsModalOpen(false)} 
                                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {formError && (
                            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-700 dark:text-rose-400 rounded-xl text-xs flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                <span className="font-semibold">{formError}</span>
                            </div>
                        )}

                        <form onSubmit={handleCreatePatient} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Name */}
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Nombre Completo *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ej: Juan Pérez"
                                        value={newPatient.name}
                                        onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-805/50 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 text-gray-900 dark:text-white"
                                    />
                                </div>

                                {/* DNI */}
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">DNI / ID *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ej: 30123456"
                                        value={newPatient.dni}
                                        onChange={(e) => setNewPatient({ ...newPatient, dni: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-805/50 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 text-gray-900 dark:text-white"
                                    />
                                </div>

                                {/* Birthdate */}
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Fecha de Nacimiento</label>
                                    <input
                                        type="date"
                                        value={newPatient.birthDate}
                                        onChange={(e) => setNewPatient({ ...newPatient, birthDate: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-805/50 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 text-gray-900 dark:text-white"
                                    />
                                </div>

                                {/* Phone */}
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Teléfono de contacto</label>
                                    <input
                                        type="tel"
                                        placeholder="Ej: +54911234567"
                                        value={newPatient.phone}
                                        onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-805/50 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 text-gray-900 dark:text-white"
                                    />
                                </div>

                                {/* Email */}
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Correo electrónico</label>
                                    <input
                                        type="email"
                                        placeholder="Ej: paciente@email.com"
                                        value={newPatient.email}
                                        onChange={(e) => setNewPatient({ ...newPatient, email: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-805/50 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 text-gray-900 dark:text-white"
                                    />
                                </div>

                                {/* Obra Social */}
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Obra Social / Cobertura</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: OSDE, Medicus, S/C"
                                        value={newPatient.obraSocial}
                                        onChange={(e) => setNewPatient({ ...newPatient, obraSocial: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-805/50 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 text-gray-900 dark:text-white"
                                    />
                                </div>

                                {/* Affiliate Number */}
                                <div className="space-y-1 sm:col-span-2">
                                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Número de afiliado</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: 1-123456-8"
                                        value={newPatient.affiliateNumber}
                                        onChange={(e) => setNewPatient({ ...newPatient, affiliateNumber: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-805/50 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 text-gray-900 dark:text-white"
                                    />
                                </div>

                                {/* Important Details / Critical notes */}
                                <div className="space-y-1 sm:col-span-2">
                                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Detalles Médicos Críticos / Alergias</label>
                                    <textarea
                                        rows="2"
                                        placeholder="Alergias a medicamentos, patologías previas crónicas, intolerancias, etc."
                                        value={newPatient.importantDetails}
                                        onChange={(e) => setNewPatient({ ...newPatient, importantDetails: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-805/50 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 text-gray-900 dark:text-white resize-none"
                                    />
                                </div>
                            </div>

                            {/* Submit */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-bold text-gray-500 hover:text-gray-800 dark:hover:text-white"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-bold rounded-xl text-sm shadow-md hover:scale-[1.01] active:scale-[0.99] disabled:opacity-75 disabled:pointer-events-none transition-all"
                                >
                                    {submitting ? "Registrando..." : "Registrar Paciente"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
