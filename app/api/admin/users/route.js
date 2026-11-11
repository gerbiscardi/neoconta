import { NextResponse } from 'next/server';
import { readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getServerSession, hashPassword, getUsersJsonPath } from '@/lib/auth';
import { getInvoicesDir, getPlatformConfigPath, getUserDataDir, writeJsonAtomic } from '@/lib/dataPaths';
import prisma from '@/lib/db';

const getDbPath = () => getUsersJsonPath();

const PLAN_DEFAULTS = {
    base: {
        facturacionManual: true,
        facturacionMasiva: false,
        limiteComprobantes: 50,
        moduloBanco: true,
        variasCuentas: false,
        limiteCuentas: 1,
        conciliacionAsistida: false,
        cruceFacturaBanco: false,
        biBasico: true,
        biAvanzado: false,
        biPremium: false,
        reportesMensuales: false,
        reportesEjecutivos: false,
        exportacionDatos: false,
        alertasSimples: false,
        alertasInteligentes: false,
        moduloImagenWeb: false,
        moduloVitacore: true,
        analisisReputacion: false,
        acompanamientoMensual: false,
        usuariosIncluidos: 1,
        soporteTipo: "estandar"
    },
    pro: {
        facturacionManual: true,
        facturacionMasiva: true,
        limiteComprobantes: 300,
        moduloBanco: true,
        variasCuentas: true,
        limiteCuentas: 3,
        conciliacionAsistida: true,
        cruceFacturaBanco: true,
        biBasico: true,
        biAvanzado: true,
        biPremium: false,
        reportesMensuales: true,
        reportesEjecutivos: false,
        exportacionDatos: true,
        alertasSimples: true,
        alertasInteligentes: false,
        moduloImagenWeb: false,
        moduloVitacore: true,
        analisisReputacion: false,
        acompanamientoMensual: false,
        usuariosIncluidos: 3,
        soporteTipo: "prioritario"
    },
    full: {
        facturacionManual: true,
        facturacionMasiva: true,
        limiteComprobantes: 1000,
        moduloBanco: true,
        variasCuentas: true,
        limiteCuentas: 5,
        conciliacionAsistida: true,
        cruceFacturaBanco: true,
        biBasico: true,
        biAvanzado: true,
        biPremium: true,
        reportesMensuales: true,
        reportesEjecutivos: true,
        exportacionDatos: true,
        alertasSimples: true,
        alertasInteligentes: true,
        moduloImagenWeb: true,
        moduloVitacore: true,
        analisisReputacion: true,
        acompanamientoMensual: true,
        usuariosIncluidos: 5,
        soporteTipo: "preferencial"
    }
};

