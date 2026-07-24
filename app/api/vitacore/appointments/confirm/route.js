import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const appointmentId = searchParams.get('id');
        const userId = searchParams.get('userId');

        if (!appointmentId) {
            return NextResponse.json({ error: 'ID de turno requerido' }, { status: 400 });
        }

        // If userId is provided, look in that folder; otherwise search across all user folders
        const usersDir = path.join(process.cwd(), 'data', 'users');
        let userFolders = userId ? [userId] : [];

        if (!userId) {
            try {
                userFolders = await fs.readdir(usersDir);
            } catch (e) {
                userFolders = [];
            }
        }

        for (const uFolder of userFolders) {
            const filePath = path.join(usersDir, uFolder, 'vitacore', 'appointments.json');
            try {
                const data = await fs.readFile(filePath, 'utf-8');
                const appointments = JSON.parse(data);
                const found = appointments.find(a => a.id === appointmentId);
                if (found) {
                    return NextResponse.json({ success: true, appointment: found, userId: uFolder });
                }
            } catch (e) {
                // Continue searching
            }
        }

        return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
    } catch (error) {
        console.error("Error in /api/vitacore/appointments/confirm GET:", error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const { appointmentId, userId, action } = await request.json(); // action = 'confirm' | 'cancel'

        if (!appointmentId || !action) {
            return NextResponse.json({ error: 'appointmentId y action son requeridos' }, { status: 400 });
        }

        const newStatus = action === 'confirm' ? 'confirmado' : 'cancelado';
        const usersDir = path.join(process.cwd(), 'data', 'users');
        let targetUser = userId;

        if (!targetUser) {
            const userFolders = await fs.readdir(usersDir);
            for (const folder of userFolders) {
                const filePath = path.join(usersDir, folder, 'vitacore', 'appointments.json');
                try {
                    const data = await fs.readFile(filePath, 'utf-8');
                    const appointments = JSON.parse(data);
                    if (appointments.some(a => a.id === appointmentId)) {
                        targetUser = folder;
                        break;
                    }
                } catch (e) {}
            }
        }

        if (!targetUser) {
            return NextResponse.json({ error: 'Turno no encontrado para actualizar' }, { status: 404 });
        }

        const filePath = path.join(usersDir, targetUser, 'vitacore', 'appointments.json');
        const data = await fs.readFile(filePath, 'utf-8');
        const appointments = JSON.parse(data);

        const index = appointments.findIndex(a => a.id === appointmentId);
        if (index === -1) {
            return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
        }

        appointments[index].status = newStatus;
        appointments[index].updatedAt = new Date().toISOString();

        await fs.writeFile(filePath, JSON.stringify(appointments, null, 2), 'utf-8');

        return NextResponse.json({
            success: true,
            message: action === 'confirm' ? 'Turno confirmado con éxito' : 'Turno cancelado',
            appointment: appointments[index]
        });
    } catch (error) {
        console.error("Error in /api/vitacore/appointments/confirm POST:", error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
