"use client";

import Link from "next/link";
import Image from "next/image"; // Import Image component
import { useState, useEffect } from "react";
import { Menu, X, ArrowRight, Box } from "lucide-react";


import { motion, AnimatePresence } from "framer-motion";

export default function Navbar({ hideUntilScroll = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed w-full z-50 transition-all duration-300 ${scrolled
        ? "bg-white/80 backdrop-blur-md shadow-sm dark:bg-black/80 opacity-100 translate-y-0"
        : hideUntilScroll
          ? "opacity-0 -translate-y-full pointer-events-none"
          : "bg-transparent text-white"
        }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <img src="/assets/navbar_logo.png" alt="NeoConta" className="h-10 w-auto object-contain" />
            </Link>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8">
            <Link
              href="/"
              className="text-sm font-medium text-gray-600 hover:text-[#ff5e00] dark:text-gray-300 dark:hover:text-[#ff5e00] transition-colors"
            >
              Inicio
            </Link>
            <Link
              href="#features"
              className="text-sm font-medium text-gray-600 hover:text-[#ff5e00] dark:text-gray-300 dark:hover:text-[#ff5e00] transition-colors"
            >
              Funcionalidades
            </Link>
            <Link
              href="#contact"
              className="text-sm font-medium text-gray-600 hover:text-[#ff5e00] dark:text-gray-300 dark:hover:text-[#ff5e00] transition-colors"
            >
              Contacto
            </Link>
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/registro"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors"
            >
              Registrarse
            </Link>
            <Link
              href="/login"
              className="group relative inline-flex h-10 items-center justify-center overflow-hidden rounded-lg bg-[#ff5e00] px-6 font-medium text-white transition-all duration-300 hover:bg-[#ff5e00]/90 hover:shadow-lg hover:shadow-[#ff5e00]/25"
            >
              <span className="mr-2">Iniciar Sesión</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800 transition-colors"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-t border-gray-100 dark:bg-black dark:border-gray-800"
          >
            <div className="px-4 pt-2 pb-6 space-y-2">
              <Link
                href="/"
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-[#ff5e00] hover:bg-orange-50 dark:text-gray-200 dark:hover:bg-orange-950/20 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                Inicio
              </Link>
              <Link
                href="#features"
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-[#ff5e00] hover:bg-orange-50 dark:text-gray-200 dark:hover:bg-orange-950/20 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                Funcionalidades
              </Link>
              <div className="pt-4 flex flex-col gap-3">
                <Link
                  href="/registro"
                  className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-700 hover:dark:bg-gray-700"
                  onClick={() => setIsOpen(false)}
                >
                  Registrarse
                </Link>
                <Link
                  href="/login"
                  className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-[#ff5e00] hover:bg-[#ff5e00]/90"
                  onClick={() => setIsOpen(false)}
                >
                  Iniciar Sesión
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
