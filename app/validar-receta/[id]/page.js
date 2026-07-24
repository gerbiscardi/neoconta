"use client";
import { useState, useEffect, use } from "react";
import { ShieldCheck, ShieldAlert, HeartPulse, CheckCircle2, Clock, User, Award, FileText, Lock } from "lucide-react";

export default function ValidarRecetaPage({ params }) {
    const resolvedParams = use(params);
    const recipeId = resolvedParams?.id;

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!recipeId) return;
        fetch(`/api/vitacore/prescriptions/validate?id=${encodeURIComponent(recipeId)}`)
            .then(res => res.json())
            .then(resData => {
                if (resData.success) {
                    setData(resData);
                } else {
                    setError(resData.message || "Receta no encontrada o inválida.");
                }
                setLoading(false);
            })
            .catch(err => {
                console.error("Error validating prescription:", err);
                setError("Error de conexión al verificar la receta.");
                setLoading(false);
            });
    }, [recipeId]);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
            <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-teal-600 to-cyan-700 p-6 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-white/10 backdrop-blur-md rounded-2xl">
                            <HeartPulse className="h-7 w-7 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-extrabold tracking-tight">NeoConta Vitacore</h1>
                            <p className="text-xs text-teal-100 font-medium">Sistema de Validación Legal de Receta Digital (Ley 27.553)</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {loading ? (
                        <div className="py-12 flex flex-col items-center justify-center gap-3">
                            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-teal-400"></div>
                            <p className="text-sm text-slate-400 font-medium">Verificando firma criptográfica e historial...</p>
                        </div>
                    ) : error ? (
                        <div className="py-8 text-center space-y-4">
                            <div className="inline-flex p-4 bg-red-950/40 border border-red-800/60 rounded-full text-red-400">
                                <ShieldAlert className="h-12 w-12" />
                            </div>
                            <h2 className="text-lg font-bold text-white">Receta No Encontrada o Inválida</h2>
                            <p className="text-sm text-slate-400 max-w-md mx-auto">{error}</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Validation Status Banner */}
                            <div className={`p-4 rounded-2xl border flex items-center gap-3.5 ${
                                data.isValid 
                                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300' 
                                    : 'bg-red-950/30 border-red-500/40 text-red-300'
                            }`}>
                                {data.isValid ? (
                                    <ShieldCheck className="h-8 w-8 text-emerald-400 shrink-0" />
                                ) : (
                                    <ShieldAlert className="h-8 w-8 text-red-400 shrink-0" />
                                )}
                                <div>
                                    <h3 className="font-extrabold text-sm uppercase tracking-wide">
                                        {data.isValid ? "DOCUMENTO OFICIAL VÁLIDO Y AUTÉNTICO" : "RECETA ANULADA O NO VIGENTE"}
                                    </h3>
                                    <p className="text-xs opacity-90">
                                        {data.isValid 
                                            ? "Emitida por profesional de la salud matriculado y verificado en plataforma NeoConta." 
                                            : "Esta prescripción ha sido anulada o ha expirado."}
                                    </p>
                                </div>
                            </div>

                            {/* Prescription Details Grid */}
                            <div className="space-y-4 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 text-xs">
                                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                                    <span className="text-slate-400 font-bold uppercase">ID de Receta:</span>
                                    <span className="font-mono font-bold text-teal-400">{data.prescription.id}</span>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-1">
                                    <div>
                                        <p className="text-slate-400 font-bold uppercase flex items-center gap-1">
                                            <Award className="h-3.5 w-3.5 text-teal-400" /> Médico Emisor
                                        </p>
                                        <p className="font-bold text-slate-100 text-sm mt-0.5">{data.prescription.professionalName}</p>
                                        <p className="text-slate-400">{data.prescription.professionalSpecialty || 'Médico'}</p>
                                        <p className="text-teal-400 font-semibold">M.N./M.P. N° {data.prescription.professionalMatricula || 'S/D'}</p>
                                    </div>

                                    <div>
                                        <p className="text-slate-400 font-bold uppercase flex items-center gap-1">
                                            <User className="h-3.5 w-3.5 text-teal-400" /> Paciente
                                        </p>
                                        <p className="font-bold text-slate-100 text-sm mt-0.5">{data.prescription.patientName}</p>
                                        <p className="text-slate-400">DNI: {data.prescription.patientDni || 'S/D'}</p>
                                    </div>
                                </div>

                                <div className="border-t border-slate-800 pt-3">
                                    <p className="text-slate-400 font-bold uppercase flex items-center gap-1 mb-2">
                                        <FileText className="h-3.5 w-3.5 text-teal-400" /> Medicamentos Prescritos (Rp/)
                                    </p>
                                    <div className="space-y-2">
                                        {data.prescription.medications.map((med, idx) => (
                                            <div key={idx} className="p-2.5 bg-slate-900 rounded-xl border border-slate-800/80">
                                                <p className="font-bold text-slate-100 text-xs">{idx + 1}. {med.name}</p>
                                                <p className="text-slate-400 text-[11px]">Dosis: {med.dosage || 'S/I'} | Cantidad: {med.quantity || '1'}</p>
                                                {med.instructions && <p className="text-teal-300/80 text-[11px] italic mt-0.5">{med.instructions}</p>}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {data.prescription.diagnosis && (
                                    <div className="border-t border-slate-800 pt-3">
                                        <p className="text-slate-400 font-bold uppercase">Diagnóstico (CIE-11 OMS):</p>
                                        <p className="font-semibold text-slate-200">{data.prescription.diagnosis}</p>
                                    </div>
                                )}

                                <div className="border-t border-slate-800 pt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                                    <div>
                                        <span className="block font-bold uppercase">Fecha de Emisión:</span>
                                        <span>{new Date(data.prescription.issuedAt).toLocaleDateString('es-AR')} {new Date(data.prescription.issuedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div>
                                        <span className="block font-bold uppercase">Vencimiento:</span>
                                        <span>{new Date(data.prescription.expiresAt).toLocaleDateString('es-AR')}</span>
                                    </div>
                                </div>

                                <div className="border-t border-slate-800 pt-3 space-y-1 text-[10px] text-slate-500 font-mono break-all">
                                    <div className="flex items-center gap-1 text-slate-400 font-bold">
                                        <Lock className="h-3 w-3 text-teal-400" /> Firma Criptográfica SHA-256:
                                    </div>
                                    <p className="bg-slate-900 p-2 rounded-lg border border-slate-800 text-teal-400/90">{data.prescription.hash}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-slate-950 p-4 border-t border-slate-800 text-center text-xs text-slate-500">
                    NeoConta Vitacore &copy; {new Date().getFullYear()} - Plataforma Certificada de Gestión Sanitaria y Recetas Digitales.
                </div>
            </div>
        </div>
    );
}
