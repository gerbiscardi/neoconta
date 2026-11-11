import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import prisma from '@/lib/db';
import { getServerSession, authorizeTenantAccess, hashPassword, getUsersJsonPath } from '@/lib/auth';
import { writeJsonAtomic } from '@/lib/dataPaths';

const SUB_USER_ROLES = new Set(['vitacore-professional', 'vitacore-receptionist']);
const ADMIN_ROLES = ['cliente', 'admin', 'user', 'owner'];

async function readUsersJson() {
    try {
        const data = await fs.readFile(getUsersJsonPath(), 'utf-8');
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

async function writeUsersJson(users) {
    await writeJsonAtomic(getUsersJsonPath(), users);
}

function sanitizeSubUser(u) {
    if (!u) return null;
    const { password, ...safeUser } = u;
    return safeUser;
}

// GET: Retrieve all sub-users (professionals & receptionists) for a clinic without ever returning passwords
export async function GET(request) {
    try {
        const session = await getServerSession(request);
        const { searchParams } = new URL(request.url);
        const auth = authorizeTenantAccess(session, searchParams.get('userId'));
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }
        const tenantId = auth.tenantId;

        const [prismaSubs, jsonUsers] = await Promise.all([
            prisma.user.findMany({
                where: {
                    parentId: tenantId,
                    role: { in: ['vitacore-professional', 'vitacore-receptionist'] }
                },
                select: {
                    id: true,
                    nombre: true,
                    email: true,
                    role: true,
                    parentId: true,
                    status: true,
                    createdAt: true
                }
            }),
            readUsersJson()
        ]);

        const jsonMap = new Map(
            jsonUsers
                .filter(u => u.parentId === tenantId && SUB_USER_ROLES.has(u.role))
                .map(u => [u.id, u])
        );

        const merged = prismaSubs.map(p => {
            const extra = jsonMap.get(p.id) || {};
            jsonMap.delete(p.id);
            return sanitizeSubUser({
                ...extra,
                ...p
            });
        });

        for (const extra of jsonMap.values()) {
            merged.push(sanitizeSubUser(extra));
        }

        return NextResponse.json({ success: true, professionals: merged });
    } catch (error) {
        console.error('Error in /api/vitacore/professionals GET:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

// POST: Add a new professional or receptionist with bcrypt hashing + Prisma sync
export async function POST(request) {
    try {
        const session = await getServerSession(request);
        const body = await request.json();
        const { userId: requestedUserId, professional } = body || {};

        const auth = authorizeTenantAccess(session, requestedUserId, {
            allowedRoles: ADMIN_ROLES
        });
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }
        const tenantId = auth.tenantId;

        if (!professional || !String(professional.nombre || '').trim() || !String(professional.email || '').trim() || !professional.password) {
            return NextResponse.json({ error: 'Faltan datos requeridos (nombre, email, password)' }, { status: 400 });
        }

        if (String(professional.password).length < 6) {
            return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
        }

        const cleanEmail = String(professional.email).trim().toLowerCase();
        const assignedRole = professional.role === 'vitacore-receptionist' ? 'vitacore-receptionist' : 'vitacore-professional';

        const [existingPrisma, usersJson] = await Promise.all([
            prisma.user.findUnique({ where: { email: cleanEmail } }),
            readUsersJson()
        ]);

        if (existingPrisma || usersJson.some(u => String(u.email || '').trim().toLowerCase() === cleanEmail)) {
            return NextResponse.json({ error: 'Ya existe un usuario registrado con ese correo electrónico' }, { status: 400 });
        }

        const hashedPassword = await hashPassword(String(professional.password));
        const newId = `${assignedRole === 'vitacore-receptionist' ? 'recep_' : 'prof_'}${crypto.randomBytes(6).toString('hex')}`;
        const createdAt = new Date().toISOString();

        await prisma.user.create({
            data: {
                id: newId,
                nombre: String(professional.nombre).trim(),
                email: cleanEmail,
                password: hashedPassword,
                role: assignedRole,
                parentId: tenantId,
                status: 'active',
                mustChangePassword: false
            }
        });

        const newSubUser = {
            id: newId,
            nombre: String(professional.nombre).trim(),
            email: cleanEmail,
            password: hashedPassword,
            tipoUsuario: 'administrativo',
            role: assignedRole,
            parentId: tenantId,
            status: 'active',
            specialty: assignedRole === 'vitacore-receptionist' ? 'Recepción / Secretaría' : String(professional.specialty || ''),
            matricula: String(professional.matricula || ''),
            createdAt
        };

        usersJson.push(newSubUser);
        try {
            await writeUsersJson(usersJson);
        } catch (jsonErr) {
            console.error('Error writing users.json in /api/vitacore/professionals POST, rolling back Prisma:', jsonErr);
            await prisma.user.delete({ where: { id: newId } }).catch(() => {});
            return NextResponse.json({ error: 'Error al persistir usuario en almacenamiento secundario; se revirtió la operación.' }, { status: 500 });
        }

        return NextResponse.json({ success: true, professional: sanitizeSubUser(newSubUser) }, { status: 201 });
    } catch (error) {
        console.error('Error in /api/vitacore/professionals POST:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

// PUT: Update professional or receptionist details (hashes password when updated)
export async function PUT(request) {
    try {
        const session = await getServerSession(request);
        const body = await request.json();
        const { userId: requestedUserId, professionalId, updatedData } = body || {};

        const auth = authorizeTenantAccess(session, requestedUserId, {
            allowedRoles: ADMIN_ROLES
        });
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }
        const tenantId = auth.tenantId;

        if (!professionalId || !updatedData) {
            return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
        }

        const usersJson = await readUsersJson();
        const index = usersJson.findIndex(
            u => u.id === professionalId && u.parentId === tenantId && SUB_USER_ROLES.has(u.role)
        );
        const existingPrisma = await prisma.user.findFirst({
            where: { id: String(professionalId), parentId: tenantId, role: { in: ['vitacore-professional', 'vitacore-receptionist'] } }
        });

        if (index === -1 && !existingPrisma) {
            return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
        }

        const currentEmail = (existingPrisma?.email || usersJson[index]?.email || '').toLowerCase();
        let nextEmail = currentEmail;

        if (updatedData.email && String(updatedData.email).trim().toLowerCase() !== currentEmail) {
            const candidateEmail = String(updatedData.email).trim().toLowerCase();
            const clashPrisma = await prisma.user.findUnique({ where: { email: candidateEmail } });
            const clashJson = usersJson.some(u => u.id !== professionalId && String(u.email || '').toLowerCase() === candidateEmail);
            if (clashPrisma || clashJson) {
                return NextResponse.json({ error: 'Ya existe otro usuario con ese correo electrónico' }, { status: 400 });
            }
            nextEmail = candidateEmail;
        }

        let nextPasswordHash = existingPrisma?.password || usersJson[index]?.password;
        if (updatedData.password && String(updatedData.password).trim() !== '') {
            if (String(updatedData.password).length < 6) {
                return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
            }
            nextPasswordHash = await hashPassword(String(updatedData.password));
        }

        const nextRole = updatedData.role === 'vitacore-receptionist'
            ? 'vitacore-receptionist'
            : (updatedData.role === 'vitacore-professional'
                ? 'vitacore-professional'
                : (existingPrisma?.role || usersJson[index]?.role));
        const nextNombre = updatedData.nombre ? String(updatedData.nombre).trim() : (existingPrisma?.nombre || usersJson[index]?.nombre);

        if (existingPrisma) {
            await prisma.user.update({
                where: { id: existingPrisma.id },
                data: {
                    nombre: nextNombre,
                    email: nextEmail,
                    password: nextPasswordHash,
                    role: nextRole
                }
            });
        } else {
            await prisma.user.create({
                data: {
                    id: String(professionalId),
                    nombre: nextNombre,
                    email: nextEmail,
                    password: nextPasswordHash,
                    role: nextRole,
                    parentId: tenantId,
                    status: 'active',
                    mustChangePassword: false
                }
            });
        }

        const baseJson = index !== -1 ? usersJson[index] : { id: String(professionalId), parentId: tenantId };
        const updatedRecord = {
            ...baseJson,
            nombre: nextNombre,
            email: nextEmail,
            password: nextPasswordHash,
            role: nextRole,
            specialty: updatedData.specialty ?? baseJson.specialty ?? '',
            matricula: updatedData.matricula ?? baseJson.matricula ?? '',
            cuit: updatedData.cuit ?? baseJson.cuit,
            signature: updatedData.signature ?? baseJson.signature
        };

        if (index !== -1) {
            usersJson[index] = updatedRecord;
        } else {
            usersJson.push(updatedRecord);
        }
        try {
            await writeUsersJson(usersJson);
        } catch (jsonErr) {
            console.error('Error writing users.json in /api/vitacore/professionals PUT, compensating Prisma:', jsonErr);
            if (existingPrisma) {
                await prisma.user.update({
                    where: { id: existingPrisma.id },
                    data: {
                        nombre: existingPrisma.nombre,
                        email: existingPrisma.email,
                        password: existingPrisma.password,
                        role: existingPrisma.role
                    }
                }).catch(() => {});
            } else {
                await prisma.user.delete({ where: { id: String(professionalId) } }).catch(() => {});
            }
            return NextResponse.json({ error: 'Error al persistir actualización; se revirtió la operación.' }, { status: 500 });
        }

        return NextResponse.json({ success: true, professional: sanitizeSubUser(updatedRecord) });
    } catch (error) {
        console.error('Error in /api/vitacore/professionals PUT:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

// DELETE: Delete a professional or receptionist
export async function DELETE(request) {
    try {
        const session = await getServerSession(request);
        const { searchParams } = new URL(request.url);
        const auth = authorizeTenantAccess(session, searchParams.get('userId'), {
            allowedRoles: ADMIN_ROLES
        });
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }
        const tenantId = auth.tenantId;
        const professionalId = searchParams.get('professionalId');

        if (!professionalId) {
            return NextResponse.json({ error: 'professionalId es requerido' }, { status: 400 });
        }

        const existingPrisma = await prisma.user.findFirst({
            where: { id: String(professionalId), parentId: tenantId, role: { in: ['vitacore-professional', 'vitacore-receptionist'] } }
        });
        const usersJson = await readUsersJson();
        const index = usersJson.findIndex(
            u => u.id === professionalId && u.parentId === tenantId && SUB_USER_ROLES.has(u.role)
        );

        if (!existingPrisma && index === -1) {
            return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
        }

        if (existingPrisma) {
            await prisma.user.delete({ where: { id: existingPrisma.id } });
        }
        if (index !== -1) {
            usersJson.splice(index, 1);
            try {
                await writeUsersJson(usersJson);
            } catch (jsonErr) {
                console.error('Error writing users.json in /api/vitacore/professionals DELETE, restoring Prisma:', jsonErr);
                if (existingPrisma) {
                    await prisma.user.create({
                        data: {
                            id: existingPrisma.id,
                            nombre: existingPrisma.nombre,
                            email: existingPrisma.email,
                            password: existingPrisma.password,
                            role: existingPrisma.role,
                            parentId: existingPrisma.parentId,
                            status: existingPrisma.status,
                            mustChangePassword: existingPrisma.mustChangePassword
                        }
                    }).catch(() => {});
                }
                return NextResponse.json({ error: 'Error al eliminar usuario en almacenamiento secundario; se revirtió la operación.' }, { status: 500 });
            }
        }

        return NextResponse.json({ success: true, message: 'Usuario eliminado de la base de datos' });
    } catch (error) {
        console.error('Error in /api/vitacore/professionals DELETE:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
