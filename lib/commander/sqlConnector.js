import dns from 'dns/promises';
import net from 'net';
import path from 'path';
import crypto from 'crypto';
import { getUserDataDir, writeJsonAtomic } from '../dataPaths.js';
import { encryptOAuthToken, decryptOAuthToken } from '../tokenCrypto.js';
import { loadJsonArray, processExternalIngestion } from './ingestService.js';

export const SUPPORTED_SQL_ENGINES = ['postgres', 'mysql', 'mssql'];

const DEFAULT_PORTS = {
    postgres: 5432,
    mysql: 3306,
    mssql: 1433
};

const QUERY_TIMEOUT_MS = 10000;
const MAX_PREVIEW_ROWS = 50;
const MAX_SYNC_ROWS = 5000;

export function getSqlConnectionsPath(tenantId) {
    return path.join(getUserDataDir(tenantId), 'commander_sql.json');
}

function isPrivateOrReservedIPv4(ip) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
        return true;
    }
    const [a, b] = parts;
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    if (a >= 224) return true; // multicast / reserved
    return false;
}

function isPrivateOrReservedIP(ip) {
    if (!ip || typeof ip !== 'string') return true;
    const lower = ip.toLowerCase().trim();
    if (net.isIPv4(lower)) {
        return isPrivateOrReservedIPv4(lower);
    }
    if (net.isIPv6(lower)) {
        if (lower === '::' || lower === '::1') return true;
        if (lower.startsWith('::ffff:')) {
            return isPrivateOrReservedIPv4(lower.slice(7));
        }
        // fc00::/7 unique local, fe80::/10 link-local, ff00::/8 multicast
        if (lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80') || lower.startsWith('ff')) {
            return true;
        }
        return false;
    }
    return true;
}

/**
 * Validates SQL host against SSRF targets (loopback, RFC1918, link-local/metadata).
 */
export async function validateSqlHost(rawHost) {
    const host = String(rawHost || '').trim();
    if (!host || host.length > 253 || /[\s/\\@?#]/.test(host)) {
        throw new Error('Host SQL inválido.');
    }

    if (process.env.COMMANDER_ALLOW_PRIVATE_SQL_HOSTS === '1') {
        return host;
    }

    const lower = host.toLowerCase();
    if (lower === 'localhost' || lower.endsWith('.local') || lower.endsWith('.internal')) {
        throw new Error('Host SQL bloqueado por política de seguridad (red privada/local no permitida).');
    }

    if (net.isIP(host)) {
        if (isPrivateOrReservedIP(host)) {
            throw new Error('Dirección IP privada o reservada bloqueada por política SSRF.');
        }
        return host;
    }

    let records;
    try {
        records = await dns.lookup(host, { all: true });
    } catch {
        throw new Error(`No se pudo resolver el host SQL "${host}".`);
    }

    if (!Array.isArray(records) || records.length === 0) {
        throw new Error(`No se pudo resolver el host SQL "${host}".`);
    }

    for (const rec of records) {
        if (isPrivateOrReservedIP(rec.address)) {
            throw new Error('El host SQL resuelve a una IP privada o reservada (bloqueado por SSRF).');
        }
    }

    return host;
}

export function normalizeSqlDataType(raw) {
    const val = String(raw || '').trim().toLowerCase();
    if (val === 'transactions' || val === 'bank_transactions') {
        return 'transactions';
    }
    return 'invoices';
}

export function validateIdentifier(identifier, label = 'identificador') {
    const val = String(identifier || '').trim();
    if (!/^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)?$/.test(val)) {
        throw new Error(`${label} SQL inválido: solo se permiten letras, números, guión bajo y esquema opcional.`);
    }
    return val;
}

export function validateReadOnlyUsername(rawUsername) {
    const username = String(rawUsername || '').trim();
    if (!username) {
        throw new Error('Usuario SQL obligatorio.');
    }
    const forbiddenUsers = new Set(['sa', 'root', 'postgres', 'sysadmin', 'admin', 'dbo']);
    if (forbiddenUsers.has(username.toLowerCase())) {
        throw new Error(`Usuario "${username}" rechazado: utilice una credencial dedicada de solo lectura (no superusuario/admin).`);
    }
    return username;
}

/**
 * Validates a user-provided SQL query to strictly allow a single read-only SELECT without side effects.
 */
