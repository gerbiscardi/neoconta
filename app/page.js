"use client";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, BarChart3, ShieldCheck, Zap, Globe, Users, Building2, Mic, Video, Mail, Phone, User, MessageSquare, Send, CheckCircle2, AlertCircle, RefreshCw, Lightbulb } from "lucide-react";

export default function Home() {
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", message: "" });
  const [status, setStatus] = useState("idle"); // idle, submitting, success, error
  const [errorMessage, setErrorMessage] = useState("");

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (res.ok) {
        setStatus("success");
        setFormData({ name: "", email: "", phone: "", message: "" });
      } else {
        setStatus("error");
        setErrorMessage(data.error || "Ocurrió un error inesperado.");
      }
    } catch (err) {
      console.error(err);
      setStatus("error");
      setErrorMessage("No se pudo conectar con el servidor. Verifique su conexión.");
    }
  };
  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-[#160b24] font-sans text-slate-900 dark:text-slate-50">
      <Navbar hideUntilScroll={true} />

      <main className="flex-grow">
        {/* Fullscreen Hero Section */}
        <section className="relative h-screen flex items-center justify-center overflow-hidden">
          {/* Background Image */}
          <div className="absolute inset-0 z-0">
            <img
              src="/assets/hero-bg.jpg"
              alt="Background"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/35"></div> {/* Overlay for contrast */}
          </div>

          {/* Centered Logo & Brand Content */}
          <div className="relative z-10 flex flex-col items-center text-center px-4 max-w-4xl animate-fade-in-up">
            {/* H1 for Search Engine indexing (accessible layout, but fits design) */}
            <h1 className="sr-only">NeoConta - Sistema de gestión para emprendedores y profesionales</h1>
            
            <img
              src="/assets/logo-white.png"
              alt="NeoConta - Sistema de gestión para emprendedores"
              className="w-56 md:w-80 h-auto drop-shadow-2xl mb-14"
            />
            
            <div className="max-w-4xl px-2">
              <h2 className="text-3xl md:text-5xl font-light tracking-tight text-white mb-6 leading-tight max-w-4xl mx-auto">
                Menos tiempo administrando. <br />
                <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-[#ff4d00] to-[#ff9d00] md:whitespace-nowrap">
                  Más tiempo haciendo crecer tu negocio.
                </span>
              </h2>
              <p className="text-xs md:text-sm text-white mb-16 font-medium leading-relaxed max-w-2xl mx-auto">
                NeoConta es un sistema de gestión para emprendedores y profesionales que reúne las herramientas esenciales para organizar ingresos, gastos, clientes, presupuestos y resultados <span className="font-bold">en un solo lugar.</span>
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                <Link
                  href="/registro"
                  className="w-full sm:w-auto px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-orange-600/25 text-xs flex items-center justify-center gap-1.5"
                >
                  Probar NeoConta
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href="#features"
                  className="w-full sm:w-auto px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white/95 font-semibold rounded-xl border border-white/20 transition-all text-xs flex items-center justify-center"
                >
                  Conocé las herramientas
                </Link>
              </div>
            </div>
          </div>

          {/* Scroll Indicator */}
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-10 animate-bounce">
            <div className="w-8 h-12 border-2 border-white/50 rounded-full flex justify-center pt-2">
              <div className="w-1 h-3 bg-white rounded-full"></div>
            </div>
          </div>
        </section>

        {/* Original Hero Content (now secondary) */}
        <section className="relative py-24 lg:py-32 overflow-hidden bg-slate-50 dark:bg-[#1a0b2e]/50">
          <div className="absolute inset-0 -z-10">
            {/* Bright, colorful glowing orbs */}
            <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-blue-400/30 dark:bg-blue-600/20 rounded-full blur-[100px] opacity-70 animate-pulse"></div>
            <div className="absolute bottom-1/4 left-1/4 w-[600px] h-[600px] bg-purple-400/30 dark:bg-purple-600/20 rounded-full blur-[120px] opacity-70 animate-pulse" style={{animationDelay: '2s'}}></div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="bg-white/70 dark:bg-neutral-900/70 backdrop-blur-2xl rounded-3xl border border-white/50 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] overflow-hidden">
              <div className="grid lg:grid-cols-2 gap-0 items-center">
                {/* Text Content */}
                <div className="p-10 md:p-16 lg:pr-12">
                  <div className="inline-block px-5 py-2 rounded-full bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-bold text-sm mb-6 shadow-sm border border-violet-100 dark:border-violet-800/50 uppercase tracking-wider">
                    Nuestra Misión
                  </div>
                  <h2 className="text-4xl md:text-5xl font-semibold tracking-tight mb-6 text-slate-900 dark:text-white leading-tight">
                    Transformación <br/><span className="font-light text-transparent bg-clip-text bg-gradient-to-r from-[#ff5e00] to-violet-500 dark:to-violet-400">Inteligente</span>
                  </h2>
                  <p className="text-base md:text-lg text-slate-600 dark:text-slate-300 leading-relaxed text-left">
                    Integramos la experiencia en gestión de negocios con consultorías especializadas en Inteligencia Artificial. Transformamos la realidad de emprendedores y PyMES aplicando IA en áreas clave: desde la automatización de procesos operativos y financieros para lograr eficiencia escalable, hasta el desarrollo de estrategias de contenido y comunicación impulsadas por inteligencia artificial.
                  </p>
                </div>

                {/* Decorative Visual Element */}
                <div className="relative h-full min-h-[400px] hidden lg:flex items-center justify-center p-8 bg-[#1a0b2e]/30">
                   {/* Glowing background behind image */}
                   <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-to-tr from-[#ff5e00] to-violet-500 rounded-full opacity-20 blur-3xl animate-pulse"></div>
                   
                   {/* The Image Container (Square) */}
                   <div className="relative w-80 h-80 md:w-96 md:h-96 rounded-3xl overflow-hidden border border-white/10 shadow-[0_0_40px_rgba(255,94,0,0.15)] transform transition-transform hover:scale-105 duration-700">
                      {/* Image set as background to cover and crop to square automatically */}
                      <div className="absolute inset-0 bg-[url('/assets/ai-network.jpg')] bg-cover bg-center"></div>
                      
                      {/* Subtle overlay to blend with theme */}
                      <div className="absolute inset-0 bg-gradient-to-tr from-[#160b24]/80 via-transparent to-transparent"></div>
                      
                      {/* Glass reflection effect */}
                      <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-30"></div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 relative overflow-hidden bg-white dark:bg-[#160b24]">
          {/* Subtle Background Pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center max-w-3xl mx-auto mb-20">
              <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-slate-900 dark:text-white mb-6">
                El poder de la IA potenciando la <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff5e00] to-violet-500 dark:to-violet-400">Gestión de Negocios</span>
              </h2>
              <p className="text-xl text-slate-600 dark:text-slate-400">
                Implementamos soluciones de IA que potencian cada negocio eliminando tareas manuales repetitivas, dando espacio a aquellas con verdadero valor personal. Estructuramos la información y la convertimos en una auténtica ingeniería de datos, optimizando así la gestión integral de proyectos y organizaciones.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {[
                {
                  icon: <BarChart3 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />,
                  title: "Estrategia de IA para Negocios",
                  description: "Diagnosticamos tu empresa, tus procesos y tus objetivos para diseñar un plan concreto de incorporación de inteligencia artificial. Nada de humo futurista: identificamos dónde la IA puede ahorrar tiempo, reducir errores, mejorar decisiones y generar nuevas oportunidades de crecimiento. Resultado: una hoja de ruta clara para aplicar IA de forma práctica, rentable y escalable.",
                  gradient: "from-emerald-500 to-teal-400",
                  shadow: "hover:shadow-emerald-500/20",
                  iconBg: "bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800",
                  titleColor: "text-emerald-600 dark:text-emerald-400"
                },
                {
                  icon: <ShieldCheck className="h-8 w-8 text-blue-600 dark:text-blue-400" />,
                  title: "Automatización Inteligente",
                  description: "Diseñamos flujos automatizados con IA para reducir tareas repetitivas, conectar herramientas y optimizar la gestión diaria de tu organización. Desde carga de datos y reportes hasta respuestas automáticas, tableros, alertas y asistentes internos. Resultado: menos trabajo manual, más velocidad operativa y equipos enfocados en lo importante.",
                  gradient: "from-blue-500 to-indigo-400",
                  shadow: "hover:shadow-blue-500/20",
                  iconBg: "bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800",
                  titleColor: "text-blue-600 dark:text-blue-400"
                },
                {
                  icon: <Users className="h-8 w-8 text-rose-600 dark:text-rose-400" />,
                  title: "Commander©",
                  description: "Plataforma de Business Intelligence personalizada. Sin importar el tamaño de tu empresa, con Commander© tendrás toda la información clave al alcance de tu mano para dominar cada decisión de tu proyecto.",
                  gradient: "from-rose-500 to-pink-400",
                  shadow: "hover:shadow-rose-500/20",
                  iconBg: "bg-rose-100 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800",
                  titleColor: "text-rose-600 dark:text-rose-400"
                },
                {
                  icon: <Mic className="h-8 w-8 text-purple-600 dark:text-purple-400" />,
                  title: "Contenido y Cultura IA",
                  description: "Acompañamos a empresas, profesionales y equipos en el aprendizaje real de la inteligencia artificial. Diseñamos capacitaciones, guías de uso, contenidos estratégicos y metodologías para que la IA no sea una moda, sino una herramienta incorporada con criterio. Resultado: equipos más preparados, más autónomos y con menos miedo a usar tecnología.",
                  gradient: "from-purple-500 to-fuchsia-400",
                  shadow: "hover:shadow-purple-500/20",
                  iconBg: "bg-purple-100 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800",
                  titleColor: "text-purple-600 dark:text-purple-400"
                }
              ].map((feature, idx) => (
                <div key={idx} className={`group relative bg-white dark:bg-neutral-900/50 backdrop-blur-md p-10 rounded-3xl border border-slate-200 dark:border-neutral-800 shadow-lg hover:shadow-2xl ${feature.shadow} transition-all duration-300 hover:-translate-y-1 overflow-hidden`}>
                  {/* Hover Gradient Glow Bar */}
                  <div className={`absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r ${feature.gradient} transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out`}></div>
                  
                  <div className={`w-16 h-16 rounded-2xl ${feature.iconBg} flex items-center justify-center mb-8 shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                    {feature.icon}
                  </div>
                  <h3 className={`text-2xl font-bold mb-4 ${feature.titleColor} transition-colors duration-300`}>{feature.title}</h3>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-base">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-24 bg-white dark:bg-[#160b24] border-y border-slate-100 dark:border-[#2a1b3d]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {[
                { label: "Clientes Acompañados", value: "10+", icon: <Users className="h-5 w-5 mx-auto mb-2 text-slate-400" /> },
                { label: "Procesos Repensados", value: "30+", icon: <RefreshCw className="h-5 w-5 mx-auto mb-2 text-slate-400" /> },
                { label: "Soluciones Brindadas", value: "15+", icon: <Lightbulb className="h-5 w-5 mx-auto mb-2 text-slate-400" /> },
                { label: "Personalización", value: "100%", icon: <ShieldCheck className="h-5 w-5 mx-auto mb-2 text-slate-400" /> },
              ].map((stat, idx) => (
                <div key={idx} className="p-4">
                  {stat.icon}
                  <div className="text-4xl font-bold text-slate-900 dark:text-white mb-1">{stat.value}</div>
                  <div className="text-sm font-medium text-slate-500 uppercase tracking-wide">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="py-24 relative overflow-hidden bg-slate-50 dark:bg-[#1a0b2e]/30">
          {/* Decorative Glowing Ambient Light */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-[#ff5e00]/10 to-violet-500/10 rounded-full blur-[100px] opacity-70 animate-pulse"></div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-slate-900 dark:text-white mb-4">
                ¿Hablamos de tu <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff5e00] to-violet-500 dark:to-violet-400">proyecto?</span>
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400">
                Dejanos tu consulta y un especialista en Inteligencia Artificial y gestión se pondrá en contacto con vos a la brevedad.
              </p>
            </div>

            <div className="max-w-xl mx-auto">
              <div className="bg-white/80 dark:bg-neutral-900/60 backdrop-blur-xl rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl p-8 md:p-10">
                {status === "success" ? (
                  <div className="text-center py-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 mb-6 border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">¡Mensaje Enviado!</h3>
                    <p className="text-slate-600 dark:text-slate-400 mb-8">
                      Gracias por contactarnos. Tu mensaje ha sido recibido con éxito y nos comunicaremos con vos a la brevedad.
                    </p>
                    <button
                      onClick={() => setStatus("idle")}
                      className="px-6 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer"
                    >
                      Enviar otro mensaje
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {status === "error" && (
                      <div className="flex items-center gap-3 p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/30 text-rose-700 dark:text-rose-400 rounded-2xl">
                        <AlertCircle className="h-5 w-5 flex-shrink-0" />
                        <p className="text-sm font-medium">{errorMessage}</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label htmlFor="name" className="text-sm font-semibold text-slate-700 dark:text-slate-300 block">
                        Nombre completo
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                          <User className="h-5 w-5" />
                        </span>
                        <input
                          type="text"
                          id="name"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          disabled={status === "submitting"}
                          required
                          placeholder="Juan Pérez"
                          className="w-full pl-11 pr-4 py-3 bg-white dark:bg-neutral-800/50 border border-slate-200 dark:border-neutral-700 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ff5e00]/50 dark:focus:ring-[#ff5e00]/30 focus:border-[#ff5e00] transition-all duration-200"
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label htmlFor="email" className="text-sm font-semibold text-slate-700 dark:text-slate-300 block">
                          Correo electrónico
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                            <Mail className="h-5 w-5" />
                          </span>
                          <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            disabled={status === "submitting"}
                            required
                            placeholder="juan@ejemplo.com"
                            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-neutral-800/50 border border-slate-200 dark:border-neutral-700 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ff5e00]/50 dark:focus:ring-[#ff5e00]/30 focus:border-[#ff5e00] transition-all duration-200"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="phone" className="text-sm font-semibold text-slate-700 dark:text-slate-300 block">
                          Celular / Teléfono
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                            <Phone className="h-5 w-5" />
                          </span>
                          <input
                            type="tel"
                            id="phone"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            disabled={status === "submitting"}
                            placeholder="+54 9 11 1234 5678"
                            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-neutral-800/50 border border-slate-200 dark:border-neutral-700 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ff5e00]/50 dark:focus:ring-[#ff5e00]/30 focus:border-[#ff5e00] transition-all duration-200"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="message" className="text-sm font-semibold text-slate-700 dark:text-slate-300 block">
                        Mensaje
                      </label>
                      <div className="relative">
                        <span className="absolute top-3 left-4 text-slate-400">
                          <MessageSquare className="h-5 w-5" />
                        </span>
                        <textarea
                          id="message"
                          name="message"
                          value={formData.message}
                          onChange={handleChange}
                          disabled={status === "submitting"}
                          required
                          rows={4}
                          placeholder="Hola, me gustaría saber más sobre cómo implementar IA en mi empresa..."
                          className="w-full pl-11 pr-4 py-3 bg-white dark:bg-neutral-800/50 border border-slate-200 dark:border-neutral-700 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ff5e00]/50 dark:focus:ring-[#ff5e00]/30 focus:border-[#ff5e00] transition-all duration-200 resize-none"
                        ></textarea>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={status === "submitting"}
                      className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#ff5e00] to-violet-600 dark:to-violet-500 text-white font-bold text-lg flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-75 disabled:pointer-events-none transition-all duration-200 shadow-lg hover:shadow-xl hover:shadow-[#ff5e00]/10 cursor-pointer"
                    >
                      {status === "submitting" ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send className="h-5 w-5" />
                          Enviar mensaje
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
