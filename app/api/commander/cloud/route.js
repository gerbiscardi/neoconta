import { getServerSession, authorizeTenantAccess } from '@/lib/auth';
import {
    getCloudStatus,
    listCloudSpreadsheets,
    syncCloudFile,
    disconnectCloudProvider
} from '@/lib/commander/cloudConnector';

function jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

export async function GET(request) {
    try {
        const session = await getServerSession(request);
        const { searchParams } = new URL(request.url);
        const requestedUserId = searchParams.get('userId');
        const action = searchParams.get('action') || 'status';
        const provider = searchParams.get('provider');

        const auth = authorizeTenantAccess(session, requestedUserId);
        if (!auth.authorized) {
            return jsonResponse({ error: auth.error }, auth.status);
        }

        if (action === 'files' && provider) {
            const files = await listCloudSpreadsheets(auth.tenantId, provider);
            return jsonResponse({ success: true, provider, files });
        }

        const status = await getCloudStatus(auth.tenantId);
        return jsonResponse({ success: true, ...status });
    } catch (error) {
        return jsonResponse({ error: error.message || 'Error consultando integración Cloud' }, error.status || 500);
    }
}

export async function POST(request) {
    try {
        const session = await getServerSession(request);
        const body = await request.json();
        const auth = authorizeTenantAccess(session, body?.userId);
        if (!auth.authorized) {
            return jsonResponse({ error: auth.error }, auth.status);
        }

        const { provider, fileId, dataType, columnMapping } = body || {};
        if (!provider || !fileId) {
            return jsonResponse({ error: 'provider y fileId son obligatorios.' }, 400);
        }

        const result = await syncCloudFile(auth.tenantId, {
            provider,
            fileId,
            dataType: dataType || 'invoices',
            columnMapping: columnMapping || {}
        });

        return jsonResponse(result, 200);
    } catch (error) {
        return jsonResponse({ error: error.message || 'Error sincronizando archivo Cloud' }, error.status || 500);
    }
}

export async function DELETE(request) {
    try {
        const session = await getServerSession(request);
        const { searchParams } = new URL(request.url);
        const requestedUserId = searchParams.get('userId');
        const provider = searchParams.get('provider');

        const auth = authorizeTenantAccess(session, requestedUserId);
        if (!auth.authorized) {
            return jsonResponse({ error: auth.error }, auth.status);
        }

        if (!provider) {
            return jsonResponse({ error: 'provider requerido.' }, 400);
        }

        await disconnectCloudProvider(auth.tenantId, provider);
        return jsonResponse({ success: true });
    } catch (error) {
        return jsonResponse({ error: error.message || 'Error desconectando proveedor Cloud' }, error.status || 500);
    }
}
