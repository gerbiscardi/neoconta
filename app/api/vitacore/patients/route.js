import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Helper to get patients file path
function getFilePath(userId) {
    return path.join(process.cwd(), 'data', 'users', userId, 'vitacore', 'patients.json');
}

// GET: Retrieve all patients for a user
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        const filePath = getFilePath(userId);
        try {
            const data = await fs.readFile(filePath, 'utf-8');
            const patients = JSON.parse(data);
            return NextResponse.json({ success: true, patients });
        } catch (error) {
            if (error.code === 'ENOENT') {
                return NextResponse.json({ success: true, patients: [] });
            }
            throw error;
        }
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

        if (!userId || !patient || !patient.name || !patient.dni) {
            return NextResponse.json({ error: 'userId, patient name, and dni are required' }, { status: 400 });
        }

        const filePath = getFilePath(userId);
        const dirPath = path.dirname(filePath);
        await fs.mkdir(dirPath, { recursive: true });

        let patients = [];
        try {
            const data = await fs.readFile(filePath, 'utf-8');
            patients = JSON.parse(data);
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }

        // Check if DNI already exists for this user
        if (patients.some(p => p.dni === patient.dni)) {
            return NextResponse.json({ error: 'Ya existe un paciente registrado con ese DNI' }, { status: 400 });
        }

        const newPatient = {
            id: 'pat_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36),
            name: patient.name,
            dni: patient.dni,
            birthDate: patient.birthDate || '',
            phone: patient.phone || '',
            email: patient.email || '',
            obraSocial: patient.obraSocial || '',
            affiliateNumber: patient.affiliateNumber || '',
            importantDetails: patient.importantDetails || '',
            created_at: new Date().toISOString(),
            consultations: []
        };

        patients.push(newPatient);
        // Sort alphabetically by name
        patients.sort((a, b) => a.name.localeCompare(b.name));

        await fs.writeFile(filePath, JSON.stringify(patients, null, 2), 'utf-8');
        return NextResponse.json({ success: true, patient: newPatient }, { status: 201 });
    } catch (error) {
        console.error('Error in /api/vitacore/patients POST:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

// PUT: Update patient details
export async function PUT(request) {
    try {
        const body = await request.json();
        const { userId, patientId, updatedData } = body;

        if (!userId || !patientId || !updatedData) {
            return NextResponse.json({ error: 'userId, patientId, and updatedData are required' }, { status: 400 });
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

        // Merge updated fields (prevent overwriting consultations array or id)
        patients[index] = {
            ...patients[index],
            name: updatedData.name ?? patients[index].name,
            dni: updatedData.dni ?? patients[index].dni,
            birthDate: updatedData.birthDate ?? patients[index].birthDate,
            phone: updatedData.phone ?? patients[index].phone,
            email: updatedData.email ?? patients[index].email,
            obraSocial: updatedData.obraSocial ?? patients[index].obraSocial,
            affiliateNumber: updatedData.affiliateNumber ?? patients[index].affiliateNumber,
            importantDetails: updatedData.importantDetails ?? patients[index].importantDetails,
        };

        await fs.writeFile(filePath, JSON.stringify(patients, null, 2), 'utf-8');
        return NextResponse.json({ success: true, patient: patients[index] });
    } catch (error) {
        console.error('Error in /api/vitacore/patients PUT:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

// DELETE: Delete a patient
export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const patientId = searchParams.get('patientId');

        if (!userId || !patientId) {
            return NextResponse.json({ error: 'userId and patientId are required' }, { status: 400 });
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

        patients.splice(index, 1);
        await fs.writeFile(filePath, JSON.stringify(patients, null, 2), 'utf-8');

        return NextResponse.json({ success: true, message: 'Paciente eliminado' });
    } catch (error) {
        console.error('Error in /api/vitacore/patients DELETE:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
