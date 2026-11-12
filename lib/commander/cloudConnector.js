import path from 'path';
import * as XLSX from 'xlsx';
import { getUserDataDir, writeJsonAtomic } from '../dataPaths.js';
import { encryptOAuthToken, decryptOAuthToken } from '../tokenCrypto.js';
import { createScopedToken, verifyScopedToken } from '../publicTokens.js';
import { processExternalIngestion } from './ingestService.js';
import fs from 'fs/promises';

export const SUPPORTED_CLOUD_PROVIDERS = ['google_drive', 'onedrive'];

const STATE_SCOPES = {
    google_drive: 'oauth:commander-gdrive-state',
    onedrive: 'oauth:commander-onedrive-state'
};

function getAppUrl() {
    return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

export function getCloudCredentialsPath(tenantId) {
    return path.join(getUserDataDir(tenantId), 'commander_cloud.json');
}

async function loadCloudStore(tenantId) {
    const filePath = getCloudCredentialsPath(tenantId);
    try {
        const raw = await fs.readFile(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { providers: {}, history: [] };
    } catch {
        return { providers: {}, history: [] };
    }
}

export function getCloudProviderConfig(provider) {
    const p = String(provider || '').toLowerCase().trim();
    const appUrl = getAppUrl();

    if (p === 'google_drive') {
        const clientId = (process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '').trim();
        const clientSecret = (process.env.GOOGLE_DRIVE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '').trim();
        const missingEnv = [];
        if (!clientId) missingEnv.push('GOOGLE_DRIVE_CLIENT_ID / GOOGLE_CLIENT_ID');
        if (!clientSecret) missingEnv.push('GOOGLE_DRIVE_CLIENT_SECRET / GOOGLE_CLIENT_SECRET');
        return {
            provider: 'google_drive',
            label: 'Google Drive',
            configured: missingEnv.length === 0,
            missingEnv,
            clientId,
            clientSecret,
            scope: 'https://www.googleapis.com/auth/drive.readonly',
            redirectUri: `${appUrl}/api/commander/cloud/google/callback`
        };
    }

    if (p === 'onedrive') {
        const clientId = (process.env.MICROSOFT_CLIENT_ID || '').trim();
        const clientSecret = (process.env.MICROSOFT_CLIENT_SECRET || '').trim();
        const missingEnv = [];
        if (!clientId) missingEnv.push('MICROSOFT_CLIENT_ID');
        if (!clientSecret) missingEnv.push('MICROSOFT_CLIENT_SECRET');
        return {
            provider: 'onedrive',
            label: 'Microsoft OneDrive',
            configured: missingEnv.length === 0,
            missingEnv,
            clientId,
            clientSecret,
            scope: 'Files.Read offline_access',
            redirectUri: `${appUrl}/api/commander/cloud/onedrive/callback`
        };
    }

    const err = new Error(`Proveedor Cloud no soportado: ${provider}`);
    err.status = 400;
    throw err;
}

export async function getCloudStatus(tenantId) {
    const store = await loadCloudStore(tenantId);
    const providers = {};

    for (const p of SUPPORTED_CLOUD_PROVIDERS) {
        const cfg = getCloudProviderConfig(p);
        const saved = store.providers?.[p] || null;
        providers[p] = {
            provider: p,
            label: cfg.label,
            configured: cfg.configured,
            missingEnv: cfg.missingEnv,
            redirectUri: cfg.redirectUri,
            scope: cfg.scope,
            connected: Boolean(saved?.encryptedAccessToken),
            connectedAt: saved?.connectedAt || null,
            expiresAt: saved?.expiresAt || null,
            accountEmail: saved?.accountEmail || null,
            lastSyncedAt: saved?.lastSyncedAt || null
        };
    }

    return {
        providers,
        history: Array.isArray(store.history) ? store.history.slice(0, 25) : []
    };
}

export function buildCloudAuthUrl(tenantId, provider) {
    const cfg = getCloudProviderConfig(provider);
    if (!cfg.configured) {
        const err = new Error(
            `Integración ${cfg.label} no disponible: faltan credenciales OAuth (${cfg.missingEnv.join(', ')}).`
        );
        err.status = 501;
        err.missingEnv = cfg.missingEnv;
        throw err;
    }

    const state = createScopedToken({ tenantId, provider: cfg.provider }, STATE_SCOPES[cfg.provider], 600);

    if (cfg.provider === 'google_drive') {
        const params = new URLSearchParams({
            client_id: cfg.clientId,
            redirect_uri: cfg.redirectUri,
            response_type: 'code',
            scope: cfg.scope,
            access_type: 'offline',
            prompt: 'consent',
            state
        });
        return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }

    const params = new URLSearchParams({
        client_id: cfg.clientId,
        redirect_uri: cfg.redirectUri,
        response_type: 'code',
        scope: cfg.scope,
        response_mode: 'query',
        state
    });
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function saveCloudTokens(tenantId, provider, tokenData) {
    const filePath = getCloudCredentialsPath(tenantId);
    const store = await loadCloudStore(tenantId);
    const prev = store.providers?.[provider] || {};

    store.providers = store.providers || {};
    store.providers[provider] = {
        provider,
        encryptedAccessToken: encryptOAuthToken(tokenData.accessToken),
        encryptedRefreshToken: tokenData.refreshToken
            ? encryptOAuthToken(tokenData.refreshToken)
            : prev.encryptedRefreshToken || '',
        expiresAt: tokenData.expiresAt || null,
        scope: tokenData.scope || '',
        accountEmail: tokenData.accountEmail || prev.accountEmail || null,
        connectedAt: prev.connectedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastSyncedAt: prev.lastSyncedAt || null
    };

    await writeJsonAtomic(filePath, store);
    return true;
}

export async function exchangeCloudOAuthCode({ provider, code, state, fetchImpl = fetch }) {
    const cfg = getCloudProviderConfig(provider);
    if (!cfg.configured) {
        const err = new Error(`Integración ${cfg.label} no configurada (${cfg.missingEnv.join(', ')}).`);
        err.status = 501;
        throw err;
    }

    const verified = verifyScopedToken(state, STATE_SCOPES[cfg.provider]);
    if (!verified || !verified.tenantId || verified.provider !== cfg.provider) {
        const err = new Error('Estado OAuth inválido o expirado.');
        err.status = 403;
        throw err;
    }

    const tokenEndpoint =
        cfg.provider === 'google_drive'
            ? 'https://oauth2.googleapis.com/token'
            : 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

    const form = new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        code,
        redirect_uri: cfg.redirectUri,
        grant_type: 'authorization_code'
    });

    const resp = await fetchImpl(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString()
    });

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json.access_token) {
        const err = new Error(json.error_description || json.error || `Error OAuth ${cfg.label} (${resp.status})`);
        err.status = 502;
        throw err;
    }

    const expiresAt = json.expires_in
        ? new Date(Date.now() + Number(json.expires_in) * 1000).toISOString()
        : null;

    await saveCloudTokens(verified.tenantId, cfg.provider, {
        accessToken: json.access_token,
        refreshToken: json.refresh_token || '',
        expiresAt,
        scope: json.scope || cfg.scope
    });

    return {
        tenantId: verified.tenantId,
        provider: cfg.provider,
        connected: true
    };
}

