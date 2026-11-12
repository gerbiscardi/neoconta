import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { getServerSession, authorizeTenantAccess } from '@/lib/auth';
import { getUserDataDir, writeJsonAtomic } from '@/lib/dataPaths';

// GET: Retrieve all audit reports for a tenant with optional filtering and pagination
export async function GET(request) {
    try {
        const session = await getServerSession(request);
        const { searchParams } = new URL(request.url);
        const auth = authorizeTenantAccess(session, searchParams.get('userId'));
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const typeFilter = searchParams.get('type'); // 'social_reviews' | 'web_audit' | null
        const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
        const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));

        const userDir = getUserDataDir(auth.tenantId);
        const historyPath = join(userDir, 'reviews_analysis.json');

        let history = [];
        try {
            const data = await readFile(historyPath, 'utf-8');
            history = JSON.parse(data);
            if (!Array.isArray(history)) history = [];
        } catch {
            history = [];
        }

        let filtered = history;
        if (typeFilter) {
            filtered = filtered.filter(r => r.type === typeFilter);
        }

        const total = filtered.length;
        const paginated = filtered.slice(offset, offset + limit);

        return NextResponse.json({
            success: true,
            total,
            limit,
            offset,
            history: paginated
        });
    } catch (error) {
        console.error('Error in GET history:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE: Delete a specific report from history atomically
export async function DELETE(request) {
    try {
        const session = await getServerSession(request);
        const { searchParams } = new URL(request.url);
        const auth = authorizeTenantAccess(session, searchParams.get('userId'));
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }
        const reportId = searchParams.get('reportId');

        if (!reportId) {
            return NextResponse.json({ error: 'Falta reportId requerido' }, { status: 400 });
        }

        const userDir = getUserDataDir(auth.tenantId);
        const historyPath = join(userDir, 'reviews_analysis.json');

        let history = [];
        try {
            const data = await readFile(historyPath, 'utf-8');
            history = JSON.parse(data);
            if (!Array.isArray(history)) history = [];
        } catch {
            return NextResponse.json({ error: 'No se encontró historial para este usuario.' }, { status: 404 });
        }

        const initialLength = history.length;
        const filtered = history.filter(r => r.id !== reportId);

        if (filtered.length === initialLength) {
            return NextResponse.json({ error: 'Reporte no encontrado en el historial.' }, { status: 404 });
        }

        await writeJsonAtomic(historyPath, filtered);

        return NextResponse.json({
            success: true,
            message: 'Reporte eliminado del historial exitosamente.'
        });
    } catch (error) {
        console.error('Error in DELETE history:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
