import { NextResponse } from 'next/server';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import prisma from '@/lib/db';

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
        limiteComprobantes: 999999,
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

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: "User ID is required" }, { status: 400 });
        }

        const userDir = join(process.cwd(), 'data', 'users', userId);
        const configPath = join(userDir, 'config.json');
        const certPath = join(userDir, 'cert.crt');

        let config = { razonSocial: "", cuit: "", production: false };
        if (existsSync(configPath)) {
            const fileData = await readFile(configPath, 'utf8');
            config = JSON.parse(fileData);
        }

        const userDb = await prisma.user.findUnique({ where: { id: userId } }).catch(() => null);
        const isOwner = userDb?.role === 'owner' || userId === 'admin' || userDb?.email === 'admin@neoconta.com' || userDb?.email === 'rmanuelguerrero@gmail.com';

        const assignedPlan = isOwner ? "full" : (config.plan || "base");
        const baseFeatures = config.features || PLAN_DEFAULTS[assignedPlan] || PLAN_DEFAULTS.base;

        const effectiveFeatures = isOwner ? {
            ...PLAN_DEFAULTS.full,
            ...baseFeatures,
            facturacionManual: true,
            facturacionMasiva: true,
            limiteComprobantes: 999999
        } : baseFeatures;

        const getFallbackCondicion = (cuit) => {
            const clean = String(cuit || "").replace(/[^0-9]/g, "");
            if (clean.startsWith("30") || clean.startsWith("33") || clean.startsWith("34")) {
                return "IVA Responsable Inscripto";
            }
            return "Responsable Monotributo";
        };

        return NextResponse.json({
            success: true,
            razonSocial: config.razonSocial || "",
            cuit: config.cuit || "",
            production: config.production === true,
            condicionIva: config.condicionIva || getFallbackCondicion(config.cuit),
            logo: config.logo || "",
            hasCert: existsSync(certPath),
            plan: assignedPlan,
            onboardingCompleted: config.onboardingCompleted === true || (Boolean(config.razonSocial) && Boolean(config.cuit)),
            features: effectiveFeatures
        });

    } catch (error) {
        console.error("Error loading user config:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const contentType = request.headers.get('content-type') || '';
        let userId, razonSocial, cuit, production, condicionIva, logo, features, medicalDetails, direccion;
        let certFile, keyFile;

        if (contentType.includes('application/json')) {
            const body = await request.json();
            userId = body.userId;
            razonSocial = body.razonSocial;
            cuit = body.cuit;
            production = body.production === true;
            condicionIva = body.condicionIva || '';
            logo = body.logo || '';
            features = body.features;
            medicalDetails = body.medicalDetails;
            direccion = body.direccion;
        } else {
            const data = await request.formData();
            userId = data.get('userId');
            razonSocial = data.get('razonSocial');
            cuit = data.get('cuit');
            production = data.get('production') === 'true';
            condicionIva = data.get('condicionIva') || '';
            logo = data.get('logo') || '';
            certFile = data.get('cert'); // File object
            keyFile = data.get('key');   // File object
        }

        if (!userId) {
            return NextResponse.json({ error: "User ID is required" }, { status: 400 });
        }

        // Directory: data/users/{userId}
        const userDir = join(process.cwd(), 'data', 'users', userId);

        // Ensure directory exists
        await mkdir(userDir, { recursive: true });

        // Save JSON Config
        const configPath = join(userDir, 'config.json');
        let existingConfig = {};
        if (existsSync(configPath)) {
            try {
                existingConfig = JSON.parse(await readFile(configPath, 'utf8'));
            } catch (e) {
                console.error("Error reading existing config:", e);
            }
        }
        let config = {
            ...existingConfig,
            ...(razonSocial !== undefined && { razonSocial }),
            ...(cuit !== undefined && { cuit }),
            ...(production !== undefined && { production }),
            ...(condicionIva !== undefined && { condicionIva }),
            ...(logo !== undefined && { logo }),
            ...(direccion !== undefined && { direccion }),
            ...(features !== undefined && { features }),
            ...(medicalDetails !== undefined && { medicalDetails }),
            onboardingCompleted: true
        };

        // Save files if provided
        if (certFile instanceof Blob) {
            const buffer = Buffer.from(await certFile.arrayBuffer());
            await writeFile(join(userDir, 'cert.crt'), buffer);
        }

        if (keyFile instanceof Blob && keyFile.size > 0) {
            const buffer = Buffer.from(await keyFile.arrayBuffer());
            await writeFile(join(userDir, 'private.key'), buffer);
        }

        // Update config file
        await writeFile(configPath, JSON.stringify(config, null, 2));

        return NextResponse.json({ success: true, config });

    } catch (error) {
        console.error("Error saving user config:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
