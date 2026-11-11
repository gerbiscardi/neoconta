import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

/**
 * Resolves the root directory for persisted NeoConta file data.
 * Defaults to `<cwd>/data` in production/runtime and honors `NEOCONTA_DATA_DIR`
 * for completely isolated test environments without ever touching real files.
 */
export function getDataRoot() {
    if (process.env.NEOCONTA_DATA_DIR && process.env.NEOCONTA_DATA_DIR.trim() !== '') {
        return path.resolve(process.env.NEOCONTA_DATA_DIR.trim());
    }
    return path.join(process.cwd(), 'data');
}

export function getUsersRootDir() {
    return path.join(getDataRoot(), 'users');
}

export function getUserDataDir(userId) {
    return path.join(getUsersRootDir(), String(userId));
}

export function getInvoicesDir() {
    return path.join(getDataRoot(), 'invoices');
}

export function getInvoiceHistoryPath(userId) {
    return path.join(getInvoicesDir(), `${String(userId)}_history.json`);
}

export function getTicketsDir() {
    return path.join(getDataRoot(), 'tickets');
}

export function getForecastingLedgerDir() {
    return path.join(getDataRoot(), 'forecasting_ledger');
}

export function getPlatformConfigPath() {
    return path.join(getDataRoot(), 'platform_config.json');
}

/**
 * Resolves `users.json` mirror path. Honors `USERS_JSON_PATH`, falling back
 * to `<dataRoot>/users.json` (which itself isolates under `NEOCONTA_DATA_DIR`).
 */
export function getUsersJsonPath() {
    if (process.env.USERS_JSON_PATH && process.env.USERS_JSON_PATH.trim() !== '') {
        return path.resolve(process.env.USERS_JSON_PATH.trim());
    }
    return path.join(getDataRoot(), 'users.json');
}

/**
 * Writes JSON atomically using a unique temporary file in the target directory
 * followed by atomic rename, preventing torn/partial JSON corruption on failure.
 */
export async function writeJsonAtomic(filePath, data) {
    const resolved = path.resolve(filePath);
    if (
        process.env.NEOCONTA_INJECT_JSON_WRITE_ERROR_TARGET &&
        resolved === path.resolve(process.env.NEOCONTA_INJECT_JSON_WRITE_ERROR_TARGET)
    ) {
        throw new Error('Injected atomic JSON write failure');
    }
    const dir = path.dirname(resolved);
    await fs.mkdir(dir, { recursive: true });
    const tmpPath = path.join(dir, `.${path.basename(resolved)}.tmp-${process.pid}-${crypto.randomBytes(6).toString('hex')}`);
    const payload = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    try {
        await fs.writeFile(tmpPath, payload, 'utf-8');
        await fs.rename(tmpPath, resolved);
    } catch (err) {
        await fs.unlink(tmpPath).catch(() => {});
        throw err;
    }
}
