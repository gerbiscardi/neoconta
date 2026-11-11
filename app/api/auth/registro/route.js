import { NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import prisma from '@/lib/db';
import { hashPassword, getUsersJsonPath } from '@/lib/auth';
import { getClientIp, registerLimiter, rateLimitResponse } from '@/lib/rateLimit';

export async function POST(request) {
    try {
        const ip = getClientIp(request);
        const limitCheck = registerLimiter.check(ip);
        if (!limitCheck.allowed) {
            return rateLimitResponse(limitCheck, "Ha alcanzado el límite máximo de registros de cuenta por hora desde esta dirección IP.");
        }

        const { nombre, email, password, tipoUsuario } = await request.json();

        if (!nombre || !email || !password || !tipoUsuario) {
            return NextResponse.json({ error: "Faltan datos requeridos (nombre, email, contraseña, tipo de usuario)" }, { status: 400 });
        }

        if (String(password).length < 6) {
            return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 });
        }

        const cleanEmail = String(email).trim().toLowerCase();
        const dbPath = getUsersJsonPath();
        let users = [];
        try {
            const data = await readFile(dbPath, 'utf-8');
            const parsed = JSON.parse(data);
            users = Array.isArray(parsed) ? parsed : [];
        } catch (err) {
            if (err.code !== 'ENOENT') {
                console.error("Error reading users db:", err);
                return NextResponse.json({ error: "Error de base de datos" }, { status: 500 });
            }
        }

        const existingPrisma = await prisma.user.findUnique({ where: { email: cleanEmail } });
        const emailExistsJson = users.some(u => String(u.email || '').trim().toLowerCase() === cleanEmail);
        if (existingPrisma || emailExistsJson) {
            return NextResponse.json({ error: "El correo electrónico ya se encuentra registrado." }, { status: 400 });
        }

        // Generate unique userId based on email split + random string
        const cleanName = cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') || 'user';
        const randomSuffix = Math.random().toString(36).substring(2, 6);
        const userId = `${cleanName}_${randomSuffix}`;

        const hashedPassword = await hashPassword(password);

        const newUser = {
            id: userId,
            nombre: nombre.trim(),
            email: cleanEmail,
            password: hashedPassword,
            tipoUsuario: tipoUsuario,
            role: "no-cliente", // Default category for self-registration from landing page
            createdAt: new Date().toISOString()
        };

        // Synchronize authoritative Prisma DB first, rollback on JSON write failure
        await prisma.user.create({
            data: {
                id: userId,
                nombre: newUser.nombre,
                email: newUser.email,
                password: newUser.password,
                role: newUser.role,
                status: 'active',
                mustChangePassword: false
            }
        });

        try {
            users.push(newUser);
            await writeFile(dbPath, JSON.stringify(users, null, 2), 'utf-8');
        } catch (err) {
            console.error("Error writing to users db, rolling back Prisma user:", err);
            await prisma.user.delete({ where: { id: userId } }).catch(() => {});
            return NextResponse.json({ error: "Error al guardar el registro" }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Registro exitoso." });

    } catch (error) {
        console.error("Error in registration API:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
