"use client";

import Link from "next/link";
import { Mail, Lock, ArrowRight, CheckCircle } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        email: "",
        password: "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
        setError(""); // Clear error on change
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: formData.email,
                    password: formData.password
                })
            });

            const data = await res.json();

            if (res.ok) {
                localStorage.setItem('neoconta_user', JSON.stringify(data.user));
                router.push("/dashboard");
            } else {
                setError(data.error || "Ocurrió un error al iniciar sesión.");
            }
        } catch (err) {
            console.error("Login connection error:", err);
            setError("Error de conexión con el servidor.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-black font-sans text-slate-900 dark:text-slate-50">
            {/* Simple Header with Logo */}
            <div className="absolute top-0 left-0 p-6">
                <Link href="/">
                    <img src="/assets/navbar_logo.png" alt="NeoConta" className="h-8 w-auto" />
                </Link>
            </div>

            <main className="flex-grow flex items-center justify-center py-20 px-4 sm:px-6 lg:px-8">
                <div className="max-w-md w-full space-y-8 bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800">
                    <div className="text-center">
                        <h2 className="mt-6 text-3xl font-extrabold text-slate-900 dark:text-white">
                            Bienvenido de nuevo
                        </h2>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                            Ingresa a tu cuenta para continuar.
                        </p>
                    </div>

                    {error && (
                        <div className="bg-red-50 dark:bg-red-950/30 p-4 rounded-lg border border-red-100 dark:border-red-800 text-sm text-red-800 dark:text-red-300 animate-pulse">
                            <p className="font-semibold">Error:</p>
                            <p>{error}</p>
                        </div>
                    )}

                    <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-300 space-y-1">
                        <p className="font-semibold text-sm">Cuentas de Prueba:</p>
                        <p>🔑 <strong>Dueño:</strong> admin@neoconta.com / admin123</p>
                        <p>🔑 <strong>Cliente:</strong> cliente@neoconta.com / cliente123</p>
                        <p>🔑 <strong>No Cliente:</strong> nocli@neoconta.com / nocli123</p>
                    </div>

                    <form className="mt-8 space-y-6" onSubmit={handleLogin}>
                        <div className="rounded-md shadow-sm -space-y-px">
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
                                disabled={loading}
                                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-lg shadow-blue-500/30 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                                    {loading ? (
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    ) : (
                                        <ArrowRight className="h-5 w-5 text-blue-500 group-hover:text-blue-400 transition-colors" />
                                    )}
                                </span>
                                {loading ? "Iniciando..." : "Iniciar Sesión"}
                            </button>
                        </div>

                        <div className="text-center mt-4">
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                ¿No tienes una cuenta?{" "}
                                <Link href="/registro" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400">
                                    Regístrate aquí
                                </Link>
                            </p>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
}
