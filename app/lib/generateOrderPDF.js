import jsPDF from "jspdf";

export function generateOrderPDF(order) {
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;

    // Header Background Accent
    doc.setFillColor(14, 116, 144); // Cyan 700
    doc.rect(0, 0, pageWidth, 22, "F");

    // Header Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text("ORDEN MÉDICA DE ESTUDIOS Y LABORATORIO - VITACORE", margin, 14);

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.text("Solicitud Sanitaria Oficial con Validez Ley 27.553", pageWidth - margin, 14, { align: "right" });

    // Professional Letterhead
    let currentY = 32;
    doc.setTextColor(15, 23, 42); // Slate 900
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(order.professionalName || "Dr. Profesional de la Salud", margin, currentY);

    currentY += 5;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(`${order.professionalSpecialty || 'Especialista'} | M.N./M.P. N° ${order.professionalMatricula || 'S/D'}`, margin, currentY);

    if (order.professionalCuit) {
        currentY += 4.5;
        doc.text(`CUIT/DNI: ${order.professionalCuit}`, margin, currentY);
    }

    // Divider Line
    currentY += 6;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(margin, currentY, pageWidth - margin, currentY);

    // Patient & Insurance Box
    currentY += 8;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, currentY, pageWidth - (margin * 2), 30, 3, 3, "F");
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, currentY, pageWidth - (margin * 2), 30, 3, 3, "D");

    let boxY = currentY + 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("DATOS DEL PACIENTE:", margin + 5, boxY);

    doc.setFont("helvetica", "normal");
    doc.text(`Nombre y Apellido: ${order.patientName || 'S/D'}`, margin + 5, boxY + 6);
    doc.text(`DNI / Documento: ${order.patientDni || 'S/D'}`, margin + 5, boxY + 12);

    const col2X = margin + 95;
    doc.text(`Cobertura / Obra Social: ${order.patientSocialSecurity || 'Particular'}`, col2X, boxY + 6);
    doc.text(`N° Afiliado: ${order.patientAffiliateNumber || 'N/A'}`, col2X, boxY + 12);
    doc.text(`Fecha de Solicitud: ${new Date(order.issuedAt).toLocaleDateString('es-AR')}`, col2X, boxY + 18);

    // Request Header
    currentY += 38;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(14, 116, 144);
    doc.text(`SOLICITUD DE PRACTICAS: ${order.category || 'Laboratorio / Diagnóstico por Imágenes'}`, margin, currentY);

    currentY += 7;
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);

    const studies = order.studies || [];
    studies.forEach((std, index) => {
        doc.setFont("helvetica", "bold");
        doc.text(`${index + 1}. ${std.name}`, margin + 5, currentY);

        if (std.loincCode) {
            doc.setFont("helvetica", "bold");
            doc.setTextColor(14, 116, 144);
            doc.text(` [LOINC: ${std.loincCode}]`, margin + 5 + doc.getTextWidth(`${index + 1}. ${std.name}`), currentY);
        }

        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);

        if (std.clinicalNotes) {
            doc.setFont("helvetica", "italic");
            doc.text(`   Detalle / Indicación: ${std.clinicalNotes}`, margin + 5, currentY + 5);
            currentY += 12;
        } else {
            currentY += 8;
        }
    });

    // Diagnóstico Presuntivo (CIE-11)
    if (order.presumptiveDiagnosis) {
        currentY += 4;
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text("Diagnóstico Presuntivo (CIE-11 OMS):", margin, currentY);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        doc.text(order.presumptiveDiagnosis, margin + 65, currentY);
        currentY += 8;
    }

    if (order.clinicalSummary) {
        currentY += 2;
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text("Resumen Clínico / Justificación Sanitaria:", margin, currentY);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        doc.text(order.clinicalSummary, margin, currentY + 5);
        currentY += 12;
    }

    // Signature Area at bottom right
    const signatureY = 220;

    if (order.useDigitalSignature && order.signatureUrl) {
        try {
            doc.addImage(order.signatureUrl, "PNG", pageWidth - margin - 60, signatureY - 20, 55, 25);
        } catch (e) {
            console.error("Error adding signature image to PDF:", e);
        }
        doc.setDrawColor(71, 85, 105);
        doc.setLineWidth(0.3);
        doc.line(pageWidth - margin - 65, signatureY + 6, pageWidth - margin, signatureY + 6);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(order.professionalName || "Firma Digitalizada", pageWidth - margin - 32.5, signatureY + 10, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.text(`M.P. / M.N. N° ${order.professionalMatricula || 'S/D'}`, pageWidth - margin - 32.5, signatureY + 14, { align: "center" });
    } else {
        // Manual Signature Box
        doc.setDrawColor(148, 163, 184);
        doc.setLineWidth(0.4);
        doc.line(pageWidth - margin - 65, signatureY + 6, pageWidth - margin, signatureY + 6);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text("Firma y Sello del Profesional (Manual)", pageWidth - margin - 32.5, signatureY + 10, { align: "center" });
        doc.text(`M.N./M.P. N° ${order.professionalMatricula || 'S/D'}`, pageWidth - margin - 32.5, signatureY + 14, { align: "center" });
    }

    // Validation & QR Section at bottom left
    const qrY = 230;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://neoconta.com.ar';
    const validationUrl = `${origin}/validar-receta/${order.id}`;
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(validationUrl)}`;

    try {
        doc.addImage(qrApiUrl, "PNG", margin, qrY - 12, 28, 28);
    } catch (e) {
        // Ignore QR image load errors if offline
    }

    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(14, 116, 144);
    doc.text("VERIFICACIÓN DE AUTENTICIDAD DE ORDEN MÉDICA", margin + 32, qrY - 6);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`Escanee el código QR para validar la firma y emisión en centro médico/laboratorio:`, margin + 32, qrY - 2);
    doc.setTextColor(14, 116, 144);
    doc.text(validationUrl, margin + 32, qrY + 2);

    doc.setFont("courier", "normal");
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text(`HASH SHA-256: ${order.hash || 'N/A'}`, margin + 32, qrY + 7);
    doc.text(`ID ORDEN: ${order.id} | VENCIMIENTO: ${new Date(order.expiresAt).toLocaleDateString('es-AR')}`, margin + 32, qrY + 11);

    // Save/Download PDF
    doc.save(`Orden_Estudio_${order.patientName.replace(/\s+/g, '_')}_${order.id}.pdf`);
}
