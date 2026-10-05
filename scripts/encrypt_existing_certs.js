const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Get encryption key buffer
function getEncryptionKey() {
    const raw = process.env.AFIP_ENCRYPTION_KEY || 'b768072003136e7b1df2bb52da833a1488dc1500be715727ce2a865aa6207e17';
    if (/^[0-9a-fA-F]{64}$/.test(raw.trim())) {
        return Buffer.from(raw.trim(), 'hex');
    }
    return crypto.createHash('sha256').update(raw).digest();
}

function encryptData(data) {
    if (!data) return '';
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const inputBuffer = Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8');
    const encrypted = Buffer.concat([cipher.update(inputBuffer), cipher.final()]);
    const tag = cipher.getAuthTag();

    return `ENC_GCM:v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptData(data) {
    if (!data) return '';
    const text = Buffer.isBuffer(data) ? data.toString('utf8') : String(data).trim();
    if (!text.startsWith('ENC_GCM:v1:')) return text;

    const parts = text.split(':');
    if (parts.length !== 5) {
        throw new Error('Formato cifrado inválido');
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

async function migrate() {
    console.log('=== Starting AES-256-GCM Certificates & Private Keys Encryption Migration ===');
    const usersBaseDir = path.join(process.cwd(), 'data', 'users');

    if (!fs.existsSync(usersBaseDir)) {
        console.log(`Directory ${usersBaseDir} does not exist. Nothing to encrypt.`);
        return;
    }

    const userDirs = fs.readdirSync(usersBaseDir);
    let totalEncrypted = 0;
    let totalAlreadyEncrypted = 0;

    for (const userId of userDirs) {
        const userDirPath = path.join(usersBaseDir, userId);
        if (!fs.statSync(userDirPath).isDirectory()) continue;

        const filesToProcess = ['cert.crt', 'private.key'];
        for (const fileName of filesToProcess) {
            const filePath = path.join(userDirPath, fileName);
            if (!fs.existsSync(filePath)) continue;

            const content = fs.readFileSync(filePath, 'utf8').trim();

            if (content.startsWith('ENC_GCM:v1:')) {
                // Verify decryption
                try {
                    const decrypted = decryptData(content);
                    if (decrypted.includes('-----BEGIN')) {
                        console.log(`[OK - Already Encrypted] User: ${userId} -> ${fileName}`);
                        totalAlreadyEncrypted++;
                    } else {
                        console.warn(`[WARN] User: ${userId} -> ${fileName} was encrypted but payload has unexpected format.`);
                    }
                } catch (decErr) {
                    console.error(`[ERROR] Decryption failed for ${userId}/${fileName}:`, decErr.message);
                }
            } else if (content.includes('-----BEGIN')) {
                // Encrypt file
                const encrypted = encryptData(content);
                // Self-test decryption before saving to disk
                const decrypted = decryptData(encrypted);
                if (decrypted !== content) {
                    throw new Error(`Self-test decryption failed for user ${userId} file ${fileName}`);
                }
                fs.writeFileSync(filePath, encrypted, 'utf8');
                console.log(`[ENCRYPTED] User: ${userId} -> ${fileName} successfully encrypted with AES-256-GCM`);
                totalEncrypted++;
            } else {
                console.log(`[SKIPPED] User: ${userId} -> ${fileName} (unknown content format)`);
            }
        }
    }

    console.log(`\n=== Migration Finished: ${totalEncrypted} files encrypted, ${totalAlreadyEncrypted} files verified ===`);
}

migrate().catch(err => {
    console.error('Fatal error during migration:', err);
    process.exit(1);
});
