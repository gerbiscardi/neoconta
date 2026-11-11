import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import prisma from '@/lib/db';
import { getServerSession, sanitizeUserId } from '@/lib/auth';
import { signAppointmentToken } from '@/lib/publicTokens';
import { getUsersRootDir } from '@/lib/dataPaths';

let isCronRunning = false;

function timingSafeSecretMatch(provided, expected) {
    if (!provided || !expected) return false;
    const hashA = crypto.createHash('sha256').update(String(provided)).digest();
    const hashB = crypto.createHash('sha256').update(String(expected)).digest();
    return crypto.timingSafeEqual(hashA, hashB);
}

export async function GET(request) {
    if (isCronRunning) {
        return NextResponse.json({ success: false, message: 'El cron de recordatorios ya se encuentra en ejecución en segundo plano.' }, { status: 429 });
    }

    try {
        isCronRunning = true;
        const cronSecret = process.env.CRON_SECRET && process.env.CRON_SECRET.trim();
        const { searchParams } = new URL(request.url);
        const secretParam = searchParams.get('secret');
        const authHeader = request.headers.get('authorization') || '';
        const bearerSecret = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;

        if (!cronSecret) {
            return NextResponse.json(
                { error: 'Servicio técnico de cron no configurado (CRON_SECRET requerido).' },
                { status: 503 }
            );
        }

        const isAuthorizedSecret =
            timingSafeSecretMatch(bearerSecret, cronSecret) ||
            timingSafeSecretMatch(secretParam, cronSecret);

        if (!isAuthorizedSecret) {
            const session = await getServerSession(request);
            if (session) {
                return NextResponse.json(
                    { error: 'Acceso denegado: la sesión web (incluido Owner) no puede consultar recordatorios clínicos identificables entre consultorios.' },
                    { status: 403 }
                );
            }
            return NextResponse.json({ error: 'Acceso no autorizado al servicio de recordatorios' }, { status: 401 });
        }

        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        const origin = process.env.NEXT_PUBLIC_APP_URL || 'https://neoconta.com.ar';
        const seenIds = new Set();
        const reminders = [];

        const pushReminder = (userId, app) => {
            const safeTenant = sanitizeUserId(userId);
            if (!safeTenant || seenIds.has(app.id)) return;
            seenIds.add(app.id);

            const cleanPhone = (app.patientPhone || '').replace(/[^0-9]/g, '');
            const formattedPhone = cleanPhone.length === 10 ? `549${cleanPhone}` : cleanPhone;

            const token = signAppointmentToken(safeTenant, app.id);
            const confirmUrl = `${origin}/confirmar-turno/${app.id}?token=${encodeURIComponent(token)}`;
            const placeName = app.professionalName ? `Consultorio ${app.professionalName}` : 'nuestro Consultorio';

            const message = `Hola *${app.patientName}*, te recordamos tu turno médico para mañana *${app.date.split('-').reverse().join('/')}* a las *${app.time} hs* con el/la *${app.professionalName}* (${app.professionalSpecialty || 'Médico'}).\n\nPor favor confirma o gestiona tu asistencia ingresando al siguiente enlace:\n${confirmUrl}\n\n¡Te esperamos en ${placeName}!`;
            const whatsappUrl = formattedPhone ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}` : null;

            reminders.push({
                userId: safeTenant,
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
        };

        // 1. Prisma appointments
        const prismaUpcoming = await prisma.appointment.findMany({
            where: {
                date: tomorrowStr,
                status: { in: ['reservado', 'confirmado'] }
            }
        });
        for (const app of prismaUpcoming) {
            pushReminder(app.userId, app);
        }

        // 2. Legacy JSON fallback
        const usersDir = getUsersRootDir();
        try {
            const userFolders = await fs.readdir(usersDir);
            for (const userId of userFolders) {
                const appointmentsPath = path.join(usersDir, userId, 'vitacore', 'appointments.json');
                try {
                    const data = await fs.readFile(appointmentsPath, 'utf-8');
                    const appointments = JSON.parse(data);
                    for (const app of appointments) {
                        if (app.date === tomorrowStr && (app.status === 'reservado' || app.status === 'confirmado')) {
                            pushReminder(userId, app);
                        }
                    }
                } catch {
                    // Ignore missing file
                }
            }
        } catch {
            // No legacy folder
        }

        return NextResponse.json({
            success: true,
            targetDate: tomorrowStr,
            totalReminders: reminders.length,
            reminders
        });
    } catch (error) {
        console.error('Error in /api/vitacore/cron/whatsapp-reminders:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    } finally {
        isCronRunning = false;
    }
}
