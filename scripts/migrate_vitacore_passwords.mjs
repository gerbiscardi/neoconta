import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function resolveUsersJsonPath() {
    const argIndex = process.argv.indexOf('--users-json');
    if (argIndex !== -1 && process.argv[argIndex + 1]) {
        return path.resolve(process.argv[argIndex + 1]);
    }
    if (process.env.USERS_JSON_PATH) {
        return path.resolve(process.env.USERS_JSON_PATH);
    }
    return path.join(process.cwd(), 'data', 'users.json');
}

function getArgValue(flag) {
    const idx = process.argv.indexOf(flag);
    if (idx !== -1 && process.argv[idx + 1]) {
        return process.argv[idx + 1];
    }
    return null;
}

function isBcryptHash(val) {
    return typeof val === 'string' && (val.startsWith('$2a$') || val.startsWith('$2b$') || val.startsWith('$2y$'));
}

async function writeJsonAtomic(filePath, data) {
    const resolved = path.resolve(filePath);
    const dir = path.dirname(resolved);
    await fs.mkdir(dir, { recursive: true });
    const tempPath = path.join(dir, `.${path.basename(resolved)}.tmp-${process.pid}-${crypto.randomBytes(6).toString('hex')}`);
    try {
        await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
        await fs.rename(tempPath, resolved);
    } catch (err) {
        await fs.unlink(tempPath).catch(() => {});
        throw err;
    }
}

function redactPlaintextPasswords(users) {
    return users.map(u => {
        if (!u || typeof u !== 'object') return u;
        if (!u.password || isBcryptHash(u.password)) return { ...u };
        return {
            ...u,
            password: '[REDACTED_PLAINTEXT_REMOVED]',
            legacyPlaintextRedacted: true
        };
    });
}

async function restoreFromBackup(backupFileArg, usersJsonPath, dryRun) {
    const backupPath = path.resolve(backupFileArg);
    const raw = await fs.readFile(backupPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
        throw new Error(`El respaldo en ${backupPath} no contiene un array válido de usuarios.`);
    }

    const restoredUsers = [];
    let preservedBcryptCount = 0;
    let adoptedPrismaHashCount = 0;
    let lockedColdRestoreCount = 0;

    for (const entry of parsed) {
        if (!entry || typeof entry !== 'object') continue;
        const cleanEmail = entry.email ? String(entry.email).trim().toLowerCase() : null;
        const userId = entry.id ? String(entry.id) : null;

        let existingPrisma = null;
        if (userId) {
            existingPrisma = await prisma.user.findUnique({ where: { id: userId } });
        }
        if (!existingPrisma && cleanEmail) {
            existingPrisma = await prisma.user.findUnique({ where: { email: cleanEmail } });
        }

        const nextEntry = { ...entry };
        delete nextEntry.legacyPlaintextRedacted;

        if (isBcryptHash(entry.password)) {
            preservedBcryptCount++;
        } else if (existingPrisma && isBcryptHash(existingPrisma.password)) {
            // Preserve active bcrypt hash from Prisma without ever restoring plaintext
            nextEntry.password = existingPrisma.password;
            nextEntry.mustChangePassword = Boolean(existingPrisma.mustChangePassword);
            adoptedPrismaHashCount++;
        } else {
            // Cold restore of a redacted account: generate high-entropy locked bcrypt hash
            // and flag mustChangePassword so admin can issue a reset safely via /api/admin/users PUT.
            const lockedSecret = crypto.randomBytes(32).toString('hex');
            nextEntry.password = await bcrypt.hash(lockedSecret, 10);
            nextEntry.mustChangePassword = true;
            nextEntry.recoveryPasswordResetRequired = true;
            nextEntry.restoredFromRedactedBackup = true;
            lockedColdRestoreCount++;
        }

        restoredUsers.push(nextEntry);

        if (!dryRun && userId && cleanEmail && isBcryptHash(nextEntry.password)) {
            await prisma.user.upsert({
                where: { id: userId },
                update: {
                    nombre: String(nextEntry.nombre || 'Usuario'),
                    email: cleanEmail,
                    password: nextEntry.password,
                    role: String(nextEntry.role || 'cliente'),
                    parentId: nextEntry.parentId || null,
                    status: nextEntry.status || 'active',
                    mustChangePassword: Boolean(nextEntry.mustChangePassword)
                },
                create: {
                    id: userId,
                    nombre: String(nextEntry.nombre || 'Usuario'),
                    email: cleanEmail,
                    password: nextEntry.password,
                    role: String(nextEntry.role || 'cliente'),
                    parentId: nextEntry.parentId || null,
                    status: nextEntry.status || 'active',
                    mustChangePassword: Boolean(nextEntry.mustChangePassword)
                }
            });
        }
    }

    if (!dryRun) {
        await writeJsonAtomic(usersJsonPath, restoredUsers);
    }

    console.log(JSON.stringify({
        success: true,
        mode: 'restore-backup',
        dryRun,
        backupPath,
        usersJsonPath,
        restoredTotal: restoredUsers.length,
        preservedBcryptCount,
        adoptedPrismaHashCount,
        lockedColdRestoreCount
    }, null, 2));
}

