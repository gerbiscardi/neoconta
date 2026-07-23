import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'users.json');

async function readUsers() {
    try {
        const data = await fs.readFile(dbPath, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        console.error("Error reading users db:", err);
        return [];
    }
}

async function writeUsers(users) {
    await fs.writeFile(dbPath, JSON.stringify(users, null, 2), 'utf-8');
}

// GET: Retrieve all professionals for a client
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        const users = await readUsers();
        const professionals = users.filter(u => u.parentId === userId && u.role === 'vitacore-professional');

        return NextResponse.json({ success: true, professionals });
    } catch (error) {
        console.error('Error in /api/vitacore/professionals GET:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

// POST: Add a new professional
export async function POST(request) {
    try {
        const body = await request.json();
        const { userId, professional } = body;

        if (!userId || !professional || !professional.nombre || !professional.email || !professional.password) {
            return NextResponse.json({ error: 'Faltan datos requeridos (nombre, email, password)' }, { status: 400 });
        }

        const users = await readUsers();

        // Check if email already exists globally
        if (users.some(u => u.email.toLowerCase() === professional.email.trim().toLowerCase())) {
            return NextResponse.json({ error: 'Ya existe un usuario registrado con ese correo electrónico' }, { status: 400 });
        }

        const newProfessional = {
            id: 'prof_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36),
            nombre: professional.nombre,
            email: professional.email.trim().toLowerCase(),
            password: professional.password,
            tipoUsuario: 'administrativo', // default
            role: 'vitacore-professional',
            parentId: userId,
            specialty: professional.specialty || '',
            matricula: professional.matricula || '',
            createdAt: new Date().toISOString()
        };

        users.push(newProfessional);
        await writeUsers(users);

        return NextResponse.json({ success: true, professional: newProfessional }, { status: 201 });
    } catch (error) {
        console.error('Error in /api/vitacore/professionals POST:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

// PUT: Update professional details
export async function PUT(request) {
    try {
        const body = await request.json();
        const { userId, professionalId, updatedData } = body;

        if (!userId || !professionalId || !updatedData) {
            return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
        }

        const users = await readUsers();
        const index = users.findIndex(u => u.id === professionalId && u.parentId === userId && u.role === 'vitacore-professional');

        if (index === -1) {
            return NextResponse.json({ error: 'Profesional no encontrado' }, { status: 404 });
        }

        // If email is changing, check if unique
        if (updatedData.email && updatedData.email.toLowerCase() !== users[index].email.toLowerCase()) {
            if (users.some(u => u.email.toLowerCase() === updatedData.email.trim().toLowerCase())) {
                return NextResponse.json({ error: 'Ya existe otro usuario con ese correo electrónico' }, { status: 400 });
            }
            users[index].email = updatedData.email.trim().toLowerCase();
        }

        // Merge updated fields
        users[index] = {
            ...users[index],
            nombre: updatedData.nombre ?? users[index].nombre,
            password: updatedData.password ?? users[index].password,
            specialty: updatedData.specialty ?? users[index].specialty,
            matricula: updatedData.matricula ?? users[index].matricula,
            cuit: updatedData.cuit ?? users[index].cuit,
            signature: updatedData.signature ?? users[index].signature,
            stampDetails: updatedData.stampDetails ?? users[index].stampDetails
        };

        await writeUsers(users);
        return NextResponse.json({ success: true, professional: users[index] });
    } catch (error) {
        console.error('Error in /api/vitacore/professionals PUT:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

// DELETE: Delete a professional
export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const professionalId = searchParams.get('professionalId');

        if (!userId || !professionalId) {
            return NextResponse.json({ error: 'userId and professionalId are required' }, { status: 400 });
        }

        const users = await readUsers();
        const index = users.findIndex(u => u.id === professionalId && u.parentId === userId && u.role === 'vitacore-professional');

        if (index === -1) {
            return NextResponse.json({ error: 'Profesional no encontrado' }, { status: 404 });
        }

        users.splice(index, 1);
        await writeUsers(users);

        return NextResponse.json({ success: true, message: 'Profesional eliminado de la base de datos' });
    } catch (error) {
        console.error('Error in /api/vitacore/professionals DELETE:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
