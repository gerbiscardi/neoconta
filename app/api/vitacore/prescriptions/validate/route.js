import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { sanitizeUserId } from '@/lib/auth';
import { verifyValidationToken } from '@/lib/publicTokens';
import { getClientIp, prescriptionsValidateLimiter, rateLimitResponse } from '@/lib/rateLimit';

function maskDni(dni) {
    const clean = String(dni || '').trim();
    if (!clean) return 'S/D';
    if (clean.length <= 3) return '***';
    return `***${clean.slice(-3)}`;
}

export async function GET(request) {
    try {
        const ip = getClientIp(request);
        const limitCheck = prescriptionsValidateLimiter.check(ip);
        if (!limitCheck.allowed) {
            return rateLimitResponse(limitCheck, 'Ha alcanzado el límite de validaciones permitidas en este intervalo.');
        }

        const { searchParams } = new URL(request.url);
        const docId = searchParams.get('id');
        const token = searchParams.get('token');

        if (!docId) {
            return NextResponse.json({ error: 'ID de documento es requerido' }, { status: 400 });
        }
        if (!token) {
            return NextResponse.json({
                success: false,
                isValid: false,
                error: 'Token criptográfico de verificación requerido'
            }, { status: 401 });
        }

        const verified = verifyValidationToken(token, docId);
        if (!verified) {
            return NextResponse.json({
                success: false,
                isValid: false,
                error: 'Enlace de verificación inválido o expirado'
            }, { status: 403 });
        }

        const tenantId = sanitizeUserId(verified.tenantId);
        if (!tenantId) {
            return NextResponse.json({ error: 'Organización inválida en el token' }, { status: 403 });
        }

        const fileName = verified.docType === 'order' ? 'orders.json' : 'prescriptions.json';
        const filePath = path.join(process.cwd(), 'data', 'users', tenantId, 'vitacore', fileName);

        let foundDoc = null;
        try {
            const data = await fs.readFile(filePath, 'utf-8');
            const items = JSON.parse(data);
            foundDoc = items.find(p => p.id === docId) || null;
        } catch {
            foundDoc = null;
        }

        if (!foundDoc) {
            return NextResponse.json({
                success: false,
                isValid: false,
                message: 'El documento consultado no existe o no ha sido emitido en la plataforma NeoConta Vitacore.'
            }, { status: 404 });
        }

        const isExpired = foundDoc.expiresAt ? new Date(foundDoc.expiresAt) < new Date() : false;
        const isValid = foundDoc.status !== 'anulada' && !isExpired;

        return NextResponse.json({
            success: true,
            isValid,
            docType: verified.docType,
            prescription: {
                id: foundDoc.id,
                hash: foundDoc.hash,
                status: foundDoc.status,
                issuedAt: foundDoc.issuedAt,
                expiresAt: foundDoc.expiresAt,
                patientName: foundDoc.patientName,
                patientDni: maskDni(foundDoc.patientDni),
                professionalName: foundDoc.professionalName,
                professionalMatricula: foundDoc.professionalMatricula,
                professionalSpecialty: foundDoc.professionalSpecialty,
                medications: foundDoc.medications || [],
                studies: foundDoc.studies || [],
                category: foundDoc.category || null,
                useDigitalSignature: foundDoc.useDigitalSignature === true
            }
        });
    } catch (error) {
        console.error('Error in validation API:', error);
        return NextResponse.json({ error: 'Error al verificar el documento' }, { status: 500 });
    }
}
