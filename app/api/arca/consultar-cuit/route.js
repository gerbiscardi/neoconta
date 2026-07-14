import { NextResponse } from 'next/server';
import { Afip } from 'afip.ts';
import path from 'path';
import fs from 'fs';

export async function POST(request) {
    try {
        const { cuit, userId } = await request.json();

        if (!userId || !cuit) {
            return NextResponse.json({ error: "userId y cuit son requeridos" }, { status: 400 });
        }

        const cuitClean = cuit.replace(/[^0-9]/g, '');
        let cuitsToTry = [];

        function getCuitForDni(dni, genderPrefix) {
            const dniStr = String(dni).padStart(8, '0');
            const base = genderPrefix + dniStr;
            const coefficients = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
            let sum = 0;
            for (let i = 0; i < 10; i++) {
                sum += parseInt(base[i]) * coefficients[i];
            }
            const remainder = sum % 11;
            let checkDigit;
            let finalPrefix = genderPrefix;
            if (remainder === 0) {
                checkDigit = 0;
            } else if (remainder === 1) {
                if (genderPrefix === 20) {
                    checkDigit = 9;
                    finalPrefix = 23;
                } else {
                    checkDigit = 4;
                    finalPrefix = 23;
                }
            } else {
                checkDigit = 11 - remainder;
            }
            return finalPrefix + dniStr + checkDigit;
        }

        if (cuitClean.length === 11) {
            cuitsToTry.push(cuitClean);
        } else if (cuitClean.length === 7 || cuitClean.length === 8) {
            cuitsToTry.push(getCuitForDni(cuitClean, 20)); // Try Male
            cuitsToTry.push(getCuitForDni(cuitClean, 27)); // Try Female
        } else {
            return NextResponse.json({ error: "Documento inválido (debe tener 7, 8 o 11 dígitos)" }, { status: 400 });
        }

        const userDir = path.join(process.cwd(), 'data', 'users', userId);
        const certPath = path.join(userDir, 'cert.crt');
        const keyPath = path.join(userDir, 'private.key');
        const configPath = path.join(userDir, 'config.json');

        if (!fs.existsSync(certPath) || !fs.existsSync(keyPath) || !fs.existsSync(configPath)) {
            return NextResponse.json({
                error: "Faltan certificados o configuración para este usuario.",
                details: "Por favor ve a la sección Configuración y sube tus certificados."
            }, { status: 400 });
        }

        const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const userCuit = parseInt(userConfig.cuit.replace(/[^0-9]/g, ''));
        const isProduction = userConfig.production === true;

        const certContent = fs.readFileSync(certPath, 'utf8');
        const keyContent = fs.readFileSync(keyPath, 'utf8');

        // Initialize AFIP SDK
        let afip;
        try {
            const ticketsDir = path.join(process.cwd(), 'data', 'tickets');
            if (!fs.existsSync(ticketsDir)) {
                fs.mkdirSync(ticketsDir, { recursive: true });
            }
            afip = new Afip({
                key: keyContent,
                cert: certContent,
                cuit: userCuit,
                production: isProduction,
                ticketPath: ticketsDir
            });
        } catch (e) {
            return NextResponse.json({
                error: "Error al inicializar el SDK de ARCA con los certificados provistos.",
                details: e.message
            }, { status: 500 });
        }

        try {
            let taxpayer = null;
            let lastError = null;
            let foundCuit = "";

            for (const targetCuit of cuitsToTry) {
                try {
                    taxpayer = await afip.registerScopeThirteenService.getTaxpayerDetails(Number(targetCuit));
                    if (taxpayer && taxpayer.persona) {
                        foundCuit = targetCuit;
                        break;
                    }
                } catch (err) {
                    lastError = err;
                    if (err.message.includes("notAuthorized") || err.message.includes("no autorizado")) {
                        throw err;
                    }
                }
            }

            if (!taxpayer || !taxpayer.persona) {
                let errorMsg = lastError ? (lastError.message || "No se encontraron datos.") : "No se encontraron datos en el padrón de ARCA.";
                if (errorMsg.includes("inexistente")) {
                    errorMsg = "El documento ingresado es inexistente en el padrón de ARCA.";
                }
                return NextResponse.json({ error: errorMsg }, { status: 404 });
            }

            const persona = taxpayer.persona;
            const razonSocial = persona.razonSocial || `${persona.apellido || ''} ${persona.nombre || ''}`.trim();

            // Smart default condition since A13 does not return taxes
            let condicionIva = "Consumidor Final";
            if (persona.tipoPersona === "JURIDICA") {
                condicionIva = "IVA Responsable Inscripto";
            }

            return NextResponse.json({
                success: true,
                razonSocial,
                condicionIva,
                foundCuit
            });

        } catch (err) {
            console.error("ARCA Error checking CUIT details via A13:", err);
            
            let errorMsg = err.message || "Error al consultar los detalles del CUIT en ARCA.";
            
            if (errorMsg.includes("notAuthorized") || errorMsg.includes("no autorizado")) {
                errorMsg = "Servicio no autorizado. Asegúrate de delegar el servicio 'ws_sr_padron_a13' (Servicio Consulta Padrón A13) en la web de ARCA para este certificado.";
            } else if (errorMsg.includes("inexistente")) {
                errorMsg = "El CUIT consultado es inexistente en el padrón de ARCA.";
            } else {
                const errData = err.response?.Errors?.Err;
                if (Array.isArray(errData)) {
                    errorMsg = errData.map(e => `[${e.Code || e.code}] ${e.Msg || e.msg}`).join(' | ');
                } else if (errData && (errData.Msg || errData.msg)) {
                    errorMsg = `[${errData.Code || errData.code}] ${errData.Msg || errData.msg}`;
                }
            }

            return NextResponse.json({ error: errorMsg }, { status: 500 });
        }

    } catch (error) {
        console.error("Global Error verifying CUIT:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
