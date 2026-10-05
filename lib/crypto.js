import crypto from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const FALLBACK_KEY = 'b768072003136e7b1df2bb52da833a1488dc1500be715727ce2a865aa6207e17';

/**
 * Returns a 32-byte (256-bit) buffer derived from AFIP_ENCRYPTION_KEY or a secure fallback.
 */
export function getEncryptionKey() {
    let raw = process.env.AFIP_ENCRYPTION_KEY;

    if (!raw) {
        // Attempt to read from .env.local or .env if running outside Next.js runtime
        try {
            const envFiles = [join(process.cwd(), '.env.local'), join(process.cwd(), '.env')];
            for (const ef of envFiles) {
                if (existsSync(ef)) {
                    const content = readFileSync(ef, 'utf8');
                    const match = content.match(/AFIP_ENCRYPTION_KEY\s*=\s*["']?([a-zA-Z0-9_-]+)["']?/);
                    if (match && match[1]) {
                        raw = match[1];
                        break;
                    }
                }
            }
        } catch {
            // ignore and fallback
        }
    }

    raw = raw || FALLBACK_KEY;

    if (/^[0-9a-fA-F]{64}$/.test(raw.trim())) {
        return Buffer.from(raw.trim(), 'hex');
    }
    return crypto.createHash('sha256').update(raw).digest();
}

/**
 * Encrypts arbitrary string or buffer using AES-256-GCM.
 * Output format: ENC_GCM:v1:<iv_hex>:<tag_hex>:<ciphertext_hex>
 * @param {string|Buffer} data
 * @returns {string}
 */
export function encryptData(data) {
    if (data === null || data === undefined || data === '') return '';
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(12); // Standard 96-bit IV for AES-GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const inputBuffer = Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8');
    const encrypted = Buffer.concat([cipher.update(inputBuffer), cipher.final()]);
    const tag = cipher.getAuthTag();

    return `ENC_GCM:v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts data in ENC_GCM:v1 format.
 * If data does not start with ENC_GCM:v1:, gracefully returns it as-is for retrocompatibility.
 * @param {string|Buffer} data
 * @returns {string}
 */
export function decryptData(data) {
    if (data === null || data === undefined || data === '') return '';
    const text = Buffer.isBuffer(data) ? data.toString('utf8') : String(data).trim();

    // Retrocompatible fallback for legacy plaintext PEM files
    if (!text.startsWith('ENC_GCM:v1:')) {
        return text;
    }

    const parts = text.split(':');
    if (parts.length !== 5) {
        throw new Error('Formato cifrado inválido para archivo de seguridad.');
    }

    const [, , ivHex, tagHex, encryptedHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
}

/**
 * Verifies if user has a certificate file stored on disk.
 * @param {string} userId
 * @returns {boolean}
 */
export function userHasCert(userId) {
    if (!userId) return false;
    const certPath = join(process.cwd(), 'data', 'users', userId, 'cert.crt');
    return existsSync(certPath);
}

/**
 * Synchronously reads and decrypts user AFIP cert and private key into memory.
 * Does not write any unencrypted data to disk.
 * @param {string} userId
 * @returns {{ certContent: string, keyContent: string } | null}
 */
export function loadDecryptedUserCredentialsSync(userId) {
    if (!userId) return null;
    const userDir = join(process.cwd(), 'data', 'users', userId);
    const certPath = join(userDir, 'cert.crt');
    const keyPath = join(userDir, 'private.key');

    if (!existsSync(certPath) || !existsSync(keyPath)) {
        return null;
    }

    const rawCert = readFileSync(certPath, 'utf8');
    const rawKey = readFileSync(keyPath, 'utf8');

    return {
        certContent: decryptData(rawCert),
        keyContent: decryptData(rawKey)
    };
}

/**
 * Asynchronously reads and decrypts user AFIP cert and private key into memory.
 * @param {string} userId
 * @returns {Promise<{ certContent: string, keyContent: string } | null>}
 */
export async function loadDecryptedUserCredentials(userId) {
    if (!userId) return null;
    const userDir = join(process.cwd(), 'data', 'users', userId);
    const certPath = join(userDir, 'cert.crt');
    const keyPath = join(userDir, 'private.key');

    if (!existsSync(certPath) || !existsSync(keyPath)) {
        return null;
    }

    const [rawCert, rawKey] = await Promise.all([
        readFile(certPath, 'utf8'),
        readFile(keyPath, 'utf8')
    ]);

    return {
        certContent: decryptData(rawCert),
        keyContent: decryptData(rawKey)
    };
}

/**
 * Encrypts and saves a sensitive user credential file (cert.crt or private.key) to disk.
 * @param {string} userId
 * @param {string} filename
 * @param {string|Buffer} content
 */
export async function saveEncryptedUserFile(userId, filename, content) {
    if (!userId || !filename) throw new Error('Parámetros inválidos para guardar archivo cifrado.');
    const userDir = join(process.cwd(), 'data', 'users', userId);
    await mkdir(userDir, { recursive: true });

    const targetPath = join(userDir, filename);
    const encrypted = encryptData(content);
    await writeFile(targetPath, encrypted, 'utf8');
}
