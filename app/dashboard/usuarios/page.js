"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
    Users, 
    Search, 
    AlertCircle, 
    CheckCircle2, 
    RefreshCw,
    Shield,
    Pencil,
    Trash2,
    Plus,
    X,
    User,
    Mail,
    Lock,
    Building,
    FileText
} from "lucide-react";

const PLAN_DEFAULTS = {
    base: {
        facturacionManual: true,
        facturacionMasiva: false,
        limiteComprobantes: 50,
        moduloBanco: true,
        variasCuentas: false,
        limiteCuentas: 1,
        conciliacionAsistida: false,
        cruceFacturaBanco: false,
        biBasico: true,
        biAvanzado: false,
        biPremium: false,
        reportesMensuales: false,
        reportesEjecutivos: false,
        exportacionDatos: false,
        alertasSimples: false,
        alertasInteligentes: false,
        moduloImagenWeb: false,
        analisisReputacion: false,
        acompanamientoMensual: false,
        usuariosIncluidos: 1,
        soporteTipo: "estandar"
    },
    pro: {
        facturacionManual: true,
        facturacionMasiva: true,
        limiteComprobantes: 300,
        moduloBanco: true,
        variasCuentas: true,
        limiteCuentas: 3,
        conciliacionAsistida: true,
        cruceFacturaBanco: true,
        biBasico: true,
        biAvanzado: true,
        biPremium: false,
        reportesMensuales: true,
        reportesEjecutivos: false,
        exportacionDatos: true,
        alertasSimples: true,
        alertasInteligentes: false,
        moduloImagenWeb: false,
        analisisReputacion: false,
        acompanamientoMensual: false,
        usuariosIncluidos: 3,
        soporteTipo: "prioritario"
    },
    full: {
        facturacionManual: true,
        facturacionMasiva: true,
        limiteComprobantes: 1000,
        moduloBanco: true,
        variasCuentas: true,
        limiteCuentas: 5,
        conciliacionAsistida: true,
        cruceFacturaBanco: true,
        biBasico: true,
        biAvanzado: true,
        biPremium: true,
        reportesMensuales: true,
        reportesEjecutivos: true,
        exportacionDatos: true,
        alertasSimples: true,
        alertasInteligentes: true,
        moduloImagenWeb: true,
        analisisReputacion: true,
        acompanamientoMensual: true,
        usuariosIncluidos: 5,
        soporteTipo: "preferencial"
    }
};

