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
        const { history, periods = 2, freq } = body || {};

        if (!Array.isArray(history) || history.length < 2) {
            return NextResponse.json({ error: 'Se requieren al menos 2 observaciones históricas' }, { status: 400 });
        }

        if (history.length > 120) {
            return NextResponse.json({ error: 'El historial excede el límite de 120 observaciones' }, { status: 400 });
        }

        const boundedPeriods = Math.min(Math.max(1, Number(periods) || 2), 24);

        // Call FastAPI internal microservice
        const dsRes = await fetch(`${DS_HOST}/api/predict/cashflow`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Token': DS_INTERNAL_SECRET
            },
            body: JSON.stringify({
                history: history.slice(0, 120).map(h => ({
                    ds: String(h.ds || '').substring(0, 10),
                    y: Number(h.y) || 0
                })),
                periods: boundedPeriods,
                freq: freq === 'MS' || freq === 'D' ? freq : null
            })
        });

        if (!dsRes.ok) {
            const errData = await dsRes.json().catch(() => ({}));
            return NextResponse.json({ error: errData.detail || 'Error en cálculo de predicción' }, { status: dsRes.status });
        }

        const data = await dsRes.json();
        return NextResponse.json(data);

    } catch (error) {
        console.error('Error proxying predict cashflow to FastAPI:', error.message);
        return NextResponse.json({ error: 'Error en servicio de predicción interna' }, { status: 500 });
    }
}
