import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { z } from 'zod';
import { getServerSession, authorizeTenantAccess } from '@/lib/auth';

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
        const session = await getServerSession(request);
        const { searchParams } = new URL(request.url);
        const auth = authorizeTenantAccess(session, searchParams.get('userId'));
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }
        const targetUserId = auth.tenantId;
        const hideClinicalConsultations = session.role === 'vitacore-receptionist';

        const search = searchParams.get('search') || '';
        const pageParam = searchParams.get('page');
        const limitParam = searchParams.get('limit');

        const where = {
            userId: targetUserId,
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
            const safePatients = hideClinicalConsultations
                ? patients.map(({ consultations, ...rest }) => ({ ...rest, consultations: [] }))
                : patients;

            return NextResponse.json({
                success: true,
                patients: safePatients,
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

        const safePatients = hideClinicalConsultations
            ? patients.map(({ consultations, ...rest }) => ({ ...rest, consultations: [] }))
            : patients;

        return NextResponse.json({ success: true, patients: safePatients, total: safePatients.length, totalPages: 1, page: 1, limit: safePatients.length });
    } catch (error) {
        console.error('Error in /api/vitacore/patients GET:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

// POST: Add a new patient
export async function POST(request) {
    try {
        const session = await getServerSession(request);
        const body = await request.json();
        const { userId, patient } = body || {};

        const auth = authorizeTenantAccess(session, userId);
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }
        const targetUserId = auth.tenantId;

        if (!patient) {
            return NextResponse.json({ error: 'Datos de paciente requeridos' }, { status: 400 });
        }

        const validation = PatientSchema.safeParse(patient);
        if (!validation.success) {
            const firstErr = validation.error.issues[0]?.message || 'Datos de paciente inválidos';
            return NextResponse.json({ error: firstErr }, { status: 400 });
        }

        const validData = validation.data;

        // Check if DNI already exists for this user
        const existing = await prisma.patient.findFirst({
            where: { userId: targetUserId, dni: validData.dni }
        });

        if (existing) {
            return NextResponse.json({ error: 'Ya existe un paciente registrado con este DNI.' }, { status: 400 });
        }

        const newPatient = await prisma.patient.create({
            data: {
                userId: targetUserId,
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
        const session = await getServerSession(request);
        const body = await request.json();
        const { userId, patient } = body || {};

        const auth = authorizeTenantAccess(session, userId);
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }
        const targetUserId = auth.tenantId;

        if (!patient || !patient.id) {
            return NextResponse.json({ error: 'patient.id es requerido' }, { status: 400 });
        }

        const existing = await prisma.patient.findFirst({
            where: { id: String(patient.id), userId: targetUserId }
        });
        if (!existing) {
            return NextResponse.json({ error: 'Paciente no encontrado en esta organización' }, { status: 404 });
        }

        const validation = PatientSchema.safeParse({
            name: patient.name ?? existing.name,
            dni: String(patient.dni ?? existing.dni),
            birthDate: patient.birthDate !== undefined ? patient.birthDate : existing.birthDate,
            phone: patient.phone !== undefined ? patient.phone : existing.phone,
            email: patient.email !== undefined ? patient.email : existing.email,
            obraSocial: patient.obraSocial !== undefined ? patient.obraSocial : existing.obraSocial,
            affiliateNumber: patient.affiliateNumber !== undefined ? patient.affiliateNumber : existing.affiliateNumber,
            importantDetails: patient.importantDetails !== undefined ? patient.importantDetails : existing.importantDetails
        });
        if (!validation.success) {
            return NextResponse.json({ error: validation.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 });
        }
        const valid = validation.data;

        const updated = await prisma.patient.update({
            where: { id: existing.id },
            data: {
                name: valid.name,
                dni: valid.dni,
                birthDate: valid.birthDate || null,
                phone: valid.phone || null,
                email: valid.email || null,
                obraSocial: valid.obraSocial || null,
                affiliateNumber: valid.affiliateNumber || null,
                importantDetails: session.role === 'vitacore-receptionist' ? existing.importantDetails : (valid.importantDetails || null)
            },
            include: { consultations: session.role !== 'vitacore-receptionist' }
        });

        const safeUpdated = session.role === 'vitacore-receptionist'
            ? { ...updated, consultations: [] }
            : updated;

        return NextResponse.json({ success: true, patient: safeUpdated });
    } catch (error) {
        console.error('Error in /api/vitacore/patients PUT:', error);
        return NextResponse.json({ error: 'Error al actualizar el paciente' }, { status: 500 });
    }
}

// DELETE: Remove a patient
export async function DELETE(request) {
    try {
        const session = await getServerSession(request);
        const { searchParams } = new URL(request.url);
        const auth = authorizeTenantAccess(session, searchParams.get('userId'), {
            allowedRoles: ['cliente', 'admin', 'user', 'owner', 'vitacore-professional']
        });
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }
        const targetUserId = auth.tenantId;
        const patientId = searchParams.get('patientId');

        if (!patientId) {
            return NextResponse.json({ error: 'patientId es requerido' }, { status: 400 });
        }

        const existing = await prisma.patient.findFirst({
            where: { id: String(patientId), userId: targetUserId }
        });
        if (!existing) {
            return NextResponse.json({ error: 'Paciente no encontrado en esta organización' }, { status: 404 });
        }

        await prisma.patient.delete({
            where: { id: existing.id }
        });

        return NextResponse.json({ success: true, message: 'Paciente eliminado correctamente' });
    } catch (error) {
        console.error('Error in /api/vitacore/patients DELETE:', error);
        return NextResponse.json({ error: 'Error al eliminar el paciente' }, { status: 500 });
    }
}