export function validateReadOnlySelectQuery(rawQuery) {
    const trimmed = String(rawQuery || '').trim().replace(/;+\s*$/, '');
    if (!trimmed) {
        throw new Error('La consulta SQL no puede estar vacía.');
    }
    if (trimmed.includes(';')) {
        throw new Error('Solo se permite una única sentencia SELECT (sin múltiples sentencias).');
    }
    if (!/^SELECT\s+/i.test(trimmed)) {
        throw new Error('Solo se permiten consultas de lectura que comiencen con SELECT.');
    }

    // Strip single-quoted string literals before keyword scanning
    const withoutStrings = trimmed.replace(/'(?:''|[^'])*'/g, "''");
    if (/--|\/\*/.test(withoutStrings)) {
        throw new Error('No se permiten comentarios SQL (-- o /*) en la consulta.');
    }

    if (/\bSELECT\b[\s\S]*?\bINTO\b/i.test(withoutStrings)) {
        throw new Error('Consulta rechazada: SELECT ... INTO no está permitido en modo solo lectura.');
    }

    const forbidden = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|MERGE|CALL|GRANT|REVOKE|REPLACE|COPY|ATTACH|DETACH|PRAGMA|WAITFOR|OPENROWSET|OPENDATASOURCE|OPENQUERY|BULK|DBCC|RAISERROR|THROW|PRINT|SHUTDOWN|RECONFIGURE|BACKUP|RESTORE|DECLARE|SET|DO|LOCK|UNLOCK|LOAD|HANDLER|PG_SLEEP|PG_TERMINATE_BACKEND|PG_CANCEL_BACKEND|PG_READ_FILE|LO_IMPORT|LO_EXPORT|DBLINK|SLEEP|BENCHMARK|LOAD_FILE|SYS_EXEC)\b|\b(XP_|SP_)[A-Z0-9_]+/i;
    if (forbidden.test(withoutStrings)) {
        throw new Error('Consulta rechazada: contiene palabras clave o funciones con efectos secundarios prohibidas.');
    }

    return trimmed;
}

function quoteTableIdentifier(engine, tableName) {
    const clean = validateIdentifier(tableName, 'Tabla/Vista');
    const parts = clean.split('.');
    if (engine === 'postgres') {
        return parts.map((p) => `"${p}"`).join('.');
    }
    if (engine === 'mysql') {
        return parts.map((p) => `\`${p}\``).join('.');
    }
    return parts.map((p) => `[${p}]`).join('.');
}

function quoteColumnIdentifier(engine, colName) {
    const clean = String(colName || '').trim();
    if (!/^[a-zA-Z0-9_]+$/.test(clean)) {
        throw new Error('Nombre de columna incremental inválido.');
    }
    if (engine === 'postgres') return `"${clean}"`;
    if (engine === 'mysql') return `\`${clean}\``;
    return `[${clean}]`;
}

export function sanitizeSqlConnection(conn) {
    if (!conn) return null;
    const { encryptedPassword, ...safe } = conn;
    return {
        ...safe,
        hasPassword: Boolean(encryptedPassword)
    };
}

export async function listSqlConnections(tenantId) {
    const filePath = getSqlConnectionsPath(tenantId);
    const items = await loadJsonArray(filePath);
    return items.map(sanitizeSqlConnection);
}

export async function getSqlConnectionById(tenantId, connectionId, { includeSecret = false } = {}) {
    const filePath = getSqlConnectionsPath(tenantId);
    const items = await loadJsonArray(filePath);
    const found = items.find((c) => c.id === connectionId);
    if (!found) return null;
    if (!includeSecret) return sanitizeSqlConnection(found);
    return {
        ...found,
        password: found.encryptedPassword ? decryptOAuthToken(found.encryptedPassword) : ''
    };
}

