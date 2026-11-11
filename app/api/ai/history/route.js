import { NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { getServerSession, authorizeTenantAccess } from '@/lib/auth';
import { getUserDataDir } from '@/lib/dataPaths';

// GET: Retrieve all audit reports for a user
export async function GET(request) {
    try {
        const session = await getServerSession(request);
        const { searchParams } = new URL(request.url);
        const auth = authorizeTenantAccess(session, searchParams.get('userId'));
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const userDir = getUserDataDir(auth.tenantId);
        const historyPath = join(userDir, 'reviews_analysis.json');

        let history = [];
        try {
            const data = await readFile(historyPath, 'utf-8');
            history = JSON.parse(data);
        } catch (e) {
            // File does not exist, return empty history
        }

        return NextResponse.json({ success: true, history });

    } catch (error) {
        console.error("Error in GET history:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE: Delete a specific report from history
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
            return NextResponse.json({ error: "Falta reportId requerido" }, { status: 400 });
        }

        const userDir = getUserDataDir(auth.tenantId);
        const historyPath = join(userDir, 'reviews_analysis.json');

        let history = [];
        try {
            const data = await readFile(historyPath, 'utf-8');
            history = JSON.parse(data);
        } catch (e) {
            return NextResponse.json({ error: "No se encontró historial para este usuario." }, { status: 404 });
        }

        const filtered = history.filter(r => r.id !== reportId);
        
        await writeFile(historyPath, JSON.stringify(filtered, null, 2), 'utf-8');

        return NextResponse.json({ success: true, message: "Reporte eliminado del historial exitosamente." });

    } catch (error) {
        console.error("Error in DELETE history:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
