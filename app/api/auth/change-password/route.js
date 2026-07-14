import { NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const DB_PATH = join(process.cwd(), 'data', 'users.json');

async function getUsers() {
    try {
        const data = await readFile(DB_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        console.error("Error reading users db:", err);
        return [];
    }
}

async function saveUsers(users) {
    await writeFile(DB_PATH, JSON.stringify(users, null, 2), 'utf-8');
}

export async function POST(request) {
    try {
        const { userId, currentPassword, newPassword } = await request.json();

        if (!userId || !currentPassword || !newPassword) {
            return NextResponse.json({ error: "Faltan datos requeridos (userId, contraseña actual, nueva contraseña)" }, { status: 400 });
        }

        if (newPassword.length < 4) {
            return NextResponse.json({ error: "La nueva contraseña debe tener al menos 4 caracteres." }, { status: 400 });
        }

        const users = await getUsers();
        const userIndex = users.findIndex(u => u.id === userId);

        if (userIndex === -1) {
            return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
        }

        const user = users[userIndex];

        if (user.password !== currentPassword) {
            return NextResponse.json({ error: "La contraseña actual es incorrecta." }, { status: 400 });
        }

        if (currentPassword === newPassword) {
            return NextResponse.json({ error: "La nueva contraseña debe ser diferente a la actual." }, { status: 400 });
        }

        // Update password and clear the flag
        users[userIndex].password = newPassword;
        users[userIndex].mustChangePassword = false;

        await saveUsers(users);

        return NextResponse.json({ success: true, message: "Contraseña cambiada con éxito." });

    } catch (error) {
        console.error("Error in change-password API:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
