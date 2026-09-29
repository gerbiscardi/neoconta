"use client";
import { useState } from "react";
import { Building, ShieldCheck, CheckCircle2, ChevronRight, ChevronLeft, Sparkles, HeartPulse, FileText, Wallet, BarChart3, X } from "lucide-react";

export default function OnboardingWizard({ currentUser, onComplete }) {
    const [step, setStep] = useState(1);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        razonSocial: "",
        cuit: "",
        condicionIva: "Monotributo",
        direccion: "",
        features: {
            facturacionManual: true,
            facturacionMasiva: true,
            moduloVitacore: true,
            moduloBanco: true,
            biBasico: true
        },
        medicalDetails: {
            specialty: "Medicina General",
            matricula: "",
            clinicName: "Consultorio Dr. Perez"
        }
    });

    const handleFeatureToggle = (featureKey) => {
        setFormData(prev => ({
            ...prev,
            features: {
                ...prev.features,
                [featureKey]: !prev.features[featureKey]
            }
        }));
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const res = await fetch('/api/user/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: currentUser?.id,
                    razonSocial: formData.razonSocial || "Empresa / Profesional",
                    cuit: formData.cuit,
                    condicionIva: formData.condicionIva,
                    direccion: formData.direccion,
                    features: formData.features,
                    medicalDetails: formData.medicalDetails
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                if (onComplete) onComplete(data);
            }
        } catch (err) {
            console.error("Error saving onboarding config:", err);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in font-sans">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
                
                {/* Header Badge */}
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-gradient-to-tr from-orange-500 to-amber-500 text-white rounded-xl shadow-md">
                            <Sparkles className="h-5 w-5" />
                        </div>
                        <div>
                            <span className="text-[10px] font-extrabold text-orange-500 uppercase tracking-widest">Configuración Inicial</span>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white">¡Bienvenido a NeoConta!</h3>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-400">
                        <span className={step >= 1 ? "text-orange-500" : ""}>1</span>
                        <span>•</span>
                        <span className={step >= 2 ? "text-orange-500" : ""}>2</span>
                        <span>•</span>
                        <span className={step >= 3 ? "text-orange-500" : ""}>3</span>
                    </div>
                </div>

                {/* STEP 1: Datos Fiscales */}
                {step === 1 && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="space-y-1">
                            <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Building className="h-4 w-4 text-orange-500" />
                                <span>Paso 1: Datos de tu Negocio o Consultorio</span>
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Ingresá la información principal para personalizar comprobantes y facturas.</p>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Razón Social / Nombre Comercial</label>
                                <input
                                    type="text"
                                    value={formData.razonSocial}
                                    onChange={(e) => setFormData(prev => ({ ...prev, razonSocial: e.target.value }))}
                                    placeholder="Ej: Dr. Pérez / Estudio Contable / Mi Negocio"
                                    className="w-full p-3 mt-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">CUIT / CUIL</label>
                                    <input
                                        type="text"
                                        value={formData.cuit}
                                        onChange={(e) => setFormData(prev => ({ ...prev, cuit: e.target.value }))}
                                        placeholder="Ej: 20-34567890-9"
                                        className="w-full p-3 mt-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Condición IVA</label>
                                    <select
                                        value={formData.condicionIva}
                                        onChange={(e) => setFormData(prev => ({ ...prev, condicionIva: e.target.value }))}
                                        className="w-full p-3 mt-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500"
                                    >
                                        <option value="Monotributo">Monotributo</option>
                                        <option value="Responsable Inscripto">Responsable Inscripto</option>
                                        <option value="Exento">Exento</option>
                                        <option value="Consumidor Final">Consumidor Final</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 2: Módulos Activos */}
                {step === 2 && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="space-y-1">
                            <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4 text-orange-500" />
                                <span>Paso 2: Módulos y Herramientas Activas</span>
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Seleccioná los servicios que querés tener disponibles en tu barra lateral.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {[
                                { key: 'facturacionManual', label: 'Facturación ARCA (ex AFIP)', desc: 'Emisión de Facturas C/B/A', icon: <FileText className="h-4 w-4 text-orange-500" /> },
                                { key: 'moduloVitacore', label: 'Vitacore Salud Digital', desc: 'Fichero médico y turnos', icon: <HeartPulse className="h-4 w-4 text-teal-500" /> },
                                { key: 'moduloBanco', label: 'Conciliación Bancaria', desc: 'Ingresos y gastos', icon: <Wallet className="h-4 w-4 text-blue-500" /> },
                                { key: 'biBasico', label: 'Commander BI & IA', desc: 'Pronóstico de Cashflow', icon: <BarChart3 className="h-4 w-4 text-purple-500" /> },
                            ].map((mod) => (
                                <div
                                    key={mod.key}
                                    onClick={() => handleFeatureToggle(mod.key)}
                                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                                        formData.features[mod.key]
                                            ? 'bg-orange-500/10 border-orange-500/30 text-slate-900 dark:text-white'
                                            : 'bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-800 text-slate-400'
                                    }`}
                                >
                                    <div className="p-2 bg-white dark:bg-zinc-800 rounded-xl shadow-sm">
                                        {mod.icon}
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold">{mod.label}</div>
                                        <div className="text-[10px] text-slate-500 dark:text-slate-400">{mod.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* STEP 3: Configuración Médica / Final */}
                {step === 3 && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="space-y-1">
                            <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <HeartPulse className="h-4 w-4 text-teal-500" />
                                <span>Paso 3: Personalización de Salud (Vitacore)</span>
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Si administrás pacientes, configurá los datos de firma e identificación del consultorio.</p>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Nombre del Consultorio / Clínica</label>
                                <input
                                    type="text"
                                    value={formData.medicalDetails.clinicName}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        medicalDetails: { ...prev.medicalDetails, clinicName: e.target.value }
                                    }))}
                                    placeholder="Ej: Consultorio Dr. Pérez"
                                    className="w-full p-3 mt-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Especialidad Principal</label>
                                    <input
                                        type="text"
                                        value={formData.medicalDetails.specialty}
                                        onChange={(e) => setFormData(prev => ({
                                            ...prev,
                                            medicalDetails: { ...prev.medicalDetails, specialty: e.target.value }
                                        }))}
                                        placeholder="Ej: Medicina General / Pediatría"
                                        className="w-full p-3 mt-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Matrícula (MN / MP)</label>
                                    <input
                                        type="text"
                                        value={formData.medicalDetails.matricula}
                                        onChange={(e) => setFormData(prev => ({
                                            ...prev,
                                            medicalDetails: { ...prev.medicalDetails, matricula: e.target.value }
                                        }))}
                                        placeholder="Ej: MN 123456"
                                        className="w-full p-3 mt-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-zinc-800">
                    {step > 1 ? (
                        <button
                            onClick={() => setStep(step - 1)}
                            className="flex items-center gap-1 px-4 py-2.5 border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-all cursor-pointer"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            <span>Anterior</span>
                        </button>
                    ) : (
                        <div></div>
                    )}

                    {step < 3 ? (
                        <button
                            onClick={() => setStep(step + 1)}
                            className="flex items-center gap-1.5 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer"
                        >
                            <span>Siguiente</span>
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-bold rounded-xl text-xs shadow-lg transition-all cursor-pointer disabled:opacity-50"
                        >
                            {submitting ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div>
                            ) : (
                                <>
                                    <CheckCircle2 className="h-4 w-4" />
                                    <span>Completar Configuración</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
