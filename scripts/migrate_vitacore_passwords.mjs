import fs from 'fs/promises';
import path from 'path';
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

function isBcryptHash(val) {
    return typeof val === 'string' && (val.startsWith('$2a$') || val.startsWith('$2b$') || val.startsWith('$2y$'));
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

async function run() {
    const usersJsonPath = resolveUsersJsonPath();
    const dryRun = process.argv.includes('--dry-run');
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
            await fs.writeFile(backupPath, JSON.stringify(redacted, null, 2), 'utf-8');
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
        await fs.writeFile(usersJsonPath, JSON.stringify(jsonUsers, null, 2), 'utf-8');
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
