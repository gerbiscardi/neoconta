"use client";
import { useState, useEffect } from "react";
import { MessageCircle, Send, Copy, Check, FileText, Pill, FlaskConical, Calendar, Building2, X } from "lucide-react";

export default function WhatsAppModal({ 
    isOpen, 
    onClose, 
    patientName = "", 
    patientPhone = "",
    appointmentData = null,
    prescriptionData = null,
    orderData = null,
    currentUser = null
}) {
    const [templateType, setTemplateType] = useState(
        appointmentData ? "turno" : prescriptionData ? "receta" : orderData ? "orden" : "personalizado"
    );

    // Initial Consultorio / Clinic Name
    const defaultClinic = currentUser?.companyName || 
        (appointmentData?.professionalName ? `Consultorio ${appointmentData.professionalName}` : 
        prescriptionData?.professionalName ? `Consultorio ${prescriptionData.professionalName}` : 
        orderData?.professionalName ? `Consultorio ${orderData.professionalName}` : "Consultorio Médico");

    const [clinicName, setClinicName] = useState(defaultClinic);
    const [customText, setCustomText] = useState("");
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (currentUser?.companyName) {
            setClinicName(currentUser.companyName);
        } else if (appointmentData?.professionalName) {
            setClinicName(`Consultorio ${appointmentData.professionalName}`);
        } else if (prescriptionData?.professionalName) {
            setClinicName(`Consultorio ${prescriptionData.professionalName}`);
        } else if (orderData?.professionalName) {
            setClinicName(`Consultorio ${orderData.professionalName}`);
        }
    }, [currentUser, appointmentData, prescriptionData, orderData]);

    if (!isOpen) return null;

    const cleanPhone = (patientPhone || "").replace(/[^0-9]/g, "");
    const formattedPhone = cleanPhone.length === 10 ? `549${cleanPhone}` : cleanPhone;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://neoconta.com.ar';

    const getMessageContent = () => {
        const placeName = clinicName.trim() || "nuestro Consultorio";

        if (templateType === "turno" && appointmentData) {
            const confirmUrl = `${origin}/confirmar-turno/${appointmentData.id}`;
            return `Hola *${patientName || appointmentData.patientName}*, te recordamos tu turno médico para el día *${appointmentData.date.split('-').reverse().join('/')}* a las *${appointmentData.time} hs* con el/la *${appointmentData.professionalName}* (${appointmentData.professionalSpecialty || 'Médico'}).\n\nConfirmá o gestioná tu asistencia con 1 clic aquí:\n${confirmUrl}\n\n¡Te esperamos en ${placeName}!`;
        }

        if (templateType === "receta" && prescriptionData) {
            const validateUrl = `${origin}/validar-receta/${prescriptionData.id}`;
            return `Hola *${patientName}*, te enviamos tu Receta Digital emitida por el/la *${prescriptionData.professionalName}*.\n\nPodés presentar el código QR en la farmacia o descargar el PDF oficial desde:\n${validateUrl}\n\n${placeName}`;
        }

        if (templateType === "orden" && orderData) {
            const validateUrl = `${origin}/validar-receta/${orderData.id}`;
            return `Hola *${patientName}*, te adjuntamos la Solicitud de Estudios y Laboratorio (${orderData.category}) emitida por *${orderData.professionalName}*.\n\nPodés visualizar las prácticas requeridas con códigos LOINC y validez QR aquí:\n${validateUrl}\n\n${placeName}`;
        }

        return customText || `Hola ${patientName}, nos comunicamos desde ${placeName} para informarte sobre tu atención.`;
    };

    const finalMessage = getMessageContent();
    const whatsappUrl = formattedPhone ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(finalMessage)}` : `https://wa.me/?text=${encodeURIComponent(finalMessage)}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(finalMessage);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans text-slate-900 dark:text-slate-100">
            <div onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="bg-white dark:bg-zinc-950 border border-emerald-500/30 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative z-10 space-y-5 overflow-hidden max-h-[92vh] overflow-y-auto">
                
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-tr from-emerald-600 to-teal-600 text-white rounded-2xl shadow-md">
                            <MessageCircle className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black tracking-tight">Notificación WhatsApp Institucional</h3>
                            <p className="text-xs text-slate-400 font-medium">Envío directo de recordatorios, recetas u órdenes médicas.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white font-bold">✕</button>
                </div>

                {/* Consultorio / Clinic Name Edit */}
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-emerald-500" />
                        <span>Nombre de tu Consultorio / Clínica (Firma de Mensaje)</span>
                    </label>
                    <input
                        type="text"
                        value={clinicName}
                        onChange={(e) => setClinicName(e.target.value)}
                        placeholder="Ej: Consultorio Dr. Perez, Centro Médico San Martín..."
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-extrabold text-emerald-700 dark:text-emerald-300"
                    />
                </div>

                {/* Template Selector */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Seleccionar Plantilla de Mensaje</label>
                    <div className="grid grid-cols-2 gap-2">
                        {appointmentData && (
                            <button
                                onClick={() => setTemplateType("turno")}
                                className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all ${
                                    templateType === "turno"
                                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                                        : "bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-slate-400"
                                }`}
                            >
                                <Calendar className="h-4 w-4 text-emerald-500" />
                                <span>Recordatorio Turno</span>
                            </button>
                        )}

                        {prescriptionData && (
                            <button
                                onClick={() => setTemplateType("receta")}
                                className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all ${
                                    templateType === "receta"
                                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                                        : "bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-slate-400"
                                }`}
                            >
                                <Pill className="h-4 w-4 text-teal-500" />
                                <span>Receta Digital</span>
                            </button>
                        )}

                        {orderData && (
                            <button
                                onClick={() => setTemplateType("orden")}
                                className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all ${
                                    templateType === "orden"
                                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                                        : "bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-slate-400"
                                }`}
                            >
                                <FlaskConical className="h-4 w-4 text-cyan-500" />
                                <span>Orden de Estudios</span>
                            </button>
                        )}

                        <button
                            onClick={() => setTemplateType("personalizado")}
                            className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all ${
                                templateType === "personalizado"
                                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                                    : "bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-slate-400"
                            }`}
                        >
                            <FileText className="h-4 w-4 text-emerald-500" />
                            <span>Libre / Personalizado</span>
                        </button>
                    </div>
                </div>

                {templateType === "personalizado" && (
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase">Mensaje Personalizado</label>
                        <textarea
                            rows={3}
                            value={customText}
                            onChange={(e) => setCustomText(e.target.value)}
                            placeholder="Escribe el mensaje para el paciente..."
                            className="w-full p-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs"
                        />
                    </div>
                )}

                {/* Message Preview */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-400 uppercase">Vista Previa del Mensaje</span>
                        <button
                            onClick={handleCopy}
                            className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                        >
                            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            <span>{copied ? "¡Copiado!" : "Copiar Texto"}</span>
                        </button>
                    </div>

                    <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 rounded-2xl text-xs font-sans whitespace-pre-wrap leading-relaxed text-slate-800 dark:text-slate-200">
                        {finalMessage}
                    </div>
                </div>

                {/* Patient Phone Status */}
                <div className="p-3 bg-slate-50 dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs flex justify-between items-center">
                    <span className="text-slate-400 font-bold">Teléfono Destino:</span>
                    <span className="font-extrabold text-slate-900 dark:text-white">{patientPhone || 'S/D (Se solicitará al abrir WhatsApp)'}</span>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl font-bold text-xs text-slate-500"
                    >
                        Cancelar
                    </button>
                    <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={onClose}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs shadow-md shadow-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer"
                    >
                        <Send className="h-4 w-4" />
                        <span>Abrir WhatsApp y Enviar</span>
                    </a>
                </div>
            </div>
        </div>
    );
}
