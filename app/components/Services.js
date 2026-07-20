'use client';

import { motion } from 'framer-motion';
import { FileText, PieChart, Users, Zap } from 'lucide-react';

const services = [
    {
        icon: <FileText className="w-8 h-8" />,
        title: "Facturación Masiva ARCA / AFIP",
        description: "Automatiza la emisión de comprobantes electrónicos con conexión directa a ARCA/AFIP."
    },
    {
        icon: <Users className="w-8 h-8" />,
        title: "Historia Clínica Digital",
        description: "Plataforma Vitacore para gestión médica de pacientes, evoluciones clínicas y recetas digitales."
    },
    {
        icon: <PieChart className="w-8 h-8" />,
        title: "Commander© Business Intelligence",
        description: "Tableros de control en tiempo real para visualizar ingresos, gastos e indicadores de tu negocio."
    },
    {
        icon: <Zap className="w-8 h-8" />,
        title: "Gestión Bancaria & Automatización IA",
        description: "Conciliación bancaria y flujo de caja automatizado mediante inteligencia artificial."
    }
];

export default function Services() {
    return (
        <section id="servicios" className="py-20 bg-slate-900">
            <div className="container mx-auto px-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <h2 className="text-4xl font-bold text-white mb-4">Nuestros Servicios</h2>
                    <p className="text-slate-400 max-w-2xl mx-auto">
                        Hacemos que la contabilidad sea simple, moderna y eficiente.
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {services.map((service, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            viewport={{ once: true }}
                            className="bg-slate-800 p-6 rounded-2xl hover:bg-slate-700 transition-colors duration-300 border border-slate-700"
                        >
                            <div className="text-purple-400 mb-4">{service.icon}</div>
                            <h3 className="text-xl font-bold text-white mb-2">{service.title}</h3>
                            <p className="text-slate-400">{service.description}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
