import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getServerSession, authorizeTenantAccess } from '@/lib/auth';
import { signAppointmentToken } from '@/lib/publicTokens';

function attachConfirmToken(tenantId, app) {
    return {
        ...app,
        confirmToken: signAppointmentToken(tenantId, app.id)
    };
}

export async function GET(request) {
    try {
        const session = await getServerSession(request);
        const { searchParams } = new URL(request.url);
        const auth = authorizeTenantAccess(session, searchParams.get('userId'));
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const userId = auth.tenantId;
        const date = searchParams.get('date');
        const professionalId = searchParams.get('professionalId');
        const patientId = searchParams.get('patientId');
        const search = searchParams.get('search') || '';
        const pageParam = searchParams.get('page');
        const limitParam = searchParams.get('limit');

        const where = {
            userId,
            ...(date ? { date } : {}),
            ...(professionalId ? { professionalId } : {}),
            ...(patientId ? { patientId } : {}),
            ...(search ? {
                OR: [
                    { patientName: { contains: search } },
                    { patientPhone: { contains: search } },
                    { reason: { contains: search } },
                    { consultationType: { contains: search } }
                ]
            } : {})
        };

        if (pageParam || limitParam) {
            const page = Math.max(1, parseInt(pageParam || '1', 10));
            const limit = Math.min(100, Math.max(1, parseInt(limitParam || '10', 10)));
            const skip = (page - 1) * limit;

            const [total, appointments] = await Promise.all([
                prisma.appointment.count({ where }),
                prisma.appointment.findMany({
                    where,
                    orderBy: [{ date: 'asc' }, { time: 'asc' }],
                    skip,
                    take: limit
                })
            ]);

            const totalPages = Math.ceil(total / limit) || 1;
            return NextResponse.json({
                success: true,
                appointments: appointments.map(a => attachConfirmToken(userId, a)),
                total,
                totalPages,
                page,
                limit
            });
        }

        const appointments = await prisma.appointment.findMany({
            where,
            orderBy: [{ date: 'asc' }, { time: 'asc' }]
        });

        return NextResponse.json({
            success: true,
            appointments: appointments.map(a => attachConfirmToken(userId, a)),
            total: appointments.length,
            totalPages: 1,
            page: 1,
            limit: appointments.length
        });
    } catch (error) {
        console.error('Error in /api/vitacore/appointments GET:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const session = await getServerSession(request);
        const body = await request.json();
        const { userId: requestedUserId, appointment } = body || {};

        const auth = authorizeTenantAccess(session, requestedUserId);
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        if (!appointment || !String(appointment.patientName || '').trim() || !appointment.date || !appointment.time) {
            return NextResponse.json({ error: 'Faltan campos obligatorios (paciente, fecha, hora)' }, { status: 400 });
        }

        const newAppointment = await prisma.appointment.create({
            data: {
                userId: auth.tenantId,
                patientId: appointment.patientId || null,
                patientName: String(appointment.patientName).trim(),
                patientPhone: String(appointment.patientPhone || appointment.patientDni || ''),
                professionalId: appointment.professionalId || null,
                professionalName: appointment.professionalName || 'Director Clínico',
                professionalSpecialty: appointment.professionalSpecialty || '',
                date: String(appointment.date),
                time: String(appointment.time),
                consultationType: appointment.consultationType || 'Consulta General',
                reason: appointment.reason || '',
                status: appointment.status || 'reservado',
                notes: appointment.notes || null
            }
        });

        return NextResponse.json({
            success: true,
            appointment: attachConfirmToken(auth.tenantId, newAppointment)
        }, { status: 201 });
    } catch (error) {
        console.error('Error in /api/vitacore/appointments POST:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

export async function PUT(request) {
    try {
        const session = await getServerSession(request);
        const body = await request.json();
        const { userId: requestedUserId, appointmentId, updatedData } = body || {};

        const auth = authorizeTenantAccess(session, requestedUserId);
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        if (!appointmentId || !updatedData) {
            return NextResponse.json({ error: 'appointmentId y updatedData son requeridos' }, { status: 400 });
        }

        const existing = await prisma.appointment.findFirst({
            where: { id: String(appointmentId), userId: auth.tenantId }
        });
        if (!existing) {
            return NextResponse.json({ error: 'Turno no encontrado en esta organización' }, { status: 404 });
        }

        const updated = await prisma.appointment.update({
            where: { id: existing.id },
            data: {
                ...(updatedData.patientName !== undefined && { patientName: updatedData.patientName }),
                ...(updatedData.date !== undefined && { date: updatedData.date }),
                ...(updatedData.time !== undefined && { time: updatedData.time }),
                ...(updatedData.status !== undefined && { status: updatedData.status }),
                ...(updatedData.consultationType !== undefined && { consultationType: updatedData.consultationType }),
                ...(updatedData.reason !== undefined && { reason: updatedData.reason }),
                ...(updatedData.notes !== undefined && { notes: updatedData.notes }),
                ...(updatedData.professionalName !== undefined && { professionalName: updatedData.professionalName })
            }
        });

        return NextResponse.json({
            success: true,
            appointment: attachConfirmToken(auth.tenantId, updated)
        });
    } catch (error) {
        console.error('Error in /api/vitacore/appointments PUT:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const session = await getServerSession(request);
        const { searchParams } = new URL(request.url);
        const auth = authorizeTenantAccess(session, searchParams.get('userId'));
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const appointmentId = searchParams.get('appointmentId');
        if (!appointmentId) {
            return NextResponse.json({ error: 'appointmentId es requerido' }, { status: 400 });
        }

        const existing = await prisma.appointment.findFirst({
            where: { id: String(appointmentId), userId: auth.tenantId }
        });
        if (!existing) {
            return NextResponse.json({ error: 'Turno no encontrado en esta organización' }, { status: 404 });
        }

        await prisma.appointment.delete({ where: { id: existing.id } });
        return NextResponse.json({ success: true, message: 'Turno eliminado exitosamente' });
    } catch (error) {
        console.error('Error in /api/vitacore/appointments DELETE:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
