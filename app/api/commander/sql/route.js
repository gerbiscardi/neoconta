import { getServerSession, authorizeTenantAccess } from '@/lib/auth';
import {
    SUPPORTED_SQL_ENGINES,
    listSqlConnections,
    getSqlConnectionById,
    saveSqlConnection,
    deleteSqlConnection,
    testSqlConnection,
    listAuthorizedTables,
    previewSqlRows,
    syncSqlConnection
} from '@/lib/commander/sqlConnector';

function jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

async function resolveConnectionCredentials(tenantId, body) {
    if (body.connectionId) {
        const saved = await getSqlConnectionById(tenantId, body.connectionId, { includeSecret: true });
        if (!saved) {
            const err = new Error('Conexión SQL no encontrada.');
            err.status = 404;
            throw err;
        }
        return {
            ...saved,
            engine: body.engine || saved.engine,
            host: body.host || saved.host,
            port: body.port || saved.port,
            database: body.database || saved.database,
            username: body.username || saved.username,
            password: body.password ? String(body.password) : saved.password,
            ssl: body.ssl !== undefined ? Boolean(body.ssl) : saved.ssl,
            tableOrQueryMode: body.tableOrQueryMode || saved.tableOrQueryMode,
            tableName: body.tableName !== undefined ? body.tableName : saved.tableName,
            customQuery: body.customQuery !== undefined ? body.customQuery : saved.customQuery,
            syncColumn: body.syncColumn !== undefined ? body.syncColumn : saved.syncColumn
        };
    }

    return {
        engine: body.engine,
        host: body.host,
        port: body.port,
        database: body.database,
        username: body.username,
        password: body.password || '',
        ssl: Boolean(body.ssl),
        tableOrQueryMode: body.tableOrQueryMode || 'table',
        tableName: body.tableName || '',
        customQuery: body.customQuery || '',
        syncColumn: body.syncColumn || ''
    };
}

export async function GET(request) {
    try {
        const session = await getServerSession(request);
        const { searchParams } = new URL(request.url);
        const requestedUserId = searchParams.get('userId');

        const auth = authorizeTenantAccess(session, requestedUserId);
        if (!auth.authorized) {
            return jsonResponse({ error: auth.error }, auth.status);
        }

        const connections = await listSqlConnections(auth.tenantId);
        return jsonResponse({
            success: true,
            connections,
            supportedEngines: SUPPORTED_SQL_ENGINES
        });
    } catch (error) {
        console.error('Error in /api/commander/sql GET:', error);
        return jsonResponse({ error: 'Error interno del servidor' }, 500);
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

        const action = String(body?.action || '').trim();

        if (action === 'save') {
            const connection = await saveSqlConnection(auth.tenantId, body);
            return jsonResponse({ success: true, connection });
        }

        if (action === 'test') {
            const creds = await resolveConnectionCredentials(auth.tenantId, body);
            const result = await testSqlConnection(creds);
            return jsonResponse({ success: true, ...result });
        }

        if (action === 'tables') {
            const creds = await resolveConnectionCredentials(auth.tenantId, body);
            const tables = await listAuthorizedTables(creds);
            return jsonResponse({ success: true, tables });
        }

        if (action === 'preview') {
            const creds = await resolveConnectionCredentials(auth.tenantId, body);
            const preview = await previewSqlRows(creds, body.maxRows || 50);
            return jsonResponse({ success: true, ...preview });
        }

        if (action === 'sync') {
            if (!body.connectionId) {
                return jsonResponse({ error: 'connectionId requerido para sincronizar.' }, 400);
            }
            const result = await syncSqlConnection(auth.tenantId, body.connectionId, {
                columnMappingOverride: body.columnMapping,
                dataTypeOverride: body.dataType
            });
            return jsonResponse(result);
        }

        return jsonResponse({ error: 'Acción SQL no reconocida.' }, 400);
    } catch (error) {
        const status = error.status || 400;
        return jsonResponse({ error: error.message || 'Error ejecutando operación SQL' }, status);
    }
}

export async function DELETE(request) {
    try {
        const session = await getServerSession(request);
        const { searchParams } = new URL(request.url);
        const requestedUserId = searchParams.get('userId');
        const connectionId = searchParams.get('connectionId');

        const auth = authorizeTenantAccess(session, requestedUserId);
        if (!auth.authorized) {
            return jsonResponse({ error: auth.error }, auth.status);
        }

        if (!connectionId) {
            return jsonResponse({ error: 'connectionId requerido.' }, 400);
        }

        const deleted = await deleteSqlConnection(auth.tenantId, connectionId);
        if (!deleted) {
            return jsonResponse({ error: 'Conexión SQL no encontrada.' }, 404);
        }

        return jsonResponse({ success: true });
    } catch (error) {
        console.error('Error in /api/commander/sql DELETE:', error);
        return jsonResponse({ error: 'Error interno del servidor' }, 500);
    }
}
