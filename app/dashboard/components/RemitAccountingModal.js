'use client';

import React, { useState, useEffect } from 'react';
import { 
    X, 
    Send, 
    Download, 
    Calendar, 
    FileSpreadsheet, 
    FileText, 
    FileCode2, 
    Mail, 
    Building, 
    CheckCircle2, 
    AlertCircle, 
    Loader2, 
    Sparkles 
} from 'lucide-react';

export default function RemitAccountingModal({ isOpen, onClose, currentUser, companyConfig }) {
    if (!isOpen) return null;

    // Helper: format YYYY-MM-DD
    const formatDate = (date) => date.toISOString().split('T')[0];

    // Default dates: Previous Month
    const now = new Date();
    const firstDayPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [fechaDesde, setFechaDesde] = useState(formatDate(firstDayPrevMonth));
    const [fechaHasta, setFechaHasta] = useState(formatDate(lastDayPrevMonth));
    const [selectedPreset, setSelectedPreset] = useState('prevMonth');

    const [format, setFormat] = useState('xlsx'); // 'xlsx' | 'pdf' | 'csv'
    const [includeInvoices, setIncludeInvoices] = useState(true);
    const [includeBank, setIncludeBank] = useState(true);

    const [recipientEmail, setRecipientEmail] = useState('');
    const [message, setMessage] = useState('Hola, te comparto la información contable y financiera del período adjunta para la liquidación. Saludos.');

    const [loading, setLoading] = useState(false);
    const [actionType, setActionType] = useState(null); // 'email' | 'download'
    const [statusMessage, setStatusMessage] = useState(null); // { type: 'success' | 'error', text: '' }

    // Load saved email on mount
    useEffect(() => {
        const savedEmail = localStorage.getItem('neoconta_contador_email');
        if (savedEmail) {
            setRecipientEmail(savedEmail);
        }
    }, []);

    // Apply preset
    const applyPreset = (preset) => {
        setSelectedPreset(preset);
        const curr = new Date();
        if (preset === 'prevMonth') {
            const f = new Date(curr.getFullYear(), curr.getMonth() - 1, 1);
            const l = new Date(curr.getFullYear(), curr.getMonth(), 0);
            setFechaDesde(formatDate(f));
            setFechaHasta(formatDate(l));
        } else if (preset === 'currentMonth') {
            const f = new Date(curr.getFullYear(), curr.getMonth(), 1);
            setFechaDesde(formatDate(f));
            setFechaHasta(formatDate(curr));
        } else if (preset === 'last30Days') {
            const f = new Date();
            f.setDate(curr.getDate() - 30);
            setFechaDesde(formatDate(f));
            setFechaHasta(formatDate(curr));
        } else if (preset === 'currentYear') {
            const f = new Date(curr.getFullYear(), 0, 1);
            setFechaDesde(formatDate(f));
            setFechaHasta(formatDate(curr));
        }
    };

    // Trigger Download from base64
    const downloadBase64File = (base64Data, filename, mimeType) => {
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Handle Submit
    const handleAction = async (action) => {
        setStatusMessage(null);

        if (!includeInvoices && !includeBank) {
            setStatusMessage({ type: 'error', text: 'Debes seleccionar al menos un módulo (Facturación o Banco) para remitir.' });
            return;
        }

        if (action === 'send_email') {
            if (!recipientEmail || !recipientEmail.includes('@')) {
                setStatusMessage({ type: 'error', text: 'Por favor ingresa un correo electrónico de destinatario válido.' });
                return;
            }
            // Save email to localStorage for future use
            localStorage.setItem('neoconta_contador_email', recipientEmail.trim());
        }

        setLoading(true);
        setActionType(action);

        try {
            const res = await fetch('/api/accounting/remit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: currentUser?.id,
                    fechaDesde,
                    fechaHasta,
                    format,
                    recipientEmail: recipientEmail.trim(),
                    message: message.trim(),
                    includeInvoices,
                    includeBank,
                    action
                })
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Ocurrió un error al procesar el informe.');
            }

            if (action === 'download') {
                downloadBase64File(data.base64Data, data.filename, data.mimeType);
                setStatusMessage({
                    type: 'success',
                    text: `¡Archivo ${data.filename} generado y descargado con éxito!`
                });
            } else {
                setStatusMessage({
                    type: 'success',
                    text: data.message || `¡Información contable remitida con éxito a ${recipientEmail}!`
                });
            }

        } catch (error) {
            console.error('Error in remit action:', error);
            setStatusMessage({ type: 'error', text: error.message || 'Error al conectar con el servidor.' });
        } finally {
            setLoading(false);
            setActionType(null);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
                
                {/* Modal Header */}
                <div className="px-6 py-5 bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-transparent border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                            <Send className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                Remitir Información Contable
                                <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                                    Contador
                                </span>
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Exporta y envía la facturación y movimientos bancarios a tu contador en un clic.
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        disabled={loading}
                        className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">

                    {/* Company Pill */}
                    <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium">
                            <Building className="h-4 w-4 text-orange-500" />
                            <span>{companyConfig?.razonSocial || currentUser?.nombre || "Mi Empresa"}</span>
                            {companyConfig?.cuit && (
                                <span className="text-xs text-slate-400">({companyConfig.cuit})</span>
                            )}
                        </div>
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                            Datos Verificados
                        </span>
                    </div>

                    {/* Presets & Dates */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Calendar className="h-4 w-4 text-orange-500" />
                            Período a Remitir
                        </label>
                        
                        {/* Preset buttons */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {[
                                { id: 'prevMonth', label: 'Mes Anterior' },
                                { id: 'currentMonth', label: 'Mes Actual' },
                                { id: 'last30Days', label: 'Últimos 30 días' },
                                { id: 'currentYear', label: 'Año en Curso' },
                            ].map((preset) => (
                                <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => applyPreset(preset.id)}
                                    className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all border ${
                                        selectedPreset === preset.id
                                            ? 'bg-orange-500 text-white border-orange-500 shadow-sm shadow-orange-500/20'
                                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60'
                                    }`}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>

                        {/* Date Pickers */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                    Fecha Desde
                                </label>
                                <input
                                    type="date"
                                    value={fechaDesde}
                                    onChange={(e) => { setFechaDesde(e.target.value); setSelectedPreset('custom'); }}
                                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-xs font-medium"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                    Fecha Hasta
                                </label>
                                <input
                                    type="date"
                                    value={fechaHasta}
                                    onChange={(e) => { setFechaHasta(e.target.value); setSelectedPreset('custom'); }}
                                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-xs font-medium"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Content Checkboxes */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Información a Incluir
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <label className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                                includeInvoices 
                                    ? 'bg-blue-500/5 dark:bg-blue-500/10 border-blue-500/30' 
                                    : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60'
                            }`}>
                                <input 
                                    type="checkbox" 
                                    checked={includeInvoices} 
                                    onChange={(e) => setIncludeInvoices(e.target.checked)}
                                    className="mt-1 h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                                />
                                <div>
                                    <p className="font-bold text-xs text-slate-800 dark:text-slate-200">Facturación Emitida (ARCA)</p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Facturas A, B, C, NC y ND con CAE, totales e IVA.</p>
                                </div>
                            </label>

                            <label className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                                includeBank 
                                    ? 'bg-purple-500/5 dark:bg-purple-500/10 border-purple-500/30' 
                                    : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60'
                            }`}>
                                <input 
                                    type="checkbox" 
                                    checked={includeBank} 
                                    onChange={(e) => setIncludeBank(e.target.checked)}
                                    className="mt-1 h-4 w-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300"
                                />
                                <div>
                                    <p className="font-bold text-xs text-slate-800 dark:text-slate-200">Movimientos Bancarios</p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Extracto de ingresos, egresos y flujo financiero.</p>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Format Selector */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Formato de Salida
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { 
                                    id: 'xlsx', 
                                    label: 'Excel (.xlsx)', 
                                    desc: 'Hojas y fórmulas',
                                    badge: 'Recomendado',
                                    icon: <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
                                },
                                { 
                                    id: 'pdf', 
                                    label: 'PDF Ejecutivo', 
                                    desc: 'Documento formal',
                                    badge: null,
                                    icon: <FileText className="h-5 w-5 text-red-500" />
                                },
                                { 
                                    id: 'csv', 
                                    label: 'CSV Plano', 
                                    desc: 'Para sistemas contables',
                                    badge: null,
                                    icon: <FileCode2 className="h-5 w-5 text-blue-500" />
                                },
                            ].map((fmt) => (
                                <button
                                    key={fmt.id}
                                    type="button"
                                    onClick={() => setFormat(fmt.id)}
                                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                                        format === fmt.id
                                            ? 'bg-orange-500/5 dark:bg-orange-500/10 border-orange-500 shadow-sm'
                                            : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                    }`}
                                >
                                    <div className="flex items-center justify-between w-full gap-2">
                                        <div>{fmt.icon}</div>
                                        {fmt.badge && (
                                            <span className="text-[9px] font-bold text-orange-600 dark:text-orange-400 bg-orange-500/15 dark:bg-orange-500/25 px-2 py-0.5 rounded-full border border-orange-500/30 ml-auto shrink-0 shadow-sm">
                                                {fmt.badge}
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-2.5">
                                        <p className="font-bold text-xs text-slate-800 dark:text-slate-200">{fmt.label}</p>
                                        <p className="text-[10px] text-slate-400">{fmt.desc}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Email Recipient and Optional Note */}
                    <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Mail className="h-4 w-4 text-orange-500" />
                            Email del Destinatario (Contador / Estudio)
                        </label>
                        <input
                            type="email"
                            placeholder="ej: contador@estudiocontable.com"
                            value={recipientEmail}
                            onChange={(e) => setRecipientEmail(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-xs font-medium placeholder:text-slate-400"
                        />

                        <div>
                            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                                Mensaje o Nota Opcional
                            </label>
                            <textarea
                                rows={2}
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Escribe un mensaje para adjuntar al correo..."
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-xs font-medium placeholder:text-slate-400 resize-none"
                            />
                        </div>
                    </div>

                    {/* Status Alert Banner */}
                    {statusMessage && (
                        <div className={`p-3.5 rounded-2xl flex items-center gap-2.5 text-xs font-medium animate-fade-in ${
                            statusMessage.type === 'success'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                        }`}>
                            {statusMessage.type === 'success' ? (
                                <CheckCircle2 className="h-4 w-4 shrink-0" />
                            ) : (
                                <AlertCircle className="h-4 w-4 shrink-0" />
                            )}
                            <span>{statusMessage.text}</span>
                        </div>
                    )}

                </div>

                {/* Modal Footer Actions */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-[11px] text-slate-400 text-center sm:text-left">
                        Genera un paquete consolidado seguro listo para liquidar.
                    </p>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={() => handleAction('download')}
                            disabled={loading}
                            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                        >
                            {loading && actionType === 'download' ? (
                                <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                            ) : (
                                <Download className="h-4 w-4 text-slate-500" />
                            )}
                            <span>Descargar Copia</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => handleAction('send_email')}
                            disabled={loading}
                            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold transition-all shadow-lg shadow-orange-500/20 cursor-pointer disabled:opacity-50"
                        >
                            {loading && actionType === 'send_email' ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Enviando...</span>
                                </>
                            ) : (
                                <>
                                    <Send className="h-4 w-4" />
                                    <span>Enviar al Contador</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
