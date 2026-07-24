"use client";
import { useRef, useState, useEffect } from "react";
import { Eraser, Check, Upload, RefreshCw } from "lucide-react";

export default function SignatureCanvas({ onSave, initialImage = null }) {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasStrokes, setHasStrokes] = useState(false);
    const [savedImage, setSavedImage] = useState(initialImage);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }, []);

    const startDrawing = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
        const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;

        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
        setHasStrokes(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
        const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;

        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasStrokes(false);
        setSavedImage(null);
        if (onSave) onSave(null);
    };

    const saveSignature = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dataUrl = canvas.toDataURL('image/png');
        setSavedImage(dataUrl);
        if (onSave) onSave(dataUrl);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target.result;
            setSavedImage(dataUrl);
            if (onSave) onSave(dataUrl);
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Firma & Sello Digitalizado</span>
                {savedImage && (
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Check className="h-4 w-4" /> Firma Configurada
                    </span>
                )}
            </div>

            {/* Signature Area */}
            <div className="relative bg-white border border-slate-300 dark:border-slate-700 rounded-2xl p-2 shadow-inner flex flex-col items-center justify-center">
                {savedImage ? (
                    <div className="relative py-4 w-full flex flex-col items-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={savedImage} alt="Firma digitalizada" className="max-h-28 object-contain" />
                        <button
                            type="button"
                            onClick={() => { setSavedImage(null); clearCanvas(); }}
                            className="mt-3 text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 bg-red-50 dark:bg-red-950/40 px-3 py-1.5 rounded-xl border border-red-200 dark:border-red-800"
                        >
                            <RefreshCw className="h-3.5 w-3.5" /> Cambiar o Trazar de Nuevo
                        </button>
                    </div>
                ) : (
                    <div className="w-full space-y-2">
                        <canvas
                            ref={canvasRef}
                            width={420}
                            height={140}
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                            className="w-full h-36 bg-slate-50 rounded-xl cursor-crosshair border border-dashed border-slate-300 touch-none"
                        />
                        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                            <span>Dibuje su firma con el mouse o dedo en pantalla</span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={clearCanvas}
                                    className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 flex items-center gap-1 font-medium"
                                >
                                    <Eraser className="h-3.5 w-3.5" /> Borrar
                                </button>
                                <button
                                    type="button"
                                    onClick={saveSignature}
                                    disabled={!hasStrokes}
                                    className="px-3 py-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg font-bold flex items-center gap-1 shadow-sm"
                                >
                                    <Check className="h-3.5 w-3.5" /> Guardar Firma
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* File Upload Alternative */}
            {!savedImage && (
                <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-slate-400">O subir imagen PNG/JPG transparente de su firma y sello:</span>
                    <label className="cursor-pointer text-xs font-bold text-teal-600 hover:text-teal-700 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all">
                        <Upload className="h-3.5 w-3.5" />
                        <span>Subir Imagen</span>
                        <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                    </label>
                </div>
            )}
        </div>
    );
}