export async function saveSqlConnection(tenantId, input) {
    const engine = String(input.engine || '').toLowerCase().trim();
    if (!SUPPORTED_SQL_ENGINES.includes(engine)) {
        throw new Error(`Motor SQL no soportado: ${engine}. Soportados: ${SUPPORTED_SQL_ENGINES.join(', ')}.`);
    }

    const name = String(input.name || '').trim() || `${engine.toUpperCase()} - ${input.database}`;
    const host = await validateSqlHost(input.host);
    const port = Number(input.port) || DEFAULT_PORTS[engine];
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('Puerto SQL inválido.');
    }

    const database = String(input.database || '').trim();
    const username = validateReadOnlyUsername(input.username);
    if (!database) {
        throw new Error('Base de datos y usuario son obligatorios.');
    }

    const tableOrQueryMode = input.tableOrQueryMode === 'query' ? 'query' : 'table';
    const tableName = input.tableName ? validateIdentifier(input.tableName, 'Tabla') : '';
    const customQuery = input.customQuery ? validateReadOnlySelectQuery(input.customQuery) : '';
    const syncColumn = input.syncColumn ? String(input.syncColumn).trim() : '';
    if (syncColumn && !/^[a-zA-Z0-9_]+$/.test(syncColumn)) {
        throw new Error('Columna incremental inválida.');
    }
    const tieBreakerColumn = input.tieBreakerColumn ? String(input.tieBreakerColumn).trim() : '';
    if (tieBreakerColumn && !/^[a-zA-Z0-9_]+$/.test(tieBreakerColumn)) {
        throw new Error('Columna de desempate inválida.');
    }
    if (syncColumn && !tieBreakerColumn) {
        throw new Error('Para sincronizaciones incrementales se exige configurar una clave de desempate única (ej. id) para garantizar paginación determinística sin omisión de registros.');
    }

    const filePath = getSqlConnectionsPath(tenantId);
    const items = await loadJsonArray(filePath);
    const now = new Date().toISOString();

    let existing = null;
    if (input.id) {
        existing = items.find((c) => c.id === input.id) || null;
    }

    const encryptedPassword =
        input.password && String(input.password).length > 0
            ? encryptOAuthToken(String(input.password))
            : existing?.encryptedPassword || '';

    const record = {
        id: existing ? existing.id : `sql_${crypto.randomBytes(6).toString('hex')}`,
        name,
        engine,
        host,
        port,
        database,
        username,
        encryptedPassword,
        ssl: Boolean(input.ssl),
        tableOrQueryMode,
        tableName,
        customQuery,
        dataType: normalizeSqlDataType(input.dataType),
        columnMapping: input.columnMapping && typeof input.columnMapping === 'object' ? input.columnMapping : {},
        syncColumn,
        tieBreakerColumn,
        lastWatermark: existing?.lastWatermark ?? null,
        lastTieBreaker: existing?.lastTieBreaker ?? null,
        hasMorePending: existing?.hasMorePending ?? false,
        lastSyncedAt: existing?.lastSyncedAt ?? null,
        lastSyncCount: existing?.lastSyncCount ?? 0,
        lastError: existing?.lastError ?? null,
        createdAt: existing?.createdAt || now,
        updatedAt: now
    };

    const next = existing
        ? items.map((c) => (c.id === existing.id ? record : c))
        : [...items, record];

    await writeJsonAtomic(filePath, next);
    return sanitizeSqlConnection(record);
}

export async function deleteSqlConnection(tenantId, connectionId) {
    const filePath = getSqlConnectionsPath(tenantId);
    const items = await loadJsonArray(filePath);
    const filtered = items.filter((c) => c.id !== connectionId);
    if (filtered.length === items.length) {
        return false;
    }
    await writeJsonAtomic(filePath, filtered);
    return true;
}

async function updateSqlConnectionMeta(tenantId, connectionId, patch) {
    const filePath = getSqlConnectionsPath(tenantId);
    const items = await loadJsonArray(filePath);
    const next = items.map((c) => (c.id === connectionId ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c));
    await writeJsonAtomic(filePath, next);
}

/**
 * Executes a single read-only query against Postgres, MySQL, or SQL Server.
 */
