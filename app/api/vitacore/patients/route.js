import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { z } from 'zod';

const PatientSchema = z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    dni: z.string().min(4, 'El DNI debe tener al menos 4 caracteres'),
    birthDate: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    obraSocial: z.string().optional().nullable(),
    affiliateNumber: z.string().optional().nullable(),
    importantDetails: z.string().optional().nullable()
});

// GET: Retrieve patients for a user (supports optional pagination and search)
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const search = searchParams.get('search') || '';
        const pageParam = searchParams.get('page');
        const limitParam = searchParams.get('limit');

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        const where = {
            userId,
            ...(search ? {
                OR: [
                    { name: { contains: search } },
                    { dni: { contains: search } },
                    { email: { contains: search } },
                    { obraSocial: { contains: search } }
                ]
            } : {})
        };

        if (pageParam || limitParam) {
            const page = Math.max(1, parseInt(pageParam || '1', 10));
            const limit = Math.max(1, parseInt(limitParam || '10', 10));
            const skip = (page - 1) * limit;

            const [total, patients] = await Promise.all([
                prisma.patient.count({ where }),
                prisma.patient.findMany({
                    where,
                    include: {
                        consultations: {
                            orderBy: { createdAt: 'desc' }
                        }
                    },
                    orderBy: { name: 'asc' },
                    skip,
                    take: limit
                })
            ]);

            const totalPages = Math.ceil(total / limit) || 1;

            return NextResponse.json({
                success: true,
                patients,
                total,
                totalPages,
                page,
                limit
            });
        }

        const patients = await prisma.patient.findMany({
            where,
            include: {
                consultations: {
                    orderBy: { createdAt: 'desc' }
                }
            },
            orderBy: { name: 'asc' }
        });

        return NextResponse.json({ success: true, patients, total: patients.length, totalPages: 1, page: 1, limit: patients.length });
    } catch (error) {
        console.error('Error in /api/vitacore/patients GET:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

// POST: Add a new patient
export async function POST(request) {
    try {
        const body = await request.json();
        const { userId, patient } = body;

        if (!userId || !patient) {
            return NextResponse.json({ error: 'userId y patient son requeridos' }, { status: 400 });
        }

        const validation = PatientSchema.safeParse(patient);
        if (!validation.success) {
            const firstErr = validation.error.issues[0]?.message || 'Datos de paciente inválidos';
            return NextResponse.json({ error: firstErr }, { status: 400 });
        }

        const validData = validation.data;

        // Check if DNI already exists for this user
        const existing = await prisma.patient.findFirst({
            where: { userId, dni: validData.dni }
        });

        if (existing) {
            return NextResponse.json({ error: 'Ya existe un paciente registrado con este DNI.' }, { status: 400 });
        }

        const newPatient = await prisma.patient.create({
            data: {
                userId,
                name: validData.name,
                dni: validData.dni,
                birthDate: validData.birthDate || null,
                phone: validData.phone || null,
                email: validData.email || null,
                obraSocial: validData.obraSocial || null,
                affiliateNumber: validData.affiliateNumber || null,
                importantDetails: validData.importantDetails || null
            },
            include: { consultations: true }
        });

        return NextResponse.json({ success: true, patient: newPatient });
    } catch (error) {
        console.error('Error in /api/vitacore/patients POST:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

// PUT: Update an existing patient
export async function PUT(request) {
    try {
        const body = await request.json();
        const { userId, patient } = body;

        if (!userId || !patient || !patient.id) {
            return NextResponse.json({ error: 'userId and patient.id are required' }, { status: 400 });
        }

        const updated = await prisma.patient.update({
            where: { id: patient.id },
            data: {
                name: patient.name,
                dni: String(patient.dni),
                birthDate: patient.birthDate || null,
                phone: patient.phone || null,
                email: patient.email || null,
                obraSocial: patient.obraSocial || null,
                affiliateNumber: patient.affiliateNumber || null,
                importantDetails: patient.importantDetails || null
            },
            include: { consultations: true }
        });

        return NextResponse.json({ success: true, patient: updated });
    } catch (error) {
        console.error('Error in /api/vitacore/patients PUT:', error);
        return NextResponse.json({ error: 'Error al actualizar el paciente' }, { status: 500 });
    }
}

// DELETE: Remove a patient
export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const patientId = searchParams.get('patientId');

        if (!userId || !patientId) {
            return NextResponse.json({ error: 'userId and patientId are required' }, { status: 400 });
        }

        await prisma.patient.delete({
            where: { id: patientId }
        });

        return NextResponse.json({ success: true, message: 'Paciente eliminado correctamente' });
    } catch (error) {
        console.error('Error in /api/vitacore/patients DELETE:', error);
        return NextResponse.json({ error: 'Error al eliminar el paciente' }, { status: 500 });
    }
}
