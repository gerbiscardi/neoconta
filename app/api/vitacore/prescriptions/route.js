import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getServerSession, authorizeTenantAccess } from '@/lib/auth';
import { getUserDataDir } from '@/lib/dataPaths';
import { signValidationToken } from '@/lib/publicTokens';

const PRESCRIPTION_ROLES = ['cliente', 'admin', 'user', 'owner', 'vitacore-professional'];

function getPrescriptionsFilePath(userId) {
    return path.join(getUserDataDir(userId), 'vitacore', 'prescriptions.json');
}

async function ensureDirectoryExists(filePath) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function readPrescriptions(userId) {
    const filePath = getPrescriptionsFilePath(userId);
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

async function writePrescriptions(userId, prescriptions) {
    const filePath = getPrescriptionsFilePath(userId);
    await ensureDirectoryExists(filePath);
    await fs.writeFile(filePath, JSON.stringify(prescriptions, null, 2), 'utf-8');
}

function attachToken(userId, item) {
    return {
        ...item,
        validateToken: signValidationToken(userId, item.id, 'prescription')
    };
}

export async function GET(request) {
    try {
        const session = await getServerSession(request);
        const { searchParams } = new URL(request.url);
        const auth = authorizeTenantAccess(session, searchParams.get('userId'), {
            allowedRoles: PRESCRIPTION_ROLES
        });
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const userId = auth.tenantId;
        const patientId = searchParams.get('patientId');
        const prescriptionId = searchParams.get('prescriptionId');

        const prescriptions = await readPrescriptions(userId);

        if (prescriptionId) {
            const found = prescriptions.find(p => p.id === prescriptionId);
            if (!found) {
                return NextResponse.json({ error: 'Receta no encontrada' }, { status: 404 });
            }
            return NextResponse.json({ success: true, prescription: attachToken(userId, found) });
        }

        if (patientId) {
            const filtered = prescriptions.filter(p => p.patientId === patientId).map(p => attachToken(userId, p));
            return NextResponse.json({ success: true, prescriptions: filtered });
        }

        return NextResponse.json({
            success: true,
            prescriptions: prescriptions.map(p => attachToken(userId, p))
        });
    } catch (error) {
        console.error('Error in /api/vitacore/prescriptions GET:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const session = await getServerSession(request);
        const body = await request.json();
        const { userId: requestedUserId, prescription } = body || {};

        const auth = authorizeTenantAccess(session, requestedUserId, {
            allowedRoles: PRESCRIPTION_ROLES
        });
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }
        const userId = auth.tenantId;

        if (!prescription || !prescription.patientId || !Array.isArray(prescription.medications) || prescription.medications.length === 0) {
            return NextResponse.json({ error: 'Faltan datos obligatorios para emitir la receta' }, { status: 400 });
        }

        const prescriptions = await readPrescriptions(userId);
        const prescriptionId = 'rec_' + crypto.randomBytes(6).toString('hex');
        const issuedAt = new Date().toISOString();

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
            professionalId: prescription.professionalId || session.id,
            professionalName: prescription.professionalName || session.nombre,
            professionalSpecialty: prescription.professionalSpecialty || '',
            professionalMatricula: prescription.professionalMatricula || '',
            professionalCuit: prescription.professionalCuit || '',
            diagnosis: prescription.diagnosis || '',
            medications: prescription.medications || [],
            observations: prescription.observations || '',
            useDigitalSignature: prescription.useDigitalSignature === true,
            signatureUrl: prescription.signatureUrl || null,
            issuedAt,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'activa'
        };

        prescriptions.unshift(newPrescription);
        await writePrescriptions(userId, prescriptions);

        return NextResponse.json({ success: true, prescription: attachToken(userId, newPrescription) }, { status: 201 });
    } catch (error) {
        console.error('Error in /api/vitacore/prescriptions POST:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const session = await getServerSession(request);
        const { searchParams } = new URL(request.url);
        const auth = authorizeTenantAccess(session, searchParams.get('userId'), {
            allowedRoles: PRESCRIPTION_ROLES
        });
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }
        const userId = auth.tenantId;
        const prescriptionId = searchParams.get('prescriptionId');

        if (!prescriptionId) {
            return NextResponse.json({ error: 'prescriptionId es requerido' }, { status: 400 });
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
