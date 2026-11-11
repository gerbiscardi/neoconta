import crypto from 'crypto';
import { getJwtSecret } from './auth.js';
import { decryptData } from './crypto.js';

const PREFIX_V1 = 'ENC_OAUTH:v1:';

function getOAuthEncryptionKey() {
    const raw =
        (process.env.OAUTH_ENCRYPTION_KEY && process.env.OAUTH_ENCRYPTION_KEY.trim()) ||
        (process.env.AFIP_ENCRYPTION_KEY && process.env.AFIP_ENCRYPTION_KEY.trim()) ||
        getJwtSecret();

    return crypto.createHash('sha256').update(`neoconta-oauth-v1:${raw}`).digest();
}

export function isEncryptedOAuthToken(value) {
    return typeof value === 'string' && value.startsWith(PREFIX_V1);
}

/**
 * Encrypts an OAuth access/refresh token for storage at rest using AES-256-GCM.
 * Idempotent: returns already-encrypted tokens unchanged.
 * @param {string|null|undefined} plaintext
 * @returns {string}
 */
export function encryptOAuthToken(plaintext) {
    if (plaintext === null || plaintext === undefined || plaintext === '') return '';
    const str = String(plaintext);
    if (str.startsWith(PREFIX_V1)) return str;

    const key = getOAuthEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(str, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return `${PREFIX_V1}${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts an OAuth token encrypted with encryptOAuthToken (or legacy AES-GCM/plaintext during migration).
 * Rejects tampered ciphertext/auth tags.
 * @param {string|null|undefined} stored
 * @returns {string}
 */
export function decryptOAuthToken(stored) {
    if (stored === null || stored === undefined || stored === '') return '';
    const str = String(stored).trim();

    if (str.startsWith('ENC_GCM:v1:')) {
        return decryptData(str);
    }

    if (!str.startsWith(PREFIX_V1)) {
        return str;
    }

    const body = str.slice(PREFIX_V1.length);
    const parts = body.split(':');
    if (parts.length !== 3) {
        throw new Error('Formato de token OAuth cifrado inválido.');
    }

    const [ivHex, tagHex, encryptedHex] = parts;
    const key = getOAuthEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
}
