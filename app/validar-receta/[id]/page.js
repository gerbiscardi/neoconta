"use client";
import { useEffect, useState, use } from "react";
import { ShieldCheck, ShieldAlert, HeartPulse, CheckCircle2, Clock, Calendar, User, FileText, Pill, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ValidarRecetaPage({ params }) {
    const resolvedParams = use(params);
    const id = resolvedParams.id;
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!id) return;
        fetch(`/api/vitacore/prescriptions/validate?id=${id}`)
            .then(res => res.json())
            .then(resData => {
                if (resData.success) {
                    setData(resData);
                } else {
                    setError(resData.message || "Receta no encontrada");
                }
            })
            .catch(err => {
                console.error("Error validando receta:", err);
                setError("Error de conexión al servidor de validación");
            })
            .finally(() => setLoading(false));
    }, [id]);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans">
            <div className="max-w-2xl mx-auto w-full space-y-6 my-auto py-8">
                {/* Header Logo */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-teal-500 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-teal-500/20">
                            <HeartPulse className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                                <span>NeoConta</span>
                                <span className="text-teal-400 font-extrabold text-xs px-2 py-0.5 rounded-full bg-teal-950 border border-teal-800">Vitacore Valid</span>
                            </h1>
                            <p className="text-xs text-slate-400">Portal Oficial de Validación Digital de Prescripciones</p>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center space-y-4 shadow-2xl">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500 mx-auto"></div>
                        <p className="text-sm font-medium text-slate-300">Verificando firma criptográfica e inalterabilidad de la receta...</p>
                    </div>
                ) : error ? (
                    <div className="bg-red-950/40 border border-red-800/60 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
                        <div className="h-16 w-16 bg-red-900/50 rounded-full flex items-center justify-center mx-auto text-red-400 border border-red-700/50">
                            <ShieldAlert className="h-10 w-10" />
                        </div>
                        <h2 className="text-2xl font-bold text-red-200">Prescripción No Válida</h2>
                        <p className="text-sm text-red-300 max-w-md mx-auto">{error}</p>
                        <div className="pt-4">
                            <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors">
                                <ArrowLeft className="h-4 w-4" /> Volver al sitio principal
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Validation Banner */}
                        <div className={`p-6 rounded-3xl border shadow-2xl flex flex-col sm:flex-row items-center gap-5 ${
                            data.valid 
                                ? 'bg-gradient-to-r from-emerald-950/60 via-teal-950/40 to-slate-900 border-emerald-500/40 text-emerald-100'
                                : 'bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-900 border-amber-500/40 text-amber-100'
                        }`}>
                            <div className={`h-16 w-16 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
                                data.valid ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/30' : 'bg-amber-500 text-slate-950 shadow-amber-500/30'
                            }`}>
                                {data.valid ? <ShieldCheck className="h-10 w-10" /> : <Clock className="h-10 w-10" />}
                            </div>
                            <div className="text-center sm:text-left space-y-1">
                                <div className="flex items-center justify-center sm:justify-start gap-2">
                                    <span className={`text-xs font-black uppercase px-2.5 py-0.5 rounded-full border ${
                                        data.valid 
                                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                    }`}>
                                        {data.prescription.status}
                                    </span>
                                    <span className="text-xs text-slate-400 font-mono">ID: {data.prescription.id}</span>
                                </div>
                                <h2 className="text-xl font-extrabold text-white">
                                    {data.valid ? "Receta Médica Oficial Auténtica" : "Receta Fuera de Vigencia"}
                                </h2>
                                <p className="text-xs text-slate-300">
                                    {data.valid 
                                        ? "Documento firmado digitalmente por un profesional matriculado en la plataforma Vitacore." 
                                        : "Esta prescripción ha superado el plazo de validez máximo de 30 días fijado por la Ley 27.553."}
                                </p>
                            </div>
                        </div>

                        {/* Prescription Details Card */}
                        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl backdrop-blur-xl">
                            {/* Patient & Professional Info */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6 border-b border-slate-800">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                        <User className="h-3.5 w-3.5 text-teal-400" /> Paciente
                                    </span>
                                    <p className="font-bold text-white text-base">{data.prescription.patientName}</p>
                                    <p className="text-xs text-slate-400">DNI: <span className="text-slate-200">{data.prescription.patientDni || 'N/A'}</span></p>
                                    <p className="text-xs text-slate-400">Cobertura: <span className="text-slate-200">{data.prescription.patientObraSocial}</span></p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                        <HeartPulse className="h-3.5 w-3.5 text-cyan-400" /> Profesional Emisor
                                    </span>
                                    <p className="font-bold text-white text-base">{data.prescription.professionalName}</p>
                                    <p className="text-xs text-slate-400">Especialidad: <span className="text-slate-200">{data.prescription.professionalSpecialty}</span></p>
                                    <p className="text-xs text-slate-400">Matrícula: <span className="text-teal-300 font-semibold">{data.prescription.professionalMatricula || 'Registrada'}</span></p>
                                </div>
                            </div>

                            {/* Diagnosis & Dates */}
                            <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
                                <div>
                                    <span className="text-slate-400 font-medium">Diagnóstico: </span>
                                    <span className="font-semibold text-teal-300">{data.prescription.diagnosis}</span>
                                </div>
                                <div className="flex items-center gap-4 text-slate-400">
                                    <span className="flex items-center gap-1">
                                        <Calendar className="h-3.5 w-3.5 text-slate-500" /> Emitida: {new Date(data.prescription.createdAt).toLocaleDateString()}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Clock className="h-3.5 w-3.5 text-slate-500" /> Vence: {new Date(data.prescription.expirationDate).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>

                            {/* Prescribed Medications */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <Pill className="h-4 w-4 text-teal-400" /> Medicamentos Prescritos (Rp/)
                                </h3>
                                <div className="space-y-2.5 divide-y divide-slate-800">
                                    {data.prescription.items.map((item, idx) => (
                                        <div key={idx} className="pt-2.5 first:pt-0 flex items-start justify-between gap-4">
                                            <div className="space-y-0.5">
                                                <p className="font-extrabold text-white text-sm">{item.drugName}</p>
                                                <p className="text-xs text-slate-300">Dosis / Frecuencia: <span className="text-teal-300 font-semibold">{item.dosage}</span> {item.frequency && `(${item.frequency})`}</p>
                                                {item.duration && <p className="text-xs text-slate-400">Duración: {item.duration}</p>}
                                            </div>
                                            <span className="px-2.5 py-1 bg-teal-950 border border-teal-800/80 text-teal-300 font-mono font-bold text-xs rounded-lg shrink-0">
                                                Cant: {item.totalQuantity || '1'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {data.prescription.observations && (
                                <div className="text-xs bg-slate-950/40 p-3 rounded-xl border border-slate-800 text-slate-300">
                                    <span className="font-bold text-slate-400">Indicaciones Generales: </span>
                                    {data.prescription.observations}
                                </div>
                            )}

                            {/* Cryptographic Hash Verification Box */}
                            <div className="pt-4 border-t border-slate-800 text-[11px] space-y-1">
                                <div className="flex items-center justify-between text-slate-400">
                                    <span>Firma Criptográfica SHA-256 (Inalterable):</span>
                                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                                        <CheckCircle2 className="h-3.5 w-3.5" /> Verificado
                                    </span>
                                </div>
                                <p className="font-mono text-[10px] text-slate-400 bg-slate-950 p-2 rounded-lg border border-slate-800/80 break-all">
                                    {data.prescription.verificationHash}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="text-center text-xs text-slate-500 pt-4">
                    NeoConta Vitacore &copy; {new Date().getFullYear()} — Plataforma de Gestión Clínica conforme Ley 27.553.
                </div>
            </div>
        </div>
    );
}
