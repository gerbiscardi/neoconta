import { NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import prisma from '@/lib/db';
import { sanitizeUserId } from '@/lib/auth';
import { verifyAppointmentToken } from '@/lib/publicTokens';
import { getClientIp, appointmentsConfirmLimiter, legacyAppointmentLimiter, rateLimitResponse } from '@/lib/rateLimit';

function timingSafeDigitsMatch(a, b) {
    const d1 = String(a || '').replace(/\D/g, '');
    const d2 = String(b || '').replace(/\D/g, '');
    if (d1.length !== 4 || d2.length !== 4) return false;
    return crypto.timingSafeEqual(Buffer.from(d1, 'utf8'), Buffer.from(d2, 'utf8'));
}

async function resolveLegacyAppointment(appointmentId, requestedUserId, phoneLast4) {
    const cleanLast4 = String(phoneLast4 || '').replace(/\D/g, '');
    if (cleanLast4.length !== 4) return { error: 'Debe ingresar los últimos 4 dígitos del teléfono registrado.', status: 400 };

    const safeTenant = requestedUserId ? sanitizeUserId(requestedUserId) : null;
    let record = await prisma.appointment.findFirst({
        where: {
            id: String(appointmentId),
            ...(safeTenant ? { userId: safeTenant } : {})
        }
    });

    let sourceType = 'prisma';
    let jsonPath = null;
    let jsonList = null;

    if (!record && safeTenant) {
        jsonPath = path.join(process.cwd(), 'data', 'users', safeTenant, 'vitacore', 'appointments.json');
        try {
            const raw = await fs.readFile(jsonPath, 'utf-8');
            jsonList = JSON.parse(raw);
            record = Array.isArray(jsonList) ? jsonList.find(a => a.id === appointmentId) : null;
            sourceType = 'json';
        } catch {
            record = null;
        }
    }

    if (!record) {
        return { error: 'No se pudo verificar el turno. Solicitá un nuevo enlace al consultorio.', status: 403 };
    }

    const storedDigits = String(record.patientPhone || '').replace(/\D/g, '');
    if (storedDigits.length < 4 || !timingSafeDigitsMatch(storedDigits.slice(-4), cleanLast4)) {
        return { error: 'Verificación fallida: los dígitos ingresados no coinciden con el teléfono del turno.', status: 403 };
    }

    return { record, sourceType, jsonPath, jsonList };
}

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
        const phoneLast4 = searchParams.get('phoneLast4');
        const requestedUserId = searchParams.get('userId');

        if (!appointmentId) {
            return NextResponse.json({ error: 'ID de turno requerido' }, { status: 400 });
        }

        if (!token) {
            if (!phoneLast4) {
                return NextResponse.json({
                    requiresLegacyVerification: true,
                    error: 'Enlace heredado: verificá los últimos 4 dígitos de tu teléfono para ver el turno.'
                }, { status: 401 });
            }

            const legacyLimit = legacyAppointmentLimiter.check(`${ip}:legacy:${appointmentId}`);
            if (!legacyLimit.allowed) {
                return rateLimitResponse(legacyLimit, 'Demasiados intentos de verificación para este turno. Solicitá un nuevo enlace al consultorio.');
            }

            const resolved = await resolveLegacyAppointment(appointmentId, requestedUserId, phoneLast4);
            if (resolved.error) {
                return NextResponse.json({ error: resolved.error, requiresLegacyVerification: true }, { status: resolved.status });
            }
            return NextResponse.json({ success: true, appointment: sanitizePublicAppointment(resolved.record) });
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
        const { appointmentId, action, token, phoneLast4, userId: requestedUserId } = body || {};

        if (!appointmentId || !action) {
            return NextResponse.json({ error: 'appointmentId y action son requeridos' }, { status: 400 });
        }
        if (action !== 'confirm' && action !== 'cancel') {
            return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
        }

        const newStatus = action === 'confirm' ? 'confirmado' : 'cancelado';

        if (!token) {
            if (!phoneLast4) {
                return NextResponse.json({
                    requiresLegacyVerification: true,
                    error: 'Token de confirmación requerido (o verificación telefónica para enlaces heredados).'
                }, { status: 401 });
            }

            const legacyLimit = legacyAppointmentLimiter.check(`${ip}:legacy:${appointmentId}`);
            if (!legacyLimit.allowed) {
                return rateLimitResponse(legacyLimit, 'Demasiados intentos de verificación para este turno.');
            }

            const resolved = await resolveLegacyAppointment(appointmentId, requestedUserId, phoneLast4);
            if (resolved.error) {
                return NextResponse.json({ error: resolved.error, requiresLegacyVerification: true }, { status: resolved.status });
            }

            if (resolved.sourceType === 'prisma') {
                const updated = await prisma.appointment.update({
                    where: { id: resolved.record.id },
                    data: { status: newStatus }
                });
                return NextResponse.json({
                    success: true,
                    message: action === 'confirm' ? 'Turno confirmado con éxito' : 'Turno cancelado',
                    appointment: sanitizePublicAppointment(updated)
                });
            }

            const idx = resolved.jsonList.findIndex(a => a.id === appointmentId);
            resolved.jsonList[idx].status = newStatus;
            resolved.jsonList[idx].updatedAt = new Date().toISOString();
            await fs.writeFile(resolved.jsonPath, JSON.stringify(resolved.jsonList, null, 2), 'utf-8');
            return NextResponse.json({
                success: true,
                message: action === 'confirm' ? 'Turno confirmado con éxito' : 'Turno cancelado',
                appointment: sanitizePublicAppointment(resolved.jsonList[idx])
            });
        }

        const verified = verifyAppointmentToken(token, appointmentId);
        if (!verified) {
            return NextResponse.json({ error: 'Enlace de confirmación inválido o expirado' }, { status: 403 });
        }

        const tenantId = sanitizeUserId(verified.tenantId);
        if (!tenantId) {
            return NextResponse.json({ error: 'Organización inválida en el token' }, { status: 403 });
        }

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
