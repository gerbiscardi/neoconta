import { getServerSession, authorizeTenantAccess } from '@/lib/auth';
import {
    getIngestPaths,
    loadJsonArray,
    processExternalIngestion,
    rollbackExternalBatch
} from '@/lib/commander/ingestService';

export async function GET(request) {
    try {
        const session = await getServerSession(request);
        const { searchParams } = new URL(request.url);
        const requestedUserId = searchParams.get('userId');

        const auth = authorizeTenantAccess(session, requestedUserId);
        if (!auth.authorized) {
            return new Response(JSON.stringify({ error: auth.error }), { status: auth.status });
        }

        const { ingestionsFilePath } = getIngestPaths(auth.tenantId);
        const ingestions = await loadJsonArray(ingestionsFilePath);
        ingestions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return new Response(JSON.stringify({ success: true, ingestions }), { status: 200 });
    } catch (error) {
        console.error('Error in /api/commander/ingest GET:', error);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
    }
}

export async function POST(request) {
    try {
        const session = await getServerSession(request);
        const body = await request.json();
        const {
            userId,
            ingestionType,
            dataType,
            data,
            fileName,
            columnMapping,
            mode = 'commit',
            skipDuplicates = false,
            idempotencyKey = null
        } = body || {};

        const auth = authorizeTenantAccess(session, userId);
        if (!auth.authorized) {
            return new Response(JSON.stringify({ error: auth.error }), { status: auth.status });
        }

        if (ingestionType === 'sql' || ingestionType === 'cloud') {
            return new Response(JSON.stringify({
                success: false,
                code: 'INTEGRATION_NOT_AVAILABLE',
                error: 'Integración todavía no disponible'
            }), { status: 501 });
        }

        if (ingestionType !== 'excel') {
            return new Response(JSON.stringify({ error: 'Tipo de ingesta no válido' }), { status: 400 });
        }

        const result = await processExternalIngestion({
            tenantId: auth.tenantId,
            ingestionType: 'excel',
            source: 'excel_import',
            provenance: 'external_excel',
            dataType,
            data,
            fileName,
            columnMapping,
            mode: mode === 'preview' ? 'preview' : 'commit',
            skipDuplicates: Boolean(skipDuplicates),
            idempotencyKey
        });

        const { status, ok, ...payload } = result;
        return new Response(JSON.stringify({ success: ok, ...payload }), { status });
    } catch (error) {
        console.error('Error in /api/commander/ingest POST:', error);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const session = await getServerSession(request);
        const { searchParams } = new URL(request.url);
        const requestedUserId = searchParams.get('userId');
        const batchId = searchParams.get('batchId');

        const auth = authorizeTenantAccess(session, requestedUserId);
        if (!auth.authorized) {
            return new Response(JSON.stringify({ error: auth.error }), { status: auth.status });
        }

        if (!batchId) {
            return new Response(JSON.stringify({ error: 'batchId es requerido' }), { status: 400 });
        }

        const result = await rollbackExternalBatch(auth.tenantId, batchId);
        const { status, ok, ...payload } = result;
        return new Response(JSON.stringify({ success: ok, ...payload }), { status });
    } catch (error) {
        console.error('Error in /api/commander/ingest DELETE:', error);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
    }
}
