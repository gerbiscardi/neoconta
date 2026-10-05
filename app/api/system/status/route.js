import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
    let dbStatus = 'ok';
    let dsStatus = 'ok';
    let arcaStatus = 'ok';

    // 1. Check SQLite / Prisma Database
    try {
        await prisma.user.findFirst({ select: { id: true } });
    } catch (err) {
        console.error("Health check DB error:", err);
        dbStatus = 'error';
    }

    // 2. Check Python DS Microservice
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        let dsRes = await fetch('http://127.0.0.1:8000/health', {
            signal: controller.signal
        }).catch(() => null);

        if (!dsRes || !dsRes.ok) {
            dsRes = await fetch('http://127.0.0.1:8000/', {
                signal: controller.signal
            }).catch(() => null);
        }

        clearTimeout(timeoutId);

        if (!dsRes || !dsRes.ok) {
            dsStatus = 'warning';
        }
    } catch (err) {
        dsStatus = 'warning';
    }

    const isHealthy = dbStatus === 'ok';

    return NextResponse.json({
        success: true,
        status: isHealthy ? (dsStatus === 'ok' ? 'online' : 'degraded') : 'offline',
        timestamp: new Date().toISOString(),
        services: {
            database: { status: dbStatus, label: 'SQLite / Prisma ORM' },
            pythonDs: { status: dsStatus, label: 'Commander BI & IA Motor' },
            arca: { status: arcaStatus, label: 'Servicio Web ARCA (AFIP)' }
        }
    });
}
