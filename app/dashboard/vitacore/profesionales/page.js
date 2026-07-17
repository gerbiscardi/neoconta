"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
    Plus, 
    Search, 
    User, 
    Mail, 
    Lock, 
    Trash2, 
    Edit2, 
    ChevronLeft, 
    HeartPulse,
    Award,
    ShieldAlert
} from "lucide-react";

export default function ProfessionalsPage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState(null);
    const [professionals, setProfessionals] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    // Modals
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedProfessional, setSelectedProfessional] = useState(null);

    // Forms
    const [form, setForm] = useState({
        nombre: "",
        email: "",
        password: "",
        specialty: "",
        matricula: ""
    });

    useEffect(() => {
        const userStr = localStorage.getItem("neoconta_user");
        if (!userStr) {
            router.push("/login");
            return;
        }
        const user = JSON.parse(userStr);
        if (user.role !== "cliente" && user.role !== "owner") {
            router.push("/dashboard/vitacore");
            return;
        }
        setCurrentUser(user);
        fetchProfessionals(user.id);
    }, [router]);

    const fetchProfessionals = async (userId) => {
        try {
            setLoading(true);
            const res = await fetch(`/api/vitacore/professionals?userId=${userId}`);
            const data = await res.json();
            if (data.success) {
                setProfessionals(data.professionals || []);
            }
        } catch (error) {
            console.error("Error fetching professionals:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenAddModal = () => {
        setForm({
            nombre: "",
            email: "",
            password: "",
            specialty: "",
            matricula: ""
        });
        setErrorMsg("");
        setIsAddModalOpen(true);
    };

    const handleOpenEditModal = (prof) => {
        setSelectedProfessional(prof);
        setForm({
            nombre: prof.nombre,
            email: prof.email,
            password: prof.password,
            specialty: prof.specialty || "",
            matricula: prof.matricula || ""
        });
        setErrorMsg("");
        setIsEditModalOpen(true);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setErrorMsg("");
        setSubmitting(true);
        try {
            const res = await fetch("/api/vitacore/professionals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: currentUser.id,
                    professional: form
                })
            });
            const data = await res.json();
            if (data.success) {
                setIsAddModalOpen(false);
                fetchProfessionals(currentUser.id);
            } else {
                setErrorMsg(data.error || "Error al crear el profesional");
            }
        } catch (error) {
            setErrorMsg("Error de conexión al servidor");
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        setErrorMsg("");
        setSubmitting(true);
        try {
            const res = await fetch("/api/vitacore/professionals", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: currentUser.id,
                    professionalId: selectedProfessional.id,
                    updatedData: form
                })
            });
            const data = await res.json();
            if (data.success) {
                setIsEditModalOpen(false);
                fetchProfessionals(currentUser.id);
            } else {
                setErrorMsg(data.error || "Error al actualizar el profesional");
            }
        } catch (error) {
            setErrorMsg("Error de conexión al servidor");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (profId) => {
        if (!confirm("¿Está seguro de que desea eliminar este profesional? Perderá el acceso a NeoConta.")) return;
        try {
            const res = await fetch(`/api/vitacore/professionals?userId=${currentUser.id}&professionalId=${profId}`, {
                method: "DELETE"
            });
            const data = await res.json();
            if (data.success) {
                fetchProfessionals(currentUser.id);
            } else {
                alert(data.error || "Error al eliminar");
            }
        } catch (error) {
            alert("Error de conexión");
        }
    };

    const filteredProfessionals = professionals.filter(p => {
        const query = searchQuery.toLowerCase();
        return (
            p.nombre.toLowerCase().includes(query) ||
            (p.specialty && p.specialty.toLowerCase().includes(query)) ||
            p.email.toLowerCase().includes(query)
        );
    });

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <button 
                        onClick={() => router.push("/dashboard/vitacore")}
                        className="flex items-center gap-1 text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider hover:underline mb-1"
                    >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Volver a Vitacore
                    </button>
                    <h1 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-teal-500 to-cyan-500 bg-clip-text text-transparent">
                        Usuarios y Profesionales Vitacore
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Administre los profesionales médicos de su clínica. Ellos tendrán acceso restringido únicamente al módulo Vitacore.
                    </p>
                </div>

                <button
                    onClick={handleOpenAddModal}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-extrabold rounded-xl text-sm shadow-lg hover:shadow-teal-500/25 transition-all self-start md:self-auto"
                >
                    <Plus className="h-4.5 w-4.5" />
                    Nuevo Profesional
                </button>
            </div>

            {/* Warning info banner */}
            <div className="p-4 bg-teal-50/40 dark:bg-teal-950/15 border border-teal-100/40 dark:border-teal-900/30 rounded-2xl flex gap-3">
                <HeartPulse className="h-5 w-5 text-teal-500 shrink-0 mt-0.5" />
                <p className="text-xs md:text-sm text-gray-600 dark:text-slate-300 leading-relaxed">
                    <strong>Acceso Limitado:</strong> Los profesionales creados en esta base de datos podrán iniciar sesión en NeoConta con su correo electrónico y contraseña. Sin embargo, su barra de navegación estará limitada única y exclusivamente al módulo <strong>Vitacore</strong> para ver pacientes y redactar evoluciones clínicas. No tendrán acceso a facturación, cuentas bancarias ni analíticas.
                </p>
            </div>

            {/* Filter Bar */}
            <div className="bg-white dark:bg-slate-900/50 backdrop-blur-md rounded-2xl border border-gray-200/80 dark:border-slate-800 p-4 shadow-sm relative">
                <div className="relative w-full max-w-md">
                    <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar profesional por nombre, especialidad o email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 dark:focus:ring-teal-500/30 focus:border-teal-500 transition-all text-gray-900 dark:text-slate-100"
                    />
                </div>
            </div>

            {/* Grid */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <div className="h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-gray-500">Cargando profesionales...</span>
                </div>
            ) : filteredProfessionals.length === 0 ? (
                <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-dashed border-gray-200 dark:border-slate-800 p-12 text-center">
                    <Award className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                    <h3 className="font-bold text-gray-700 dark:text-gray-300 text-lg mb-1">No se encontraron profesionales</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                        {searchQuery ? "Ajuste el término de búsqueda o limpie los filtros." : "Comience agregando el primer profesional médico a cargo de las evoluciones clínicas de sus pacientes."}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProfessionals.map((prof) => (
                        <div 
                            key={prof.id} 
                            className="bg-white dark:bg-slate-900/50 rounded-2xl border border-gray-200/80 dark:border-slate-800/80 p-5 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between gap-4"
                        >
                            <div className="space-y-3">
                                {/* Profile Header */}
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-xl flex items-center justify-center font-black">
                                        {prof.nombre.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h4 className="font-black text-gray-900 dark:text-white text-base leading-tight">
                                            {prof.nombre}
                                        </h4>
                                        <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-black tracking-wider block">
                                            {prof.specialty || "General"}
                                        </span>
                                    </div>
                                </div>

                                {/* Details */}
                                <div className="space-y-1.5 text-xs text-gray-600 dark:text-slate-300 bg-gray-50/50 dark:bg-slate-950/20 p-3 rounded-xl border border-gray-100 dark:border-slate-800/50">
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-400">Matrícula:</span>
                                        <span className="font-bold">{prof.matricula || "S/M"}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-400">Email de acceso:</span>
                                        <span className="font-bold lowercase select-all">{prof.email}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-400">Contraseña:</span>
                                        <span className="font-mono text-teal-600 dark:text-teal-400 font-bold">{prof.password}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-2 border-t border-gray-100 dark:border-slate-800 pt-3">
                                <button
                                    onClick={() => handleOpenEditModal(prof)}
                                    className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/20 rounded-lg transition-colors"
                                    title="Editar Profesional"
                                >
                                    <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(prof.id)}
                                    className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors"
                                    title="Eliminar Profesional"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal: Agregar Profesional */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div onClick={() => setIsAddModalOpen(false)} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                    <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative z-10 space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold">Agregar Profesional</h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="p-1 text-gray-400 hover:text-white">✕</button>
                        </div>
                        {errorMsg && (
                            <div className="p-3 bg-rose-50 text-rose-700 border border-rose-100 rounded-xl text-xs flex gap-2">
                                <ShieldAlert className="h-4 w-4 shrink-0" />
                                <span>{errorMsg}</span>
                            </div>
                        )}
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Nombre Completo *</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ej: Dr. Manuel Guerrero"
                                        value={form.nombre}
                                        onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                                        className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Especialidad</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Pediatría, Odontología, Kinesiología"
                                    value={form.specialty}
                                    onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Matrícula Nacional / Provincial</label>
                                <input
                                    type="text"
                                    placeholder="Ej: M.N. 123456"
                                    value={form.matricula}
                                    onChange={(e) => setForm({ ...form, matricula: e.target.value })}
                                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Email de Acceso *</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="email"
                                        required
                                        placeholder="Ej: medico@clinica.com"
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Contraseña Temporal *</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ej: contraseña123"
                                        value={form.password}
                                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                                        className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-bold text-gray-500 hover:text-gray-800 dark:hover:text-white"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-bold rounded-xl text-sm shadow-md"
                                >
                                    {submitting ? "Creando..." : "Crear Profesional"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Editar Profesional */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div onClick={() => setIsEditModalOpen(false)} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                    <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative z-10 space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold">Editar Profesional</h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="p-1 text-gray-400 hover:text-white">✕</button>
                        </div>
                        {errorMsg && (
                            <div className="p-3 bg-rose-50 text-rose-700 border border-rose-100 rounded-xl text-xs flex gap-2">
                                <ShieldAlert className="h-4 w-4 shrink-0" />
                                <span>{errorMsg}</span>
                            </div>
                        )}
                        <form onSubmit={handleUpdate} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Nombre Completo *</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="text"
                                        required
                                        value={form.nombre}
                                        onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                                        className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Especialidad</label>
                                <input
                                    type="text"
                                    value={form.specialty}
                                    onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Matrícula Nacional / Provincial</label>
                                <input
                                    type="text"
                                    value={form.matricula}
                                    onChange={(e) => setForm({ ...form, matricula: e.target.value })}
                                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Email de Acceso *</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="email"
                                        required
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Contraseña *</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="text"
                                        required
                                        value={form.password}
                                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                                        className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-bold text-gray-500 hover:text-gray-800 dark:hover:text-white"
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
        </div>
    );
}
