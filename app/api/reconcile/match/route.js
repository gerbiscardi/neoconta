import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

const DS_HOST = process.env.DS_HOST || 'http://127.0.0.1:8000';
const DS_INTERNAL_SECRET = process.env.DS_INTERNAL_SECRET || '';

export async function POST(request) {
    try {
        const session = await getServerSession(request);
        if (!session) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const body = await request.json();
        const { movement, invoices } = body || {};

        if (!movement || typeof movement.amount !== 'number') {
            return NextResponse.json({ error: 'Datos de movimiento bancario inválidos' }, { status: 400 });
        }

        if (!Array.isArray(invoices)) {
            return NextResponse.json({ error: 'La lista de facturas debe ser un arreglo' }, { status: 400 });
        }

        if (invoices.length > 200) {
            return NextResponse.json({ error: 'Límite máximo de 200 facturas excedido' }, { status: 400 });
        }

        // Call FastAPI internal microservice
        const dsRes = await fetch(`${DS_HOST}/api/reconcile/match`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Token': DS_INTERNAL_SECRET
            },
            body: JSON.stringify({
                movement: {
                    amount: movement.amount,
                    date: String(movement.date || '').substring(0, 10),
                    description: String(movement.description || '').substring(0, 200)
                },
                invoices: invoices.slice(0, 200).map(inv => ({
                    id: String(inv.id || ''),
                    amount: Number(inv.amount) || 0,
                    date: String(inv.date || '').substring(0, 10),
                    client_name: String(inv.client_name || '').substring(0, 100)
                }))
            })
        });

        if (!dsRes.ok) {
            const errData = await dsRes.json().catch(() => ({}));
            return NextResponse.json({ error: errData.detail || 'Error en conciliación asistida' }, { status: dsRes.status });
        }

        const data = await dsRes.json();
        return NextResponse.json(data);

    } catch (error) {
        console.error('Error proxying reconcile match to FastAPI:', error.message);
        return NextResponse.json({ error: 'Error en servicio de conciliación interna' }, { status: 500 });
    }
}