async function getValidAccessToken(tenantId, provider, fetchImpl = fetch) {
    const cfg = getCloudProviderConfig(provider);
    if (!cfg.configured) {
        const err = new Error(`Integración ${cfg.label} no disponible: faltan credenciales (${cfg.missingEnv.join(', ')}).`);
        err.status = 501;
        throw err;
    }

    const store = await loadCloudStore(tenantId);
    const saved = store.providers?.[cfg.provider];
    if (!saved?.encryptedAccessToken) {
        const err = new Error(`${cfg.label} no está conectado para esta cuenta.`);
        err.status = 401;
        throw err;
    }

    const accessToken = decryptOAuthToken(saved.encryptedAccessToken);
    const refreshToken = saved.encryptedRefreshToken ? decryptOAuthToken(saved.encryptedRefreshToken) : '';

    const isExpiring = saved.expiresAt && new Date(saved.expiresAt).getTime() - Date.now() < 60000;
    if (!isExpiring || !refreshToken) {
        return accessToken;
    }

    const tokenEndpoint =
        cfg.provider === 'google_drive'
            ? 'https://oauth2.googleapis.com/token'
            : 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

    const form = new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
    });

    const resp = await fetchImpl(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString()
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json.access_token) {
        return accessToken;
    }

    const expiresAt = json.expires_in
        ? new Date(Date.now() + Number(json.expires_in) * 1000).toISOString()
        : saved.expiresAt;

    await saveCloudTokens(tenantId, cfg.provider, {
        accessToken: json.access_token,
        refreshToken: json.refresh_token || refreshToken,
        expiresAt,
        scope: json.scope || saved.scope
    });

    return json.access_token;
}

