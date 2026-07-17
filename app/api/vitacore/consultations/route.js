import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Helper to get patients file path
function getFilePath(userId) {
    return path.join(process.cwd(), 'data', 'users', userId, 'vitacore', 'patients.json');
}

// POST: Add a new consultation/evolution for a patient
export async function POST(request) {
    try {
        const body = await request.json();
        const { userId, patientId, consultation } = body;

        if (!userId || !patientId || !consultation || !consultation.reason) {
            return NextResponse.json({ error: 'userId, patientId, and consultation reason are required' }, { status: 400 });
        }

        const filePath = getFilePath(userId);
        let patients = [];
        try {
            const data = await fs.readFile(filePath, 'utf-8');
            patients = JSON.parse(data);
        } catch (error) {
            return NextResponse.json({ error: 'Fichero no encontrado' }, { status: 404 });
        }

        const index = patients.findIndex(p => p.id === patientId);
        if (index === -1) {
            return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });
        }

        const newConsultation = {
            id: 'cons_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36),
            date: consultation.date || new Date().toISOString(),
            reason: consultation.reason,
            observations: consultation.observations || '',
            prescription: consultation.prescription || '',
            tags: Array.isArray(consultation.tags) ? consultation.tags : [],
            isImportant: consultation.isImportant === true,
            created_at: new Date().toISOString()
        };

        if (!patients[index].consultations) {
            patients[index].consultations = [];
        }

        patients[index].consultations.push(newConsultation);
        // Sort consultations by date descending (latest first)
        patients[index].consultations.sort((a, b) => new Date(b.date) - new Date(a.date));

        await fs.writeFile(filePath, JSON.stringify(patients, null, 2), 'utf-8');
        return NextResponse.json({ success: true, consultation: newConsultation }, { status: 201 });
    } catch (error) {
        console.error('Error in /api/vitacore/consultations POST:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

// PUT: Update a consultation
export async function PUT(request) {
    try {
        const body = await request.json();
        const { userId, patientId, consultationId, updatedData } = body;

        if (!userId || !patientId || !consultationId || !updatedData) {
            return NextResponse.json({ error: 'userId, patientId, consultationId, and updatedData are required' }, { status: 400 });
        }

        const filePath = getFilePath(userId);
        let patients = [];
        try {
            const data = await fs.readFile(filePath, 'utf-8');
            patients = JSON.parse(data);
        } catch (error) {
            return NextResponse.json({ error: 'Fichero no encontrado' }, { status: 404 });
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

        // Merge updated fields
        consultations[cIndex] = {
            ...consultations[cIndex],
            date: updatedData.date ?? consultations[cIndex].date,
            reason: updatedData.reason ?? consultations[cIndex].reason,
            observations: updatedData.observations ?? consultations[cIndex].observations,
            prescription: updatedData.prescription ?? consultations[cIndex].prescription,
            tags: Array.isArray(updatedData.tags) ? updatedData.tags : consultations[cIndex].tags,
            isImportant: updatedData.isImportant ?? consultations[cIndex].isImportant
        };

        // Sort consultations by date descending (latest first)
        consultations.sort((a, b) => new Date(b.date) - new Date(a.date));
        patients[pIndex].consultations = consultations;

        await fs.writeFile(filePath, JSON.stringify(patients, null, 2), 'utf-8');
        return NextResponse.json({ success: true, consultation: consultations[cIndex] });
    } catch (error) {
        console.error('Error in /api/vitacore/consultations PUT:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

// DELETE: Delete a consultation
export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const patientId = searchParams.get('patientId');
        const consultationId = searchParams.get('consultationId');

        if (!userId || !patientId || !consultationId) {
            return NextResponse.json({ error: 'userId, patientId, and consultationId are required' }, { status: 400 });
        }

        const filePath = getFilePath(userId);
        let patients = [];
        try {
            const data = await fs.readFile(filePath, 'utf-8');
            patients = JSON.parse(data);
        } catch (error) {
            return NextResponse.json({ error: 'Fichero no encontrado' }, { status: 404 });
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
