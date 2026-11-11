import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import prisma from '@/lib/db';
import { getServerSession, authorizeTenantAccess } from '@/lib/auth';
import { getUserDataDir } from '@/lib/dataPaths';
import { signAppointmentToken, signValidationToken } from '@/lib/publicTokens';

const APPOINTMENT_STAFF_ROLES = ['cliente', 'admin', 'user', 'owner', 'vitacore-professional', 'vitacore-receptionist'];
const CLINICAL_DOCUMENT_ROLES = ['cliente', 'admin', 'user', 'owner', 'vitacore-professional'];

export async function POST(request) {
    try {
        const session = await getServerSession(request);
        const body = await request.json();
        const { userId: requestedUserId, type, id } = body || {};

        if (!type || !id) {
            return NextResponse.json({ error: 'type e id son requeridos' }, { status: 400 });
        }

        const normalizedType = String(type).trim().toLowerCase();
        if (!['appointment', 'prescription', 'order'].includes(normalizedType)) {
            return NextResponse.json({ error: 'Tipo de enlace inválido (appointment, prescription, order)' }, { status: 400 });
        }

        const allowedRoles = normalizedType === 'appointment'
            ? APPOINTMENT_STAFF_ROLES
            : CLINICAL_DOCUMENT_ROLES;

        const auth = authorizeTenantAccess(session, requestedUserId, { allowedRoles });
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const tenantId = auth.tenantId;
        const cleanId = String(id).trim();

        if (normalizedType === 'appointment') {
            let found = await prisma.appointment.findFirst({
                where: { id: cleanId, userId: tenantId }
            });

            if (!found) {
                const filePath = path.join(getUserDataDir(tenantId), 'vitacore', 'appointments.json');
                try {
                    const raw = await fs.readFile(filePath, 'utf-8');
                    const list = JSON.parse(raw);
                    if (Array.isArray(list)) {
                        found = list.find(a => a && a.id === cleanId) || null;
                    }
                } catch {
                    found = null;
                }
            }

            if (!found) {
                return NextResponse.json({ error: 'Turno no encontrado en la organización' }, { status: 404 });
            }

            const token = signAppointmentToken(tenantId, cleanId);
            const pathUrl = `/confirmar-turno/${encodeURIComponent(cleanId)}?token=${encodeURIComponent(token)}`;
            return NextResponse.json({
                success: true,
                type: 'appointment',
                id: cleanId,
                token,
                path: pathUrl
            });
        }

        const fileName = normalizedType === 'order' ? 'orders.json' : 'prescriptions.json';
        const filePath = path.join(getUserDataDir(tenantId), 'vitacore', fileName);
        let foundDoc = null;
        try {
            const raw = await fs.readFile(filePath, 'utf-8');
            const items = JSON.parse(raw);
            if (Array.isArray(items)) {
                foundDoc = items.find(item => item && item.id === cleanId) || null;
            }
        } catch {
            foundDoc = null;
        }

        if (!foundDoc) {
            return NextResponse.json({ error: 'Documento no encontrado en la organización' }, { status: 404 });
        }

        const token = signValidationToken(tenantId, cleanId, normalizedType);
        const pathUrl = `/validar-receta/${encodeURIComponent(cleanId)}?token=${encodeURIComponent(token)}`;
        return NextResponse.json({
            success: true,
            type: normalizedType,
            id: cleanId,
            token,
            path: pathUrl
        });
    } catch (error) {
        console.error('Error in /api/vitacore/public-links/reissue POST:', error);
        return NextResponse.json({ error: 'Error interno al reemitir enlace firmado' }, { status: 500 });
    }
}
