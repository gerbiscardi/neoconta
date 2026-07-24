import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

function getOrdersFilePath(userId) {
    return path.join(process.cwd(), 'data', 'users', userId, 'vitacore', 'orders.json');
}

async function ensureDirectoryExists(filePath) {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
}

async function readOrders(userId) {
    const filePath = getOrdersFilePath(userId);
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
}

async function writeOrders(userId, orders) {
    const filePath = getOrdersFilePath(userId);
    await ensureDirectoryExists(filePath);
    await fs.writeFile(filePath, JSON.stringify(orders, null, 2), 'utf-8');
}

// GET: Retrieve medical orders for a patient
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const patientId = searchParams.get('patientId');
        const orderId = searchParams.get('orderId');

        if (!userId) {
            return NextResponse.json({ error: 'userId es requerido' }, { status: 400 });
        }

        const orders = await readOrders(userId);

        if (orderId) {
            const found = orders.find(o => o.id === orderId);
            if (!found) {
                return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
            }
            return NextResponse.json({ success: true, order: found });
        }

        if (patientId) {
            const filtered = orders.filter(o => o.patientId === patientId);
            return NextResponse.json({ success: true, orders: filtered });
        }

        return NextResponse.json({ success: true, orders });
    } catch (error) {
        console.error('Error in /api/vitacore/orders GET:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

// POST: Create a new medical study/lab order
export async function POST(request) {
    try {
        const body = await request.json();
        const { userId, order } = body;

        if (!userId || !order || !order.patientId || !order.studies || order.studies.length === 0) {
            return NextResponse.json({ error: 'Faltan datos obligatorios para emitir la orden médica' }, { status: 400 });
        }

        const orders = await readOrders(userId);
        const orderId = 'ord_' + crypto.randomBytes(6).toString('hex');
        const issuedAt = new Date().toISOString();

        // Calculate cryptographic SHA-256 hash of order payload for verification
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
            
            professionalId: order.professionalId || '',
            professionalName: order.professionalName || '',
            professionalSpecialty: order.professionalSpecialty || '',
            professionalMatricula: order.professionalMatricula || '',
            professionalCuit: order.professionalCuit || '',
            
            category: order.category || 'Laboratorio / Análisis Clínicos', // Laboratorio | Imágenes | Cardiología | Otros
            presumptiveDiagnosis: order.presumptiveDiagnosis || '',
            studies: order.studies || [], // [{ name: '', loincCode: '', clinicalNotes: '' }]
            clinicalSummary: order.clinicalSummary || '',
            
            useDigitalSignature: order.useDigitalSignature === true,
            signatureUrl: order.signatureUrl || null,
            
            issuedAt: issuedAt,
            expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days for studies
            status: 'emitida'
        };

        orders.unshift(newOrder);
        await writeOrders(userId, orders);

        return NextResponse.json({ success: true, order: newOrder }, { status: 201 });
    } catch (error) {
        console.error('Error in /api/vitacore/orders POST:', error);
        return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
    }
}

// DELETE: Annull an order
export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const orderId = searchParams.get('orderId');

        if (!userId || !orderId) {
            return NextResponse.json({ error: 'userId y orderId son requeridos' }, { status: 400 });
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
