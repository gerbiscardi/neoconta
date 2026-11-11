import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const USERS_JSON_PATH = path.join(process.cwd(), 'data', 'users.json');

function isBcryptHash(val) {
    return typeof val === 'string' && (val.startsWith('$2a$') || val.startsWith('$2b$') || val.startsWith('$2y$'));
}

async function run() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let jsonUsers = [];
    let jsonChanged = false;

    try {
        const raw = await fs.readFile(USERS_JSON_PATH, 'utf-8');
        jsonUsers = JSON.parse(raw);
        const backupPath = `${USERS_JSON_PATH}.bak-${timestamp}`;
        await fs.writeFile(backupPath, raw, 'utf-8');
        console.log(`Backup created at: ${backupPath}`);
    } catch (err) {
        console.warn('No existing data/users.json found or unreadable; checking Prisma only.');
    }

    let jsonHashedCount = 0;
    let prismaHashedCount = 0;
    let prismaSyncedCount = 0;

    for (let i = 0; i < jsonUsers.length; i++) {
        const u = jsonUsers[i];
        if (!u || !u.password) continue;
        if (!isBcryptHash(u.password)) {
            const hashed = await bcrypt.hash(String(u.password), 10);
            jsonUsers[i].password = hashed;
            jsonChanged = true;
            jsonHashedCount++;
        }

        // Ensure Vitacore sub-users also exist in Prisma with hashed credentials
        if (u.role === 'vitacore-professional' || u.role === 'vitacore-receptionist') {
            const existing = await prisma.user.findUnique({ where: { id: String(u.id) } });
            if (!existing) {
                await prisma.user.create({
                    data: {
                        id: String(u.id),
                        nombre: String(u.nombre || 'Profesional'),
                        email: String(u.email || '').trim().toLowerCase(),
                        password: jsonUsers[i].password,
                        role: u.role,
                        parentId: u.parentId || null,
                        status: u.status || 'active',
                        mustChangePassword: Boolean(u.mustChangePassword)
                    }
                });
                prismaSyncedCount++;
            } else if (!isBcryptHash(existing.password)) {
                await prisma.user.update({
                    where: { id: existing.id },
                    data: { password: jsonUsers[i].password }
                });
                prismaHashedCount++;
            }
        }
    }

    if (jsonChanged) {
        await fs.writeFile(USERS_JSON_PATH, JSON.stringify(jsonUsers, null, 2), 'utf-8');
    }

    const prismaUsers = await prisma.user.findMany();
    for (const pu of prismaUsers) {
        if (pu.password && !isBcryptHash(pu.password)) {
            const hashed = await bcrypt.hash(String(pu.password), 10);
            await prisma.user.update({
                where: { id: pu.id },
                data: { password: hashed }
            });
            prismaHashedCount++;
        }
    }

    console.log(JSON.stringify({
        success: true,
        jsonTotal: jsonUsers.length,
        jsonHashedCount,
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
