import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// GET: Retrieve appointments for a client/professional (supports pagination, date filter, and search)
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const date = searchParams.get('date'); // YYYY-MM-DD
        const professionalId = searchParams.get('professionalId');
        const patientId = searchParams.get('patientId');
        const search = searchParams.get('search') || '';
        const pageParam = searchParams.get('page');
        const limitParam = searchParams.get('limit');

        if (!userId) {
            return NextResponse.json({ error: 'userId es requerido' }, { status: 400 });
        }

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
            const limit = Math.max(1, parseInt(limitParam || '10', 10));
            const skip = (page - 1) * limit;

            const [total, appointments] = await Promise.all([
                prisma.appointment.count({ where }),
                prisma.appointment.findMany({
                    where,
                    orderBy: [
                        { date: 'asc' },
                        { time: 'asc' }
                    ],
                    skip,
                    take: limit
                })
            ]);

            const totalPages = Math.ceil(total / limit) || 1;

            return NextResponse.json({
                success: true,
                appointments,
                total,
                totalPages,
                page,
                limit
            });
        }

        const appointments = await prisma.appointment.findMany({
            where,
            orderBy: [
                { date: 'asc' },
                { time: 'asc' }
            ]
        });

        return NextResponse.json({
            success: true,
            appointments,
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

// POST: Create a new appointment
export async function POST(request) {
    try {
        const body = await request.json();
        const { userId, appointment } = body;

        if (!userId || !appointment || !appointment.patientName || !appointment.date || !appointment.time) {
            return NextResponse.json({ error: 'Faltan campos obligatorios (paciente, fecha, hora)' }, { status: 400 });
        }

        const newAppointment = await prisma.appointment.create({
            data: {
                userId,
                patientId: appointment.patientId || null,
                patientName: appointment.patientName,
                patientPhone: appointment.patientPhone || appointment.patientDni || '',
                professionalId: appointment.professionalId || null,
                professionalName: appointment.professionalName || 'Director Clínico',
                professionalSpecialty: appointment.professionalSpecialty || '',
                date: appointment.date,
                time: appointment.time,
                consultationType: appointment.consultationType || 'Consulta General',
                reason: appointment.reason || '',
                status: appointment.status || 'reservado',
                notes: appointment.notes || null
            }
        });

        return NextResponse.json({ success: true, appointment: newAppointment }, { status: 201 });
    } catch (error) {
        console.error('Error in /api/vitacore/appointments POST:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

// PUT: Update appointment status or details
export async function PUT(request) {
    try {
        const body = await request.json();
        const { userId, appointmentId, updatedData } = body;

        if (!userId || !appointmentId || !updatedData) {
            return NextResponse.json({ error: 'userId, appointmentId y updatedData son requeridos' }, { status: 400 });
        }

        const updated = await prisma.appointment.update({
            where: { id: appointmentId },
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

        return NextResponse.json({ success: true, appointment: updated });
    } catch (error) {
        console.error('Error in /api/vitacore/appointments PUT:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

// DELETE: Delete an appointment
export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const appointmentId = searchParams.get('appointmentId');

        if (!userId || !appointmentId) {
            return NextResponse.json({ error: 'userId y appointmentId son requeridos' }, { status: 400 });
        }

        await prisma.appointment.delete({
            where: { id: appointmentId }
        });

        return NextResponse.json({ success: true, message: 'Turno eliminado exitosamente' });
    } catch (error) {
        console.error('Error in /api/vitacore/appointments DELETE:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