async function executeReadOnlySql(conn, sqlText, params = []) {
    await validateSqlHost(conn.host);
    validateReadOnlyUsername(conn.username);
    const engine = String(conn.engine || '').toLowerCase();
    const port = Number(conn.port) || DEFAULT_PORTS[engine];

    if (engine === 'postgres') {
        const pgModule = await import('pg');
        const Client = pgModule.Client || pgModule.default?.Client;
        const client = new Client({
            host: conn.host,
            port,
            database: conn.database,
            user: conn.username,
            password: conn.password || '',
            ssl: conn.ssl ? { rejectUnauthorized: true } : false,
            connectionTimeoutMillis: QUERY_TIMEOUT_MS,
            statement_timeout: QUERY_TIMEOUT_MS,
            query_timeout: QUERY_TIMEOUT_MS
        });
        await client.connect();
        try {
            await client.query('BEGIN TRANSACTION READ ONLY');
            const res = await client.query(sqlText, params);
            await client.query('ROLLBACK').catch(() => {});
            return res.rows || [];
        } catch (err) {
            await client.query('ROLLBACK').catch(() => {});
            throw err;
        } finally {
            await client.end().catch(() => {});
        }
    }

    if (engine === 'mysql') {
        const mysql = await import('mysql2/promise');
        const createConnection = mysql.createConnection || mysql.default?.createConnection;
        const connection = await createConnection({
            host: conn.host,
            port,
            database: conn.database,
            user: conn.username,
            password: conn.password || '',
            ssl: conn.ssl ? { rejectUnauthorized: true } : undefined,
            connectTimeout: QUERY_TIMEOUT_MS
        });
        try {
            await connection.query('SET SESSION TRANSACTION READ ONLY');
            await connection.query('START TRANSACTION READ ONLY');
            const [rows] = await connection.execute({ sql: sqlText, timeout: QUERY_TIMEOUT_MS }, params);
            await connection.query('ROLLBACK').catch(() => {});
            return Array.isArray(rows) ? rows : [];
        } catch (err) {
            await connection.query('ROLLBACK').catch(() => {});
            throw err;
        } finally {
            await connection.end().catch(() => {});
        }
    }

    if (engine === 'mssql') {
        const mssqlModule = await import('mssql');
        const sql = mssqlModule.default || mssqlModule;
        const pool = new sql.ConnectionPool({
            server: conn.host,
            port,
            database: conn.database,
            user: conn.username,
            password: conn.password || '',
            connectionTimeout: QUERY_TIMEOUT_MS,
            requestTimeout: QUERY_TIMEOUT_MS,
            options: {
                encrypt: Boolean(conn.ssl),
                trustServerCertificate: false
            }
        });
        await pool.connect();
        try {
            const req = pool.request();
            params.forEach((val, idx) => {
                req.input(`p${idx + 1}`, val);
            });
            const res = await req.query(sqlText);
            return res.recordset || [];
        } finally {
            await pool.close().catch(() => {});
        }
    }

    throw new Error(`Motor SQL no soportado: ${engine}`);
}

export async function testSqlConnection(connInput) {
    const start = Date.now();
    const rows = await executeReadOnlySql(connInput, 'SELECT 1 AS ok');
    return {
        connected: true,
        latencyMs: Date.now() - start,
        probeResult: rows[0] || { ok: 1 }
    };
}

export async function listAuthorizedTables(connInput) {
    const engine = String(connInput.engine || '').toLowerCase();
    let sqlText;
    if (engine === 'postgres') {
        sqlText = `
            SELECT table_schema, table_name, table_type
            FROM information_schema.tables
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY table_schema, table_name
        `;
    } else if (engine === 'mysql') {
        sqlText = `
            SELECT table_schema, table_name, table_type
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
            ORDER BY table_name
        `;
    } else {
        sqlText = `
            SELECT TABLE_SCHEMA AS table_schema, TABLE_NAME AS table_name, TABLE_TYPE AS table_type
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA NOT IN ('sys', 'INFORMATION_SCHEMA')
            ORDER BY TABLE_SCHEMA, TABLE_NAME
        `;
    }

    const rows = await executeReadOnlySql(connInput, sqlText);
    return rows.map((r) => {
        const schema = r.table_schema || r.TABLE_SCHEMA || '';
        const name = r.table_name || r.TABLE_NAME || '';
        const type = r.table_type || r.TABLE_TYPE || 'BASE TABLE';
        return {
            schema,
            name,
            fullName: engine === 'mysql' ? name : (schema ? `${schema}.${name}` : name),
            type
        };
    });
}

