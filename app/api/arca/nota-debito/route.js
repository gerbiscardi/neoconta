import { NextResponse } from 'next/server';
import { Afip } from 'afip.ts';
import path from 'path';
import fs from 'fs';

export async function POST(request) {
    try {
        const { userId, invoiceId, amount } = await request.json();

        if (!userId || !invoiceId || !amount) {
            return NextResponse.json({ error: "Faltan parámetros requeridos (userId, invoiceId, amount)" }, { status: 400 });
        }

        const debitAmount = Math.round(Number(amount) * 100) / 100;
        if (isNaN(debitAmount) || debitAmount <= 0) {
            return NextResponse.json({ error: "El monto de la Nota de Débito debe ser mayor a 0" }, { status: 400 });
        }

        const invoicesDir = path.join(process.cwd(), 'data', 'invoices');
        const historyFile = path.join(invoicesDir, `${userId}_history.json`);

        // 1. Load History and find original invoice
        let history = [];
        try {
            const fileData = fs.readFileSync(historyFile, 'utf8');
            history = JSON.parse(fileData);
        } catch (error) {
            return NextResponse.json({ error: "No se encontró el historial de facturas." }, { status: 404 });
        }

        const originalInvoice = history.find(inv => inv.cae === invoiceId);
        if (!originalInvoice) {
            return NextResponse.json({ error: "No se encontró la factura original en el historial." }, { status: 404 });
        }

        if (originalInvoice.debitNoteIssued) {
            return NextResponse.json({ error: "Ya se ha emitido una Nota de Débito para esta factura." }, { status: 400 });
        }

        // 2. Load User Configuration and Certificates
        const userDir = path.join(process.cwd(), 'data', 'users', userId);
        const certPath = path.join(userDir, 'cert.crt');
        const keyPath = path.join(userDir, 'private.key');
        const configPath = path.join(userDir, 'config.json');

        if (!fs.existsSync(certPath) || !fs.existsSync(keyPath) || !fs.existsSync(configPath)) {
            return NextResponse.json({ error: "Faltan certificados o configuración para el usuario." }, { status: 400 });
        }

        const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const cuit = parseInt(userConfig.cuit.replace(/[^0-9]/g, ''));
        const isProduction = userConfig.production === true;
        const certContent = fs.readFileSync(certPath, 'utf8');
        const keyContent = fs.readFileSync(keyPath, 'utf8');

        // 3. Initialize AFIP SDK
        let afip;
        try {
            const ticketsDir = path.join(process.cwd(), 'data', 'tickets');
            if (!fs.existsSync(ticketsDir)) {
                fs.mkdirSync(ticketsDir, { recursive: true });
            }
            afip = new Afip({
                key: keyContent,
                cert: certContent,
                cuit: cuit,
                production: isProduction,
                ticketPath: ticketsDir
            });
        } catch (e) {
            return NextResponse.json({ error: "Error al inicializar AFIP SDK", details: e.message }, { status: 500 });
        }

        // 4. Prepare Debit Note Data (Voucher Type 12 = Nota de Débito C)
        const dateStr = new Date(Date.now() - ((new Date()).getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        
        // Client variables mapping
        const condicionStr = String(originalInvoice.CondicionIVA || "").toLowerCase();
        const cuitStr = String(originalInvoice.CUIT || "").replace(/[^0-9]/g, '');

        let docTipo = originalInvoice.DocTipo !== undefined ? Number(originalInvoice.DocTipo) : 99;
        let docNro = originalInvoice.DocNro !== undefined ? Number(originalInvoice.DocNro) : 0;

        if (originalInvoice.DocTipo === undefined) {
            if (cuitStr.length >= 10 && !condicionStr.includes("consumidor")) {
                docTipo = 80;
                docNro = parseInt(cuitStr);
            } else if (cuitStr.length >= 7 && cuitStr.length <= 8) {
                docTipo = 96;
                docNro = parseInt(cuitStr);
            }
        }

        let condicionId = 5;
        const cStr = condicionStr.trim().toLowerCase();
        
        if (cStr.includes("responsable inscripto") || cStr === "iva responsable inscripto" || cStr === "responsable inscripto") {
            condicionId = 1;
        } else if (cStr.includes("sujeto exento") || cStr === "iva sujeto exento" || cStr === "exento") {
            condicionId = 4;
        } else if (cStr === "consumidor final" || cStr.includes("consumidor")) {
            condicionId = 5;
        } else if (cStr.includes("monotributo") || cStr === "responsable monotributo" || cStr.includes("monotributista")) {
            condicionId = 6;
        } else if (cStr.includes("no categorizado") || cStr === "sujeto no categorizado") {
            condicionId = 7;
        } else if (cStr.includes("proveedor del exterior")) {
            condicionId = 8;
        } else if (cStr.includes("cliente del exterior")) {
            condicionId = 9;
        } else if (cStr.includes("19.640") || cStr.includes("19640") || cStr.includes("liberado")) {
            condicionId = 10;
        } else if (cStr.includes("monotributista social") || cStr.includes("monotributo social")) {
            condicionId = 13;
        } else if (cStr.includes("no alcanzado") || cStr.includes("no responsable")) {
            condicionId = 3;
        } else if (cStr.includes("promovido") || cStr.includes("independiente promovido")) {
            condicionId = 15;
        } else if (cuitStr.length >= 10) {
            condicionId = 1;
        }

        // Determine original voucher number from afip_response or fallback
        const originalPtoVta = originalInvoice.PtoVta || originalInvoice.ptoVta || originalInvoice.afip_response?.response?.FeCabResp?.PtoVta || originalInvoice.afip_response?.PtoVta || 1;
        const originalNro = originalInvoice.CbteDesde || originalInvoice.cbteDesde || originalInvoice.afip_response?.response?.FeDetResp?.FECAEDetResponse?.[0]?.CbteDesde || originalInvoice.afip_response?.CbteDesde || originalInvoice.id || 1;

        const data = {
            CantReg: 1,
            PtoVta: originalPtoVta,
            CbteTipo: 12, // 12 = Nota de Débito C
            Concepto: 1,
            DocTipo: docTipo,
            DocNro: docNro,
            CbteDesde: 1,
            CbteHasta: 1,
            CbteFch: parseInt(dateStr.replace(/-/g, '')),
            ImpTotal: debitAmount,
            ImpTotConc: 0,
            ImpNeto: debitAmount,
            ImpOpEx: 0,
            ImpIVA: 0,
            ImpTrib: 0,
            MonId: 'PES',
            MonCotiz: 1,
            CondicionIVAReceptorId: condicionId,
            CbtesAsoc: [
                {
                    Tipo: 11, // Related original voucher type (11 = Factura C)
                    PtoVta: originalPtoVta,
                    Nro: originalNro
                }
            ]
        };

        // 5. Emit Voucher type 12 via AFIP
        let debitResponse;
        try {
            const lastVoucher = await afip.electronicBillingService.getLastVoucher(originalPtoVta, 12);
            data.CbteDesde = lastVoucher.CbteNro + 1;
            data.CbteHasta = lastVoucher.CbteNro + 1;

            debitResponse = await afip.electronicBillingService.createInvoice(data);
        } catch (afipErr) {
            console.error("AFIP Error emitting Debit Note:", afipErr);
            return NextResponse.json({ error: afipErr.message }, { status: 500 });
        }

        if (!debitResponse.cae) {
            const obsData = debitResponse.response?.FeDetResp?.FECAEDetResponse?.[0]?.Observaciones?.Obs;
            const errData = debitResponse.response?.Errors?.Err;
            
            let errorMessages = [];
            
            // Parse Observations
            if (Array.isArray(obsData)) {
                obsData.forEach(o => errorMessages.push(`[Obs ${o.Code || o.code}] ${o.Msg || o.msg}`));
            } else if (obsData && (obsData.Msg || obsData.msg)) {
                errorMessages.push(`[Obs ${obsData.Code || obsData.code}] ${obsData.Msg || obsData.msg}`);
            }
            
            // Parse General Errors
            if (Array.isArray(errData)) {
                errData.forEach(e => errorMessages.push(`[Err ${e.Code || e.code}] ${e.Msg || e.msg}`));
            } else if (errData && (errData.Msg || errData.msg)) {
                errorMessages.push(`[Err ${errData.Code || errData.code}] ${errData.Msg || errData.msg}`);
            }
            
            let errorMsg = errorMessages.length > 0 
                ? errorMessages.join(' | ') 
                : "Rechazado por regla de negocio de AFIP.";
                
            return NextResponse.json({ error: errorMsg }, { status: 400 });
        }

        // 6. Update Original Invoice in History with Debit Note details
        const updatedHistory = history.map(inv => {
            if (inv.cae === invoiceId) {
                return {
                    ...inv,
                    debitNoteIssued: true,
                    debitNoteCae: debitResponse.cae,
                    debitNoteVto: debitResponse.caeFchVto || debitResponse.caeVto,
                    debitNotePtoVta: data.PtoVta,
                    debitNoteNro: debitResponse.response?.FeDetResp?.FECAEDetResponse?.[0]?.CbteDesde || data.CbteDesde,
                    debitNoteAmount: debitAmount,
                    debitNoteDate: dateStr
                };
            }
            return inv;
        });

        // Save updated history
        fs.writeFileSync(historyFile, JSON.stringify(updatedHistory, null, 2), 'utf8');

        return NextResponse.json({
            success: true,
            debitNote: {
                cae: debitResponse.cae,
                caeVto: debitResponse.caeFchVto || debitResponse.caeVto,
                nro: data.CbteDesde,
                amount: debitAmount,
                date: dateStr
            }
        });

    } catch (error) {
        console.error("Global Error processing Debit Note:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
