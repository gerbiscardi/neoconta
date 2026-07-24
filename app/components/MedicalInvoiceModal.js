"use client";
import { useState } from "react";
import { FileText, CheckCircle2, AlertCircle, DollarSign, User, ShieldCheck, Download, X } from "lucide-react";

export default function MedicalInvoiceModal({ 
    isOpen, 
    onClose, 
    patient, 
    currentUser, 
    defaultAmount = "15000",
    consultationReason = "Consulta Médica General",
    onSuccess 
}) {
    const [tipoComprobante, setTipoComprobante] = useState("11"); // 11 = Factura C, 6 = Factura B
    const [docTipo, setDocTipo] = useState(patient?.dni && patient.dni.length === 11 ? "80" : "96"); // 80 = CUIT, 96 = DNI
    const [docNro, setDocNro] = useState(patient?.dni || "");
    const [razonSocial, setRazonSocial] = useState(patient?.name || "");
    const [ivaCondicion, setIvaCondicion] = useState("5"); // 5 = Consumidor Final, 4 = Exento
    
    const [itemConcept, setItemConcept] = useState(`Honorarios Profesionales - ${consultationReason}`);
    const [amount, setAmount] = useState(defaultAmount);
    const [formaPago, setFormaPago] = useState("Efectivo");

    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    if (!isOpen) return null;

    const handleFacturar = async (e) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);

        const targetUserId = currentUser?.role === 'vitacore-professional' ? currentUser.parentId : currentUser?.id;
        const totalAmount = parseFloat(amount) || 0;

        if (totalAmount <= 0) {
            setError("El importe de la consulta debe ser mayor a $0");
            setSubmitting(false);
            return;
        }

        const invoicePayload = {
            userId: targetUserId,
            production: false,
            invoices: [
                {
                    tipoComprobante: parseInt(tipoComprobante),
                    puntoVenta: 1,
                    concepto: 2, // 2 = Servicios
                    docTipo: parseInt(docTipo),
                    docNro: parseInt(docNro.replace(/[^0-9]/g, '')) || 0,
                    razonSocial: razonSocial,
                    ivaCondicion: parseInt(ivaCondicion),
                    items: [
                        {
                            description: itemConcept,
                            quantity: 1,
                            unitPrice: totalAmount,
                            total: totalAmount
                        }
                    ],
                    formaPago: formaPago
                }
            ]
        };

        try {
            const res = await fetch("/api/arca/facturar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(invoicePayload)
            });

            const data = await res.json();

            if (res.ok && data.success && data.results && data.results[0] && data.results[0].cae) {
                setResult(data.results[0]);
                if (onSuccess) onSuccess(data.results[0]);
            } else {
                setError(data.error || data.details || (data.results && data.results[0] && data.results[0].error) || "Error al emitir factura en ARCA");
            }
        } catch (err) {
            console.error("Error invoicing with ARCA:", err);
            setError("Error de conexión con el servicio de facturación ARCA.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="bg-white dark:bg-zinc-950 border border-blue-500/30 rounded-3xl w-full max-w-xl p-6 shadow-2xl relative z-10 space-y-6 overflow-hidden max-h-[92vh] overflow-y-auto font-sans text-slate-900 dark:text-slate-100">
                
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-2xl shadow-md">
                            <FileText className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black tracking-tight">Facturación Electrónica ARCA</h3>
                            <p className="text-xs text-slate-400 font-medium">Emisión de Factura Médica oficial con CAE en tiempo real.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white font-bold">✕</button>
                </div>

                {result ? (
                    /* Invoice Issued Success View */
                    <div className="py-6 space-y-6 text-center">
                        <div className="inline-flex p-4 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-300 dark:border-emerald-800">
                            <CheckCircle2 className="h-12 w-12" />
                        </div>

                        <div className="space-y-1">
                            <h4 className="text-xl font-black text-slate-900 dark:text-white">Factura Autorizada por ARCA</h4>
                            <p className="text-xs text-slate-400">Comprobante fiscal registrado en los servidores de AFIP / ARCA.</p>
                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 text-xs space-y-2 max-w-md mx-auto text-left">
                            <div className="flex justify-between border-b border-slate-200 dark:border-zinc-800 pb-2">
                                <span className="text-slate-400 font-bold">N° Comprobante:</span>
                                <span className="font-extrabold text-blue-600 dark:text-blue-400">
                                    {tipoComprobante === "11" ? "Factura C" : "Factura B"} 00001-{String(result.cbteNro || 1).padStart(8, '0')}
                                </span>
                            </div>
                            <div className="flex justify-between border-b border-slate-200 dark:border-zinc-800 pb-2">
                                <span className="text-slate-400 font-bold">Código CAE:</span>
                                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{result.cae}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-200 dark:border-zinc-800 pb-2">
                                <span className="text-slate-400 font-bold">Vencimiento CAE:</span>
                                <span>{result.caeVto ? result.caeVto.split('-').reverse().join('/') : 'N/A'}</span>
                            </div>
                            <div className="flex justify-between pt-1 font-bold text-sm">
                                <span>Importe Total:</span>
                                <span className="text-slate-900 dark:text-white">${parseFloat(amount).toLocaleString('es-AR')}</span>
                            </div>
                        </div>

                        <div className="flex justify-center gap-3 pt-2">
                            <button
                                onClick={onClose}
                                className="px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl text-xs"
                            >
                                Cerrar y Volver
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Invoice Form */
                    <form onSubmit={handleFacturar} className="space-y-4 text-xs">
                        {error && (
                            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl flex items-center gap-2 font-medium">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="font-bold text-slate-400 uppercase">Tipo de Comprobante *</label>
                                <select
                                    value={tipoComprobante}
                                    onChange={(e) => setTipoComprobante(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl font-bold"
                                >
                                    <option value="11">Factura C (Monotributista)</option>
                                    <option value="6">Factura B (Resp. Inscripto)</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="font-bold text-slate-400 uppercase">Forma de Pago</label>
                                <select
                                    value={formaPago}
                                    onChange={(e) => setFormaPago(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl font-bold"
                                >
                                    <option value="Efectivo">Efectivo</option>
                                    <option value="Transferencia / MP">Transferencia / Mercado Pago</option>
                                    <option value="Tarjeta de Débito">Tarjeta de Débito</option>
                                    <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
                                    <option value="Cobertura / Reembolso">Cobertura / Obra Social</option>
                                </select>
                            </div>
                        </div>

                        {/* Patient Billing Details */}
                        <div className="p-3.5 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3">
                            <span className="font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">Receptor / Paciente</span>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="sm:col-span-2 space-y-1">
                                    <label className="font-bold text-slate-400 uppercase">Nombre / Razón Social *</label>
                                    <input
                                        type="text"
                                        required
                                        value={razonSocial}
                                        onChange={(e) => setRazonSocial(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl font-bold"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="font-bold text-slate-400 uppercase">Tipo Doc</label>
                                    <select
                                        value={docTipo}
                                        onChange={(e) => setDocTipo(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl font-semibold"
                                    >
                                        <option value="96">DNI</option>
                                        <option value="80">CUIT</option>
                                        <option value="99">Sin Documento</option>
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="font-bold text-slate-400 uppercase">Número DNI / CUIT *</label>
                                    <input
                                        type="text"
                                        required
                                        value={docNro}
                                        onChange={(e) => setDocNro(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl font-bold"
                                    />
                                </div>

                                <div className="sm:col-span-2 space-y-1">
                                    <label className="font-bold text-slate-400 uppercase">Condición frente al IVA</label>
                                    <select
                                        value={ivaCondicion}
                                        onChange={(e) => setIvaCondicion(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl font-semibold"
                                    >
                                        <option value="5">Consumidor Final</option>
                                        <option value="4">IVA Exento</option>
                                        <option value="1">Responsable Inscripto</option>
                                        <option value="6">Monotributo</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Concept & Amount */}
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <label className="font-bold text-slate-400 uppercase">Concepto / Descripción en Factura *</label>
                                <input
                                    type="text"
                                    required
                                    value={itemConcept}
                                    onChange={(e) => setItemConcept(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl font-semibold"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="font-bold text-slate-400 uppercase">Importe Total Consulta ($ ARS) *</label>
                                <div className="relative">
                                    <span className="absolute left-3 top.1/2 transform -translate-y-1/2 font-bold text-slate-400">$</span>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        step="100"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full pl-7 pr-3 py-2.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-base font-extrabold text-blue-600 dark:text-blue-400"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-zinc-800">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl font-bold text-slate-500"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold rounded-xl shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                            >
                                {submitting ? "Obteniendo CAE en ARCA..." : "Emitir Factura ARCA"}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
