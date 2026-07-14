"use client";

import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Link from "next/link";
import { User, Mail, Lock, Building, ArrowRight, CheckCircle } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Registro() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        nombre: "",
        email: "",
        password: "",
        confirmPassword: "",
        tipoUsuario: "recaudador",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
        setError("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccessMsg("");

        if (formData.password !== formData.confirmPassword) {
            setError("Las contraseñas no coinciden.");
            return;
        }

        setLoading(true);

        try {
            const res = await fetch("/api/auth/registro", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nombre: formData.nombre,
                    email: formData.email,
                    password: formData.password,
                    tipoUsuario: formData.tipoUsuario
                })
            });

            const data = await res.json();

            if (res.ok) {
                setSuccessMsg("¡Registro exitoso! Redirigiendo a inicio de sesión...");
                setTimeout(() => {
                    router.push("/login");
                }, 2000);
            } else {
                setError(data.error || "Ocurrió un error al registrarse.");
            }
        } catch (err) {
            console.error("Registration connection error:", err);
            setError("Error de conexión con el servidor.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-black font-sans text-slate-900 dark:text-slate-50">
            <Navbar />

            <main className="flex-grow flex items-center justify-center py-20 px-4 sm:px-6 lg:px-8">
                <div className="max-w-md w-full space-y-8 bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800">
                    <div className="text-center">
                        <h2 className="mt-6 text-3xl font-extrabold text-slate-900 dark:text-white">
                            Crear una cuenta
                        </h2>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                            Unete a NeoConta y optimiza tu gestión.
                        </p>
                    </div>

                    {error && (
                        <div className="bg-red-50 dark:bg-red-950/30 p-4 rounded-lg border border-red-100 dark:border-red-800 text-sm text-red-800 dark:text-red-300 animate-pulse">
                            <p className="font-semibold">Error:</p>
                            <p>{error}</p>
                        </div>
                    )}

                    {successMsg && (
                        <div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-lg border border-green-100 dark:border-green-800 text-sm text-green-800 dark:text-green-300 animate-bounce">
                            <p className="font-semibold">Éxito:</p>
                            <p>{successMsg}</p>
                        </div>
                    )}

                    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                        <div className="rounded-md shadow-sm -space-y-px">
                            {/* Nombre Completo */}
                            <div className="relative mb-4">
                                <label htmlFor="nombre" className="sr-only">Nombre Completo</label>
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <User className="h-5 w-5 text-slate-400" />
                                </div>
                                <input
                                    id="nombre"
                                    name="nombre"
                                    type="text"
                                    required
                                    className="appearance-none rounded-lg relative block w-full px-3 py-3 pl-10 border border-slate-300 dark:border-slate-700 placeholder-slate-500 text-slate-900 dark:text-white dark:bg-slate-800 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm transition-colors"
                                    placeholder="Nombre Completo"
                                    value={formData.nombre}
                                    onChange={handleChange}
                                />
                            </div>

                            {/* Email */}
                            <div className="relative mb-4">
                                <label htmlFor="email" className="sr-only">Correo Electrónico</label>
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-slate-400" />
                                </div>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    required
                                    className="appearance-none rounded-lg relative block w-full px-3 py-3 pl-10 border border-slate-300 dark:border-slate-700 placeholder-slate-500 text-slate-900 dark:text-white dark:bg-slate-800 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm transition-colors"
                                    placeholder="Correo Electrónico"
                                    value={formData.email}
                                    onChange={handleChange}
                                />
                            </div>

                            {/* Tipo de Usuario */}
                            <div className="relative mb-4">
                                <label htmlFor="tipoUsuario" className="sr-only">Tipo de Usuario</label>
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Building className="h-5 w-5 text-slate-400" />
                                </div>
                                <select
                                    id="tipoUsuario"
                                    name="tipoUsuario"
                                    className="appearance-none rounded-lg relative block w-full px-3 py-3 pl-10 border border-slate-300 dark:border-slate-700 placeholder-slate-500 text-slate-900 dark:text-white dark:bg-slate-800 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm transition-colors"
                                    value={formData.tipoUsuario}
                                    onChange={handleChange}
                                >
                                    <option value="recaudador">Recaudador</option>
                                    <option value="administrativo">Administrativo</option>
                                    <option value="legal">Legales</option>
                                </select>
                            </div>

                            {/* Contraseña */}
                            <div className="relative mb-4">
                                <label htmlFor="password" className="sr-only">Contraseña</label>
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-slate-400" />
                                </div>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    required
                                    className="appearance-none rounded-lg relative block w-full px-3 py-3 pl-10 border border-slate-300 dark:border-slate-700 placeholder-slate-500 text-slate-900 dark:text-white dark:bg-slate-800 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm transition-colors"
                                    placeholder="Contraseña"
                                    value={formData.password}
                                    onChange={handleChange}
                                />
                            </div>

                            {/* Confirmar Contraseña */}
                            <div className="relative mb-4">
                                <label htmlFor="confirmPassword" className="sr-only">Confirmar Contraseña</label>
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-slate-400" />
                                </div>
                                <input
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    type="password"
                                    required
                                    className="appearance-none rounded-lg relative block w-full px-3 py-3 pl-10 border border-slate-300 dark:border-slate-700 placeholder-slate-500 text-slate-900 dark:text-white dark:bg-slate-800 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm transition-colors"
                                    placeholder="Confirmar Contraseña"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <input
                                    id="remember-me"
                                    name="remember-me"
                                    type="checkbox"
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-900 dark:text-slate-300">
                                    Recordarme
                                </label>
                            </div>

                            <div className="text-sm">
                                <Link href="#" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400">
                                    ¿Olvidaste tu contraseña?
                                </Link>
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loading || successMsg}
                                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-lg shadow-blue-500/30 disabled:opacity-75 disabled:cursor-not-allowed"
                            >
                                <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                                    {loading ? (
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    ) : (
                                        <CheckCircle className="h-5 w-5 text-blue-500 group-hover:text-blue-400 transition-colors" aria-hidden="true" />
                                    )}
                                </span>
                                {loading ? "Registrando..." : "Registrarse"}
                            </button>
                        </div>

                        <div className="text-center mt-4">
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                ¿Ya tienes una cuenta?{" "}
                                <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400">
                                    Inicia sesión
                                </Link>
                            </p>
                        </div>
                    </form>
                </div>
            </main>

            <Footer />
        </div>
    );
}
