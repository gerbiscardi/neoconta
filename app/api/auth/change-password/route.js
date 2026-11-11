import { NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import { getServerSession, sanitizeUserId, verifyPassword, hashPassword, getUsersJsonPath } from '@/lib/auth';
import prisma from '@/lib/db';

async function getUsers() {
    try {
        const data = await readFile(getUsersJsonPath(), 'utf-8');
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        if (err.code !== 'ENOENT') {
            console.error("Error reading users db:", err);
        }
        return [];
    }
}

async function saveUsers(users) {
    await writeFile(getUsersJsonPath(), JSON.stringify(users, null, 2), 'utf-8');
}

export async function POST(request) {
    try {
        const session = await getServerSession(request);
        if (!session) {
            return NextResponse.json({ error: "No autenticado. Por favor inicia sesión." }, { status: 401 });
        }
        if ((session.status && session.status !== 'active') || session.role === 'inactive' || session.role === 'disabled') {
            return NextResponse.json({ error: "Cuenta inactiva o deshabilitada." }, { status: 403 });
        }

        const { userId, currentPassword, newPassword } = await request.json();

        const selfUserId = sanitizeUserId(session.id);
        const requestedUserId = userId ? sanitizeUserId(userId) : selfUserId;
        if (!selfUserId || !requestedUserId || requestedUserId !== selfUserId) {
            return NextResponse.json({ error: "Solo podés modificar la contraseña de tu propia cuenta." }, { status: 403 });
        }

        if (!currentPassword || !newPassword) {
            return NextResponse.json({ error: "Faltan datos requeridos (contraseña actual, nueva contraseña)" }, { status: 400 });
        }

        if (String(newPassword).length < 6) {
            return NextResponse.json({ error: "La nueva contraseña debe tener al menos 6 caracteres." }, { status: 400 });
        }

        const prismaUser = await prisma.user.findUnique({ where: { id: selfUserId } });
        const users = await getUsers();
        const userIndex = users.findIndex(u => u.id === selfUserId);

        if (!prismaUser && userIndex === -1) {
            return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
        }

        const authoritativeHash = prismaUser?.password || users[userIndex]?.password;
        const isCurrentMatch = await verifyPassword(currentPassword, authoritativeHash);
        if (!isCurrentMatch) {
            return NextResponse.json({ error: "La contraseña actual es incorrecta." }, { status: 400 });
        }

        if (currentPassword === newPassword) {
            return NextResponse.json({ error: "La nueva contraseña debe ser diferente a la actual." }, { status: 400 });
        }

        const hashedPassword = await hashPassword(newPassword);

        // Synchronize authoritative Prisma DB first
        if (prismaUser) {
            await prisma.user.update({
                where: { id: selfUserId },
                data: {
                    password: hashedPassword,
                    mustChangePassword: false
                }
            });
        } else {
            const jsonRecord = users[userIndex];
            await prisma.user.upsert({
                where: { email: String(jsonRecord.email).trim().toLowerCase() },
                update: {
                    password: hashedPassword,
                    mustChangePassword: false
                },
                create: {
                    id: selfUserId,
                    nombre: jsonRecord.nombre || 'Usuario',
                    email: String(jsonRecord.email).trim().toLowerCase(),
                    password: hashedPassword,
                    role: jsonRecord.role || 'cliente',
                    parentId: jsonRecord.parentId || null,
                    status: jsonRecord.status || 'active',
                    mustChangePassword: false
                }
            });
        }

        // Synchronize users.json mirror if record exists there
        if (userIndex !== -1) {
            users[userIndex].password = hashedPassword;
            users[userIndex].mustChangePassword = false;
            await saveUsers(users);
        }

        return NextResponse.json({ success: true, message: "Contraseña cambiada con éxito." });

    } catch (error) {
        console.error("Error in change-password API:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
