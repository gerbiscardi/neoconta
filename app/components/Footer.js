"use client";

import { useState } from "react";
import Link from "next/link";
import { Twitter, Linkedin, Facebook, Github, Heart, Box, X, UploadCloud, FileText, CheckCircle, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Footer() {
    const [isAboutOpen, setIsAboutOpen] = useState(false);
    const [isCareersOpen, setIsCareersOpen] = useState(false);
    const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
    const [isTermsOpen, setIsTermsOpen] = useState(false);
    const [careerName, setCareerName] = useState("");
    const [careerEmail, setCareerEmail] = useState("");
    const [careerRole, setCareerRole] = useState("Consultoría de Procesos");
    const [careerFile, setCareerFile] = useState(null);
    const [careerStatus, setCareerStatus] = useState("idle"); // idle, submitting, success, error
    const [careerMessage, setCareerMessage] = useState("");
    const [dragActive, setDragActive] = useState(false);

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            const validTypes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
            if (validTypes.includes(file.type) || file.name.endsWith(".pdf") || file.name.endsWith(".doc") || file.name.endsWith(".docx")) {
                if (file.size <= 5 * 1024 * 1024) { // 5MB limit
                    setCareerFile(file);
                } else {
                    setCareerStatus("error");
                    setCareerMessage("El archivo debe pesar menos de 5MB.");
                }
            } else {
                setCareerStatus("error");
                setCareerMessage("Solo se permiten archivos PDF, DOC o DOCX.");
            }
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size <= 5 * 1024 * 1024) {
                setCareerFile(file);
            } else {
                setCareerStatus("error");
                setCareerMessage("El archivo debe pesar menos de 5MB.");
            }
        }
    };

    const handleCareerSubmit = async (e) => {
        e.preventDefault();
        if (!careerName.trim()) {
            setCareerStatus("error");
            setCareerMessage("El nombre es obligatorio.");
            return;
        }
        if (!careerEmail.trim() || !careerEmail.includes("@")) {
            setCareerStatus("error");
            setCareerMessage("Por favor ingrese un correo válido.");
            return;
        }
        if (!careerFile) {
            setCareerStatus("error");
            setCareerMessage("Debe adjuntar su CV.");
            return;
        }

        setCareerStatus("submitting");
        setCareerMessage("");

        const formData = new FormData();
        formData.append("name", careerName);
        formData.append("email", careerEmail);
        formData.append("role", careerRole);
        formData.append("cv", careerFile);

        try {
            const response = await fetch("/api/careers", {
                method: "POST",
                body: formData,
            });

            const data = await response.json();
            if (response.ok && data.success) {
                setCareerStatus("success");
                setCareerName("");
                setCareerEmail("");
                setCareerRole("Consultoría de Procesos");
                setCareerFile(null);
            } else {
                setCareerStatus("error");
                setCareerMessage(data.error || "Ocurrió un error al enviar tu postulación.");
            }
        } catch (err) {
            console.error(err);
            setCareerStatus("error");
            setCareerMessage("Error de conexión. Intente de nuevo más tarde.");
        }
    };

    return (
        <footer className="bg-white border-t border-gray-100 dark:bg-black dark:border-gray-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div className="col-span-1 md:col-span-2">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="relative w-8 h-8 overflow-hidden rounded-lg bg-gradient-to-tr from-[#ff5e00] to-violet-600 p-[1px]">
                                <div className="absolute inset-0 bg-white dark:bg-black rounded-lg flex items-center justify-center">
                                    <Box className="w-5 h-5 text-[#ff5e00] dark:text-white" />
                                </div>
                            </div>
                            <span className="font-bold text-lg text-gray-900 dark:text-white">
                                NeoConta
                            </span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
                            Plataforma de servicios digitales e Inteligencia Artificial para la gestión de tu negocio.
                        </p>
                        <div className="flex space-x-4">
                            <Link href="#" className="text-gray-400 hover:text-[#ff5e00] transition-colors">
                                <Twitter className="h-5 w-5" />
                            </Link>
                            <Link href="#" className="text-gray-400 hover:text-[#ff5e00] transition-colors">
                                <Linkedin className="h-5 w-5" />
                            </Link>
                            <Link href="#" className="text-gray-400 hover:text-[#ff5e00] transition-colors">
                                <Github className="h-5 w-5" />
                            </Link>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white tracking-wider uppercase mb-4">
                            Compañía
                        </h3>
                        <ul className="space-y-3">
                            <li>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setIsAboutOpen(true);
                                    }}
                                    className="text-sm text-gray-500 hover:text-[#ff5e00] dark:text-gray-400 transition-colors bg-transparent border-0 p-0 cursor-pointer text-left focus:outline-none"
                                >
                                    Acerca de
                                </button>
                            </li>

                            <li>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setIsCareersOpen(true);
                                    }}
                                    className="text-sm text-gray-500 hover:text-[#ff5e00] dark:text-gray-400 transition-colors bg-transparent border-0 p-0 cursor-pointer text-left focus:outline-none"
                                >
                                    Carreras
                                </button>
                            </li>
                            <li>
                                <Link href="#" className="text-sm text-gray-500 hover:text-[#ff5e00] dark:text-gray-400 transition-colors">
                                    Contacto
                                </Link>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white tracking-wider uppercase mb-4">
                            Legal
                        </h3>
                        <ul className="space-y-3">
                            <li>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setIsPrivacyOpen(true);
                                    }}
                                    className="text-sm text-gray-500 hover:text-[#ff5e00] dark:text-gray-400 transition-colors bg-transparent border-0 p-0 cursor-pointer text-left focus:outline-none"
                                >
                                    Privacidad
                                </button>
                            </li>
                            <li>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setIsTermsOpen(true);
                                    }}
                                    className="text-sm text-gray-500 hover:text-[#ff5e00] dark:text-gray-400 transition-colors bg-transparent border-0 p-0 cursor-pointer text-left focus:outline-none"
                                >
                                    Términos
                                </button>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="mt-12 pt-8 border-t border-gray-100 dark:border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        &copy; {new Date().getFullYear()} NeoConta. Todos los derechos reservados.
                    </p>
                    
                    {/* Sectigo Positive SSL Seal */}
                    <div className="flex items-center">
                        <a 
                            href="#" 
                            onClick={(e) => {
                                e.preventDefault();
                                window.open(
                                    `https://secure.trust-provider.com/ttb_searcher/trustlogo?v_querytype=W&v_shortname=CL1&v_search=https://${window.location.host}/`, 
                                    "tl_wnd_credentials" + new Date().getTime(), 
                                    "toolbar=0,scrollbars=1,location=1,status=1,menubar=1,resizable=1,width=374,height=660"
                                );
                            }}
                            className="transition-opacity hover:opacity-90 active:scale-95 duration-200 inline-block"
                            title="Haz clic para verificar nuestro Certificado SSL de Sectigo Positive"
                        >
                            <img 
                                src="https://micuenta.donweb.com/img/sectigo_positive_md.png" 
                                alt="Sectigo Positive SSL Secured" 
                                className="h-10 w-auto rounded"
                            />
                        </a>
                    </div>

                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <span>Hecho con</span>
                        <Heart className="h-4 w-4 mx-1 text-red-500 fill-current" />
                        <span>en Argentina</span>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {isAboutOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        {/* Backdrop overlay */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsAboutOpen(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />

                        {/* Modal card */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="bg-white dark:bg-zinc-950 border border-gray-100 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative z-10 overflow-hidden"
                        >
                            {/* Accent Glow Element */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#ff5e00]/20 to-transparent blur-2xl pointer-events-none rounded-full" />
                            
                            {/* Close button */}
                            <button
                                onClick={() => setIsAboutOpen(false)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>

                            {/* Logo/Icon Header */}
                            <div className="flex items-center gap-2 mb-4">
                                <div className="relative w-8 h-8 overflow-hidden rounded-lg bg-[#ff5e00] p-[1px]">
                                    <div className="absolute inset-0 bg-white dark:bg-black rounded-lg flex items-center justify-center">
                                        <Box className="w-5 h-5 text-[#ff5e00]" />
                                    </div>
                                </div>
                                <span className="font-bold text-lg text-gray-900 dark:text-white">
                                    Sobre NeoConta
                                </span>
                            </div>

                            {/* Description Paragraph */}
                            <p className="text-gray-600 dark:text-gray-300 text-sm md:text-base leading-relaxed mb-6">
                                En NeoConta brindamos una plataforma web de servicios digitales e Inteligencia Artificial diseñada para optimizar y automatizar la gestión administrativa, médica y financiera de profesionales, PyMEs y emprendedores, ofreciendo herramientas como facturación masiva ARCA, historia clínica digital y business intelligence.
                            </p>

                            {/* Close Action Button */}
                            <div className="flex justify-end">
                                <button
                                    onClick={() => setIsAboutOpen(false)}
                                    className="px-5 py-2 rounded-lg bg-[#ff5e00] text-white font-medium text-sm hover:bg-[#ff5e00]/90 hover:shadow-lg hover:shadow-[#ff5e00]/25 transition-all duration-200"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isCareersOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        {/* Backdrop overlay */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => {
                                if (careerStatus !== "submitting") {
                                    setIsCareersOpen(false);
                                    setCareerStatus("idle");
                                    setCareerMessage("");
                                }
                            }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />

                        {/* Modal card */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="bg-white dark:bg-zinc-950 border border-gray-100 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative z-10 overflow-hidden"
                        >
                            {/* Accent Glow Element */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#ff5e00]/20 to-transparent blur-2xl pointer-events-none rounded-full" />
                            
                            {/* Close button */}
                            {careerStatus !== "submitting" && (
                                <button
                                    onClick={() => {
                                        setIsCareersOpen(false);
                                        setCareerStatus("idle");
                                        setCareerMessage("");
                                    }}
                                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            )}

                            {/* Header */}
                            <div className="flex items-center gap-2 mb-4">
                                <div className="relative w-8 h-8 overflow-hidden rounded-lg bg-[#ff5e00] p-[1px]">
                                    <div className="absolute inset-0 bg-white dark:bg-black rounded-lg flex items-center justify-center">
                                        <Box className="w-5 h-5 text-[#ff5e00]" />
                                    </div>
                                </div>
                                <span className="font-bold text-lg text-gray-900 dark:text-white">
                                    Sumate al Equipo
                                </span>
                            </div>

                            {careerStatus === "success" ? (
                                <div className="text-center py-8">
                                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 mb-4 animate-bounce">
                                        <CheckCircle className="h-6 w-6" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                        ¡Postulación Recibida!
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-6">
                                        Gracias por tu interés en sumarte a NeoConta. Evaluaremos tu perfil y nos pondremos en contacto contigo a la brevedad.
                                    </p>
                                    <button
                                        onClick={() => {
                                            setIsCareersOpen(false);
                                            setCareerStatus("idle");
                                        }}
                                        className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-[#ff5e00] text-white font-medium text-sm hover:bg-[#ff5e00]/90 transition-all duration-200"
                                    >
                                        Entendido
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleCareerSubmit} className="space-y-4">
                                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mb-2 leading-relaxed">
                                        Buscamos profesionales proactivos y apasionados por redefinir procesos contables y administrativos de la mano de la Inteligencia Artificial.
                                    </p>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                                            Nombre Completo *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            disabled={careerStatus === "submitting"}
                                            value={careerName}
                                            onChange={(e) => setCareerName(e.target.value)}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#ff5e00]/20 focus:border-[#ff5e00] transition-all disabled:opacity-50"
                                            placeholder="Tu nombre y apellido"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                                            Correo Electrónico *
                                        </label>
                                        <input
                                            type="email"
                                            required
                                            disabled={careerStatus === "submitting"}
                                            value={careerEmail}
                                            onChange={(e) => setCareerEmail(e.target.value)}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#ff5e00]/20 focus:border-[#ff5e00] transition-all disabled:opacity-50"
                                            placeholder="ejemplo@correo.com"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                                            Área de Interés *
                                        </label>
                                        <select
                                            disabled={careerStatus === "submitting"}
                                            value={careerRole}
                                            onChange={(e) => setCareerRole(e.target.value)}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ff5e00]/20 focus:border-[#ff5e00] transition-all disabled:opacity-50"
                                        >
                                            <option value="Consultoría de Procesos">Consultoría de Procesos</option>
                                            <option value="Desarrollo de Software / IA">Desarrollo de Software / IA</option>
                                            <option value="Administración y Finanzas">Administración y Finanzas</option>
                                            <option value="Soporte y Operaciones">Soporte y Operaciones</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                                            Cargar CV (PDF, DOC o DOCX) *
                                        </label>
                                        
                                        <div
                                            onDragEnter={handleDrag}
                                            onDragOver={handleDrag}
                                            onDragLeave={handleDrag}
                                            onDrop={handleDrop}
                                            className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center transition-all cursor-pointer ${
                                                dragActive 
                                                    ? "border-[#ff5e00] bg-[#ff5e00]/5" 
                                                    : "border-gray-200 dark:border-zinc-800 bg-gray-50/30 dark:bg-zinc-900/30 hover:border-[#ff5e00]/50"
                                            }`}
                                            onClick={() => document.getElementById("cv-file-input").click()}
                                        >
                                            <input
                                                id="cv-file-input"
                                                type="file"
                                                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                                className="hidden"
                                                onChange={handleFileChange}
                                                disabled={careerStatus === "submitting"}
                                            />
                                            {careerFile ? (
                                                <div className="flex items-center gap-2 text-[#ff5e00]">
                                                    <FileText className="h-8 w-8 shrink-0" />
                                                    <div className="text-left">
                                                        <p className="text-xs md:text-sm font-medium text-gray-800 dark:text-gray-200 max-w-[200px] truncate">
                                                            {careerFile.name}
                                                        </p>
                                                        <p className="text-[10px] text-gray-400">
                                                            {(careerFile.size / 1024).toFixed(1)} KB
                                                        </p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <UploadCloud className="h-8 w-8 text-gray-400 mb-1.5" />
                                                    <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                                                        Arrastrá tu archivo aquí o hacé clic para buscar
                                                    </p>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">
                                                        Límite de 5MB
                                                    </p>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {careerStatus === "error" && (
                                        <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs rounded-xl font-medium">
                                            {careerMessage}
                                        </div>
                                    )}

                                    <div className="flex justify-end gap-3 pt-2">
                                        <button
                                            type="button"
                                            disabled={careerStatus === "submitting"}
                                            onClick={() => {
                                                setIsCareersOpen(false);
                                                setCareerStatus("idle");
                                                setCareerMessage("");
                                            }}
                                            className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors disabled:opacity-50"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={careerStatus === "submitting"}
                                            className="px-5 py-2.5 rounded-xl bg-[#ff5e00] text-white font-medium text-sm hover:bg-[#ff5e00]/90 hover:shadow-lg hover:shadow-[#ff5e00]/25 transition-all duration-200 disabled:opacity-50 flex items-center justify-center min-w-[120px]"
                                        >
                                            {careerStatus === "submitting" ? (
                                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                "Enviar"
                                            )}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isPrivacyOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        {/* Backdrop overlay */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsPrivacyOpen(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />

                        {/* Modal card */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="bg-white dark:bg-zinc-950 border border-gray-100 dark:border-zinc-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative z-10 overflow-hidden"
                        >
                            {/* Accent Glow Element */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#ff5e00]/20 to-transparent blur-2xl pointer-events-none rounded-full" />
                            
                            {/* Close button */}
                            <button
                                onClick={() => setIsPrivacyOpen(false)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>

                            {/* Header */}
                            <div className="flex items-center gap-2 mb-4">
                                <div className="relative w-8 h-8 overflow-hidden rounded-lg bg-[#ff5e00] p-[1px]">
                                    <div className="absolute inset-0 bg-white dark:bg-black rounded-lg flex items-center justify-center">
                                        <Shield className="w-5 h-5 text-[#ff5e00]" />
                                    </div>
                                </div>
                                <span className="font-bold text-lg text-gray-900 dark:text-white">
                                    Declaración de Privacidad
                                </span>
                            </div>

                            {/* Scrollable Content */}
                            <div className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-6 max-h-[60vh] overflow-y-auto pr-2 space-y-4">
                                <p className="font-medium text-gray-800 dark:text-gray-200">
                                    En NeoConta asumimos un compromiso absoluto con la transparencia, la seguridad de la información y el cumplimiento del marco regulatorio de la República Argentina.
                                </p>

                                <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-white text-xs uppercase tracking-wider mb-2">
                                        1. Protección de Datos Personales (Ley N° 25.326)
                                    </h4>
                                    <p className="mb-2">
                                        De conformidad con lo dispuesto por la Ley N° 25.326 de Protección de Datos Personales, sus normas reglamentarias y complementarias, le informamos que:
                                    </p>
                                    <ul className="list-disc pl-5 space-y-1.5">
                                        <li>
                                            <strong>Consentimiento Informado:</strong> Al ingresar sus datos en nuestros formularios o cargar su currículum vitae en la sección de Carreras, usted otorga su consentimiento previo, libre e informado (Art. 5 y 6) para el tratamiento de su información.
                                        </li>
                                        <li>
                                            <strong>Finalidad del Tratamiento:</strong> Los datos recopilados serán utilizados exclusivamente para los fines para los cuales fueron suministrados (evaluación de perfiles laborales, contacto institucional o provisión de servicios de consultoría administrativa y tecnológica).
                                        </li>
                                        <li>
                                            <strong>Deber de Seguridad y Confidencialidad:</strong> Implementamos estrictas medidas técnicas y organizativas para garantizar la seguridad de la información (Art. 9 de la Ley 25.326), evitando su pérdida, alteración o el acceso no autorizado por parte de terceros. Asimismo, mantenemos secreto profesional sobre sus datos (Art. 10).
                                        </li>
                                        <li>
                                            <strong>Derechos ARCO:</strong> Como titular de los datos, usted tiene el derecho legal de acceder de forma gratuita a sus datos personales (Art. 14), así como de solicitar su rectificación, actualización o supresión (Art. 16) mediante comunicación directa a nuestros canales oficiales de contacto.
                                        </li>
                                    </ul>
                                </div>

                                <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-white text-xs uppercase tracking-wider mb-2">
                                        2. Propiedad Intelectual y Limitación de Responsabilidad (Ley N° 22.362 y CCyCN)
                                    </h4>
                                    <ul className="list-disc pl-5 space-y-1.5">
                                        <li>
                                            <strong>Registro Marcario:</strong> NeoConta es titular exclusivo de los derechos de propiedad intelectual, marcas, logotipos y nombres comerciales asociados bajo los términos de la Ley de Marcas y Designaciones N° 22.362.
                                        </li>
                                        <li>
                                            <strong>Uso no Autorizado:</strong> Queda estrictamente prohibido el uso indebido de nuestra marca "NeoConta", nombre comercial, logotipos o cualquier otro signo identificatorio por parte de terceros no autorizados a su uso, incluyendo cualquier reproducción, imitación o explotación no autorizada. Cualquier infracción será pasible de las acciones y sanciones civiles y penales previstas en el Art. 31 de la Ley 22.362.
                                        </li>
                                        <li>
                                            <strong>Deslinde de Responsabilidad:</strong> Garantizamos el resguardo técnico y la seguridad de las plataformas digitales bajo nuestro control directo. Sin embargo, NeoConta declina expresamente toda responsabilidad por los daños y perjuicios de cualquier naturaleza que puedan derivarse del uso ilegal de nuestro nombre y marca por parte de terceros no autorizados (incluyendo ataques de suplantación de identidad o <em>phishing</em>, páginas web apócrifas, perfiles falsos en redes sociales o correos fraudulentos ajenos a nuestra organización). Instamos a los usuarios a constatar la legitimidad de toda comunicación mediante nuestros canales oficiales.
                                        </li>
                                    </ul>
                                </div>

                                <p className="text-xs text-gray-400 mt-4">
                                    Última actualización: Mayo de 2026.
                                </p>
                            </div>

                            {/* Close Action Button */}
                            <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-zinc-800">
                                <button
                                    onClick={() => setIsPrivacyOpen(false)}
                                    className="px-5 py-2 rounded-lg bg-[#ff5e00] text-white font-medium text-sm hover:bg-[#ff5e00]/90 hover:shadow-lg hover:shadow-[#ff5e00]/25 transition-all duration-200"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isTermsOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        {/* Backdrop overlay */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsTermsOpen(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />

                        {/* Modal card */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="bg-white dark:bg-zinc-950 border border-gray-100 dark:border-zinc-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative z-10 overflow-hidden"
                        >
                            {/* Accent Glow Element */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#ff5e00]/20 to-transparent blur-2xl pointer-events-none rounded-full" />
                            
                            {/* Close button */}
                            <button
                                onClick={() => setIsTermsOpen(false)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>

                            {/* Header */}
                            <div className="flex items-center gap-2 mb-4">
                                <div className="relative w-8 h-8 overflow-hidden rounded-lg bg-[#ff5e00] p-[1px]">
                                    <div className="absolute inset-0 bg-white dark:bg-black rounded-lg flex items-center justify-center">
                                        <FileText className="w-5 h-5 text-[#ff5e00]" />
                                    </div>
                                </div>
                                <span className="font-bold text-lg text-gray-900 dark:text-white">
                                    Términos y Condiciones
                                </span>
                            </div>

                            {/* Scrollable Content */}
                            <div className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-6 max-h-[60vh] overflow-y-auto pr-2 space-y-4">
                                <p className="font-medium text-gray-800 dark:text-gray-200">
                                    Bienvenido a NeoConta. Al acceder, navegar o utilizar nuestra plataforma digital y servicios de consultoría, usted acepta cumplir y estar sujeto a los siguientes Términos y Condiciones.
                                </p>

                                <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-white text-xs uppercase tracking-wider mb-2">
                                        1. Aceptación y Encuadre Legal (Arts. 984 a 989 del CCyCN)
                                    </h4>
                                    <p>
                                        Estos Términos y Condiciones constituyen un contrato de adhesión celebrado por medios electrónicos. Al interactuar con el sitio web o utilizar las herramientas de NeoConta, usted presta su libre conformidad con la totalidad de estas cláusulas, de acuerdo con los artículos 984, 985, 986 y concordantes del Código Civil y Comercial de la Nación Argentina.
                                    </p>
                                </div>

                                <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-white text-xs uppercase tracking-wider mb-2">
                                        2. Naturaleza y Alcance de los Servicios (Ley N° 24.240)
                                    </h4>
                                    <ul className="list-disc pl-5 space-y-1.5">
                                        <li>
                                            <strong>Objeto:</strong> NeoConta brinda una plataforma web de servicios digitales y soluciones basadas en Inteligencia Artificial para la optimización y automatización de procesos contables, administrativos y de gestión.
                                        </li>
                                        <li>
                                            <strong>Ausencia de Asesoramiento Matricular Directo:</strong> La plataforma y sus reportes actúan como herramientas de asistencia y automatización. No constituyen, en sí mismas, un reemplazo del dictamen profesional de contadores públicos matriculados según las normativas de los consejos profesionales locales.
                                        </li>
                                        <li>
                                            <strong>Deber de Información (Art. 4 de la Ley N° 24.240):</strong> Nos comprometemos a proveer de forma clara, detallada y gratuita toda la información sobre el funcionamiento de las herramientas y servicios brindados.
                                        </li>
                                    </ul>
                                </div>

                                <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-white text-xs uppercase tracking-wider mb-2">
                                        3. Contratación por Medios Electrónicos (Arts. 1105 a 1116 del CCyCN)
                                    </h4>
                                    <ul className="list-disc pl-5 space-y-1.5">
                                        <li>
                                            <strong>Perfeccionamiento:</strong> Los acuerdos y solicitudes de contacto/carrera se perfeccionan a distancia mediante medios electrónicos.
                                        </li>
                                        <li>
                                            <strong>Notificaciones:</strong> Todas las comunicaciones enviadas al correo electrónico consignado por el usuario o a través de la plataforma serán consideradas válidas y vinculantes.
                                        </li>
                                    </ul>
                                </div>

                                <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-white text-xs uppercase tracking-wider mb-2">
                                        4. Responsabilidades y Limitaciones de Servicio
                                    </h4>
                                    <ul className="list-disc pl-5 space-y-1.5">
                                        <li>
                                            <strong>Exactitud de los Datos:</strong> El usuario es exclusivamente responsable por la veracidad, licitud y exactitud de la información, facturas, CVs o datos bancarios que cargue o integre en el sistema.
                                        </li>
                                        <li>
                                            <strong>Disponibilidad del Servicio:</strong> Garantizamos la máxima diligencia técnica para el mantenimiento del sitio. Sin embargo, NeoConta no será responsable por interrupciones, demoras o errores causados por fallas en servicios externos ajenos a nuestro control directo (por ejemplo, interrupciones en los sistemas de AFIP/ARCA, plataformas bancarias integradas o fallas de red del proveedor de internet del usuario).
                                        </li>
                                        <li>
                                            <strong>Abuso y Cláusulas Nulas:</strong> En cumplimiento del artículo 1118 y concordantes del CCyCN y la Ley N° 24.240, cualquier cláusula de este documento que sea declarada nula o abusiva por la autoridad competente no afectará la validez del resto del acuerdo.
                                        </li>
                                    </ul>
                                </div>

                                <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-white text-xs uppercase tracking-wider mb-2">
                                        5. Ley Aplicable y Jurisdicción
                                    </h4>
                                    <p>
                                        Este acuerdo se rige por las leyes vigentes de la República Argentina. Para cualquier disputa que no pueda resolverse amigablemente, las partes se someten a la jurisdicción de los tribunales competentes en materia comercial de la República Argentina, salvaguardando los derechos de prórroga de jurisdicción y domicilio del consumidor establecidos en la Ley N° 24.240.
                                    </p>
                                </div>

                                <p className="text-xs text-gray-400 mt-4">
                                    Última actualización: Mayo de 2026.
                                </p>
                            </div>

                            {/* Close Action Button */}
                            <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-zinc-800">
                                <button
                                    onClick={() => setIsTermsOpen(false)}
                                    className="px-5 py-2 rounded-lg bg-[#ff5e00] text-white font-medium text-sm hover:bg-[#ff5e00]/90 hover:shadow-lg hover:shadow-[#ff5e00]/25 transition-all duration-200"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </footer>
    );
}
