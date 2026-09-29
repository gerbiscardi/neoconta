"use client";
import { useEffect } from "react";

export function useKeyboardShortcuts(shortcuts = {}) {
    useEffect(() => {
        const handleKeyDown = (e) => {
            const isCtrlOrCmd = e.ctrlKey || e.metaKey;

            if (!isCtrlOrCmd) return;

            const key = e.key.toLowerCase();

            if (key === 'k' && shortcuts.onSearch) {
                e.preventDefault();
                shortcuts.onSearch();
            } else if (key === 'n' && shortcuts.onNewPatient) {
                e.preventDefault();
                shortcuts.onNewPatient();
            } else if (key === 't' && shortcuts.onNewAppointment) {
                e.preventDefault();
                shortcuts.onNewAppointment();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [shortcuts]);
}
