import crypto from 'crypto';
import { getJwtSecret } from './auth.js';

function deriveScopeKey(scope) {
    return crypto
        .createHmac('sha256', getJwtSecret())
        .update(`neoconta-public-scope:${scope}`)
        .digest();
}

/**
 * Creates an HMAC-SHA256 signed token bound to a specific scope and expiration.
 */
export function createScopedToken(payload, scope, ttlSeconds) {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const body = { ...payload, scope, exp };
    const encoded = Buffer.from(JSON.stringify(body), 'utf8').toString('base64url');
    const sig = crypto.createHmac('sha256', deriveScopeKey(scope)).update(encoded).digest('base64url');
    return `${encoded}.${sig}`;
}

/**
 * Verifies an HMAC-SHA256 signed scoped token in constant time.
 * Returns decoded payload or null on invalid signature, wrong scope, or expiration.
 */
export function verifyScopedToken(token, expectedScope) {
    try {
        if (!token || typeof token !== 'string' || !token.includes('.')) {
            return null;
        }
        const parts = token.split('.');
        if (parts.length !== 2) return null;

        const [encoded, providedSig] = parts;
        if (!encoded || !providedSig) return null;

        const expectedSig = crypto
            .createHmac('sha256', deriveScopeKey(expectedScope))
            .update(encoded)
            .digest('base64url');

        const providedBuf = Buffer.from(providedSig, 'utf8');
        const expectedBuf = Buffer.from(expectedSig, 'utf8');
        if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
            return null;
        }

        const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
        if (!decoded || decoded.scope !== expectedScope) return null;
        if (!decoded.exp || typeof decoded.exp !== 'number' || decoded.exp < Math.floor(Date.now() / 1000)) {
            return null;
        }
        return decoded;
    } catch {
        return null;
    }
}

export function signAppointmentToken(tenantId, appointmentId, ttlDays = 30) {
    return createScopedToken(
        { tid: String(tenantId), aid: String(appointmentId) },
        'vitacore:appointment-confirm',
        ttlDays * 24 * 60 * 60
    );
}

export function verifyAppointmentToken(token, expectedAppointmentId) {
    const decoded = verifyScopedToken(token, 'vitacore:appointment-confirm');
    if (!decoded || !decoded.tid || !decoded.aid) return null;
    if (expectedAppointmentId && decoded.aid !== String(expectedAppointmentId)) return null;
    return { tenantId: String(decoded.tid), appointmentId: String(decoded.aid) };
}

export function signValidationToken(tenantId, docId, docType = 'prescription', ttlDays = 365) {
    return createScopedToken(
        { tid: String(tenantId), did: String(docId), dtype: String(docType) },
        'vitacore:document-validate',
        ttlDays * 24 * 60 * 60
    );
}

export function verifyValidationToken(token, expectedDocId) {
    const decoded = verifyScopedToken(token, 'vitacore:document-validate');
    if (!decoded || !decoded.tid || !decoded.did) return null;
    if (expectedDocId && decoded.did !== String(expectedDocId)) return null;
    return {
        tenantId: String(decoded.tid),
        docId: String(decoded.did),
        docType: decoded.dtype === 'order' ? 'order' : 'prescription'
    };
}

export function signOAuthState(tenantId, provider, ttlSeconds = 600) {
    const nonce = crypto.randomBytes(12).toString('hex');
    return createScopedToken(
        { tid: String(tenantId), provider: String(provider), nonce },
        'oauth:commentor-state',
        ttlSeconds
    );
}

export function verifyOAuthState(state, expectedProvider) {
    const decoded = verifyScopedToken(state, 'oauth:commentor-state');
    if (!decoded || !decoded.tid || decoded.provider !== expectedProvider) return null;
    return { tenantId: String(decoded.tid), provider: decoded.provider };
}