export function buildSelectWithLimit(conn, { maxRows, watermark, tieBreaker = null, offset = 0 }) {
    const engine = String(conn.engine || '').toLowerCase();
    const limit = Math.min(Math.max(1, Number(maxRows) || MAX_PREVIEW_ROWS), MAX_SYNC_ROWS);
    const safeOffset = Math.max(0, Number(offset) || 0);

    let baseSql;
    if (conn.tableOrQueryMode === 'query') {
        baseSql = validateReadOnlySelectQuery(conn.customQuery);
    } else {
        if (!conn.tableName) {
            throw new Error('Debe seleccionar una tabla o vista.');
        }
        const quotedTable = quoteTableIdentifier(engine, conn.tableName);
        baseSql = `SELECT * FROM ${quotedTable}`;
    }

    const params = [];
    let wrappedSql = baseSql;

    const hasSyncColumn = Boolean(conn.syncColumn && String(conn.syncColumn).trim());
    const hasTieBreaker = Boolean(conn.tieBreakerColumn && String(conn.tieBreakerColumn).trim());
    const colQuoted = hasSyncColumn ? quoteColumnIdentifier(engine, conn.syncColumn) : null;
    const tieQuoted = hasTieBreaker ? quoteColumnIdentifier(engine, conn.tieBreakerColumn) : null;
    const hasWatermark = hasSyncColumn && watermark !== null && watermark !== undefined && watermark !== '';
    const hasTieValue = hasTieBreaker && tieBreaker !== null && tieBreaker !== undefined && tieBreaker !== '';

    const orderParts = [];
    if (colQuoted) orderParts.push(`${colQuoted} ASC`);
    if (tieQuoted) orderParts.push(`${tieQuoted} ASC`);
    const orderSql = orderParts.length > 0 ? `ORDER BY ${orderParts.join(', ')}` : '';

    if (hasWatermark && hasTieValue) {
        // Deterministic keyset continuation: (syncCol > w) OR (syncCol = w AND tieCol > t)
        if (engine === 'postgres') {
            params.push(watermark, tieBreaker);
            wrappedSql = `SELECT * FROM (${baseSql}) AS _cmd_src WHERE (${colQuoted} > $1 OR (${colQuoted} = $1 AND ${tieQuoted} > $2))`;
        } else if (engine === 'mssql') {
            params.push(watermark, tieBreaker);
            wrappedSql = `SELECT * FROM (${baseSql}) AS _cmd_src WHERE (${colQuoted} > @p1 OR (${colQuoted} = @p1 AND ${tieQuoted} > @p2))`;
        } else {
            // MySQL: ? positional placeholders must match parameter count exactly (watermark, watermark, tieBreaker)
            params.push(watermark, watermark, tieBreaker);
            wrappedSql = `SELECT * FROM (${baseSql}) AS _cmd_src WHERE (${colQuoted} > ? OR (${colQuoted} = ? AND ${tieQuoted} > ?))`;
        }
    } else if (hasWatermark) {
        params.push(watermark);
        const p1 = engine === 'postgres' ? '$1' : engine === 'mssql' ? '@p1' : '?';
        wrappedSql = `SELECT * FROM (${baseSql}) AS _cmd_src WHERE ${colQuoted} >= ${p1}`;
    }

    if (engine === 'mssql') {
        const mssqlOrder = orderSql || 'ORDER BY (SELECT NULL)';
        return {
            sqlText: `SELECT * FROM (${wrappedSql}) AS _cmd_lim ${mssqlOrder} OFFSET ${safeOffset} ROWS FETCH NEXT ${limit} ROWS ONLY`,
            params
        };
    }

    const mysqlPgOrder = orderSql ? ` ${orderSql}` : '';
    return {
        sqlText: `SELECT * FROM (${wrappedSql}) AS _cmd_lim${mysqlPgOrder} LIMIT ${limit} OFFSET ${safeOffset}`.replace(/\s+/g, ' ').trim(),
        params
    };
}

export async function previewSqlRows(connInput, maxRows = MAX_PREVIEW_ROWS) {
    const { sqlText, params } = buildSelectWithLimit(connInput, { maxRows, watermark: null, offset: 0 });
    const rows = await executeReadOnlySql(connInput, sqlText, params);
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    return {
        headers,
        rows,
        rowCount: rows.length
    };
}

