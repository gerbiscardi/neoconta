import { NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { sanitizeUserId } from '@/lib/auth';
import { getUsersRootDir, getUserDataDir } from '@/lib/dataPaths';
import { verifyValidationToken, getLegacyLinksPolicy, maskInitials } from '@/lib/publicTokens';
import { getClientIp, prescriptionsValidateLimiter, rateLimitResponse } from '@/lib/rateLimit';

function maskDni(dni) {
    const clean = String(dni || '').trim();
    if (!clean) return 'S/D';
    if (clean.length <= 3) return '***';
    return `***${clean.slice(-3)}`;
}

function timingSafeHexMatch(a, b) {
    const cleanA = String(a || '').trim().toLowerCase();
    const cleanB = String(b || '').trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(cleanA) || !/^[a-f0-9]{64}$/.test(cleanB)) {
        return false;
    }
    return crypto.timingSafeEqual(Buffer.from(cleanA, 'hex'), Buffer.from(cleanB, 'hex'));
}

async function findLegacyDocumentByHash(docId, providedHash) {
    const usersRoot = getUsersRootDir();
    let tenantDirs = [];
    try {
        tenantDirs = await fs.readdir(usersRoot);
    } catch {
        return null;
    }

    for (const dir of tenantDirs) {
        const cleanDir = sanitizeUserId(dir);
        if (!cleanDir) continue;
        for (const [docType, fileName] of [['prescription', 'prescriptions.json'], ['order', 'orders.json']]) {
            const filePath = path.join(getUserDataDir(cleanDir), 'vitacore', fileName);
            try {
                const raw = await fs.readFile(filePath, 'utf-8');
                const items = JSON.parse(raw);
                if (!Array.isArray(items)) continue;
                const candidate = items.find(p => p && p.id === docId);
                if (candidate && timingSafeHexMatch(candidate.hash, providedHash)) {
                    return { foundDoc: candidate, docType };
                }
            } catch {
                // Missing file or invalid JSON in this tenant folder
            }
        }
    }
    return null;
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
        const legacyHash = searchParams.get('hash');

        if (!docId) {
            return NextResponse.json({ error: 'ID de documento es requerido' }, { status: 400 });
        }

        let foundDoc = null;
        let docType = 'prescription';
        let isLegacyMode = false;
        let legacySunsetAt = null;

        if (token) {
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

            docType = verified.docType;
            const fileName = docType === 'order' ? 'orders.json' : 'prescriptions.json';
            const filePath = path.join(getUserDataDir(tenantId), 'vitacore', fileName);

            try {
                const data = await fs.readFile(filePath, 'utf-8');
                const items = JSON.parse(data);
                foundDoc = items.find(p => p.id === docId) || null;
            } catch {
                foundDoc = null;
            }
        } else if (legacyHash) {
            const policy = getLegacyLinksPolicy();
            if (!policy.active) {
                return NextResponse.json({
                    success: false,
                    isValid: false,
                    legacySunset: true,
                    legacySunsetAt: policy.sunsetAt,
                    error: 'El período transitorio de enlaces heredados por hash ha finalizado. Solicitá la reemisión de un enlace QR firmado al consultorio.'
                }, { status: 410 });
            }

            if (!/^[a-f0-9]{64}$/i.test(legacyHash.trim())) {
                return NextResponse.json({
                    success: false,
                    isValid: false,
                    error: 'Código hash SHA-256 inválido para validación heredada'
                }, { status: 403 });
            }
            const legacyMatch = await findLegacyDocumentByHash(docId, legacyHash);
            if (legacyMatch) {
                foundDoc = legacyMatch.foundDoc;
                docType = legacyMatch.docType;
                isLegacyMode = true;
                legacySunsetAt = policy.sunsetAt;
            }
        } else {
            return NextResponse.json({
                success: false,
                isValid: false,
                requiresHashFallback: true,
                error: 'Token criptográfico de verificación requerido (o hash SHA-256 para documentos impresos previos).'
            }, { status: 401 });
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

        // Minimización estricta de información sanitaria en validación heredada (?hash=):
        // solo confirma autenticidad del emisor, vigencia, iniciales del paciente y conteo de ítems.
        if (isLegacyMode) {
            return NextResponse.json({
                success: true,
                isValid,
                docType,
                legacyMode: true,
                legacySunsetAt,
                prescription: {
                    id: foundDoc.id,
                    hash: foundDoc.hash,
                    status: foundDoc.status,
                    issuedAt: foundDoc.issuedAt,
                    expiresAt: foundDoc.expiresAt,
                    patientName: maskInitials(foundDoc.patientName),
                    professionalName: foundDoc.professionalName,
                    professionalMatricula: foundDoc.professionalMatricula,
                    professionalSpecialty: foundDoc.professionalSpecialty,
                    medicationsCount: Array.isArray(foundDoc.medications) ? foundDoc.medications.length : 0,
                    studiesCount: Array.isArray(foundDoc.studies) ? foundDoc.studies.length : 0,
                    useDigitalSignature: foundDoc.useDigitalSignature === true
                }
            });
        }

        return NextResponse.json({
            success: true,
            isValid,
            docType,
            legacyMode: false,
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
                diagnosis: foundDoc.diagnosis || null,
                category: foundDoc.category || null,
                useDigitalSignature: foundDoc.useDigitalSignature === true
            }
        });
    } catch (error) {
        console.error('Error in validation API:', error);
        return NextResponse.json({ error: 'Error al verificar el documento' }, { status: 500 });
    }
}