export async function listCloudSpreadsheets(tenantId, provider, { fetchImpl = fetch } = {}) {
    const accessToken = await getValidAccessToken(tenantId, provider, fetchImpl);

    if (provider === 'google_drive') {
        const q = [
            'trashed = false',
            "and (mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'",
            "or mimeType = 'application/vnd.ms-excel'",
            "or mimeType = 'text/csv'",
            "or mimeType = 'application/vnd.google-apps.spreadsheet')"
        ].join(' ');
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,modifiedTime,size)&pageSize=50&orderBy=modifiedTime%20desc`;
        const resp = await fetchImpl(url, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            const err = new Error(json.error?.message || `Error listando archivos de Google Drive (${resp.status})`);
            err.status = resp.status === 401 ? 401 : 502;
            throw err;
        }
        return (json.files || []).map((f) => ({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            modifiedTime: f.modifiedTime || null,
            size: Number(f.size) || null
        }));
    }

    const url = 'https://graph.microsoft.com/v1.0/me/drive/root/children?$top=100&$select=id,name,size,lastModifiedDateTime,file';
    const resp = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
        const err = new Error(json.error?.message || `Error listando archivos de OneDrive (${resp.status})`);
        err.status = resp.status === 401 ? 401 : 502;
        throw err;
    }

    return (json.value || [])
        .filter((item) => item.file && /\.(xlsx|xls|csv)$/i.test(item.name || ''))
        .map((f) => ({
            id: f.id,
            name: f.name,
            mimeType: f.file?.mimeType || 'application/octet-stream',
            modifiedTime: f.lastModifiedDateTime || null,
            size: Number(f.size) || null
        }));
}

export async function syncCloudFile(
    tenantId,
    { provider, fileId, dataType = 'invoices', columnMapping = {}, fetchImpl = fetch }
) {
    if (!fileId) {
        const err = new Error('fileId requerido para sincronizar.');
        err.status = 400;
        throw err;
    }

    const accessToken = await getValidAccessToken(tenantId, provider, fetchImpl);
    let fileMeta;
    let fileBuffer;

    if (provider === 'google_drive') {
        const metaUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,modifiedTime`;
        const metaResp = await fetchImpl(metaUrl, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const metaJson = await metaResp.json().catch(() => ({}));
        if (!metaResp.ok || !metaJson.id) {
            const err = new Error(metaJson.error?.message || `No se pudo obtener metadata del archivo (${metaResp.status})`);
            err.status = 502;
            throw err;
        }
        fileMeta = {
            id: metaJson.id,
            name: metaJson.name,
            mimeType: metaJson.mimeType,
            modifiedTime: metaJson.modifiedTime || null
        };

        const isGoogleSheet = metaJson.mimeType === 'application/vnd.google-apps.spreadsheet';
        const downloadUrl = isGoogleSheet
            ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=${encodeURIComponent('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}`
            : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;

        const dlResp = await fetchImpl(downloadUrl, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!dlResp.ok) {
            const err = new Error(`Error descargando archivo de Google Drive (${dlResp.status})`);
            err.status = 502;
            throw err;
        }
        fileBuffer = Buffer.from(await dlResp.arrayBuffer());
    } else {
        const metaUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(fileId)}?$select=id,name,lastModifiedDateTime,file`;
        const metaResp = await fetchImpl(metaUrl, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const metaJson = await metaResp.json().catch(() => ({}));
        if (!metaResp.ok || !metaJson.id) {
            const err = new Error(metaJson.error?.message || `No se pudo obtener metadata de OneDrive (${metaResp.status})`);
            err.status = 502;
            throw err;
        }
        fileMeta = {
            id: metaJson.id,
            name: metaJson.name,
            mimeType: metaJson.file?.mimeType || 'application/octet-stream',
            modifiedTime: metaJson.lastModifiedDateTime || null
        };

        const contentUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(fileId)}/content`;
        const dlResp = await fetchImpl(contentUrl, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!dlResp.ok) {
            const err = new Error(`Error descargando archivo de OneDrive (${dlResp.status})`);
            err.status = 502;
            throw err;
        }
        fileBuffer = Buffer.from(await dlResp.arrayBuffer());
    }

    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) {
        const err = new Error('El archivo descargado no contiene hojas válidas.');
        err.status = 400;
        throw err;
    }
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: '' });

    const idempotencyKey = `${provider}:${fileId}:${fileMeta.modifiedTime || rows.length}`;
    const ingestionResult = await processExternalIngestion({
        tenantId,
        ingestionType: 'cloud',
        source: 'cloud_import',
        provenance: 'external_cloud',
        dataType,
        data: rows,
        fileName: `Cloud:${provider}:${fileMeta.name}`,
        columnMapping,
        mode: 'commit',
        skipDuplicates: true,
        idempotencyKey,
        metadata: {
            provider,
            externalFileId: fileMeta.id,
            externalFileName: fileMeta.name,
            externalModifiedTime: fileMeta.modifiedTime
        }
    });

    if (!ingestionResult.ok) {
        const err = new Error(ingestionResult.error || 'Error validando registros del archivo Cloud.');
        err.status = ingestionResult.status || 400;
        throw err;
    }

    const insertedCount = ingestionResult.recordCount ?? 0;
    const skippedDuplicatesCount = ingestionResult.skippedDuplicates ?? 0;
    const deduplicatedBatch = Boolean(ingestionResult.idempotentReplay);

    const storePath = getCloudCredentialsPath(tenantId);
    const store = await loadCloudStore(tenantId);
    if (store.providers?.[provider]) {
        store.providers[provider].lastSyncedAt = new Date().toISOString();
    }
    store.history = [
        {
            timestamp: new Date().toISOString(),
            provider,
            fileId: fileMeta.id,
            fileName: fileMeta.name,
            modifiedTime: fileMeta.modifiedTime,
            insertedCount,
            skippedDuplicatesCount,
            deduplicatedBatch
        },
        ...(Array.isArray(store.history) ? store.history : [])
    ].slice(0, 50);
    await writeJsonAtomic(storePath, store);

    return {
        success: true,
        file: fileMeta,
        ...ingestionResult,
        insertedCount,
        skippedDuplicatesCount,
        deduplicatedBatch
    };
}

export async function disconnectCloudProvider(tenantId, provider) {
    const cfg = getCloudProviderConfig(provider);
    const filePath = getCloudCredentialsPath(tenantId);
    const store = await loadCloudStore(tenantId);
    if (store.providers && store.providers[cfg.provider]) {
        delete store.providers[cfg.provider];
        await writeJsonAtomic(filePath, store);
        return true;
    }
    return false;
}