export default function UsuariosAdmin() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState(null); // { type: 'success'|'error', text: '' }

    // Modals visibility
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);

    // Form data state
    const [formData, setFormData] = useState({
        nombre: "",
        email: "",
        password: "",
        role: "no-cliente",
        tipoUsuario: "recaudador",
        cuit: "",
        razonSocial: "",
        plan: "base",
        features: PLAN_DEFAULTS.base
    });

    // Authentication and Role check
    useEffect(() => {
        const userStr = localStorage.getItem('neoconta_user');
        if (!userStr) {
            router.push("/login");
            return;
        }

        const parsedUser = JSON.parse(userStr);
        if (parsedUser.role !== 'owner') {
            router.push("/dashboard");
            return;
        }

        setCurrentUser(parsedUser);
        fetchUsers(parsedUser);
    }, [router]);

    const fetchUsers = async (user) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/users?callerRole=${user.role}`);
            const data = await res.json();
            if (data.success) {
                setUsers(data.users);
            } else {
                setMessage({ type: 'error', text: data.error || 'Error al cargar usuarios' });
            }
        } catch (error) {
            console.error("Error fetching users:", error);
            setMessage({ type: 'error', text: 'Error de conexión con el servidor' });
        } finally {
            setLoading(false);
        }
    };

    // Open create modal
    const openCreateModal = () => {
        setFormData({
            nombre: "",
            email: "",
            password: "Neo2026",
            role: "no-cliente",
            tipoUsuario: "recaudador",
            cuit: "",
            razonSocial: "",
            plan: "base",
            features: PLAN_DEFAULTS.base
        });
        setMessage(null);
        setShowCreateModal(true);
    };

    // Open edit modal
    const openEditModal = (user) => {
        setSelectedUser(user);
        setFormData({
            nombre: user.nombre || "",
            email: user.email || "",
            password: "", // blank, only change if entered
            role: user.role || "no-cliente",
            tipoUsuario: user.tipoUsuario || "recaudador",
            cuit: user.cuit || "",
            razonSocial: user.razonSocial || "",
            plan: user.plan || "base",
            features: user.features || PLAN_DEFAULTS[user.plan || "base"] || PLAN_DEFAULTS.base
        });
        setMessage(null);
        setShowEditModal(true);
    };

    // Handle form input change
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handlePlanChange = (planName) => {
        setFormData(prev => {
            const updatedFeatures = planName === 'custom' 
                ? prev.features 
                : (PLAN_DEFAULTS[planName] || PLAN_DEFAULTS.base);
            return {
                ...prev,
                plan: planName,
                features: updatedFeatures
            };
        });
    };

    const handleFeatureChange = (key, value) => {
        setFormData(prev => {
            const newFeatures = {
                ...prev.features,
                [key]: value
            };
            
            let matchedPlan = 'custom';
            for (const [planName, defaults] of Object.entries(PLAN_DEFAULTS)) {
                let matches = true;
                for (const [k, v] of Object.entries(defaults)) {
                    if (newFeatures[k] !== v) {
                        matches = false;
                        break;
                    }
                }
                if (matches) {
                    matchedPlan = planName;
                    break;
                }
            }

            return {
                ...prev,
                plan: matchedPlan,
                features: newFeatures
            };
        });
    };

    // Handle user creation
    const handleCreateUser = async (e) => {
        e.preventDefault();
        if (!currentUser) return;
        setSubmitting(true);
        setMessage(null);

        try {
            const res = await fetch("/api/admin/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    callerRole: currentUser.role,
                    ...formData
                })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setMessage({ type: 'success', text: data.message || "Usuario creado con éxito." });
                setShowCreateModal(false);
                fetchUsers(currentUser);
            } else {
                setMessage({ type: 'error', text: data.error || "Ocurrió un error al crear el usuario." });
            }
        } catch (error) {
            console.error("Error creating user:", error);
            setMessage({ type: 'error', text: "Error de conexión. Intente de nuevo." });
        } finally {
            setSubmitting(false);
        }
    };

    // Handle user edit
    const handleEditUser = async (e) => {
        e.preventDefault();
        if (!currentUser || !selectedUser) return;
        setSubmitting(true);
        setMessage(null);

        try {
            const res = await fetch("/api/admin/users", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    callerRole: currentUser.role,
                    userId: selectedUser.id,
                    ...formData
                })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setMessage({ type: 'success', text: data.message || "Usuario actualizado con éxito." });
                setShowEditModal(false);
                fetchUsers(currentUser);
            } else {
                setMessage({ type: 'error', text: data.error || "Ocurrió un error al actualizar el usuario." });
            }
        } catch (error) {
            console.error("Error updating user:", error);
            setMessage({ type: 'error', text: "Error de conexión. Intente de nuevo." });
        } finally {
            setSubmitting(false);
        }
    };

    // Handle user deletion
    const handleDeleteUser = async (userId) => {
        if (!currentUser) return;
        if (!window.confirm("¿Estás seguro de que deseas dar de baja a este usuario? Se revocará su acceso de inmediato.")) {
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const res = await fetch(`/api/admin/users?userId=${userId}&callerRole=${currentUser.role}`, {
                method: "DELETE"
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setMessage({ type: 'success', text: data.message || "Usuario eliminado con éxito." });
                fetchUsers(currentUser);
            } else {
                setMessage({ type: 'error', text: data.error || "Ocurrió un error al eliminar el usuario." });
                setLoading(false);
            }
        } catch (error) {
            console.error("Error deleting user:", error);
            setMessage({ type: 'error', text: "Error de conexión. Intente de nuevo." });
            setLoading(false);
        }
    };

    // Filter users based on search query
    const filteredUsers = users.filter(user => 
        (user.nombre || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.email || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading && users.length === 0) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-orange-500"></div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
                        <Users className="h-8 w-8 text-orange-500" />
                        <span>Gestión de Usuarios</span>
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Administra las cuentas de tus clientes y colaboradores, crea perfiles y gestiona sus datos.
                    </p>
                </div>
                
                <div className="flex gap-3">
                    <button 
                        onClick={openCreateModal}
                        className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl transition-all text-sm cursor-pointer shadow-lg shadow-orange-600/20"
                    >
                        <Plus className="h-4.5 w-4.5" />
                        <span>Crear Usuario</span>
                    </button>

                    <button 
                        onClick={() => fetchUsers(currentUser)}
                        className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded-xl transition-all text-sm cursor-pointer"
                    >
                        <RefreshCw className="h-4 w-4" />
                        <span>Actualizar Lista</span>
                    </button>
                </div>
            </div>

            {/* Notifications */}
            {message && (
                <div className={`p-4 rounded-2xl flex gap-3 items-center border transition-all ${
                    message.type === 'success' 
                        ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200/40 text-emerald-800 dark:text-emerald-400' 
                        : 'bg-red-50 dark:bg-red-950/20 border-red-200/40 text-red-800 dark:text-red-400'
                }`}>
                    {message.type === 'success' ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                    ) : (
                        <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                    )}
                    <span className="text-sm font-semibold">{message.text}</span>
                </div>
            )}

            {/* Search and Stats */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                    <input 
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar por nombre o correo electrónico..." 
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                    />
                </div>

                <div className="flex gap-6 text-sm text-slate-500 dark:text-slate-400 font-medium">
                    <div>
                        Total: <span className="text-slate-800 dark:text-white font-bold">{users.length}</span>
                    </div>
                    <div>
                        Clientes: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{users.filter(u => u.role === 'cliente').length}</span>
                    </div>
                    <div>
                        No Clientes: <span className="text-orange-500 font-bold">{users.filter(u => u.role === 'no-cliente').length}</span>
                    </div>
                </div>
            </div>

            {/* Table Container */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-400 uppercase tracking-wider text-xs font-bold">
                                <th className="p-5">Usuario</th>
                                <th className="p-5">CUIT / Razón Social</th>
                                <th className="p-5">Categoría Actual</th>
                                <th className="p-5">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="p-8 text-center text-slate-500 dark:text-slate-400">
                                        No se encontraron usuarios registrados.
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => {
                                    const isOwner = user.role === 'owner';
                                    const avatarLetter = (user.nombre || "U").charAt(0).toUpperCase();

                                    return (
                                        <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                                            {/* User Details */}
                                            <td className="p-5">
                                                <div className="flex items-center gap-3">
                                                    <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-white ${
                                                        isOwner 
                                                            ? 'bg-gradient-to-tr from-slate-700 to-slate-900' 
                                                            : 'bg-gradient-to-tr from-orange-500 to-amber-500'
                                                    }`}>
                                                        {avatarLetter}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                                            {user.nombre}
                                                            {isOwner && (
                                                                <span className="text-[10px] uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                                                                    <Shield className="h-3 w-3" /> Dueño
                                                                </span>
                                                            )}
                                                        </h4>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* CUIT / Razón Social */}
                                            <td className="p-5 text-sm text-slate-600 dark:text-slate-300 font-medium">
                                                {user.cuit ? (
                                                    <div>
                                                        <p className="font-semibold text-slate-900 dark:text-white">{user.razonSocial || "Sin Razón Social"}</p>
                                                        <p className="text-xs text-slate-500">{user.cuit}</p>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 dark:text-slate-600 italic text-xs">Sin CUIT asignado</span>
                                                )}
                                            </td>

                                            {/* Current Role Badge */}
                                            <td className="p-5">
                                                <div className="flex flex-col gap-1 items-start">
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                                                        isOwner 
                                                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700' 
                                                            : user.role === 'cliente'
                                                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                                                : 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20'
                                                    }`}>
                                                        <span className={`h-1.5 w-1.5 rounded-full ${
                                                            isOwner ? 'bg-slate-500' : user.role === 'cliente' ? 'bg-emerald-500' : 'bg-orange-500'
                                                        }`} />
                                                        {isOwner ? 'Dueño' : user.role === 'cliente' ? 'Cliente' : 'No Cliente'}
                                                    </span>
                                                    {user.role === 'cliente' && (
                                                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-extrabold uppercase tracking-wide border mt-0.5 ${
                                                            user.plan === 'base' ? 'bg-blue-500/5 text-blue-600 dark:text-blue-400 border-blue-500/15' :
                                                            user.plan === 'pro' ? 'bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/15' :
                                                            user.plan === 'full' ? 'bg-purple-500/5 text-purple-600 dark:text-purple-400 border-purple-500/15' :
                                                            'bg-orange-500/5 text-orange-600 dark:text-orange-400 border-orange-500/15'
                                                        }`}>
                                                            {user.plan === 'custom' ? 'Personalizado' : `Plan ${user.plan}`}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Actions */}
                                            <td className="p-5">
                                                {isOwner ? (
                                                    <span className="text-xs text-slate-400 italic">No modificable</span>
                                                ) : (
                                                    <div className="flex items-center gap-3">
                                                        <button
                                                            onClick={() => openEditModal(user)}
                                                            className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors cursor-pointer"
                                                            title="Editar usuario"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteUser(user.id)}
                                                            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors cursor-pointer"
                                                            title="Dar de baja / Eliminar"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* CREATE USER MODAL */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto relative border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-800 mb-4">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Plus className="h-5 w-5 text-orange-500" />
                                Crear Nuevo Usuario
                            </h3>
                            <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                                <X className="h-5 w-5 text-slate-400" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Nombre Completo *</label>
                                <input
                                    type="text"
                                    name="nombre"
                                    required
                                    value={formData.nombre}
                                    onChange={handleInputChange}
                                    placeholder="Nombre Completo"
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Email *</label>
                                <input
                                    type="email"
                                    name="email"
                                    required
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    placeholder="correo@ejemplo.com"
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Contraseña *</label>
                                <input
                                    type="text"
                                    name="password"
                                    required
                                    value={formData.password}
                                    onChange={handleInputChange}
                                    placeholder="Contraseña"
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />
                                <span className="text-[10px] text-slate-400 font-medium">Contraseña estándar predefinida. Se le obligará al usuario a cambiarla en su primer inicio de sesión.</span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Categoría *</label>
                                    <select
                                        name="role"
                                        value={formData.role}
                                        onChange={handleInputChange}
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold"
                                    >
                                        <option value="no-cliente">No Cliente</option>
                                        <option value="cliente">Cliente</option>
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Tipo de Usuario *</label>
                                    <select
                                        name="tipoUsuario"
                                        value={formData.tipoUsuario}
                                        onChange={handleInputChange}
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold"
                                    >
                                        <option value="recaudador">Recaudador</option>
                                        <option value="administrativo">Administrativo</option>
                                        <option value="legal">Legales</option>
                                    </select>
                                </div>
                            </div>

                            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-4">
                                <p className="text-xs text-slate-400 font-bold uppercase">Configuración Fiscal (Opcional)</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">CUIT</label>
                                        <input
                                            type="text"
                                            name="cuit"
                                            value={formData.cuit}
                                            onChange={handleInputChange}
                                            placeholder="Ex: 20-12345678-9"
                                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Razón Social</label>
                                        <input
                                            type="text"
                                            name="razonSocial"
                                            value={formData.razonSocial}
                                            onChange={handleInputChange}
                                            placeholder="Ex: Empresa SRL"
                                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            {formData.role === 'cliente' && (
                                <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-4 animate-fade-in-quick">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs text-slate-400 font-bold uppercase">Plan y Control de Módulos</p>
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                            formData.plan === 'base' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' :
                                            formData.plan === 'pro' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                                            formData.plan === 'full' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' :
                                            'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20'
                                        }`}>
                                            {formData.plan === 'custom' ? 'Personalizado' : `Plan ${formData.plan}`}
                                        </span>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Seleccionar Plan</label>
                                        <select
                                            value={formData.plan}
                                            onChange={(e) => handlePlanChange(e.target.value)}
                                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold cursor-pointer"
                                        >
                                            <option value="base">Plan Base (50 comp/mes, 1 cuenta banco)</option>
                                            <option value="pro">Plan Pro (300 comp/mes, 3 cuentas banco, Conciliación)</option>
                                            <option value="full">Plan Full (1000 comp/mes, 5 cuentas, ORM CoMentor)</option>
                                            <option value="custom">Personalizado / Módulos Específicos</option>
                                        </select>
                                    </div>

                                    <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                                        {/* Facturación */}
                                        <div className="space-y-2">
                                            <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Facturación</h5>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.features.facturacionManual}
                                                        onChange={(e) => handleFeatureChange('facturacionManual', e.target.checked)}
                                                        className="rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                                                    />
                                                    <span>Facturación Manual</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.features.facturacionMasiva}
                                                        onChange={(e) => handleFeatureChange('facturacionMasiva', e.target.checked)}
                                                        className="rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                                                    />
                                                    <span>Facturación Masiva ARCA</span>
                                                </label>
                                            </div>
                                            <div className="grid grid-cols-1 gap-2 text-xs pt-1">
                                                <label className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                                                    <span>Límite de Comprobantes/Mes</span>
                                                    <input
                                                        type="number"
                                                        value={formData.features.limiteComprobantes}
                                                        onChange={(e) => handleFeatureChange('limiteComprobantes', Number(e.target.value))}
                                                        className="w-20 px-2 py-1 text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
                                                    />
                                                </label>
                                            </div>
                                        </div>

                                        {/* Cuentas y Conciliación Bancaria */}
                                        <div className="space-y-2 border-t border-slate-200/40 dark:border-slate-700/40 pt-2">
                                            <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cuentas y Conciliación</h5>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.features.moduloBanco}
                                                        onChange={(e) => handleFeatureChange('moduloBanco', e.target.checked)}
                                                        className="rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                                                    />
                                                    <span>Módulo Banco Básico</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.features.variasCuentas}
                                                        onChange={(e) => handleFeatureChange('variasCuentas', e.target.checked)}
                                                        className="rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                                                    />
                                                    <span>Varias Cuentas Bancarias</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.features.conciliacionAsistida}
                                                        onChange={(e) => handleFeatureChange('conciliacionAsistida', e.target.checked)}
                                                        className="rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                                                    />
                                                    <span>Conciliación Asistida</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.features.cruceFacturaBanco}
                                                        onChange={(e) => handleFeatureChange('cruceFacturaBanco', e.target.checked)}
                                                        className="rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                                                    />
                                                    <span>Cruce Factura/Banco</span>
                                                </label>
                                            </div>
                                            <div className="grid grid-cols-1 gap-2 text-xs pt-1">
                                                <label className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                                                    <span>Límite de Cuentas Bancarias</span>
                                                    <input
                                                        type="number"
                                                        value={formData.features.limiteCuentas}
                                                        onChange={(e) => handleFeatureChange('limiteCuentas', Number(e.target.value))}
                                                        className="w-20 px-2 py-1 text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
                                                    />
                                                </label>
                                            </div>
                                        </div>

                                        {/* Business Intelligence */}
                                        <div className="space-y-2 border-t border-slate-200/40 dark:border-slate-700/40 pt-2">
                                            <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Business Intelligence (BI)</h5>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.features.biBasico}
                                                        onChange={(e) => handleFeatureChange('biBasico', e.target.checked)}
                                                        className="rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                                                    />
                                                    <span>BI Básico</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.features.biAvanzado}
                                                        onChange={(e) => handleFeatureChange('biAvanzado', e.target.checked)}
                                                        className="rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                                                    />
                                                    <span>BI Avanzado</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.features.biPremium}
                                                        onChange={(e) => handleFeatureChange('biPremium', e.target.checked)}
                                                        className="rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                                                    />
                                                    <span>BI Premium / Ejecutivo</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.features.exportacionDatos}
                                                        onChange={(e) => handleFeatureChange('exportacionDatos', e.target.checked)}
                                                        className="rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                                                    />
                                                    <span>Exportación de Datos</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.features.reportesMensuales}
                                                        onChange={(e) => handleFeatureChange('reportesMensuales', e.target.checked)}
                                                        className="rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                                                    />
                                                    <span>Reportes Mensuales</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.features.reportesEjecutivos}
                                                        onChange={(e) => handleFeatureChange('reportesEjecutivos', e.target.checked)}
                                                        className="rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                                                    />
                                                    <span>Reportes Ejecutivos</span>
                                                </label>
                                            </div>
                                        </div>

                                        {/* Reputación Digital (CoMentor) & Alertas */}
                                        <div className="space-y-2 border-t border-slate-200/40 dark:border-slate-700/40 pt-2">
                                            <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Reputación y Alertas</h5>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.features.alertasSimples}
                                                        onChange={(e) => handleFeatureChange('alertasSimples', e.target.checked)}
                                                        className="rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                                                    />
                                                    <span>Alertas Simples</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.features.alertasInteligentes}
                                                        onChange={(e) => handleFeatureChange('alertasInteligentes', e.target.checked)}
                                                        className="rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                                                    />
                                                    <span>Alertas Inteligentes</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.features.moduloImagenWeb}
                                                        onChange={(e) => handleFeatureChange('moduloImagenWeb', e.target.checked)}
                                                        className="rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                                                    />
                                                    <span>Módulo Imagen Web (CoMentor)</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.features.analisisReputacion}
                                                        onChange={(e) => handleFeatureChange('analisisReputacion', e.target.checked)}
                                                        className="rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                                                    />
                                                    <span>Análisis de Reputación</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300 col-span-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.features.acompanamientoMensual}
                                                        onChange={(e) => handleFeatureChange('acompanamientoMensual', e.target.checked)}
                                                        className="rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                                                    />
                                                    <span>Acompañamiento Mensual</span>
                                                </label>
                                            </div>
                                        </div>

                                        {/* Soporte y Usuarios */}
                                        <div className="space-y-2 border-t border-slate-200/40 dark:border-slate-700/40 pt-2">
                                            <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Soporte y Usuarios</h5>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <label className="flex items-center justify-between text-slate-700 dark:text-slate-300 col-span-2">
                                                    <span>Usuarios Incluidos</span>
                                                    <input
                                                        type="number"
                                                        value={formData.features.usuariosIncluidos}
                                                        onChange={(e) => handleFeatureChange('usuariosIncluidos', Number(e.target.value))}
                                                        className="w-20 px-2 py-1 text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
                                                    />
                                                </label>
                                                <label className="flex items-center justify-between text-slate-700 dark:text-slate-300 col-span-2">
                                                    <span>Tipo de Soporte</span>
                                                    <select
                                                        value={formData.features.soporteTipo}
                                                        onChange={(e) => handleFeatureChange('soporteTipo', e.target.value)}
                                                        className="w-32 px-2 py-1 text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
                                                    >
                                                        <option value="estandar">Estándar</option>
                                                        <option value="prioritario">Prioritario</option>
                                                        <option value="preferencial">Preferencial</option>
                                                    </select>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-orange-600/10 flex items-center gap-1.5"
                                >
                                    {submitting ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div>
                                    ) : (
                                        <span>Guardar</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* EDIT USER MODAL */}
            {showEditModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto relative border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-800 mb-4">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Pencil className="h-5 w-5 text-orange-500" />
                                Editar Usuario
                            </h3>
                            <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                                <X className="h-5 w-5 text-slate-400" />
                            </button>
                        </div>

                        <form onSubmit={handleEditUser} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Nombre Completo *</label>
                                <input
                                    type="text"
                                    name="nombre"
                                    required
                                    value={formData.nombre}
                                    onChange={handleInputChange}
                                    placeholder="Nombre Completo"
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Email *</label>
                                <input
                                    type="email"
                                    name="email"
                                    required
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    placeholder="correo@ejemplo.com"
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Contraseña</label>
                                <input
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleInputChange}
                                    placeholder="Dejar en blanco para conservar contraseña"
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Categoría *</label>
                                    <select
                                        name="role"
                                        value={formData.role}
                                        onChange={handleInputChange}
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold"
                                    >
                                        <option value="no-cliente">No Cliente</option>
                                        <option value="cliente">Cliente</option>
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Tipo de Usuario *</label>
                                    <select
                                        name="tipoUsuario"
                                        value={formData.tipoUsuario}
                                        onChange={handleInputChange}
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold"
                                    >
                                        <option value="recaudador">Recaudador</option>
                                        <option value="administrativo">Administrativo</option>
                                        <option value="legal">Legales</option>
                                    </select>
                                </div>
                            </div>

                            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-4">
                                <p className="text-xs text-slate-400 font-bold uppercase">Configuración Fiscal (Opcional)</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">CUIT</label>
                                        <input
                                            type="text"
                                            name="cuit"
                                            value={formData.cuit}
                                            onChange={handleInputChange}
                                            placeholder="Ex: 20-12345678-9"
                                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Razón Social</label>
                                        <input
                                            type="text"
                                            name="razonSocial"
                                            value={formData.razonSocial}
                                            onChange={handleInputChange}
                                            placeholder="Ex: Empresa SRL"
                                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            {formData.role === 'cliente' && (
                                <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-4 animate-fade-in-quick">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs text-slate-400 font-bold uppercase">Plan y Control de Módulos</p>
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                            formData.plan === 'base' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' :
                                            formData.plan === 'pro' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                                            formData.plan === 'full' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' :
                                            'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20'
                                        }`}>
                                            {formData.plan === 'custom' ? 'Personalizado' : `Plan ${formData.plan}`}
                                        </span>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Seleccionar Plan</label>
                                        <select
                                            value={formData.plan}
                                            onChange={(e) => handlePlanChange(e.target.value)}
                                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold cursor-pointer"
                                        >
                                            <option value="base">Plan Base (50 comp/mes, 1 cuenta banco)</option>
                                            <option value="pro">Plan Pro (300 comp/mes, 3 cuentas banco, Conciliación)</option>
                                            <option value="full">Plan Full (1000 comp/mes, 5 cuentas, ORM CoMentor)</option>
                                            <option value="custom">Personalizado / Módulos Específicos</option>
                                        </select>
                                    </div>

                                    <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                                        {/* Facturación */}
                                        <div className="space-y-2">
                                            <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Facturación</h5>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.features.facturacionManual}
                                                        onChange={(e) => handleFeatureChange('facturacionManual', e.target.checked)}
                                                        className="rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                                                    />
                                                    <span>Facturación Manual</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.features.facturacionMasiva}
                                                        onChange={(e) => handleFeatureChange('facturacionMasiva', e.target.checked)}
                                                        className="rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                                                    />
                                                    <span>Facturación Masiva ARCA</span>
                                                </label>
                                            </div>
                                            <div className="grid grid-cols-1 gap-2 text-xs pt-1">
                                                <label className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                                                    <span>Límite de Comprobantes/Mes</span>
                                                    <input
                                                        type="number"
                                                        value={formData.features.limiteComprobantes}
                                                        onChange={(e) => handleFeatureChange('limiteComprobantes', Number(e.target.value))}
                                                        className="w-20 px-2 py-1 text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
                                                    />
                                                </label>
                                            </div>
                                        </div>

                                        {/* Cuentas y Conciliación Bancaria */}
                                        <div className="space-y-2 border-t border-slate-200/40 dark:border-slate-700/40 pt-2">
                                            <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cuentas y Conciliación</h5>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.features.moduloBanco}
                                                        onChange={(e) => handleFeatureChange('moduloBanco', e.target.checked)}
                                                        className="rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                                                    />
                                                    <span>Módulo Banco Básico</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.features.variasCuentas}
                                                        onChange={(e) => handleFeatureChange('variasCuentas', e.target.checked)}
                                                        className="rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                                                    />
                                                    <span>Varias Cuentas Bancarias</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.features.conciliacionAsistida}
                                                        onChange={(e) => handleFeatureChange('conciliacionAsistida', e.target.checked)}
                                                        className="rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                                                    />
                                                    <span>Conciliación Asistida</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.features.cruceFacturaBanco}
                                                        onChange={(e) => handleFeatureChange('cruceFacturaBanco', e.target.checked)}
                                                        className="rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                                                    />
                                                    <span>Cruce Factura/Banco</span>
                                                </label>
                                            </div>
                                            <div className="grid grid-cols-1 gap-2 text-xs pt-1">
                                                <label className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                                                    <span>Límite de Cuentas Bancarias</span>
                                                    <input
                                                        type="number"
                                                        value={formData.features.limiteCuentas}
                                                        onChange={(e) => handleFeatureChange('limiteCuentas', Number(e.target.value))}
                                                        className="w-20 px-2 py-1 text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
                                                    />
                                                </label>
                                            </div>
                                        </div>

                                        {/* Business Intelligence */}
                                        <div className="space-y-2 border-t border-slate-200/40 dark:border-slate-700/40 pt-2">
                                            <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Business Intelligence (BI)</h5>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.features.biBasico}
                                                        onChange={(e) => handleFeatureChange('biBasico', e.target.checked)}
                                                        className="rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                                                    />
                                                    <span>BI Básico</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.features.biAvanzado}
                                                        onChange={(e) => handleFeatureChange('biAvanzado', e.target.checked)}
                                                        className="rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                                                    />
                                                    <span>BI Avanzado</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.features.biPremium}
                                                        onChange={(e) => handleFeatureChange('biPremium', e.target.checked)}
                                                        className="rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                                                    />
                                                    <span>BI Premium / Ejecutivo</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.features.exportacionDatos}
                                                        onChange={(e) => handleFeatureChange('exportacionDatos', e.target.checked)}
                                                        className="rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                                                    />
                                                    <span>Exportación de Datos</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.features.reportesMensuales}
                                                        onChange={(e) => handleFeatureChange('reportesMensuales', e.target.checked)}
                                                        className="rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                                                    />
                                                    <span>Reportes Mensuales</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.features.reportesEjecutivos}
                                                        onChange={(e) => handleFeatureChange('reportesEjecutivos', e.target.checked)}
                                                        className="rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                                                    />
                                                    <span>Reportes Ejecutivos</span>
                                                </label>
                                            </div>
                                        </div>

                                        {/* Reputación Digital (CoMentor) & Alertas */}
                                        <div className="space-y-2 border-t border-slate-200/40 dark:border-slate-700/40 pt-2">
                                            <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Reputación y Alertas</h5>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.features.alertasSimples}
                                                        onChange={(e) => handleFeatureChange('alertasSimples', e.target.checked)}
                                                        className="rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                                                    />
                                                    <span>Alertas Simples</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.features.alertasInteligentes}
                                                        onChange={(e) => handleFeatureChange('alertasInteligentes', e.target.checked)}
                                                        className="rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                                                    />
                                                    <span>Alertas Inteligentes</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.features.moduloImagenWeb}
                                                        onChange={(e) => handleFeatureChange('moduloImagenWeb', e.target.checked)}
                                                        className="rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                                                    />
                                                    <span>Módulo Imagen Web (CoMentor)</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.features.analisisReputacion}
                                                        onChange={(e) => handleFeatureChange('analisisReputacion', e.target.checked)}
                                                        className="rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                                                    />
                                                    <span>Análisis de Reputación</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300 col-span-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.features.acompanamientoMensual}
                                                        onChange={(e) => handleFeatureChange('acompanamientoMensual', e.target.checked)}
                                                        className="rounded border-slate-300 dark:border-slate-700 text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                                                    />
                                                    <span>Acompañamiento Mensual</span>
                                                </label>
                                            </div>
                                        </div>

                                        {/* Soporte y Usuarios */}
                                        <div className="space-y-2 border-t border-slate-200/40 dark:border-slate-700/40 pt-2">
                                            <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Soporte y Usuarios</h5>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <label className="flex items-center justify-between text-slate-700 dark:text-slate-300 col-span-2">
                                                    <span>Usuarios Incluidos</span>
                                                    <input
                                                        type="number"
                                                        value={formData.features.usuariosIncluidos}
                                                        onChange={(e) => handleFeatureChange('usuariosIncluidos', Number(e.target.value))}
                                                        className="w-20 px-2 py-1 text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
                                                    />
                                                </label>
                                                <label className="flex items-center justify-between text-slate-700 dark:text-slate-300 col-span-2">
                                                    <span>Tipo de Soporte</span>
                                                    <select
                                                        value={formData.features.soporteTipo}
                                                        onChange={(e) => handleFeatureChange('soporteTipo', e.target.value)}
                                                        className="w-32 px-2 py-1 text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
                                                    >
                                                        <option value="estandar">Estándar</option>
                                                        <option value="prioritario">Prioritario</option>
                                                        <option value="preferencial">Preferencial</option>
                                                    </select>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setShowEditModal(false)}
                                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-orange-600/10 flex items-center gap-1.5"
                                >
                                    {submitting ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div>
                                    ) : (
                                        <span>Guardar Cambios</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
