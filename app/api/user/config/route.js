import { NextResponse } from 'next/server';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

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

        const assignedPlan = config.plan || "base";

        return NextResponse.json({
            success: true,
            razonSocial: config.razonSocial || "",
            cuit: config.cuit || "",
            production: config.production === true,
            logo: config.logo || "",
            hasCert: existsSync(certPath),
            plan: assignedPlan,
            features: config.features || PLAN_DEFAULTS[assignedPlan] || PLAN_DEFAULTS.base
        });

    } catch (error) {
        console.error("Error loading user config:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const data = await request.formData();
        const userId = data.get('userId');
        const razonSocial = data.get('razonSocial');
        const cuit = data.get('cuit');
        const production = data.get('production') === 'true';
        const logo = data.get('logo') || '';
        const certFile = data.get('cert'); // File object
        const keyFile = data.get('key');   // File object

        if (!userId) {
            return NextResponse.json({ error: "User ID is required" }, { status: 400 });
        }

        // Directory: data/users/{userId}
        const userDir = join(process.cwd(), 'data', 'users', userId);

        // Ensure directory exists
        await mkdir(userDir, { recursive: true });

        // Save JSON Config
        const configPath = join(userDir, 'config.json');
        let config = { razonSocial, cuit, production, logo };

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

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Error saving user config:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
