"use client";
import { useRef, useState, useEffect } from "react";
import { Eraser, Upload, Check, RefreshCw, PenTool } from "lucide-react";

export default function SignatureCanvas({ initialSignature = "", onSave, onClose }) {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawn, setHasDrawn] = useState(false);
    const [activeTab, setActiveTab] = useState("draw"); // 'draw' | 'upload'
    const [previewUrl, setPreviewUrl] = useState(initialSignature);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        ctx.strokeStyle = "#0f172a"; // dark indigo
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        if (initialSignature && activeTab === "draw") {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                setHasDrawn(true);
            };
            img.src = initialSignature;
        }
    }, [activeTab, initialSignature]);

    const startDrawing = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        ctx.beginPath();
        ctx.moveTo(clientX - rect.left, clientY - rect.top);
        setIsDrawing(true);
        setHasDrawn(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        ctx.lineTo(clientX - rect.left, clientY - rect.top);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasDrawn(false);
        setPreviewUrl("");
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            setPreviewUrl(evt.target.result);
            setHasDrawn(true);
        };
        reader.readAsDataURL(file);
    };

    const handleConfirm = () => {
        if (activeTab === "upload") {
            if (previewUrl) {
                onSave(previewUrl);
            }
        } else {
            const canvas = canvasRef.current;
            if (canvas && hasDrawn) {
                const dataUrl = canvas.toDataURL("image/png");
                onSave(dataUrl);
            }
        }
    };

    return (
        <div className="space-y-4">
            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-zinc-800">
                <button
                    type="button"
                    onClick={() => setActiveTab("draw")}
                    className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
                        activeTab === "draw"
                            ? "border-teal-500 text-teal-600 dark:text-teal-400"
                            : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-slate-300"
                    }`}
                >
                    <PenTool className="h-4 w-4" />
                    <span>Trazar en Pantalla</span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab("upload")}
                    className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
                        activeTab === "upload"
                            ? "border-teal-500 text-teal-600 dark:text-teal-400"
                            : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-slate-300"
                    }`}
                >
                    <Upload className="h-4 w-4" />
                    <span>Subir Imagen PNG / Sello</span>
                </button>
            </div>

            {activeTab === "draw" ? (
                <div className="space-y-2">
                    <div className="border border-gray-300 dark:border-zinc-700 rounded-2xl overflow-hidden bg-white dark:bg-zinc-950 relative shadow-inner">
                        <canvas
                            ref={canvasRef}
                            width={460}
                            height={180}
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                            className="w-full h-44 touch-none cursor-crosshair"
                        />
                        {!hasDrawn && (
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-gray-300 dark:text-zinc-700 text-xs font-medium italic">
                                Dibuje su firma aquí con el mouse o pantalla táctil...
                            </div>
                        )}
                        <div className="absolute bottom-2 right-2 flex gap-1">
                            <button
                                type="button"
                                onClick={clearCanvas}
                                className="px-2.5 py-1 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-600 dark:text-slate-300 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                            >
                                <Eraser className="h-3.5 w-3.5" />
                                <span>Limpiar</span>
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-2xl p-6 text-center space-y-3 bg-gray-50/50 dark:bg-zinc-900/50 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-all">
                        {previewUrl ? (
                            <div className="space-y-2">
                                <img src={previewUrl} alt="Vista previa de firma" className="max-h-32 mx-auto object-contain bg-white dark:bg-zinc-950 p-2 rounded-xl border" />
                                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center gap-1">
                                    <Check className="h-3.5 w-3.5" /> Imagen cargada correctamente
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                <Upload className="h-8 w-8 text-teal-500 mx-auto" />
                                <p className="text-xs font-bold text-gray-700 dark:text-slate-300">Seleccione el archivo con su firma y sello</p>
                                <p className="text-[11px] text-gray-400">Formatos recomendados: PNG transparente o JPG</p>
                            </div>
                        )}
                        <input
                            type="file"
                            accept="image/png, image/jpeg"
                            onChange={handleFileUpload}
                            className="hidden"
                            id="signature-upload-input"
                        />
                        <label
                            htmlFor="signature-upload-input"
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-md transition-all"
                        >
                            <Upload className="h-3.5 w-3.5" />
                            <span>{previewUrl ? "Cambiar Archivo" : "Buscar Archivo"}</span>
                        </label>
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-zinc-800">
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                        Cancelar
                    </button>
                )}
                <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={!hasDrawn && !previewUrl}
                    className="px-5 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-teal-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                    <Check className="h-4 w-4" />
                    <span>Guardar Firma Digitalizada</span>
                </button>
            </div>
        </div>
    );
}
