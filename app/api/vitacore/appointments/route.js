import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

function getAppointmentsFilePath(userId) {
    return path.join(process.cwd(), 'data', 'users', userId, 'vitacore', 'appointments.json');
}

async function ensureDirectoryExists(filePath) {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
}

async function readAppointments(userId) {
    const filePath = getAppointmentsFilePath(userId);
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
}

async function writeAppointments(userId, appointments) {
    const filePath = getAppointmentsFilePath(userId);
    await ensureDirectoryExists(filePath);
    await fs.writeFile(filePath, JSON.stringify(appointments, null, 2), 'utf-8');
}

// GET: Retrieve appointments for a client/professional
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const date = searchParams.get('date'); // YYYY-MM-DD
        const professionalId = searchParams.get('professionalId');
        const patientId = searchParams.get('patientId');

        if (!userId) {
            return NextResponse.json({ error: 'userId es requerido' }, { status: 400 });
        }

        let appointments = await readAppointments(userId);

        if (date) {
            appointments = appointments.filter(a => a.date === date);
        }

        if (professionalId) {
            appointments = appointments.filter(a => a.professionalId === professionalId);
        }

        if (patientId) {
            appointments = appointments.filter(a => a.patientId === patientId);
        }

        // Sort by time
        appointments.sort((a, b) => a.time.localeCompare(b.time));

        return NextResponse.json({ success: true, appointments });
    } catch (error) {
        console.error('Error in /api/vitacore/appointments GET:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

// POST: Create a new appointment
export async function POST(request) {
    try {
        const body = await request.json();
        const { userId, appointment } = body;

        if (!userId || !appointment || !appointment.patientName || !appointment.date || !appointment.time) {
            return NextResponse.json({ error: 'Faltan campos obligatorios (paciente, fecha, hora)' }, { status: 400 });
        }

        const appointments = await readAppointments(userId);
        const newId = 'trn_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);

        const newAppointment = {
            id: newId,
            patientId: appointment.patientId || null,
            patientName: appointment.patientName,
            patientDni: appointment.patientDni || '',
            patientPhone: appointment.patientPhone || '',
            patientObraSocial: appointment.patientObraSocial || 'Particular',
            
            professionalId: appointment.professionalId || '',
            professionalName: appointment.professionalName || 'Director Clínico',
            professionalSpecialty: appointment.professionalSpecialty || '',
            
            date: appointment.date, // YYYY-MM-DD
            time: appointment.time, // HH:MM
            duration: appointment.duration || 30, // minutes
            consultationType: appointment.consultationType || 'Consulta General',
            reason: appointment.reason || '',
            
            status: appointment.status || 'reservado', // reservado | confirmado | en_espera | atendido | ausente | cancelado
            createdAt: new Date().toISOString()
        };

        appointments.push(newAppointment);
        await writeAppointments(userId, appointments);

        return NextResponse.json({ success: true, appointment: newAppointment }, { status: 201 });
    } catch (error) {
        console.error('Error in /api/vitacore/appointments POST:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

// PUT: Update appointment status or details
export async function PUT(request) {
    try {
        const body = await request.json();
        const { userId, appointmentId, updatedData } = body;

        if (!userId || !appointmentId || !updatedData) {
            return NextResponse.json({ error: 'userId, appointmentId y updatedData son requeridos' }, { status: 400 });
        }

        const appointments = await readAppointments(userId);
        const index = appointments.findIndex(a => a.id === appointmentId);

        if (index === -1) {
            return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
        }

        appointments[index] = {
            ...appointments[index],
            ...updatedData,
            updatedAt: new Date().toISOString()
        };

        await writeAppointments(userId, appointments);

        return NextResponse.json({ success: true, appointment: appointments[index] });
    } catch (error) {
        console.error('Error in /api/vitacore/appointments PUT:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

// DELETE: Delete an appointment
export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const appointmentId = searchParams.get('appointmentId');

        if (!userId || !appointmentId) {
            return NextResponse.json({ error: 'userId y appointmentId son requeridos' }, { status: 400 });
        }

        const appointments = await readAppointments(userId);
        const filtered = appointments.filter(a => a.id !== appointmentId);

        await writeAppointments(userId, filtered);

        return NextResponse.json({ success: true, message: 'Turno eliminado exitosamente' });
    } catch (error) {
        console.error('Error in /api/vitacore/appointments DELETE:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
