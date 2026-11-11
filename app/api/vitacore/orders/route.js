import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getServerSession, authorizeTenantAccess } from '@/lib/auth';
import { signValidationToken } from '@/lib/publicTokens';

const ORDER_ROLES = ['cliente', 'admin', 'user', 'owner', 'vitacore-professional'];

function getOrdersFilePath(userId) {
    return path.join(process.cwd(), 'data', 'users', userId, 'vitacore', 'orders.json');
}

async function ensureDirectoryExists(filePath) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function readOrders(userId) {
    const filePath = getOrdersFilePath(userId);
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

async function writeOrders(userId, orders) {
    const filePath = getOrdersFilePath(userId);
    await ensureDirectoryExists(filePath);
    await fs.writeFile(filePath, JSON.stringify(orders, null, 2), 'utf-8');
}

function attachToken(userId, item) {
    return {
        ...item,
        validateToken: signValidationToken(userId, item.id, 'order')
    };
}

export async function GET(request) {
    try {
        const session = await getServerSession(request);
        const { searchParams } = new URL(request.url);
        const auth = authorizeTenantAccess(session, searchParams.get('userId'), {
            allowedRoles: ORDER_ROLES
        });
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const userId = auth.tenantId;
        const patientId = searchParams.get('patientId');
        const orderId = searchParams.get('orderId');

        const orders = await readOrders(userId);

        if (orderId) {
            const found = orders.find(o => o.id === orderId);
            if (!found) {
                return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
            }
            return NextResponse.json({ success: true, order: attachToken(userId, found) });
        }

        if (patientId) {
            const filtered = orders.filter(o => o.patientId === patientId).map(o => attachToken(userId, o));
            return NextResponse.json({ success: true, orders: filtered });
        }

        return NextResponse.json({ success: true, orders: orders.map(o => attachToken(userId, o)) });
    } catch (error) {
        console.error('Error in /api/vitacore/orders GET:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const session = await getServerSession(request);
        const body = await request.json();
        const { userId: requestedUserId, order } = body || {};

        const auth = authorizeTenantAccess(session, requestedUserId, {
            allowedRoles: ORDER_ROLES
        });
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }
        const userId = auth.tenantId;

        if (!order || !order.patientId || !Array.isArray(order.studies) || order.studies.length === 0) {
            return NextResponse.json({ error: 'Faltan datos obligatorios para emitir la orden médica' }, { status: 400 });
        }

        const orders = await readOrders(userId);
        const orderId = 'ord_' + crypto.randomBytes(6).toString('hex');
        const issuedAt = new Date().toISOString();

        const rawPayload = `${orderId}|${userId}|${order.patientId}|${order.patientDni || ''}|${JSON.stringify(order.studies)}|${issuedAt}`;
        const sha256Hash = crypto.createHash('sha256').update(rawPayload).digest('hex');

        const newOrder = {
            id: orderId,
            hash: sha256Hash,
            patientId: order.patientId,
            patientName: order.patientName || '',
            patientDni: order.patientDni || '',
            patientSocialSecurity: order.patientSocialSecurity || '',
            patientAffiliateNumber: order.patientAffiliateNumber || '',
            professionalId: order.professionalId || session.id,
            professionalName: order.professionalName || session.nombre,
            professionalSpecialty: order.professionalSpecialty || '',
            professionalMatricula: order.professionalMatricula || '',
            professionalCuit: order.professionalCuit || '',
            category: order.category || 'Laboratorio / Análisis Clínicos',
            presumptiveDiagnosis: order.presumptiveDiagnosis || '',
            studies: order.studies || [],
            clinicalSummary: order.clinicalSummary || '',
            useDigitalSignature: order.useDigitalSignature === true,
            signatureUrl: order.signatureUrl || null,
            issuedAt,
            expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'emitida'
        };

        orders.unshift(newOrder);
        await writeOrders(userId, orders);

        return NextResponse.json({ success: true, order: attachToken(userId, newOrder) }, { status: 201 });
    } catch (error) {
        console.error('Error in /api/vitacore/orders POST:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const session = await getServerSession(request);
        const { searchParams } = new URL(request.url);
        const auth = authorizeTenantAccess(session, searchParams.get('userId'), {
            allowedRoles: ORDER_ROLES
        });
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }
        const userId = auth.tenantId;
        const orderId = searchParams.get('orderId');

        if (!orderId) {
            return NextResponse.json({ error: 'orderId es requerido' }, { status: 400 });
        }

        const orders = await readOrders(userId);
        const index = orders.findIndex(o => o.id === orderId);
        if (index === -1) {
            return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
        }

        orders[index].status = 'anulada';
        orders[index].annulledAt = new Date().toISOString();
        await writeOrders(userId, orders);

        return NextResponse.json({ success: true, message: 'Orden anulada exitosamente' });
    } catch (error) {
        console.error('Error in /api/vitacore/orders DELETE:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
