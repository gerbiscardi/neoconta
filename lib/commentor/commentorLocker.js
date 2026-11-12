/**
 * NeoConta - Commentor Concurrency Lock
 * Serializes sync and audit recalculations per tenant.
 */

const activeTenantLocks = new Map();

/**
 * Acquires an in-process lock for a tenant's Commentor operations.
 * @param {string|number} tenantId
 * @param {number} [timeoutMs=15000]
 * @returns {Promise<() => void>} release function
 */
export async function acquireCommentorLock(tenantId, timeoutMs = 15000) {
    const key = String(tenantId);
    const deadline = Date.now() + timeoutMs;

    while (activeTenantLocks.has(key)) {
        if (Date.now() >= deadline) {
            throw new Error('Tiempo de espera agotado para sincronización concurrente de Commentor.');
        }
        await new Promise(r => setTimeout(r, 50));
    }

    let isReleased = false;
    activeTenantLocks.set(key, Date.now());

    return function releaseLock() {
        if (!isReleased) {
            isReleased = true;
            activeTenantLocks.delete(key);
        }
    };
}
