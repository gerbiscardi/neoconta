import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import prisma from '@/lib/db';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import nodemailer from 'nodemailer';

// Helper: Normalize date to YYYY-MM-DD
function normalizeDateStr(d) {
    if (!d) return null;
    const str = String(d).trim();
    if (str.includes('T')) {
        return str.split('T')[0];
    }
    if (str.includes('-')) {
        const parts = str.split('-');
        if (parts[0].length === 4) return str; // YYYY-MM-DD
        if (parts[2]?.length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`; // DD-MM-YYYY
    }
    if (str.includes('/')) {
        const parts = str.split('/');
        if (parts[2]?.length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`; // DD/MM/YYYY
        if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`; // YYYY/MM/DD
    }
    if (str.length === 8 && !isNaN(Number(str))) {
        return `${str.substring(0, 4)}-${str.substring(4, 6)}-${str.substring(6, 8)}`;
    }
    const parsed = new Date(d);
    if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
    }
    return null;
}

// Helper: Voucher type name
const VOUCHER_NAMES = {
    1: "Factura A",
    2: "ND A",
    3: "NC A",
    6: "Factura B",
    7: "ND B",
    8: "NC B",
    11: "Factura C",
    12: "ND C",
    13: "NC C",
    201: "FCE A",
    202: "ND PyME A",
    203: "NC PyME A",
    206: "FCE B",
    207: "ND PyME B",
    208: "NC PyME B",
    211: "FCE C",
    212: "ND PyME C",
    213: "NC PyME C"
};

function getVoucherName(type) {
    return VOUCHER_NAMES[Number(type)] || `Cbte ${type}`;
}

// Fetch invoices from history.json or DB
async function getInvoicesForUser(userId, fechaDesde, fechaHasta) {
    const invoicesDir = path.join(process.cwd(), 'data', 'invoices');
    const historyFile = path.join(invoicesDir, `${userId}_history.json`);
    let invoices = [];

    if (existsSync(historyFile)) {
        try {
            const data = await fs.readFile(historyFile, 'utf8');
            invoices = JSON.parse(data);
        } catch (e) {
            console.error('Error reading invoice history file:', e);
        }
    }

    if (!invoices || invoices.length === 0) {
        try {
            const dbInvoices = await prisma.invoice.findMany({
                where: { userId }
            });
            invoices = dbInvoices.map(inv => ({
                cbteTipo: inv.cbteTipo,
                cbteDesde: inv.cbteDesde,
                cbteHasta: inv.cbteHasta,
                ptoVta: 1,
                impTotal: inv.impTotal,
                Total: inv.impTotal,
                docNro: inv.docNro,
                cae: inv.cae,
                caeVto: inv.caeVto,
                created_at: inv.createdAt ? inv.createdAt.toISOString() : null,
                status: 'aprobado'
            }));
        } catch (e) {
            console.error('Error fetching invoices from db:', e);
        }
    }

    // Filter by date range
    return invoices.filter(inv => {
        const rawDate = inv.created_at || inv.cbteFch || inv.CbteFch || inv.fecha;
        const norm = normalizeDateStr(rawDate);
        if (!norm) return true; // keep if no date
        if (fechaDesde && norm < fechaDesde) return false;
        if (fechaHasta && norm > fechaHasta) return false;
        return true;
    }).map(inv => ({
        fecha: normalizeDateStr(inv.created_at || inv.cbteFch || inv.CbteFch || inv.fecha) || 'S/D',
        tipo: getVoucherName(inv.cbteTipo || inv.CbteTipo || 11),
        ptoVta: inv.ptoVta || inv.PtoVta || 1,
        numero: inv.cbteDesde || inv.CbteDesde || inv.id || 1,
        receptorDoc: inv.docNro || inv.DocNro || inv.cuit || inv.CUIT || inv.Cuit || 'Consumidor Final',
        receptorNombre: inv.cliente || inv.RazonSocial || inv.nombre || 'Consumidor Final',
        condicionIva: inv.condicionIva || 'Consumidor Final',
        total: Number(inv.impTotal || inv.Total || inv.Importe || inv.total || 0),
        cae: inv.cae || inv.CAE || 'N/A',
        caeVto: inv.caeVto || inv.CaeVto || 'N/A',
        status: inv.status || 'aprobado'
    }));
}

// Fetch bank transactions from _transactions.json or DB
async function getBankTransactionsForUser(userId, fechaDesde, fechaHasta) {
    const txFilePath = path.join(process.cwd(), 'data', 'users', userId, 'banco', '_transactions.json');
    let transactions = [];

    if (existsSync(txFilePath)) {
        try {
            const data = await fs.readFile(txFilePath, 'utf8');
            transactions = JSON.parse(data);
        } catch (e) {
            console.error('Error reading bank transactions file:', e);
        }
    }

    if (!transactions || transactions.length === 0) {
        try {
            const dbTx = await prisma.bankTransaction.findMany({
                where: { userId }
            });
            transactions = dbTx.map(tx => ({
                id: tx.id,
                date: tx.date,
                description: tx.description,
                amount: tx.amount,
                category: tx.category,
                source: tx.source
            }));
        } catch (e) {
            console.error('Error fetching bank transactions from db:', e);
        }
    }

    // Filter by date range
    return transactions.filter(tx => {
        const rawDate = tx.transaction_date || tx.date || tx.fecha;
        const norm = normalizeDateStr(rawDate);
        if (!norm) return true;
        if (fechaDesde && norm < fechaDesde) return false;
        if (fechaHasta && norm > fechaHasta) return false;
        return true;
    }).map(tx => {
        const amount = Number(tx.amount || 0);
        return {
            fecha: normalizeDateStr(tx.transaction_date || tx.date || tx.fecha) || 'S/D',
            descripcion: tx.description || tx.detalle || tx.concepto || 'Movimiento bancario',
            categoria: tx.category || 'General',
            tipo: amount >= 0 ? 'Ingreso' : 'Egreso',
            monto: Math.abs(amount),
            montoConSigno: amount,
            cuenta: tx.source || tx.cuenta || 'Principal'
        };
    });
}

// Fetch user profile info
async function getUserProfile(userId) {
    let profile = {
        razonSocial: "Empresa",
        cuit: "",
        condicionIva: "Responsable Monotributo",
        email: "",
        nombre: ""
    };

    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user) {
            profile.email = user.email || "";
            profile.nombre = user.nombre || "";
        }
    } catch (e) {}

    const cfgPath = path.join(process.cwd(), 'data', 'users', userId, 'config.json');
    if (existsSync(cfgPath)) {
        try {
            const raw = await fs.readFile(cfgPath, 'utf8');
            const data = JSON.parse(raw);
            profile.razonSocial = data.razonSocial || profile.nombre || profile.razonSocial;
            profile.cuit = data.cuit || "";
            profile.condicionIva = data.condicionIva || profile.condicionIva;
            profile.logo = data.logo || "";
        } catch (e) {}
    }

    return profile;
}

// Generate Excel Workbook
function generateExcelBuffer(profile, fechaDesde, fechaHasta, invoices, bankTx, includeInvoices, includeBank) {
    const wb = XLSX.utils.book_new();

    // 1. Resumen Sheet
    const totalFacturado = invoices.reduce((sum, inv) => sum + (inv.status === 'aprobado' ? inv.total : 0), 0);
    const totalIngresosBanco = bankTx.filter(t => t.montoConSigno > 0).reduce((sum, t) => sum + t.monto, 0);
    const totalEgresosBanco = bankTx.filter(t => t.montoConSigno < 0).reduce((sum, t) => sum + t.monto, 0);

    const resumenData = [
        ["NEOCONTA - INFORME CONTABLE Y FINANCIERO"],
        ["Fecha de Generación:", new Date().toLocaleDateString('es-AR') + " " + new Date().toLocaleTimeString('es-AR')],
        [],
        ["DATOS DE LA EMPRESA / CLIENTE"],
        ["Razón Social:", profile.razonSocial],
        ["CUIT:", profile.cuit || "No informado"],
        ["Condición IVA:", profile.condicionIva || "No informada"],
        ["Período informado:", `Desde ${fechaDesde || 'Inicio'} hasta ${fechaHasta || 'Fin'}`],
        [],
        ["RESUMEN CONSOLIDADO DEL PERÍODO"],
        ["Concepto", "Cantidad de Registros", "Total Importe ($)"],
        ["Comprobantes Emitidos ARCA", invoices.length, totalFacturado],
        ["Ingresos Bancarios (+)", bankTx.filter(t => t.montoConSigno > 0).length, totalIngresosBanco],
        ["Egresos Bancarios (-)", bankTx.filter(t => t.montoConSigno < 0).length, totalEgresosBanco],
        ["Flujo Neto Bancario", bankTx.length, totalIngresosBanco - totalEgresosBanco]
    ];
    const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
    XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen Contable");

    // 2. Facturación Sheet
    if (includeInvoices) {
        const invRows = invoices.map(i => ({
            "Fecha": i.fecha,
            "Tipo": i.tipo,
            "Pto Venta": i.ptoVta,
            "Nro Comprobante": i.numero,
            "Doc / CUIT Receptor": i.receptorDoc,
            "Cliente / Razón Social": i.receptorNombre,
            "Condición IVA": i.condicionIva,
            "Importe Total ($)": i.total,
            "Estado": i.status,
            "CAE": i.cae,
            "Vencimiento CAE": i.caeVto
        }));
        const wsInv = XLSX.utils.json_to_sheet(invRows.length > 0 ? invRows : [{ "Mensaje": "Sin comprobantes en el período seleccionado" }]);
        XLSX.utils.book_append_sheet(wb, wsInv, "Facturacion_ARCA");
    }

    // 3. Banco Sheet
    if (includeBank) {
        const bankRows = bankTx.map(b => ({
            "Fecha": b.fecha,
            "Descripción / Concepto": b.descripcion,
            "Categoría": b.categoria,
            "Tipo": b.tipo,
            "Importe ($)": b.montoConSigno,
            "Cuenta / Origen": b.cuenta
        }));
        const wsBank = XLSX.utils.json_to_sheet(bankRows.length > 0 ? bankRows : [{ "Mensaje": "Sin movimientos bancarios en el período seleccionado" }]);
        XLSX.utils.book_append_sheet(wb, wsBank, "Banco_Movimientos");
    }

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// Generate CSV
function generateCsvBuffer(profile, fechaDesde, fechaHasta, invoices, bankTx, includeInvoices, includeBank) {
    let lines = [];
    lines.push(`NEOCONTA;INFORME CONTABLE;${profile.razonSocial};CUIT:${profile.cuit || ''};Periodo:${fechaDesde || ''} al ${fechaHasta || ''}`);
    lines.push('');

    if (includeInvoices) {
        lines.push('--- COMPROBANTES EMITIDOS ARCA ---');
        lines.push('Fecha;Tipo;Punto Venta;Numero;Doc Receptor;Cliente;Total;CAE;Estado');
        invoices.forEach(i => {
            lines.push(`${i.fecha};${i.tipo};${i.ptoVta};${i.numero};${i.receptorDoc};"${i.receptorNombre.replace(/"/g, '""')}";${i.total};${i.cae};${i.status}`);
        });
        lines.push('');
    }

    if (includeBank) {
        lines.push('--- MOVIMIENTOS BANCARIOS ---');
        lines.push('Fecha;Concepto;Categoria;Tipo;Importe;Cuenta');
        bankTx.forEach(b => {
            lines.push(`${b.fecha};"${b.descripcion.replace(/"/g, '""')}";${b.categoria};${b.tipo};${b.montoConSigno};${b.cuenta}`);
        });
    }

    return Buffer.from(lines.join('\r\n'), 'utf-8');
}