export async function syncSqlConnection(
    tenantId,
    connectionId,
    { columnMappingOverride, dataTypeOverride, queryExecutor = executeReadOnlySql, pageSize = MAX_SYNC_ROWS, maxPages = 20 } = {}
) {
    const conn = await getSqlConnectionById(tenantId, connectionId, { includeSecret: true });
    if (!conn) {
        throw new Error('Conexión SQL no encontrada.');
    }

    const effectivePageSize = Math.min(Math.max(1, Number(pageSize) || MAX_SYNC_ROWS), MAX_SYNC_ROWS);
    const effectiveMaxPages = Math.min(Math.max(1, Number(maxPages) || 20), 100);

    try {
        const dataType = dataTypeOverride
            ? normalizeSqlDataType(dataTypeOverride)
            : normalizeSqlDataType(conn.dataType);
        const columnMapping = columnMappingOverride || conn.columnMapping || {};

        let totalFetched = 0;
        let totalInserted = 0;
        let totalSkipped = 0;
        let currentWatermark = conn.lastWatermark;
        let currentTieBreaker = conn.lastTieBreaker ?? null;
        let offset = 0;
        let hasMorePending = false;
        const useKeyset = Boolean(conn.syncColumn && conn.tieBreakerColumn);

        for (let page = 0; page < effectiveMaxPages; page++) {
            const { sqlText, params } = buildSelectWithLimit(conn, {
                maxRows: effectivePageSize,
                watermark: currentWatermark,
                tieBreaker: useKeyset ? currentTieBreaker : null,
                offset: useKeyset ? 0 : offset
            });
            const rows = await queryExecutor(conn, sqlText, params);
            if (!Array.isArray(rows) || rows.length === 0) {
                hasMorePending = false;
                break;
            }

            totalFetched += rows.length;

            const ingestionResult = await processExternalIngestion({
                tenantId,
                ingestionType: 'sql',
                source: 'sql_import',
                provenance: 'external_sql',
                dataType,
                data: rows,
                fileName: `SQL:${conn.name}:${conn.database}`,
                columnMapping,
                mode: 'commit',
                skipDuplicates: true,
                metadata: {
                    connectionId: conn.id,
                    engine: conn.engine,
                    host: conn.host,
                    database: conn.database,
                    page
                }
            });

            if (!ingestionResult || !ingestionResult.ok) {
                throw new Error(ingestionResult?.error || 'Error validando registros SQL.');
            }

            totalInserted += ingestionResult.recordCount ?? 0;
            totalSkipped += ingestionResult.skippedDuplicates ?? 0;

            const lastRow = rows[rows.length - 1];
            if (conn.syncColumn && lastRow && lastRow[conn.syncColumn] !== undefined && lastRow[conn.syncColumn] !== null && lastRow[conn.syncColumn] !== '') {
                let candidate = lastRow[conn.syncColumn];
                if (candidate instanceof Date) candidate = candidate.toISOString();
                currentWatermark = candidate;
            }
            if (conn.tieBreakerColumn && lastRow && lastRow[conn.tieBreakerColumn] !== undefined && lastRow[conn.tieBreakerColumn] !== null && lastRow[conn.tieBreakerColumn] !== '') {
                currentTieBreaker = lastRow[conn.tieBreakerColumn];
            }

            const pageFull = rows.length === effectivePageSize;
            const reachedPageCap = page === effectiveMaxPages - 1 && pageFull;
            hasMorePending = reachedPageCap;

            // Persist cursor after each successfully ingested page for safe continuation
            await updateSqlConnectionMeta(tenantId, connectionId, {
                lastWatermark: currentWatermark,
                lastTieBreaker: currentTieBreaker,
                hasMorePending,
                lastSyncedAt: new Date().toISOString(),
                lastSyncCount: totalInserted,
                lastError: null
            });

            if (!pageFull) {
                break;
            }
            if (!useKeyset) {
                offset += rows.length;
            }
        }

        if (totalFetched === 0) {
            await updateSqlConnectionMeta(tenantId, connectionId, {
                hasMorePending: false,
                lastSyncedAt: new Date().toISOString(),
                lastSyncCount: 0,
                lastError: null
            });
        }

        const warning = hasMorePending
            ? 'Quedan registros pendientes por sincronizar: se alcanzó el límite de páginas por ejecución. Ejecute una nueva sincronización para continuar desde el último cursor.'
            : null;

        return {
            success: true,
            ok: true,
            dataType,
            fetchedCount: totalFetched,
            insertedCount: totalInserted,
            skippedDuplicatesCount: totalSkipped,
            lastWatermark: currentWatermark,
            lastTieBreaker: currentTieBreaker,
            hasMorePending,
            ...(warning ? { warning } : {})
        };
    } catch (err) {
        await updateSqlConnectionMeta(tenantId, connectionId, {
            lastError: err.message
        }).catch(() => {});
        throw err;
    }
}
