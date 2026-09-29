"use client";
import { useState } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

export default function ConfirmDeleteModal({ isOpen, onClose, onConfirm, title = "Eliminar Registro", itemText = "este elemento", warningText = "Esta acción no se puede deshacer y borrará permanentemente los datos." }) {
    const [typedConfirm, setTypedConfirm] = useState("");
    const [submitting, setSubmitting] = useState(false);

    if (!isOpen) return null;

    const isMatch = typedConfirm.trim().toUpperCase() === "ELIMINAR";

    const handleConfirm = async () => {
        if (!isMatch) return;
        setSubmitting(true);
        try {
            await onConfirm();
            onClose();
        } catch (err) {
            console.error("Error during deletion confirmation:", err);
        } finally {
            setSubmitting(false);
            setTypedConfirm("");
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in font-sans">
            <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 relative">
                
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-rose-500/10 text-rose-500 rounded-2xl border border-rose-500/20">
                            <AlertTriangle className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-900 dark:text-white">{title}</h3>
                            <p className="text-xs text-rose-500 font-bold">Acción Crítica e Irreversible</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Body Details */}
                <div className="space-y-3">
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        ¿Estás seguro de que deseas eliminar <span className="font-extrabold text-slate-900 dark:text-white">{itemText}</span>?
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 p-3 bg-slate-50 dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800">
                        {warningText}
                    </p>
                    
                    <div className="space-y-1.5 pt-2">
                        <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                            Escribí <span className="text-rose-500 font-black">ELIMINAR</span> para confirmar:
                        </label>
                        <input
                            type="text"
                            value={typedConfirm}
                            onChange={(e) => setTypedConfirm(e.target.value)}
                            placeholder="ELIMINAR"
                            className="w-full p-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-rose-500 uppercase font-mono font-bold"
                        />
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2.5 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-all cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        disabled={!isMatch || submitting}
                        onClick={handleConfirm}
                        className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-bold rounded-xl text-xs shadow-lg transition-all cursor-pointer disabled:cursor-not-allowed"
                    >
                        {submitting ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white" />
                        ) : (
                            <>
                                <Trash2 className="h-4 w-4" />
                                <span>Confirmar Eliminación</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