async function run() {
    const usersJsonPath = resolveUsersJsonPath();
    const dryRun = process.argv.includes('--dry-run');
    const restoreBackupArg = getArgValue('--restore-backup');

    if (restoreBackupArg) {
        await restoreFromBackup(restoreBackupArg, usersJsonPath, dryRun);
        return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let jsonUsers = [];
    let jsonChanged = false;
    let backupPath = null;

    try {
        const raw = await fs.readFile(usersJsonPath, 'utf-8');
        const parsed = JSON.parse(raw);
        jsonUsers = Array.isArray(parsed) ? parsed : [];
        if (!dryRun) {
            // Backup redacted pre-migration snapshot: NEVER persists plaintext passwords on disk
            // so a rollback can never restore cleartext credentials.
            backupPath = `${usersJsonPath}.bak-${timestamp}`;
            const redacted = redactPlaintextPasswords(jsonUsers);
            await writeJsonAtomic(backupPath, redacted);
            console.log(`Redacted backup created at: ${backupPath}`);
        }
    } catch (err) {
        if (err.code !== 'ENOENT') throw err;
        console.warn(`No existing users JSON found at ${usersJsonPath}; checking Prisma only.`);
    }

    let jsonHashedCount = 0;
    let jsonAlignedFromPrismaCount = 0;
    let prismaHashedCount = 0;
    let prismaSyncedCount = 0;

    for (let i = 0; i < jsonUsers.length; i++) {
        const u = jsonUsers[i];
        if (!u || !u.id || !u.email) continue;

        const cleanEmail = String(u.email).trim().toLowerCase();
        const existing = await prisma.user.findUnique({ where: { id: String(u.id) } })
            || await prisma.user.findUnique({ where: { email: cleanEmail } });

        const jsonHasValidBcrypt = isBcryptHash(u.password);

        if (!jsonHasValidBcrypt && u.password) {
            // If Prisma already holds a valid bcrypt hash, preserve it rather than overwriting
            // with stale legacy plaintext; align users.json to Prisma's active hash.
            if (existing && isBcryptHash(existing.password)) {
                jsonUsers[i].password = existing.password;
                jsonChanged = true;
                jsonAlignedFromPrismaCount++;
            } else {
                const hashed = await bcrypt.hash(String(u.password), 10);
                jsonUsers[i].password = hashed;
                jsonChanged = true;
                jsonHashedCount++;
            }
        }

        const effectiveHash = jsonUsers[i].password;
        if (!existing && effectiveHash && isBcryptHash(effectiveHash)) {
            if (!dryRun) {
                await prisma.user.create({
                    data: {
                        id: String(u.id),
                        nombre: String(u.nombre || 'Usuario'),
                        email: cleanEmail,
                        password: effectiveHash,
                        role: String(u.role || 'cliente'),
                        parentId: u.parentId || null,
                        status: u.status || 'active',
                        mustChangePassword: Boolean(u.mustChangePassword)
                    }
                });
            }
            prismaSyncedCount++;
        } else if (existing && !isBcryptHash(existing.password)) {
            const nextHash = (effectiveHash && isBcryptHash(effectiveHash))
                ? effectiveHash
                : await bcrypt.hash(String(existing.password), 10);
            if (!dryRun) {
                await prisma.user.update({
                    where: { id: existing.id },
                    data: { password: nextHash }
                });
            }
            prismaHashedCount++;
            if (jsonUsers[i].password !== nextHash) {
                jsonUsers[i].password = nextHash;
                jsonChanged = true;
            }
        } else if (existing && isBcryptHash(existing.password) && jsonUsers[i].password !== existing.password) {
            jsonUsers[i].password = existing.password;
            jsonChanged = true;
            jsonAlignedFromPrismaCount++;
        }
    }

    if (jsonChanged && !dryRun) {
        await writeJsonAtomic(usersJsonPath, jsonUsers);
    }

    const prismaUsers = await prisma.user.findMany();
    for (const pu of prismaUsers) {
        if (pu.password && !isBcryptHash(pu.password)) {
            const hashed = await bcrypt.hash(String(pu.password), 10);
            if (!dryRun) {
                await prisma.user.update({
                    where: { id: pu.id },
                    data: { password: hashed }
                });
            }
            prismaHashedCount++;
        }
    }

    console.log(JSON.stringify({
        success: true,
        mode: 'migrate',
        dryRun,
        usersJsonPath,
        backupPath,
        jsonTotal: jsonUsers.length,
        jsonHashedCount,
        jsonAlignedFromPrismaCount,
        prismaTotal: prismaUsers.length,
        prismaHashedCount,
        prismaSyncedCount
    }, null, 2));
}

run()
    .catch((err) => {
        console.error('Migration error:', err.message);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
