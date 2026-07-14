import { NextResponse } from 'next/server';
import { Afip } from 'afip.ts';
import path from 'path';
import fs from 'fs';

export async function POST(request) {
    try {
        const { invoices, userId, production = false } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: "User ID is required" }, { status: 400 });
        }

        // Path to user specific certificates and config
        const userDir = path.join(process.cwd(), 'data', 'users', userId);
        const certPath = path.join(userDir, 'cert.crt');
        const keyPath = path.join(userDir, 'private.key');
        const configPath = path.join(userDir, 'config.json');

        // Check if configuration exists
        if (!fs.existsSync(certPath) || !fs.existsSync(keyPath) || !fs.existsSync(configPath)) {
            return NextResponse.json({
                error: "Faltan certificados o configuración para este usuario.",
                details: "Por favor ve a la sección Configuración y sube tus certificados."
            }, { status: 400 });
        }

        // Load User Configuration (CUIT, Production status)
        const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const cuit = parseInt(userConfig.cuit.replace(/[^0-9]/g, ''));
        const isProduction = userConfig.production === true || production === true;

        // Read Cert and Key contents (afip-ws-node requires string content)
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
                cuit: cuit,
                production: isProduction,
                ticketPath: ticketsDir
            });
        } catch (e) {
            return NextResponse.json({
                error: "Error al inicializar AFIP SDK con los certificados provistos.",
                details: e.message
            }, { status: 500 });
        }

        const results = [];

        for (const rawInvoice of invoices) {
            let invoice = {};
            try {
                // Remove spaces from Excel column headers
                for (const key in rawInvoice) {
                    invoice[key.trim()] = rawInvoice[key];
                }

                const date = new Date(Date.now() - ((new Date()).getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                const rawAmount = invoice.Total || invoice.total || invoice.Importe || invoice.importe || 0;
                const amount = typeof rawAmount === 'string'
                    ? parseFloat(rawAmount.replace(/\./g, '').replace(/,/g, '.'))
                    : Number(rawAmount);

                const condicionStr = String(invoice.CondicionIVA || invoice.condicion || invoice.Condicion || "").toLowerCase();
                const cuitStr = String(invoice.CUIT || invoice.Cuit || invoice.cuit || "").replace(/[^0-9]/g, '');

                // DocTipo defaults to 99 (Consumidor Final, doc 0)
                let docTipo = invoice.DocTipo !== undefined ? Number(invoice.DocTipo) : 99;
                let docNro = invoice.DocNro !== undefined ? Number(invoice.DocNro) : 0;

                if (invoice.DocTipo === undefined) {
                    // Fallback to legacy calculation based on CUIT/CUIL length
                    if (cuitStr.length >= 10 && !condicionStr.includes("consumidor")) {
                        docTipo = 80; // CUIT
                        docNro = parseInt(cuitStr);
                    } else if (cuitStr.length >= 7 && cuitStr.length <= 8) {
                        docTipo = 96; // DNI
                        docNro = parseInt(cuitStr);
                    }
                } else {
                    // If docTipo is explicitly provided, make sure docNro is parsed from CUIT if missing
                    if (invoice.DocNro === undefined && cuitStr) {
                        docNro = parseInt(cuitStr);
                    }
                }

                // AFIP RG 5616: Map Condicion IVA to CondicionIVAReceptorId
                let condicionId = 5; // Default: Consumidor Final
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
                    condicionId = 1; // Fallback if they gave a CUIT but no text condition
                }

                /* 
                 * Standard Invoice Type 11 (Factura C) 
                 */
                const cbteTipo = invoice.CbteTipo !== undefined ? Number(invoice.CbteTipo) : 11;
                const ptoVta = invoice.PtoVta !== undefined ? Number(invoice.PtoVta) : 1;
                const concepto = invoice.ConceptoId !== undefined ? Number(invoice.ConceptoId) : (isNaN(Number(invoice.Concepto)) ? 2 : Number(invoice.Concepto));

                const impNeto = invoice.ImpNeto !== undefined ? Number(invoice.ImpNeto) : amount;
                const impIVA = invoice.ImpIVA !== undefined ? Number(invoice.ImpIVA) : 0;
                const impTotConc = invoice.ImpTotConc !== undefined ? Number(invoice.ImpTotConc) : 0;
                const impOpEx = invoice.ImpOpEx !== undefined ? Number(invoice.ImpOpEx) : 0;
                const impTrib = invoice.ImpTrib !== undefined ? Number(invoice.ImpTrib) : 0;

                const data = {
                    CantReg: 1,
                    PtoVta: ptoVta,
                    CbteTipo: cbteTipo,
                    Concepto: concepto,
                    DocTipo: docTipo,
                    DocNro: docNro,
                    CbteDesde: 1,
                    CbteHasta: 1,
                    CbteFch: invoice.CbteFch ? parseInt(String(invoice.CbteFch).replace(/-/g, '')) : parseInt(date.replace(/-/g, '')),
                    ImpTotal: amount,
                    ImpTotConc: impTotConc,
                    ImpNeto: impNeto,
                    ImpOpEx: impOpEx,
                    ImpIVA: impIVA,
                    ImpTrib: impTrib,
                    MonId: 'PES',
                    MonCotiz: 1,
                    CondicionIVAReceptorId: condicionId
                };

                // Add service ranges if Concepto is 2 (Servicios) or 3
                if (concepto === 2 || concepto === 3) {
                    if (invoice.FchServDesde) data.FchServDesde = parseInt(String(invoice.FchServDesde).replace(/-/g, ''));
                    if (invoice.FchServHasta) data.FchServHasta = parseInt(String(invoice.FchServHasta).replace(/-/g, ''));
                    if (invoice.FchVtoPago) data.FchVtoPago = parseInt(String(invoice.FchVtoPago).replace(/-/g, ''));
                }

                // Add associated vouchers for Credit/Debit Notes
                if (invoice.CbtesAsoc) {
                    data.CbtesAsoc = invoice.CbtesAsoc;
                }

                // Add VAT rates if provided
                if (invoice.Iva) {
                    data.Iva = invoice.Iva;
                }

                // Add optional fields (e.g. for FCE CBU/payment options)
                if (invoice.Opcionales) {
                    data.Opcionales = invoice.Opcionales;
                    // For FCEs, FchVtoPago is required even if concept is not Services
                    if (invoice.FchVtoPago && !data.FchVtoPago) {
                        data.FchVtoPago = parseInt(String(invoice.FchVtoPago).replace(/-/g, ''));
                    }
                }

                // REAL IMPLEMENTATION
                // 1. Get last voucher number dynamically for this point of sale and type
                const lastVoucher = await afip.electronicBillingService.getLastVoucher(data.PtoVta, data.CbteTipo);

                // 2. Assign the next voucher number
                data.CbteDesde = lastVoucher.CbteNro + 1;
                data.CbteHasta = lastVoucher.CbteNro + 1;

                // 3. Create the voucher
                const invoiceResponse = await afip.electronicBillingService.createInvoice(data);

                // If AFIP doesn't return a CAE, it silently rejected our invoice due to business rules
                if (!invoiceResponse.cae) {
                    const obsData = invoiceResponse.response?.FeDetResp?.FECAEDetResponse?.[0]?.Observaciones?.Obs;
                    const errData = invoiceResponse.response?.Errors?.Err;
                    
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
                        
                    throw new Error(errorMsg);
                }

                results.push({
                    ...invoice,
                    PtoVta: data.PtoVta,
                    CbteDesde: data.CbteDesde,
                    status: 'aprobado',
                    cae: invoiceResponse.cae,
                    caeVto: invoiceResponse.caeFchVto || invoiceResponse.caeVto,
                    afip_response: invoiceResponse
                });

            } catch (err) {
                // Determine which object to log in case `invoice` didn't get populated correctly before failing
                const failedInvoiceContext = Object.keys(invoice).length > 0 ? invoice : rawInvoice;
                console.error("AFIP Error processing invoice:", failedInvoiceContext, err.message);

                results.push({
                    ...failedInvoiceContext,
                    status: 'rechazado',
                    error: err.message
                });
            }
        } // End of invoice processing loop (for...of)

        // Save the successful invoices to persistent storage
        if (results.some(r => r.status === 'aprobado')) {
            const invoicesDir = path.join(process.cwd(), 'data', 'invoices');

            try {
                // Ensure directory exists
                await fs.promises.mkdir(invoicesDir, { recursive: true });

                const historyFile = path.join(invoicesDir, `${userId}_history.json`);
                let history = [];

                try {
                    // Try to read existing history
                    const fileData = await fs.promises.readFile(historyFile, 'utf8');
                    history = JSON.parse(fileData);
                } catch (readErr) {
                    // File doesn't exist yet, we start fresh
                    if (readErr.code !== 'ENOENT') {
                        console.error('Error reading invoice history file:', readErr);
                    }
                }

                // Add the new approved invoices to history
                const newlyApproved = results.filter(r => r.status === 'aprobado').map(r => {
                    const now = new Date();
                    const expiration = new Date(now);
                    expiration.setDate(now.getDate() + 30);

                    return {
                        ...r,
                        created_at: now.toISOString(),
                        expirationDate: expiration.toISOString().split('T')[0], // format: YYYY-MM-DD
                        isPaid: false
                    };
                });

                // Prepend newest on top
                history = [...newlyApproved, ...history];

                // Save updated history
                await fs.promises.writeFile(historyFile, JSON.stringify(history, null, 2), 'utf8');

            } catch (writeErr) {
                console.error('CRITICAL: Failed to write persistent invoice history:', writeErr);
                // We don't throw here to not break the user's flow if only saving fails
            }
        }

        return NextResponse.json({ results });

    } catch (error) {
        console.error("Global Error processing afip invoice:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
