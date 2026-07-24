import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

function getPrescriptionsFilePath(userId) {
    return path.join(process.cwd(), 'data', 'users', userId, 'vitacore', 'prescriptions.json');
}

async function ensureDirectoryExists(filePath) {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
}

async function readPrescriptions(userId) {
    const filePath = getPrescriptionsFilePath(userId);
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
}

async function writePrescriptions(userId, prescriptions) {
    const filePath = getPrescriptionsFilePath(userId);
    await ensureDirectoryExists(filePath);
    await fs.writeFile(filePath, JSON.stringify(prescriptions, null, 2), 'utf-8');
}

// GET: Retrieve prescriptions for a patient
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const patientId = searchParams.get('patientId');
        const prescriptionId = searchParams.get('prescriptionId');

        if (!userId) {
            return NextResponse.json({ error: 'userId es requerido' }, { status: 400 });
        }

        const prescriptions = await readPrescriptions(userId);

        if (prescriptionId) {
            const found = prescriptions.find(p => p.id === prescriptionId);
            if (!found) {
                return NextResponse.json({ error: 'Receta no encontrada' }, { status: 404 });
            }
            return NextResponse.json({ success: true, prescription: found });
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
        const { userId, prescription } = body;

        if (!userId || !prescription || !prescription.patientId || !prescription.medications || prescription.medications.length === 0) {
            return NextResponse.json({ error: 'Faltan datos obligatorios para emitir la receta' }, { status: 400 });
        }

        const prescriptions = await readPrescriptions(userId);
        const prescriptionId = 'rec_' + crypto.randomBytes(6).toString('hex');
        const issuedAt = new Date().toISOString();

        // Calculate cryptographic SHA-256 hash of prescription payload for legal verification
        const rawPayload = `${prescriptionId}|${userId}|${prescription.patientId}|${prescription.patientDni || ''}|${JSON.stringify(prescription.medications)}|${issuedAt}`;
        const sha256Hash = crypto.createHash('sha256').update(rawPayload).digest('hex');

        const newPrescription = {
            id: prescriptionId,
            hash: sha256Hash,
            patientId: prescription.patientId,
            patientName: prescription.patientName || '',
            patientDni: prescription.patientDni || '',
            patientSocialSecurity: prescription.patientSocialSecurity || '',
            patientAffiliateNumber: prescription.patientAffiliateNumber || '',
            
            professionalId: prescription.professionalId || '',
            professionalName: prescription.professionalName || '',
            professionalSpecialty: prescription.professionalSpecialty || '',
            professionalMatricula: prescription.professionalMatricula || '',
            professionalCuit: prescription.professionalCuit || '',
            
            diagnosis: prescription.diagnosis || '',
            medications: prescription.medications || [],
            observations: prescription.observations || '',
            
            useDigitalSignature: prescription.useDigitalSignature === true,
            signatureUrl: prescription.signatureUrl || null,
            
            issuedAt: issuedAt,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
            status: 'activa'
        };

        prescriptions.unshift(newPrescription);
        await writePrescriptions(userId, prescriptions);

        return NextResponse.json({ success: true, prescription: newPrescription }, { status: 201 });
    } catch (error) {
        console.error('Error in /api/vitacore/prescriptions POST:', error);
        return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
    }
}

// DELETE: Annull a prescription
export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const prescriptionId = searchParams.get('prescriptionId');

        if (!userId || !prescriptionId) {
            return NextResponse.json({ error: 'userId y prescriptionId son requeridos' }, { status: 400 });
        }

        const prescriptions = await readPrescriptions(userId);
        const index = prescriptions.findIndex(p => p.id === prescriptionId);

        if (index === -1) {
            return NextResponse.json({ error: 'Receta no encontrada' }, { status: 404 });
        }

        prescriptions[index].status = 'anulada';
        prescriptions[index].annulledAt = new Date().toISOString();

        await writePrescriptions(userId, prescriptions);

        return NextResponse.json({ success: true, message: 'Receta anulada exitosamente' });
    } catch (error) {
        console.error('Error in /api/vitacore/prescriptions DELETE:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
