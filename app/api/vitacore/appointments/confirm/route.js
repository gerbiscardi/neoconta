import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import prisma from '@/lib/db';
import { sanitizeUserId } from '@/lib/auth';
import { verifyAppointmentToken } from '@/lib/publicTokens';
import { getClientIp, appointmentsConfirmLimiter, rateLimitResponse } from '@/lib/rateLimit';

function sanitizePublicAppointment(app) {
    const rawName = String(app.patientName || '').trim();
    const parts = rawName.split(/\s+/);
    const displayName = parts.length > 1
        ? `${parts[0]} ${parts[1][0]}.`
        : rawName;

    return {
        id: app.id,
        patientName: displayName,
        date: app.date,
        time: app.time,
        consultationType: app.consultationType || 'Consulta General',
        professionalName: app.professionalName || 'Profesional',
        professionalSpecialty: app.professionalSpecialty || '',
        status: app.status
    };
}

export async function GET(request) {
    try {
        const ip = getClientIp(request);
        const limitCheck = appointmentsConfirmLimiter.check(ip);
        if (!limitCheck.allowed) {
            return rateLimitResponse(limitCheck, 'Ha realizado demasiadas consultas de turnos en poco tiempo.');
        }

        const { searchParams } = new URL(request.url);
        const appointmentId = searchParams.get('id');
        const token = searchParams.get('token');

        if (!appointmentId) {
            return NextResponse.json({ error: 'ID de turno requerido' }, { status: 400 });
        }
        if (!token) {
            return NextResponse.json({ error: 'Token de confirmación requerido' }, { status: 401 });
        }

        const verified = verifyAppointmentToken(token, appointmentId);
        if (!verified) {
            return NextResponse.json({ error: 'Enlace de confirmación inválido o expirado' }, { status: 403 });
        }

        const tenantId = sanitizeUserId(verified.tenantId);
        if (!tenantId) {
            return NextResponse.json({ error: 'Organización inválida en el token' }, { status: 403 });
        }

        // Primary lookup in Prisma scoped strictly to tenantId
        const prismaApp = await prisma.appointment.findFirst({
            where: { id: String(appointmentId), userId: tenantId }
        });
        if (prismaApp) {
            return NextResponse.json({ success: true, appointment: sanitizePublicAppointment(prismaApp) });
        }

        // Legacy fallback scoped strictly to tenantId (never scans other tenant folders)
        const filePath = path.join(process.cwd(), 'data', 'users', tenantId, 'vitacore', 'appointments.json');
        try {
            const data = await fs.readFile(filePath, 'utf-8');
            const appointments = JSON.parse(data);
            const found = appointments.find(a => a.id === appointmentId);
            if (found) {
                return NextResponse.json({ success: true, appointment: sanitizePublicAppointment(found) });
            }
        } catch {
            // File absent
        }

        return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
    } catch (error) {
        console.error('Error in /api/vitacore/appointments/confirm GET:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const ip = getClientIp(request);
        const limitCheck = appointmentsConfirmLimiter.check(ip);
        if (!limitCheck.allowed) {
            return rateLimitResponse(limitCheck, 'Ha realizado demasiadas operaciones de turnos en poco tiempo.');
        }

        const body = await request.json();
        const { appointmentId, action, token } = body || {};

        if (!appointmentId || !action) {
            return NextResponse.json({ error: 'appointmentId y action son requeridos' }, { status: 400 });
        }
        if (action !== 'confirm' && action !== 'cancel') {
            return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
        }
        if (!token) {
            return NextResponse.json({ error: 'Token de confirmación requerido' }, { status: 401 });
        }

        const verified = verifyAppointmentToken(token, appointmentId);
        if (!verified) {
            return NextResponse.json({ error: 'Enlace de confirmación inválido o expirado' }, { status: 403 });
        }

        const tenantId = sanitizeUserId(verified.tenantId);
        if (!tenantId) {
            return NextResponse.json({ error: 'Organización inválida en el token' }, { status: 403 });
        }

        const newStatus = action === 'confirm' ? 'confirmado' : 'cancelado';

        const prismaApp = await prisma.appointment.findFirst({
            where: { id: String(appointmentId), userId: tenantId }
        });
        if (prismaApp) {
            const updated = await prisma.appointment.update({
                where: { id: prismaApp.id },
                data: { status: newStatus }
            });
            return NextResponse.json({
                success: true,
                message: action === 'confirm' ? 'Turno confirmado con éxito' : 'Turno cancelado',
                appointment: sanitizePublicAppointment(updated)
            });
        }

        const filePath = path.join(process.cwd(), 'data', 'users', tenantId, 'vitacore', 'appointments.json');
        let appointments = [];
        try {
            const data = await fs.readFile(filePath, 'utf-8');
            appointments = JSON.parse(data);
        } catch {
            return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
        }

        const index = appointments.findIndex(a => a.id === appointmentId);
        if (index === -1) {
            return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
        }

        appointments[index].status = newStatus;
        appointments[index].updatedAt = new Date().toISOString();
        await fs.writeFile(filePath, JSON.stringify(appointments, null, 2), 'utf-8');

        return NextResponse.json({
            success: true,
            message: action === 'confirm' ? 'Turno confirmado con éxito' : 'Turno cancelado',
            appointment: sanitizePublicAppointment(appointments[index])
        });
    } catch (error) {
        console.error('Error in /api/vitacore/appointments/confirm POST:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
