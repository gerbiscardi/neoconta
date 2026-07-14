'use client';

import { motion } from 'framer-motion';

export default function Hero() {
    return (
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-900">
            {/* Background Gradients */}
            <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
            <div className="absolute top-0 -right-4 w-72 h-72 bg-yellow-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>

            <div className="relative z-10 text-center px-4">
                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="text-6xl md:text-8xl font-bold text-white mb-6 tracking-tight"
                >
                    NeoConta
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="text-xl md:text-2xl text-slate-300 max-w-2xl mx-auto"
                >
                    Soluciones contables digitales para el futuro de tu negocio.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    className="mt-10"
                >
                    <a
                        href="#servicios"
                        className="px-8 py-3 bg-white text-slate-900 rounded-full font-semibold hover:bg-slate-100 transition-colors duration-300"
                    >
                        Descubrir Servicios
                    </a>
                </motion.div>
            </div>
        </div>
    );
}
