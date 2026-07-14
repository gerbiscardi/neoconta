"use client";
import { useState, useEffect } from "react";
import { 
    Save, 
    Upload, 
    User, 
    Building, 
    FileKey, 
    CheckCircle, 
    ArrowRight, 
    Download, 
    RefreshCw,
    HelpCircle,
    X,
    ChevronLeft,
    ChevronRight,
    ArrowUpRight,
    ShieldCheck
} from "lucide-react";

export default function ConfigurationPage() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [saved, setSaved] = useState(false);

    // Instructions Modal States
    const [showInstructions, setShowInstructions] = useState(false);
    const [activeStep, setActiveStep] = useState(1);

    const [formData, setFormData] = useState({
        razonSocial: "",
        cuit: "",
        production: false,
        logo: "",
        certFile: null,
    });
    const [hasCert, setHasCert] = useState(false);

    useEffect(() => {
        const storedUser = localStorage.getItem('neoconta_user');
        if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
            
            // Load configuration from server
            fetch(`/api/user/config?userId=${parsedUser.id}`)
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        setFormData(prev => ({
                            ...prev,
                            razonSocial: data.razonSocial || "",
                            cuit: data.cuit || "",
                            production: data.production === true,
                            logo: data.logo || ""
                        }));
                        setHasCert(data.hasCert);
                    }
                })
                .catch(err => console.error("Error loading config:", err));
        }
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        const { name, files } = e.target;
        setFormData(prev => ({ ...prev, [name]: files[0] }));
    };

    const handleLogoChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 1024 * 1024) {
            alert("El logo no debe superar 1 MB de tamaño.");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setFormData(prev => ({ ...prev, logo: reader.result }));
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveLogo = () => {
        setFormData(prev => ({ ...prev, logo: "" }));
    };

    const handleGenerateCSR = async () => {
        if (!formData.razonSocial || !formData.cuit) {
            alert("Por favor completa Razón Social y CUIT primero.");
            return;
        }
        setGenerating(true);
        try {
            const res = await fetch('/api/user/csr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    cuit: formData.cuit,
                    companyName: formData.razonSocial
                })
            });
            const data = await res.json();

            if (res.ok) {
                // Download CSR
                const blob = new Blob([data.csr], { type: 'application/x-pem-file' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = "pedido.csr";
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);

                alert("¡Éxito! Se descargó 'pedido.csr' y la Clave Privada se guardó en el servidor.");
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (e) {
            console.error(e);
            alert("Error de conexión al generar CSR.");
        } finally {
            setGenerating(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!user) return;

        if (!formData.razonSocial || !formData.cuit) {
            alert("Por favor completa los campos de Razón Social y CUIT antes de guardar.");
            return;
        }

        setLoading(true);
        setSaved(false);

        try {
            const data = new FormData();
            data.append('userId', user.id);
            data.append('razonSocial', formData.razonSocial);
            data.append('cuit', formData.cuit);
            data.append('production', formData.production ? 'true' : 'false');
            data.append('logo', formData.logo || '');
            if (formData.certFile) data.append('cert', formData.certFile);

            const res = await fetch('/api/user/config', {
                method: 'POST',
                body: data
            });

            if (res.ok) {
                setSaved(true);
                if (formData.certFile) setHasCert(true);
                setTimeout(() => setSaved(false), 3000);
            } else {
                alert("Error al guardar la configuración");
            }
        } catch (error) {
            console.error(error);
            alert("Error de conexión");
        } finally {
            setLoading(false);
        }
    };

    const steps = [
        {
            title: "Generar el archivo .CSR en NeoConta",
            desc: "Primero debes generar la solicitud de certificado cifrada desde nuestra plataforma.",
            content: (
                <div className="space-y-3">
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        Completa tus datos fiscales en la pantalla de configuración (<b>Razón Social</b> y <b>CUIT</b>) y luego haz clic en el botón <b>"Generar y Descargar .CSR"</b> en el Paso A.
                    </p>
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800 text-xs text-slate-500 space-y-2">
                        <p className="font-semibold text-slate-700 dark:text-slate-300">¿Qué sucede en este paso?</p>
                        <ul className="list-disc pl-4 space-y-1">
                            <li>Se genera y descarga a tu computadora un archivo llamado <code className="px-1 py-0.5 bg-orange-100 dark:bg-orange-950 text-orange-700 rounded font-mono">pedido.csr</code>.</li>
                            <li>La clave privada (clave criptográfica asociada) se almacena automáticamente de forma encriptada en los servidores seguros de NeoConta para poder firmar tus facturas en el futuro.</li>
                        </ul>
                    </div>
                </div>
            )
        },
        {
            title: "Ingresar a AFIP con Clave Fiscal",
            desc: "Accede al portal oficial de AFIP con tu CUIT y contraseña contable.",
            content: (
                <div className="space-y-3">
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        Entra a la página web de <b>AFIP</b> con tu clave fiscal (debes poseer Nivel de Seguridad 3 o superior).
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        Busca y abre el servicio llamado <b>"Administración de Certificados Digitales"</b>.
                    </p>
                    <div className="bg-orange-500/5 border border-orange-500/20 p-4 rounded-2xl text-xs text-orange-600 dark:text-orange-400">
                        <strong>Tip contable:</strong> Si no tienes el servicio habilitado, ve primero al "Administrador de Relaciones de Clave Fiscal", haz clic en "Adherir Servicio", busca "AFIP", luego "Servicios Interactivos" y activa "Administración de Certificados Digitales".
                    </div>
                </div>
            )
        },
        {
            title: "Subir el .CSR y descargar el Certificado .CRT",
            desc: "Sube la solicitud generada y AFIP te emitirá tu certificado oficial.",
            content: (
                <div className="space-y-3">
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        Dentro del servicio de certificados de AFIP:
                    </p>
                    <ol className="list-decimal pl-5 text-sm text-slate-600 dark:text-slate-300 space-y-2">
                        <li>Agrega un nuevo alias para identificar a la plataforma (por ejemplo, escribe: <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">NeoConta</code>).</li>
                        <li>Haz clic en "Seleccionar Archivo" y sube el archivo <code className="font-mono">pedido.csr</code> que descargaste de NeoConta en el Paso 1.</li>
                        <li>Presiona <b>"Generar Certificado"</b>.</li>
                        <li>AFIP procesará la solicitud y te mostrará el alias con un botón de **Descargar**. Haz clic y guarda el archivo <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">.crt</code> en tu computadora.</li>
                    </ol>
                </div>
            )
        },
        {
            title: "Asociar el Web Service de Facturación",
            desc: "Delega permisos en AFIP para autorizar a NeoConta a facturar en tu nombre.",
            content: (
                <div className="space-y-3">
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        Para que NeoConta pueda facturar masivamente, AFIP requiere que vincules el certificado al servicio de facturación:
                    </p>
                    <ol className="list-decimal pl-5 text-sm text-slate-600 dark:text-slate-300 space-y-2">
                        <li>Ve a <b>"Administrador de Relaciones de Clave Fiscal"</b> en AFIP.</li>
                        <li>Haz clic en <b>"Nueva Relación"</b> <span className="text-slate-400 dark:text-slate-500 mx-1">→</span> <b>"Buscar"</b> <span className="text-slate-400 dark:text-slate-500 mx-1">→</span> <b>"AFIP"</b> <span className="text-slate-400 dark:text-slate-500 mx-1">→</span> <b>"Webservices"</b>.</li>
                        <li>Busca en el listado el servicio de <b>"Facturación Electrónica"</b> (también llamado <code className="font-mono">wsfe</code>).</li>
                        <li>En el campo "Representante", selecciona el alias de computador que creaste en el paso anterior (<code className="font-mono">NeoConta</code>).</li>
                        <li>Presiona <b>"Confirmar"</b> para dar de alta la relación fiscal.</li>
                    </ol>
                </div>
            )
        },
        {
            title: "Subir el Certificado .CRT en NeoConta",
            desc: "Carga el certificado emitido en nuestro portal para finalizar.",
            content: (
                <div className="space-y-3">
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        Regresa a la pestaña de Configuración de NeoConta:
                    </p>
                    <ol className="list-decimal pl-5 text-sm text-slate-600 dark:text-slate-300 space-y-2">
                        <li>En el <b>Paso B ("Subir Certificado")</b>, haz clic en el cuadro de selección de archivos y sube el certificado <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">.crt</code> que te dio AFIP.</li>
                        <li>Haz clic en el botón naranja inferior <b>"Guardar Todo"</b>.</li>
                    </ol>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl text-xs text-emerald-600 dark:text-emerald-400 flex items-start gap-2">
                        <ShieldCheck className="h-5 w-5 shrink-0" />
                        <span>
                            <strong>¡Felicidades!</strong> Una vez guardado, tu cuenta estará plenamente habilitada en ARCA/AFIP y el facturador masivo podrá emitir tus facturas electrónicas de forma instantánea.
                        </span>
                    </div>
                </div>
            )
        }
    ];

    if (!user) return <div className="p-8">Cargando usuario...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up pb-10">
            {/* Header Title */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <User className="h-8 w-8 text-orange-600" />
                        Configuración de Facturación
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Configura tus datos fiscales y certificados digitales.</p>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-8 space-y-8">

                    {/* Business Info */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <Building className="h-5 w-5 text-slate-500" />
                            1. Datos de la Empresa
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Razón Social</label>
                                <input
                                    type="text"
                                    name="razonSocial"
                                    value={formData.razonSocial}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none transition-all text-slate-900 dark:text-white"
                                    placeholder="Ej. Mi Empresa S.A."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">CUIT</label>
                                <input
                                    type="text"
                                    name="cuit"
                                    value={formData.cuit}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none transition-all text-slate-900 dark:text-white"
                                    placeholder="20-12345678-9"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Entorno de Facturación</label>
                                <select
                                    name="production"
                                    value={formData.production ? "true" : "false"}
                                    onChange={(e) => setFormData(prev => ({ ...prev, production: e.target.value === "true" }))}
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none transition-all text-slate-900 dark:text-white font-semibold"
                                >
                                    <option value="false">Homologación (Pruebas)</option>
                                    <option value="true">Producción (Real)</option>
                                </select>
                            </div>
                        </div>

                        {/* Logo Upload Section */}
                        <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-6">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Logo de la Empresa (Opcional)</label>
                            <div className="flex flex-col sm:flex-row items-center gap-6 bg-slate-50/50 dark:bg-slate-800/20 p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                                {formData.logo ? (
                                    <div className="relative h-20 w-44 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center p-2 overflow-hidden shadow-sm">
                                        <img src={formData.logo} alt="Preview Logo" className="max-h-full max-w-full object-contain" />
                                        <button
                                            type="button"
                                            onClick={handleRemoveLogo}
                                            className="absolute top-1 right-1 p-1 bg-red-100 text-red-655 rounded-full hover:bg-red-200 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/80 transition-colors cursor-pointer"
                                            title="Quitar Logo"
                                        >
                                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="h-20 w-44 bg-slate-100 dark:bg-slate-800/80 rounded-lg flex flex-col items-center justify-center border border-slate-200 dark:border-slate-700 border-dashed text-slate-400 dark:text-slate-500">
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Sin Logo</span>
                                    </div>
                                )}
                                <div className="flex-1 space-y-2">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                                        Subir una imagen en formato PNG o JPG. Se recomienda un logo horizontal o cuadrado de fondo blanco o transparente. Tamaño máximo: 1 MB.
                                    </p>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="file"
                                            id="logoInput"
                                            accept="image/png, image/jpeg"
                                            onChange={handleLogoChange}
                                            className="hidden"
                                        />
                                        <label
                                            htmlFor="logoInput"
                                            className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-350 rounded-lg cursor-pointer transition-colors inline-block"
                                        >
                                            Seleccionar Logo
                                        </label>
                                        {formData.logo && (
                                            <button
                                                type="button"
                                                onClick={handleRemoveLogo}
                                                className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-900/30 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                                            >
                                                Quitar Logo
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <hr className="border-slate-100 dark:border-slate-800" />

                    {/* Wizard Area */}
                    <div className="space-y-6">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <FileKey className="h-5 w-5 text-slate-500" />
                            2. Gestión de Certificados (AFIP)
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Step A: Generate */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl space-y-4 border border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">A</div>
                                    <h3 className="font-medium text-slate-900 dark:text-white">Generar Solicitud</h3>
                                </div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Genera el archivo <b>.csr</b> para subir a AFIP. Nosotros guardamos la clave privada de forma segura por ti.
                                </p>
                                <button
                                    onClick={handleGenerateCSR}
                                    disabled={generating}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-350 hover:bg-slate-55 dark:border-slate-650 dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-all shadow-sm font-medium cursor-pointer"
                                >
                                    {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                    {generating ? "Generando..." : "Generar y Descargar .CSR"}
                                </button>
                            </div>

                            {/* Step B: Upload */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl space-y-4 border border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">B</div>
                                    <h3 className="font-medium text-slate-900 dark:text-white">Subir Certificado</h3>
                                </div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Sube el archivo <b>.crt</b> que descargaste de AFIP luego de presentar la solicitud.
                                </p>
                                <label className="cursor-pointer block">
                                    <input type="file" name="certFile" accept=".crt" onChange={handleFileChange} className="hidden" />
                                    <div className="w-full py-2.5 px-4 bg-white dark:bg-slate-800 border border-slate-350 hover:border-orange-500 dark:border-slate-650 border-dashed rounded-lg text-sm text-slate-600 dark:text-slate-400 text-center transition-all hover:bg-slate-50/50 font-medium">
                                        {formData.certFile ? formData.certFile.name : "Seleccionar .CRT"}
                                    </div>
                                </label>
                                {hasCert && (
                                    <p className="text-xs text-emerald-605 dark:text-emerald-400 font-semibold flex items-center gap-1.5 justify-center mt-2">
                                        <ShieldCheck className="h-4 w-4 shrink-0" /> Certificado emitido y activo en servidor.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-4 flex items-center justify-end gap-4 border-t border-slate-100 dark:border-slate-800">
                        {saved && (
                            <span className="text-green-600 dark:text-green-400 flex items-center gap-2 text-sm font-medium animate-fade-in">
                                <CheckCircle className="h-4 w-4" /> Guardado correctamente
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                setActiveStep(1);
                                setShowInstructions(true);
                            }}
                            className="flex items-center gap-2 px-5 py-2.5 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-850 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-all font-medium rounded-lg shadow-sm cursor-pointer"
                        >
                            <span className="text-sm">💡</span>
                            Instructivo Paso a Paso
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="flex items-center gap-2 px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg transition-all shadow-lg shadow-orange-500/20 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {loading ? "Guardando..." : <><Save className="h-4 w-4" /> Guardar Todo</>}
                        </button>
                    </div>
                </div>
            </div>

            {/* ==========================================
                STEP-BY-STEP POPUP INSTRUCTIONS MODAL
               ========================================== */}
            {showInstructions && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-fade-in-up">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                            <div className="flex items-center gap-3">
                                <HelpCircle className="h-6 w-6 text-orange-600 shrink-0" />
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Instructivo de Certificados AFIP</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Paso a paso para habilitar facturación en NeoConta.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowInstructions(false)}
                                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Modal Timeline Steps Indicator */}
                        <div className="px-6 py-4 bg-slate-100/40 dark:bg-slate-800/10 border-b border-slate-200/50 dark:border-slate-850 flex items-center justify-between gap-2 overflow-x-auto">
                            {steps.map((s, idx) => {
                                const stepNum = idx + 1;
                                const isCurrent = stepNum === activeStep;
                                const isCompleted = stepNum < activeStep;
                                return (
                                    <div key={idx} className="flex items-center gap-2">
                                        <button
                                            onClick={() => setActiveStep(stepNum)}
                                            className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs transition-all cursor-pointer ${
                                                isCurrent 
                                                    ? 'bg-orange-600 text-white ring-4 ring-orange-500/20' 
                                                    : isCompleted 
                                                        ? 'bg-emerald-600 text-white' 
                                                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-300'
                                            }`}
                                        >
                                            {stepNum}
                                        </button>
                                        {stepNum < steps.length && (
                                            <div className={`h-0.5 w-8 rounded transition-all ${
                                                isCompleted ? 'bg-emerald-600' : 'bg-slate-200 dark:bg-slate-850'
                                            }`} />
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Modal Body - Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-8 space-y-6">
                            <div className="space-y-2">
                                <span className="text-[10px] font-bold tracking-wider uppercase text-orange-600 dark:text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">
                                    Paso {activeStep} de {steps.length}
                                </span>
                                <h4 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
                                    {steps[activeStep - 1].title}
                                </h4>
                                <p className="text-sm text-slate-400">
                                    {steps[activeStep - 1].desc}
                                </p>
                            </div>

                            <hr className="border-slate-100 dark:border-slate-850" />

                            <div className="animate-fade-in-quick">
                                {steps[activeStep - 1].content}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/30">
                            <button
                                onClick={() => setActiveStep(prev => Math.max(1, prev - 1))}
                                disabled={activeStep === 1}
                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl transition-all border border-slate-350 hover:bg-slate-100 dark:border-slate-750 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Anterior
                            </button>

                            {activeStep < steps.length ? (
                                <button
                                    onClick={() => setActiveStep(prev => Math.min(steps.length, prev + 1))}
                                    className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold rounded-xl bg-orange-600 hover:bg-orange-700 text-white transition-all shadow-md shadow-orange-500/15 cursor-pointer"
                                >
                                    Siguiente
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            ) : (
                                <button
                                    onClick={() => setShowInstructions(false)}
                                    className="flex items-center gap-1.5 px-6 py-2.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-md shadow-emerald-500/15 cursor-pointer"
                                >
                                    ¡Comprendido! Habilitar
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
