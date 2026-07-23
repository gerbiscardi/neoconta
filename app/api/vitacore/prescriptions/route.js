import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

function getFilePath(userId) {
    return path.join(process.cwd(), 'data', 'users', userId, 'vitacore', 'prescriptions.json');
}

async function readPrescriptions(userId) {
    try {
        const filePath = getFilePath(userId);
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
}

async function writePrescriptions(userId, prescriptions) {
    const filePath = getFilePath(userId);
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(prescriptions, null, 2), 'utf-8');
}

// GET: List prescriptions for a user / patient
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const patientId = searchParams.get('patientId');
        const prescriptionId = searchParams.get('prescriptionId');

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        const prescriptions = await readPrescriptions(userId);

        if (prescriptionId) {
            const rx = prescriptions.find(p => p.id === prescriptionId);
            if (!rx) {
                return NextResponse.json({ error: 'Prescripción no encontrada' }, { status: 404 });
            }
            return NextResponse.json({ success: true, prescription: rx });
        }

        if (patientId) {
            const filtered = prescriptions.filter(p => p.patientId === patientId);
            return NextResponse.json({ success: true, prescriptions: filtered });
        }

        return NextResponse.json({ success: true, prescriptions });

    } catch (error) {
        console.error('Error in /api/vitacore/prescriptions GET:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

// POST: Create a new prescription
export async function POST(request) {
    try {
        const body = await request.json();
        const { 
            userId, 
            patientId, 
            professionalId, 
            professionalName, 
            professionalSpecialty, 
            professionalMatricula,
            professionalCuit,
            patientName, 
            patientDni, 
            patientObraSocial, 
            patientNumeroAfiliado,
            patientFechaNacimiento,
            diagnosis, 
            items, // Array of { drugName, dosage, frequency, duration, totalQuantity }
            observations, 
            useDigitalSignature, 
            signatureBase64,
            stampDetails
        } = body;

        if (!userId || !patientId || !patientName || !items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: 'Faltan datos obligatorios (paciente, medicamentos)' }, { status: 400 });
        }

        const rxId = 'rx_' + crypto.randomBytes(8).toString('hex');
        const createdAt = new Date().toISOString();
        
        // Calculate expiration date (30 days by default per Ley 27.553)
        const expirationDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        // Calculate cryptographic verification Hash SHA-256
        const hashInput = `${rxId}|${userId}|${patientDni || ''}|${professionalMatricula || ''}|${createdAt}|${JSON.stringify(items)}`;
        const verificationHash = crypto.createHash('sha256').update(hashInput).digest('hex').toUpperCase();

        const newPrescription = {
            id: rxId,
            userId,
            patientId,
            professionalId: professionalId || '',
            professionalName: professionalName || 'Médico Tratante',
            professionalSpecialty: professionalSpecialty || 'Medicina General',
            professionalMatricula: professionalMatricula || '',
            professionalCuit: professionalCuit || '',
            patientName,
            patientDni: patientDni || '',
            patientObraSocial: patientObraSocial || 'Particular',
            patientNumeroAfiliado: patientNumeroAfiliado || '',
            patientFechaNacimiento: patientFechaNacimiento || '',
            diagnosis: diagnosis || 'Consulta Médica General',
            items,
            observations: observations || '',
            useDigitalSignature: !!useDigitalSignature,
            signatureBase64: useDigitalSignature ? (signatureBase64 || '') : '',
            stampDetails: stampDetails || '',
            createdAt,
            expirationDate,
            verificationHash,
            status: 'vigente'
        };

        const prescriptions = await readPrescriptions(userId);
        prescriptions.unshift(newPrescription);
        await writePrescriptions(userId, prescriptions);

        return NextResponse.json({ success: true, prescription: newPrescription }, { status: 201 });

    } catch (error) {
        console.error('Error in /api/vitacore/prescriptions POST:', error);
        return NextResponse.json({ error: 'Error interno al guardar la receta' }, { status: 500 });
    }
}

// DELETE: Delete a prescription
export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const prescriptionId = searchParams.get('prescriptionId');

        if (!userId || !prescriptionId) {
            return NextResponse.json({ error: 'userId and prescriptionId are required' }, { status: 400 });
        }

        const prescriptions = await readPrescriptions(userId);
        const filtered = prescriptions.filter(p => p.id !== prescriptionId);
        await writePrescriptions(userId, filtered);

        return NextResponse.json({ success: true, message: 'Receta eliminada correctamente' });

    } catch (error) {
        console.error('Error in /api/vitacore/prescriptions DELETE:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
