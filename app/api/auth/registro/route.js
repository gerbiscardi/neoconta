import { NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

export async function POST(request) {
    try {
        const { nombre, email, password, tipoUsuario } = await request.json();

        if (!nombre || !email || !password || !tipoUsuario) {
            return NextResponse.json({ error: "Faltan datos requeridos (nombre, email, contraseña, tipo de usuario)" }, { status: 400 });
        }

        const dbPath = join(process.cwd(), 'data', 'users.json');
        let users = [];
        try {
            const data = await readFile(dbPath, 'utf-8');
            users = JSON.parse(data);
        } catch (err) {
            console.error("Error reading users db:", err);
            return NextResponse.json({ error: "Error de base de datos" }, { status: 500 });
        }

        const emailExists = users.some(u => u.email.toLowerCase() === email.trim().toLowerCase());
        if (emailExists) {
            return NextResponse.json({ error: "El correo electrónico ya se encuentra registrado." }, { status: 400 });
        }

        // Generate unique userId based on email split + random string
        const cleanName = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
        const randomSuffix = Math.random().toString(36).substring(2, 6);
        const userId = `${cleanName}_${randomSuffix}`;

        const newUser = {
            id: userId,
            nombre: nombre.trim(),
            email: email.trim().toLowerCase(),
            password: password, // For simplicity in mock db
            tipoUsuario: tipoUsuario,
            role: "no-cliente", // Default category for self-registration from landing page
            createdAt: new Date().toISOString()
        };

        users.push(newUser);

        try {
            await writeFile(dbPath, JSON.stringify(users, null, 2), 'utf-8');
        } catch (err) {
            console.error("Error writing to users db:", err);
            return NextResponse.json({ error: "Error al guardar el registro" }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Registro exitoso." });

    } catch (error) {
        console.error("Error in registration API:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
