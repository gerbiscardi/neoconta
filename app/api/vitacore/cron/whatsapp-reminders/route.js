import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request) {
    try {
        const usersDir = path.join(process.cwd(), 'data', 'users');
        let userFolders = [];
        try {
            userFolders = await fs.readdir(usersDir);
        } catch (e) {
            return NextResponse.json({ success: true, reminders: [], message: 'No hay usuarios registrados.' });
        }

        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        const reminders = [];

        for (const userId of userFolders) {
            const appointmentsPath = path.join(usersDir, userId, 'vitacore', 'appointments.json');
            try {
                const data = await fs.readFile(appointmentsPath, 'utf-8');
                const appointments = JSON.parse(data);

                const upcoming = appointments.filter(app => {
                    return app.date === tomorrowStr && (app.status === 'reservado' || app.status === 'confirmado');
                });

                for (const app of upcoming) {
                    const cleanPhone = (app.patientPhone || '').replace(/[^0-9]/g, '');
                    const formattedPhone = cleanPhone.length === 10 ? `549${cleanPhone}` : cleanPhone;

                    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://neoconta.com.ar';
                    const confirmUrl = `${origin}/confirmar-turno/${app.id}?userId=${userId}`;

                    const placeName = app.professionalName ? `Consultorio ${app.professionalName}` : "nuestro Consultorio";

                    const message = `Hola *${app.patientName}*, te recordamos tu turno médico para mañana *${app.date.split('-').reverse().join('/')}* a las *${app.time} hs* con el/la *${app.professionalName}* (${app.professionalSpecialty || 'Médico'}).\n\nPor favor confirma o gestiona tu asistencia ingresando al siguiente enlace:\n${confirmUrl}\n\n¡Te esperamos en ${placeName}!`;

                    const whatsappUrl = formattedPhone ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}` : null;

                    reminders.push({
                        userId,
                        appointmentId: app.id,
                        patientName: app.patientName,
                        patientPhone: app.patientPhone,
                        date: app.date,
                        time: app.time,
                        professionalName: app.professionalName,
                        status: app.status,
                        whatsappUrl,
                        message
                    });
                }
            } catch (err) {
                // Ignore missing file or invalid json for a particular user
            }
        }

        return NextResponse.json({
            success: true,
            targetDate: tomorrowStr,
            totalReminders: reminders.length,
            reminders
        });
    } catch (error) {
        console.error("Error in /api/vitacore/cron/whatsapp-reminders:", error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
