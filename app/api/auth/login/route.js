import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function POST(request) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json({ error: "Faltan datos (email, contraseña)" }, { status: 400 });
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

        const user = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password);

        if (!user) {
            return NextResponse.json({ error: "Correo electrónico o contraseña incorrectos." }, { status: 401 });
        }

        // Return user info excluding password
        const { password: _, ...userInfo } = user;
        userInfo.mustChangePassword = user.mustChangePassword === true;

        return NextResponse.json({ success: true, user: userInfo });

    } catch (error) {
        console.error("Error in login API:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