async function getUsers() {
    try {
        const data = await readFile(getDbPath(), 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        console.error("Error reading users db:", err);
        return [];
    }
}

async function saveUsers(users) {
    await writeJsonAtomic(getDbPath(), users);
}

// GET: List all users with stats and config (For owner only)
export async function GET(request) {
    try {
        const session = await getServerSession(request);
        if (!session || session.role !== 'owner') {
            return NextResponse.json({ error: "No autorizado. Solo el dueño de NeoConta puede realizar esta acción." }, { status: 403 });
        }

        const users = await getUsers();
        const invoicesDir = getInvoicesDir();
        const configPath = getPlatformConfigPath();

        // Load Platform Configuration (Parámetros del Simulador Comercial Hipotético)
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

        // Current month key for quota evaluation (Mes calendario en curso: YYYY-MM)
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonthNum = String(now.getMonth() + 1).padStart(2, '0');
        const currentMonthKey = `${currentYear}-${currentMonthNum}`; // e.g. "2026-11"

        // Remove password from response and calculate individual client operational stats
        const sanitizedUsers = [];
        let totalCommercialInvoices = 0;
        let totalCommercialMonthInvoices = 0;
        let totalInvoicesBreakdown = { facturas: 0, notasCredito: 0 };
        const monthlyAggregates = {};

        for (const user of users) {
            const { password, ...userInfo } = user;

            // Identificación estricta y persistente de cuentas internas / de prueba
            const isInternal = Boolean(
                user.isInternal === true || 
                user.id === 'admin' || 
                user.id === 'cliente' || 
                user.id === 'nocli' || 
                (user.email && (user.email.toLowerCase().endsWith('@neoconta.com') || user.email.toLowerCase() === 'admin@neoconta.com'))
            );
            userInfo.isInternal = isInternal;

            // Load CUIT, Razón Social, Plan and Features from config.json if they exist
            userInfo.cuit = "";
            userInfo.razonSocial = "";
            userInfo.plan = "base";
            userInfo.features = PLAN_DEFAULTS.base;
            try {
                const configJsonPath = join(getUserDataDir(user.id), 'config.json');
                const configData = await readFile(configJsonPath, 'utf-8');
                const userConfig = JSON.parse(configData);
                userInfo.cuit = userConfig.cuit || "";
                userInfo.razonSocial = userConfig.razonSocial || "";
                userInfo.plan = userConfig.plan || "base";
                userInfo.features = userConfig.features || PLAN_DEFAULTS[userInfo.plan] || PLAN_DEFAULTS.base;
            } catch (e) {
                // Ignore missing config files
            }
            
            // Default individual operational stats (MINIMIZACIÓN DE DATOS: sin montos financieros privados de clientes)
            const invoiceLimit = userInfo.features?.limiteComprobantes || (userInfo.plan === 'full' ? 1000 : userInfo.plan === 'pro' ? 300 : 50);
            userInfo.stats = {
                invoiceCount: 0,
                monthInvoiceCount: 0,
                invoiceLimit: invoiceLimit,
                monthUsagePercent: 0,
                lastInvoiceDate: null
            };

            try {
                const historyFile = join(invoicesDir, `${user.id}_history.json`);
                const fileContent = await readFile(historyFile, 'utf-8');
                const invoices = JSON.parse(fileContent);
                if (Array.isArray(invoices) && invoices.length > 0) {
                    userInfo.stats.invoiceCount = invoices.length;
                    let latestDate = null;
                    let userMonthCount = 0;

                    for (const inv of invoices) {
                        // Determinar fecha fiscal autoritativa (CbteFch > created_at > afip_response)
                        const rawFch = inv.CbteFch || inv.cbteFch;
                        let invDate = null;
                        let monthKey = null;

                        if (rawFch) {
                            // Si viene como YYYY-MM-DD o YYYYMMDD
                            if (rawFch.includes('-')) {
                                monthKey = rawFch.substring(0, 7);
                                invDate = new Date(rawFch);
                            } else if (rawFch.length === 8) {
                                monthKey = `${rawFch.substring(0, 4)}-${rawFch.substring(4, 6)}`;
                                invDate = new Date(`${rawFch.substring(0, 4)}-${rawFch.substring(4, 6)}-${rawFch.substring(6, 8)}`);
                            }
                        }

                        if (!invDate) {
                            const invDateStr = inv.created_at || (inv.afip_response?.response?.FeCabResp?.FchProceso ? 
                                `${inv.afip_response.response.FeCabResp.FchProceso.substring(0,4)}-${inv.afip_response.response.FeCabResp.FchProceso.substring(4,6)}-${inv.afip_response.response.FeCabResp.FchProceso.substring(6,8)}` : null);
                            if (invDateStr) {
                                invDate = new Date(invDateStr);
                                monthKey = invDate.toISOString().substring(0, 7);
                            }
                        }

                        if (invDate && (!latestDate || invDate > latestDate)) {
                            latestDate = invDate;
                        }

                        // Verificar si corresponde al mes en curso
                        if (monthKey === currentMonthKey) {
                            userMonthCount++;
                        }

                        // Acumular series mensuales solo para clientes comerciales reales
                        if (userInfo.role === 'cliente' && !isInternal && monthKey) {
                            if (!monthlyAggregates[monthKey]) {
                                monthlyAggregates[monthKey] = { total: 0, fct: 0, nc: 0 };
                            }
                            monthlyAggregates[monthKey].total++;
                            if (inv.CbteTipo === 13) {
                                monthlyAggregates[monthKey].nc++;
                                totalInvoicesBreakdown.notasCredito++;
                            } else {
                                monthlyAggregates[monthKey].fct++;
                                totalInvoicesBreakdown.facturas++;
                            }
                        }
                    }

                    userInfo.stats.lastInvoiceDate = latestDate ? latestDate.toISOString() : null;
                    userInfo.stats.monthInvoiceCount = userMonthCount;
                    userInfo.stats.monthUsagePercent = Math.min(100, Math.round((userMonthCount / invoiceLimit) * 100));

                    // Acumular totales globales solo de clientes comerciales reales
                    if (userInfo.role === 'cliente' && !isInternal) {
                        totalCommercialInvoices += invoices.length;
                        totalCommercialMonthInvoices += userMonthCount;
                    }
                }
            } catch (e) {
                // Ignore errors from missing history files
            }

            sanitizedUsers.push(userInfo);
        }

        // Clientes comerciales operativos reales
        const commercialClients = sanitizedUsers.filter(u => u.role === 'cliente' && !u.isInternal);
        const activeClients = commercialClients.length;
        const totalUsers = sanitizedUsers.length;

        // Cupo global mensual de clientes comerciales activos
        const totalQuota = commercialClients.reduce((acc, u) => acc + (u.stats.invoiceLimit || 50), 0);
        const quotaUtilization = totalQuota > 0 ? Math.round((totalCommercialMonthInvoices / totalQuota) * 100) : 0;

        // Serie mensual continua para el gráfico (Junio a Noviembre 2026)
        const monthsRange = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'];
        const monthLabels = { '01':'Ene', '02':'Feb', '03':'Mar', '04':'Abr', '05':'May', '06':'Jun', '07':'Jul', '08':'Ago', '09':'Sep', '10':'Oct', '11':'Nov', '12':'Dic' };
        
        const monthlySeries = monthsRange.map(mKey => {
            const agg = monthlyAggregates[mKey] || { total: 0, fct: 0, nc: 0 };
            const [y, m] = mKey.split('-');
            return {
                key: mKey,
                monthLabel: monthLabels[m] || m,
                year: y,
                total: agg.total,
                facturas: agg.fct,
                notasCredito: agg.nc,
                isCurrent: mKey === currentMonthKey
            };
        });

        // Simulador de pricing comercial hipotético
        const simulatedMrr = (activeClients * costPerClient) + baseSubscription;

        const stats = {
            // Métricas auditadas reales
            totalInvoices: totalCommercialInvoices, // 30 comprobantes reales
            totalInvoicesBreakdown, // { facturas: 23, notasCredito: 7 }
            currentMonthInvoices: totalCommercialMonthInvoices, // 0 en nov 2026
            currentMonthKey,
            totalQuota: totalQuota > 0 ? totalQuota : 1000, // 1.000 cupo mensual
            quotaUtilization, // 0% de uso en el mes corriente
            mrr: 0, // MRR Genuino Contratado: Sin suscripciones de pago registradas
            arpu: 0, // Sin cobros vigentes
            conversionRate: "Fase Inicial",
            commercialClientsCount: activeClients, // 1
            internalUsersCount: sanitizedUsers.filter(u => u.isInternal).length, // 3
            // Simulador comercial hipotético
            simulatedPricing: {
                baseSubscription,
                costPerClient,
                simulatedMrr
            },
            monthlySeries
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
        const session = await getServerSession(request);
        if (!session || session.role !== 'owner') {
            return NextResponse.json({ error: "No autorizado. Solo el dueño de NeoConta puede realizar esta acción." }, { status: 403 });
        }

        const { nombre, email, password, role, tipoUsuario, cuit, razonSocial, plan, features } = await request.json();

        if (!nombre || !email || !password || !role || !tipoUsuario) {
            return NextResponse.json({ error: "Faltan datos requeridos (nombre, email, contraseña, rol, tipo de usuario)" }, { status: 400 });
        }

        const cleanEmail = email.trim().toLowerCase();
        const users = await getUsers();
        const existingPrisma = await prisma.user.findUnique({ where: { email: cleanEmail } });
        const emailExists = users.some(u => String(u.email || '').trim().toLowerCase() === cleanEmail);
        if (existingPrisma || emailExists) {
            return NextResponse.json({ error: "El correo electrónico ya se encuentra registrado." }, { status: 400 });
        }

        // Generate unique userId based on email prefix + random string
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
            role: role,
            isInternal: false,
            mustChangePassword: true, // Force password change on first login
            createdAt: new Date().toISOString()
        };

        // Synchronize authoritative Prisma DB first
        await prisma.user.upsert({
            where: { id: userId },
            update: {
                nombre: newUser.nombre,
                email: newUser.email,
                password: newUser.password,
                role: newUser.role,
                status: 'active',
                mustChangePassword: true
            },
            create: {
                id: userId,
                nombre: newUser.nombre,
                email: newUser.email,
                password: newUser.password,
                role: newUser.role,
                status: 'active',
                mustChangePassword: true
            }
        });

        try {
            users.push(newUser);
            await saveUsers(users);
        } catch (saveErr) {
            await prisma.user.delete({ where: { id: userId } }).catch(() => {});
            throw saveErr;
        }

        // Save config.json for clients
        if (role === 'cliente' || cuit || razonSocial) {
            const userDir = getUserDataDir(userId);
            await mkdir(userDir, { recursive: true });
            const configPath = join(userDir, 'config.json');
            
            let existingConfig = {};
            try {
                const configData = await readFile(configPath, 'utf-8');
                existingConfig = JSON.parse(configData);
            } catch (e) {}

            const assignedPlan = plan || "base";
            const updatedConfig = {
                ...existingConfig,
                cuit: cuit || "",
                razonSocial: razonSocial || "",
                plan: assignedPlan,
                features: features || PLAN_DEFAULTS[assignedPlan] || PLAN_DEFAULTS.base
            };
            await writeJsonAtomic(configPath, updatedConfig);
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
        const session = await getServerSession(request);
        if (!session || session.role !== 'owner') {
            return NextResponse.json({ error: "No autorizado. Solo el dueño de NeoConta puede realizar esta acción." }, { status: 403 });
        }

        const { userId, nombre, email, password, role, tipoUsuario, cuit, razonSocial, plan, features } = await request.json();

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

        let hashedPassword = null;
        if (password && password.trim() !== "") {
            hashedPassword = await hashPassword(password);
            users[userIndex].password = hashedPassword;
            users[userIndex].mustChangePassword = true; // Force password change if reset by admin
        }

        const previousPrisma = await prisma.user.findUnique({ where: { id: userId } });

        // Synchronize authoritative Prisma DB first
        await prisma.user.upsert({
            where: { id: userId },
            update: {
                nombre: users[userIndex].nombre,
                email: users[userIndex].email,
                role: users[userIndex].role,
                ...(hashedPassword ? { password: hashedPassword, mustChangePassword: true } : {})
            },
            create: {
                id: userId,
                nombre: users[userIndex].nombre,
                email: users[userIndex].email,
                password: users[userIndex].password,
                role: users[userIndex].role,
                status: users[userIndex].status || 'active',
                mustChangePassword: Boolean(users[userIndex].mustChangePassword)
            }
        });

        try {
            await saveUsers(users);
        } catch (saveErr) {
            console.error("Error writing users.json in admin PUT, compensating Prisma:", saveErr);
            if (previousPrisma) {
                await prisma.user.update({
                    where: { id: userId },
                    data: {
                        nombre: previousPrisma.nombre,
                        email: previousPrisma.email,
                        password: previousPrisma.password,
                        role: previousPrisma.role,
                        mustChangePassword: previousPrisma.mustChangePassword
                    }
                }).catch(() => {});
            } else {
                await prisma.user.delete({ where: { id: userId } }).catch(() => {});
            }
            throw saveErr;
        }

        // Update config.json (CUIT/Razón Social/Plan/Features)
        if (role === 'cliente' || cuit || razonSocial) {
            const userDir = getUserDataDir(userId);
            await mkdir(userDir, { recursive: true });
            const configPath = join(userDir, 'config.json');

            let existingConfig = {};
            try {
                const configData = await readFile(configPath, 'utf-8');
                existingConfig = JSON.parse(configData);
            } catch (e) {}

            const assignedPlan = plan || existingConfig.plan || "base";
            const updatedConfig = {
                ...existingConfig,
                cuit: cuit || "",
                razonSocial: razonSocial || "",
                plan: assignedPlan,
                features: features || existingConfig.features || PLAN_DEFAULTS[assignedPlan] || PLAN_DEFAULTS.base
            };
            await writeJsonAtomic(configPath, updatedConfig);
        }

        return NextResponse.json({ success: true, message: "Usuario actualizado exitosamente." });

    } catch (error) {
        console.error("Error in admin PUT user:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE: Deactivate/Delete user (For owner only)
export async function DELETE(request) {
    try {
        const session = await getServerSession(request);
        if (!session || session.role !== 'owner') {
            return NextResponse.json({ error: "No autorizado. Solo el dueño de NeoConta puede realizar esta acción." }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

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

        const previousPrisma = await prisma.user.findUnique({ where: { id: userId } });

        // Synchronize with Prisma DB first
        await prisma.user.deleteMany({
            where: { id: userId }
        });

        // Filter out and save JSON mirror; restore Prisma record on JSON write failure
        const filteredUsers = users.filter(u => u.id !== userId);
        try {
            await saveUsers(filteredUsers);
        } catch (saveErr) {
            console.error("Error writing users.json in admin DELETE, restoring Prisma user:", saveErr);
            if (previousPrisma) {
                await prisma.user.create({
                    data: {
                        id: previousPrisma.id,
                        nombre: previousPrisma.nombre,
                        email: previousPrisma.email,
                        password: previousPrisma.password,
                        role: previousPrisma.role,
                        parentId: previousPrisma.parentId,
                        status: previousPrisma.status,
                        mustChangePassword: previousPrisma.mustChangePassword
                    }
                }).catch(() => {});
            }
            throw saveErr;
        }

        return NextResponse.json({ success: true, message: "Usuario dado de baja exitosamente." });

    } catch (error) {
        console.error("Error in admin DELETE user:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PATCH: Toggle role between 'cliente' and 'no-cliente' (Left for backwards compatibility if needed)
export async function PATCH(request) {
    try {
        const session = await getServerSession(request);
        if (!session || session.role !== 'owner') {
            return NextResponse.json({ error: "No autorizado. Solo el dueño de NeoConta puede realizar esta acción." }, { status: 403 });
        }

        const { userId, newRole } = await request.json();

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

        const previousPrisma = await prisma.user.findUnique({ where: { id: userId } });

        users[userIndex].role = newRole;
        await prisma.user.updateMany({
            where: { id: userId },
            data: { role: newRole }
        });
        try {
            await saveUsers(users);
        } catch (saveErr) {
            console.error("Error writing users.json in admin PATCH, compensating Prisma:", saveErr);
            if (previousPrisma) {
                await prisma.user.update({
                    where: { id: userId },
                    data: { role: previousPrisma.role }
                }).catch(() => {});
            }
            throw saveErr;
        }

        return NextResponse.json({ success: true, message: `Usuario actualizado a ${newRole} exitosamente.` });

    } catch (error) {
        console.error("Error in admin PATCH user role:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
