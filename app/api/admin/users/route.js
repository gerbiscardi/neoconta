import { NextResponse } from 'next/server';
import { readFile, writeFile, readdir, mkdir } from 'fs/promises';
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

// GET: List all users with stats and config (For owner only)
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const callerRole = searchParams.get('callerRole');

        if (callerRole !== 'owner') {
            return NextResponse.json({ error: "No autorizado. Solo el dueño de NeoConta puede realizar esta acción." }, { status: 403 });
        }

        const users = await getUsers();
        const invoicesDir = join(process.cwd(), 'data', 'invoices');
        const configPath = join(process.cwd(), 'data', 'platform_config.json');

        // Load Platform Configuration
        let baseSubscription = 4500000;
        let costPerClient = 125000;
        try {
            const configData = await readFile(configPath, 'utf-8');
            const config = JSON.parse(configData);
            if (config.baseSubscription !== undefined) baseSubscription = Number(config.baseSubscription);
            if (config.costPerClient !== undefined) costPerClient = Number(config.costPerClient);
        } catch (e) {
            // Ignore missing config files and use default
        }

        // Remove password from response and calculate individual client stats
        const sanitizedUsers = [];
        let totalInvoices = 0;
        let totalVolume = 0;

        for (const user of users) {
            const { password, ...userInfo } = user;
            
            // Default individual stats
            userInfo.stats = {
                totalInvoiced: 0,
                invoiceCount: 0,
                lastInvoiceDate: null
            };

            // Load CUIT and Razón Social from config.json if they exist
            userInfo.cuit = "";
            userInfo.razonSocial = "";
            try {
                const configJsonPath = join(process.cwd(), 'data', 'users', user.id, 'config.json');
                const configData = await readFile(configJsonPath, 'utf-8');
                const userConfig = JSON.parse(configData);
                userInfo.cuit = userConfig.cuit || "";
                userInfo.razonSocial = userConfig.razonSocial || "";
            } catch (e) {
                // Ignore missing config files
            }

            try {
                const historyFile = join(invoicesDir, `${user.id}_history.json`);
                const fileContent = await readFile(historyFile, 'utf-8');
                const invoices = JSON.parse(fileContent);
                if (Array.isArray(invoices) && invoices.length > 0) {
                    userInfo.stats.invoiceCount = invoices.length;
                    let clientVol = 0;
                    let latestDate = null;
                    for (const inv of invoices) {
                        const amount = Number(inv.Total || inv.Importe || 0);
                        clientVol += amount;
                        
                        // Parse date
                        const invDateStr = inv.created_at || (inv.afip_response?.response?.FeCabResp?.FchProceso ? 
                            `${inv.afip_response.response.FeCabResp.FchProceso.substring(0,4)}-${inv.afip_response.response.FeCabResp.FchProceso.substring(4,6)}-${inv.afip_response.response.FeCabResp.FchProceso.substring(6,8)}` : null);
                        
                        let invDate = null;
                        if (invDateStr) {
                            invDate = new Date(invDateStr);
                            if (!latestDate || invDate > latestDate) {
                                latestDate = invDate;
                            }
                        }
                    }
                    userInfo.stats.totalInvoiced = clientVol;
                    userInfo.stats.lastInvoiceDate = latestDate ? latestDate.toISOString() : null;

                    // Accumulate to global totals
                    totalInvoices += invoices.length;
                    totalVolume += clientVol;
                }
            } catch (e) {
                // Ignore errors from missing history files
            }

            sanitizedUsers.push(userInfo);
        }

        const activeClients = sanitizedUsers.filter(u => u.role === 'cliente').length;
        const totalUsers = sanitizedUsers.length;
        const conversionRate = totalUsers > 0 ? ((activeClients / totalUsers) * 100).toFixed(1) : "0.0";
        const arpu = activeClients > 0 ? Math.round(((activeClients * costPerClient) + baseSubscription) / activeClients) : 0;

        const stats = {
            totalInvoices,
            totalVolume,
            mrr: (activeClients * costPerClient) + baseSubscription,
            arpu,
            conversionRate
        };

        const latestInvoices = [];

        return NextResponse.json({ 
            success: true, 
            users: sanitizedUsers, 
            stats,
            latestInvoices,
            config: { baseSubscription, costPerClient }
        });

    } catch (error) {
        console.error("Error in admin GET users:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST: Create a new user (For owner only)
export async function POST(request) {
    try {
        const { callerRole, nombre, email, password, role, tipoUsuario, cuit, razonSocial } = await request.json();

        if (callerRole !== 'owner') {
            return NextResponse.json({ error: "No autorizado. Solo el dueño de NeoConta puede realizar esta acción." }, { status: 403 });
        }

        if (!nombre || !email || !password || !role || !tipoUsuario) {
            return NextResponse.json({ error: "Faltan datos requeridos (nombre, email, contraseña, rol, tipo de usuario)" }, { status: 400 });
        }

        const users = await getUsers();
        const emailExists = users.some(u => u.email.toLowerCase() === email.trim().toLowerCase());
        if (emailExists) {
            return NextResponse.json({ error: "El correo electrónico ya se encuentra registrado." }, { status: 400 });
        }

        // Generate unique userId based on email prefix + random string
        const cleanName = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
        const randomSuffix = Math.random().toString(36).substring(2, 6);
        const userId = `${cleanName}_${randomSuffix}`;

        const newUser = {
            id: userId,
            nombre: nombre.trim(),
            email: email.trim().toLowerCase(),
            password: password,
            tipoUsuario: tipoUsuario,
            role: role,
            mustChangePassword: true, // Force password change on first login
            createdAt: new Date().toISOString()
        };

        users.push(newUser);
        await saveUsers(users);

        // If CUIT or Razón Social are provided, save config.json
        if (cuit || razonSocial) {
            const userDir = join(process.cwd(), 'data', 'users', userId);
            await mkdir(userDir, { recursive: true });
            const configPath = join(userDir, 'config.json');
            await writeFile(configPath, JSON.stringify({ cuit: cuit || "", razonSocial: razonSocial || "" }, null, 2), 'utf-8');
        }

        return NextResponse.json({ success: true, message: "Usuario creado exitosamente.", userId });

    } catch (error) {
        console.error("Error in admin POST user:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT: Edit user details (For owner only)
export async function PUT(request) {
    try {
        const { callerRole, userId, nombre, email, password, role, tipoUsuario, cuit, razonSocial } = await request.json();

        if (callerRole !== 'owner') {
            return NextResponse.json({ error: "No autorizado. Solo el dueño de NeoConta puede realizar esta acción." }, { status: 403 });
        }

        if (!userId || !nombre || !email || !role || !tipoUsuario) {
            return NextResponse.json({ error: "Faltan datos requeridos (userId, nombre, email, rol, tipo de usuario)" }, { status: 400 });
        }

        const users = await getUsers();
        const userIndex = users.findIndex(u => u.id === userId);

        if (userIndex === -1) {
            return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
        }

        // Check email uniqueness among other users
        const emailTaken = users.some(u => u.id !== userId && u.email.toLowerCase() === email.trim().toLowerCase());
        if (emailTaken) {
            return NextResponse.json({ error: "El correo electrónico ya está en uso por otro usuario." }, { status: 400 });
        }

        // Prevent changing owner's role
        if (users[userIndex].role === 'owner' && role !== 'owner') {
            return NextResponse.json({ error: "No se puede cambiar el rol del dueño de NeoConta." }, { status: 400 });
        }

        // Apply edits
        users[userIndex].nombre = nombre.trim();
        users[userIndex].email = email.trim().toLowerCase();
        users[userIndex].role = role;
        users[userIndex].tipoUsuario = tipoUsuario;

        if (password && password.trim() !== "") {
            users[userIndex].password = password;
            users[userIndex].mustChangePassword = true; // Force password change if reset by admin
        }

        await saveUsers(users);

        // Update config.json (CUIT/Razón Social)
        const userDir = join(process.cwd(), 'data', 'users', userId);
        await mkdir(userDir, { recursive: true });
        const configPath = join(userDir, 'config.json');
        await writeFile(configPath, JSON.stringify({ cuit: cuit || "", razonSocial: razonSocial || "" }, null, 2), 'utf-8');

        return NextResponse.json({ success: true, message: "Usuario actualizado exitosamente." });

    } catch (error) {
        console.error("Error in admin PUT user:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE: Deactivate/Delete user (For owner only)
export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const callerRole = searchParams.get('callerRole');

        if (callerRole !== 'owner') {
            return NextResponse.json({ error: "No autorizado. Solo el dueño de NeoConta puede realizar esta acción." }, { status: 403 });
        }

        if (!userId) {
            return NextResponse.json({ error: "Falta el ID del usuario (userId)" }, { status: 400 });
        }

        const users = await getUsers();
        const userIndex = users.findIndex(u => u.id === userId);

        if (userIndex === -1) {
            return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
        }

        // Prevent deleting the owner
        if (users[userIndex].role === 'owner') {
            return NextResponse.json({ error: "No se puede eliminar la cuenta del dueño de NeoConta." }, { status: 400 });
        }

        // Filter out and save
        const filteredUsers = users.filter(u => u.id !== userId);
        await saveUsers(filteredUsers);

        return NextResponse.json({ success: true, message: "Usuario dado de baja exitosamente." });

    } catch (error) {
        console.error("Error in admin DELETE user:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PATCH: Toggle role between 'cliente' and 'no-cliente' (Left for backwards compatibility if needed)
export async function PATCH(request) {
    try {
        const { userId, newRole, callerRole, callerId } = await request.json();

        if (callerRole !== 'owner') {
            return NextResponse.json({ error: "No autorizado. Solo el dueño de NeoConta puede realizar esta acción." }, { status: 403 });
        }

        if (!userId || !newRole) {
            return NextResponse.json({ error: "Faltan datos (userId, newRole)" }, { status: 400 });
        }

        if (newRole !== 'cliente' && newRole !== 'no-cliente') {
            return NextResponse.json({ error: "Rol no válido. Solo se permite 'cliente' o 'no-cliente'." }, { status: 400 });
        }

        const users = await getUsers();
        const userIndex = users.findIndex(u => u.id === userId);

        if (userIndex === -1) {
            return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
        }

        const targetUser = users[userIndex];

        if (targetUser.role === 'owner') {
            return NextResponse.json({ error: "No se puede modificar la categoría del dueño de NeoConta." }, { status: 400 });
        }

        users[userIndex].role = newRole;
        await saveUsers(users);

        return NextResponse.json({ success: true, message: `Usuario actualizado a ${newRole} exitosamente.` });

    } catch (error) {
        console.error("Error in admin PATCH user role:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