// Generate PDF Document
function generatePdfBuffer(profile, fechaDesde, fechaHasta, invoices, bankTx, includeInvoices, includeBank) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Brand Header banner
    doc.setFillColor(249, 115, 22); // Orange #f97316
    doc.rect(0, 0, 210, 24, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("NEOCONTA • INFORME CONTABLE Y FINANCIERO", 14, 15);

    // Subheader & Company info
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    
    let y = 32;
    doc.setFont("helvetica", "bold");
    doc.text("Empresa / Cliente:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(profile.razonSocial || "Empresa", 52, y);

    doc.setFont("helvetica", "bold");
    doc.text("CUIT:", 130, y);
    doc.setFont("helvetica", "normal");
    doc.text(profile.cuit || "S/D", 145, y);

    y += 6;
    doc.setFont("helvetica", "bold");
    doc.text("Período:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(`${fechaDesde || 'Inicio'} al ${fechaHasta || 'Actualidad'}`, 52, y);

    doc.setFont("helvetica", "bold");
    doc.text("Fecha Emisión:", 130, y);
    doc.setFont("helvetica", "normal");
    doc.text(new Date().toLocaleDateString('es-AR'), 160, y);

    y += 10;
    // KPI Cards
    const totalFacturado = invoices.reduce((sum, inv) => sum + (inv.status === 'aprobado' ? inv.total : 0), 0);
    const totalIngresosBanco = bankTx.filter(t => t.montoConSigno > 0).reduce((sum, t) => sum + t.monto, 0);
    const totalEgresosBanco = bankTx.filter(t => t.montoConSigno < 0).reduce((sum, t) => sum + t.monto, 0);

    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, y, 58, 20, 2, 2, 'FD');
    doc.roundedRect(76, y, 58, 20, 2, 2, 'FD');
    doc.roundedRect(138, y, 58, 20, 2, 2, 'FD');

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("TOTAL FACTURADO", 18, y + 6);
    doc.text("INGRESOS BANCARIOS", 80, y + 6);
    doc.text("EGRESOS BANCARIOS", 142, y + 6);

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(`$ ${totalFacturado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 18, y + 14);
    doc.setTextColor(16, 185, 129); // green
    doc.text(`$ ${totalIngresosBanco.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 80, y + 14);
    doc.setTextColor(239, 68, 68); // red
    doc.text(`$ ${totalEgresosBanco.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 142, y + 14);

    y += 28;

    // Table: Facturación
    if (includeInvoices) {
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text(`Comprobantes de Facturación Emitidos (${invoices.length})`, 14, y);

        const invoiceRows = invoices.map(i => [
            i.fecha,
            i.tipo,
            `${String(i.ptoVta).padStart(4, '0')}-${String(i.numero).padStart(8, '0')}`,
            i.receptorNombre.substring(0, 24),
            `$ ${i.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
            i.cae
        ]);

        autoTable(doc, {
            startY: y + 3,
            head: [['Fecha', 'Tipo', 'Número', 'Cliente / Receptor', 'Total ($)', 'CAE']],
            body: invoiceRows.length > 0 ? invoiceRows : [['-', 'Sin registros', '-', '-', '-', '-']],
            theme: 'grid',
            headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 8 },
            styles: { fontSize: 7, cellPadding: 2 },
            margin: { left: 14, right: 14 }
        });

        y = doc.lastAutoTable.finalY + 10;
    }

    // Table: Banco
    if (includeBank) {
        // If near end of page, add page
        if (y > 230) {
            doc.addPage();
            y = 20;
        }

        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text(`Movimientos Bancarios (${bankTx.length})`, 14, y);

        const bankRows = bankTx.map(b => [
            b.fecha,
            b.descripcion.substring(0, 32),
            b.categoria,
            b.tipo,
            `$ ${b.montoConSigno.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
        ]);

        autoTable(doc, {
            startY: y + 3,
            head: [['Fecha', 'Concepto', 'Categoría', 'Tipo', 'Importe ($)']],
            body: bankRows.length > 0 ? bankRows : [['-', 'Sin movimientos', '-', '-', '-']],
            theme: 'grid',
            headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontSize: 8 },
            styles: { fontSize: 7, cellPadding: 2 },
            margin: { left: 14, right: 14 }
        });
    }

    // Add page numbers in footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`Página ${i} de ${pageCount} • NeoConta Software Contable Inteligente`, 14, 290);
    }

    return Buffer.from(doc.output('arraybuffer'));
}

export async function POST(request) {
    try {
        const body = await request.json();
        const {
            userId,
            fechaDesde,
            fechaHasta,
            format = 'xlsx',
            recipientEmail,
            message = '',
            includeInvoices = true,
            includeBank = true,
            action = 'download'
        } = body;

        if (!userId) {
            return NextResponse.json({ error: "El parámetro userId es requerido" }, { status: 400 });
        }

        const profile = await getUserProfile(userId);
        const invoices = includeInvoices ? await getInvoicesForUser(userId, fechaDesde, fechaHasta) : [];
        const bankTx = includeBank ? await getBankTransactionsForUser(userId, fechaDesde, fechaHasta) : [];

        let fileBuffer;
        let mimeType;
        let extension;

        if (format === 'pdf') {
            fileBuffer = generatePdfBuffer(profile, fechaDesde, fechaHasta, invoices, bankTx, includeInvoices, includeBank);
            mimeType = 'application/pdf';
            extension = 'pdf';
        } else if (format === 'csv') {
            fileBuffer = generateCsvBuffer(profile, fechaDesde, fechaHasta, invoices, bankTx, includeInvoices, includeBank);
            mimeType = 'text/csv; charset=utf-8';
            extension = 'csv';
        } else {
            fileBuffer = generateExcelBuffer(profile, fechaDesde, fechaHasta, invoices, bankTx, includeInvoices, includeBank);
            mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            extension = 'xlsx';
        }

        const cleanRazon = (profile.razonSocial || 'Cliente').replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `NeoConta_Informe_${cleanRazon}_${fechaDesde || 'inicio'}_al_${fechaHasta || 'fin'}.${extension}`;

        if (action === 'send_email') {
            if (!recipientEmail || !recipientEmail.includes('@')) {
                return NextResponse.json({ error: "Debes ingresar un correo electrónico de destinatario válido." }, { status: 400 });
            }

            const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, CONTACT_EMAIL } = process.env;
            const hasSMTP = SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASSWORD;

            if (hasSMTP) {
                const transporter = nodemailer.createTransport({
                    host: SMTP_HOST,
                    port: parseInt(SMTP_PORT, 10),
                    secure: parseInt(SMTP_PORT, 10) === 465,
                    auth: { user: SMTP_USER, pass: SMTP_PASSWORD }
                });

                const logoPath = path.join(process.cwd(), 'public', 'assets', 'navbar_logo.png');
                const emailAttachments = [
                    {
                        filename,
                        content: fileBuffer,
                        contentType: mimeType
                    }
                ];

                if (existsSync(logoPath)) {
                    emailAttachments.push({
                        filename: 'neoconta_logo.png',
                        path: logoPath,
                        cid: 'neoconta_footer_logo'
                    });
                }

                let companyLogoSrc = profile.logo;
                if (profile.logo && profile.logo.startsWith('data:')) {
                    const matches = profile.logo.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                    if (matches && matches.length === 3) {
                        const mime = matches[1];
                        const base64Data = matches[2];
                        emailAttachments.push({
                            filename: 'company_logo',
                            content: Buffer.from(base64Data, 'base64'),
                            contentType: mime,
                            cid: 'company_logo'
                        });
                        companyLogoSrc = 'cid:company_logo';
                    }
                }

                const companyLogoHtml = companyLogoSrc ? `
                    <img src="${companyLogoSrc}" alt="${profile.razonSocial}" style="max-height: 48px; max-width: 180px; object-fit: contain; display: block;" />
                ` : `
                    <div style="font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: -0.3px;">
                        ${profile.razonSocial}
                    </div>
                `;

                const htmlContent = `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                    
                    <!-- Company Logo / Header Top Bar -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-bottom: 2px solid #f97316;">
                        <tr>
                            <td align="left" style="padding: 18px 24px;">
                                ${companyLogoHtml}
                            </td>
                            <td align="right" style="padding: 18px 24px; vertical-align: middle;">
                                <div style="font-size: 11px; font-weight: 700; color: #ea580c; text-transform: uppercase; letter-spacing: 0.5px; background-color: #fff7ed; padding: 4px 10px; border-radius: 20px; border: 1px solid #fed7aa; display: inline-block;">
                                    Remisión Contable
                                </div>
                            </td>
                        </tr>
                    </table>

                    <!-- Header Gradient Banner -->
                    <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 22px 24px; color: white;">
                        <h1 style="margin: 0; font-size: 19px; font-weight: 700; color: #ffffff;">Información Contable y Financiera</h1>
                        <p style="margin: 5px 0 0; font-size: 13px; color: #ffedd5; opacity: 0.95;">
                            Empresa: <strong>${profile.razonSocial}</strong> (CUIT: ${profile.cuit || 'S/D'}) • Período: <strong>${fechaDesde || 'Inicio'} al ${fechaHasta || 'Actualidad'}</strong>
                        </p>
                    </div>

                    <!-- Content Body -->
                    <div style="padding: 24px;">
                        <p style="font-size: 15px; margin-top: 0; color: #334155;">Estimado/a,</p>
                        <p style="font-size: 14px; line-height: 1.6; color: #334155;">
                            Adjuntamos la información contable y financiera consolidada de <strong>${profile.razonSocial}</strong> correspondiente al período <strong>${fechaDesde || 'Inicio'} al ${fechaHasta || 'Actualidad'}</strong> para su análisis y liquidación impositiva.
                        </p>
                        
                        ${message ? `
                        <div style="background-color: #f8fafc; border-left: 4px solid #f97316; padding: 14px 18px; margin: 20px 0; font-style: italic; font-size: 14px; color: #475569; border-radius: 0 8px 8px 0;">
                            "${message}"
                        </div>` : ''}

                        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; margin: 22px 0;">
                            <h4 style="margin: 0 0 10px; font-size: 12px; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">Resumen de Archivos Adjuntos:</h4>
                            <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #334155; line-height: 1.8;">
                                ${includeInvoices ? `<li><strong>${invoices.length}</strong> Comprobantes de facturación emitidos (ARCA)</li>` : ''}
                                ${includeBank ? `<li><strong>${bankTx.length}</strong> Movimientos bancarios registrados</li>` : ''}
                                <li>Formato del archivo: <strong>.${extension.toUpperCase()}</strong></li>
                            </ul>
                        </div>
                        
                        <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">
                            El informe <strong>${filename}</strong> se encuentra adjunto a este mensaje.
                        </p>
                    </div>

                    <!-- Footer with small NeoConta logo -->
                    <div style="background-color: #f8fafc; padding: 20px 24px; border-top: 1px solid #e2e8f0; text-align: center;">
                        <div style="margin-bottom: 8px;">
                            <img src="cid:neoconta_footer_logo" alt="NeoConta" style="height: 20px; width: auto; display: inline-block; vertical-align: middle; opacity: 0.9;" />
                        </div>
                        <p style="margin: 0; font-size: 11px; color: #64748b;">
                            Enviado de forma segura y automatizada a través de la plataforma <strong>NeoConta</strong>.
                        </p>
                    </div>
                </div>
                `;

                await transporter.sendMail({
                    from: `"NeoConta" <${CONTACT_EMAIL || SMTP_USER}>`,
                    to: recipientEmail,
                    subject: `[NeoConta] Información Contable (${fechaDesde} a ${fechaHasta}) - ${profile.razonSocial}`,
                    html: htmlContent,
                    attachments: emailAttachments
                });

                return NextResponse.json({
                    success: true,
                    message: `Información contable remitida con éxito a ${recipientEmail}.`,
                    filename
                });
            } else {
                // If SMTP is not yet configured, log and return simulated success
                console.log(`[NeoConta Remit] SMTP not configured. Simulated sending to ${recipientEmail} with attachment ${filename}.`);
                return NextResponse.json({
                    success: true,
                    message: `Información contable procesada con éxito para ${recipientEmail}. (Nota: Se generó el adjunto ${filename} en formato .${extension.toUpperCase()}).`,
                    filename,
                    smtpSimulated: true
                });
            }
        }

        // Direct Download
        const base64Data = fileBuffer.toString('base64');
        return NextResponse.json({
            success: true,
            filename,
            mimeType,
            base64Data,
            counts: {
                invoices: invoices.length,
                bank: bankTx.length
            }
        });

    } catch (error) {
        console.error("Error in /api/accounting/remit:", error);
        return NextResponse.json({ error: error.message || "Error al procesar la remisión contable." }, { status: 500 });
    }
}
