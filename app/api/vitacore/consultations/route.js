import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getServerSession, authorizeTenantAccess } from '@/lib/auth';
import { getUserDataDir } from '@/lib/dataPaths';

const CLINICAL_ROLES = ['cliente', 'admin', 'user', 'owner', 'vitacore-professional'];

function getFilePath(userId) {
    return path.join(getUserDataDir(userId), 'vitacore', 'patients.json');
}

export async function POST(request) {
    try {
        const session = await getServerSession(request);
        const body = await request.json();
        const { userId, patientId, consultation } = body || {};

        const auth = authorizeTenantAccess(session, userId, { allowedRoles: CLINICAL_ROLES });
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        if (!patientId || !consultation || !String(consultation.reason || '').trim()) {
            return NextResponse.json({ error: 'patientId y motivo de consulta son requeridos' }, { status: 400 });
        }

        const filePath = getFilePath(auth.tenantId);
        let patients = [];
        try {
            const data = await fs.readFile(filePath, 'utf-8');
            patients = JSON.parse(data);
        } catch {
            return NextResponse.json({ error: 'Fichero clínico no encontrado' }, { status: 404 });
        }

        const index = patients.findIndex(p => p.id === patientId);
        if (index === -1) {
            return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });
        }

        const newConsultation = {
            id: `cons_${crypto.randomBytes(6).toString('hex')}`,
            date: consultation.date || new Date().toISOString(),
            reason: String(consultation.reason).trim(),
            observations: String(consultation.observations || ''),
            prescription: String(consultation.prescription || ''),
            tags: Array.isArray(consultation.tags) ? consultation.tags : [],
            isImportant: consultation.isImportant === true,
            professionalId: session.id,
            professionalName: session.nombre,
            created_at: new Date().toISOString()
        };

        if (!patients[index].consultations) {
            patients[index].consultations = [];
        }

        patients[index].consultations.push(newConsultation);
        patients[index].consultations.sort((a, b) => new Date(b.date) - new Date(a.date));

        await fs.writeFile(filePath, JSON.stringify(patients, null, 2), 'utf-8');
        return NextResponse.json({ success: true, consultation: newConsultation }, { status: 201 });
    } catch (error) {
        console.error('Error in /api/vitacore/consultations POST:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

export async function PUT(request) {
    try {
        const session = await getServerSession(request);
        const body = await request.json();
        const { userId, patientId, consultationId, updatedData } = body || {};

        const auth = authorizeTenantAccess(session, userId, { allowedRoles: CLINICAL_ROLES });
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        if (!patientId || !consultationId || !updatedData) {
            return NextResponse.json({ error: 'patientId, consultationId y updatedData son requeridos' }, { status: 400 });
        }

        const filePath = getFilePath(auth.tenantId);
        let patients = [];
        try {
            const data = await fs.readFile(filePath, 'utf-8');
            patients = JSON.parse(data);
        } catch {
            return NextResponse.json({ error: 'Fichero clínico no encontrado' }, { status: 404 });
        }

        const pIndex = patients.findIndex(p => p.id === patientId);
        if (pIndex === -1) {
            return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });
        }

        const consultations = patients[pIndex].consultations || [];
        const cIndex = consultations.findIndex(c => c.id === consultationId);
        if (cIndex === -1) {
            return NextResponse.json({ error: 'Consulta no encontrada' }, { status: 404 });
        }

        consultations[cIndex] = {
            ...consultations[cIndex],
            date: updatedData.date ?? consultations[cIndex].date,
            reason: updatedData.reason ?? consultations[cIndex].reason,
            observations: updatedData.observations ?? consultations[cIndex].observations,
            prescription: updatedData.prescription ?? consultations[cIndex].prescription,
            tags: Array.isArray(updatedData.tags) ? updatedData.tags : consultations[cIndex].tags,
            isImportant: updatedData.isImportant ?? consultations[cIndex].isImportant
        };

        consultations.sort((a, b) => new Date(b.date) - new Date(a.date));
        patients[pIndex].consultations = consultations;

        await fs.writeFile(filePath, JSON.stringify(patients, null, 2), 'utf-8');
        return NextResponse.json({ success: true, consultation: consultations[cIndex] });
    } catch (error) {
        console.error('Error in /api/vitacore/consultations PUT:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const session = await getServerSession(request);
        const { searchParams } = new URL(request.url);
        const auth = authorizeTenantAccess(session, searchParams.get('userId'), { allowedRoles: CLINICAL_ROLES });
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const patientId = searchParams.get('patientId');
        const consultationId = searchParams.get('consultationId');

        if (!patientId || !consultationId) {
            return NextResponse.json({ error: 'patientId y consultationId son requeridos' }, { status: 400 });
        }

        const filePath = getFilePath(auth.tenantId);
        let patients = [];
        try {
            const data = await fs.readFile(filePath, 'utf-8');
            patients = JSON.parse(data);
        } catch {
            return NextResponse.json({ error: 'Fichero clínico no encontrado' }, { status: 404 });
        }

        const pIndex = patients.findIndex(p => p.id === patientId);
        if (pIndex === -1) {
            return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });
        }

        const consultations = patients[pIndex].consultations || [];
        const cIndex = consultations.findIndex(c => c.id === consultationId);
        if (cIndex === -1) {
            return NextResponse.json({ error: 'Consulta no encontrada' }, { status: 404 });
        }

        consultations.splice(cIndex, 1);
        patients[pIndex].consultations = consultations;

        await fs.writeFile(filePath, JSON.stringify(patients, null, 2), 'utf-8');
        return NextResponse.json({ success: true, message: 'Consulta eliminada' });
    } catch (error) {
        console.error('Error in /api/vitacore/consultations DELETE:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
