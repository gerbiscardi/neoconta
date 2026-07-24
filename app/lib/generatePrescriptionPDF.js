import jsPDF from "jspdf";

export function generatePrescriptionPDF(prescription) {
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;

    // Header Background Accent
    doc.setFillColor(15, 118, 110); // Teal 700
    doc.rect(0, 0, pageWidth, 22, "F");

    // Header Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text("RECETA MÉDICA DIGITAL - VITACORE", margin, 14);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Ley N° 27.553 de Receta Electrónica y Telemedicina", pageWidth - margin, 14, { align: "right" });

    // Professional Letterhead (Encabezado del Profesional)
    let currentY = 32;
    doc.setTextColor(15, 23, 42); // Slate 900
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(prescription.professionalName || "Dr. Profesional de la Salud", margin, currentY);

    currentY += 5;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(`${prescription.professionalSpecialty || 'Especialista'} | M.N./M.P. N° ${prescription.professionalMatricula || 'S/D'}`, margin, currentY);

    if (prescription.professionalCuit) {
        currentY += 4.5;
        doc.text(`CUIT/DNI: ${prescription.professionalCuit}`, margin, currentY);
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
    doc.text(`Nombre y Apellido: ${prescription.patientName || 'S/D'}`, margin + 5, boxY + 6);
    doc.text(`DNI / Documento: ${prescription.patientDni || 'S/D'}`, margin + 5, boxY + 12);

    const col2X = margin + 95;
    doc.text(`Cobertura / Obra Social: ${prescription.patientSocialSecurity || 'Particular'}`, col2X, boxY + 6);
    doc.text(`N° Afiliado: ${prescription.patientAffiliateNumber || 'N/A'}`, col2X, boxY + 12);
    doc.text(`Fecha de Emisión: ${new Date(prescription.issuedAt).toLocaleDateString('es-AR')}`, col2X, boxY + 18);

    // Rp/ Section (Prescription Details)
    currentY += 38;
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 118, 110);
    doc.text("Rp /", margin, currentY);

    currentY += 6;
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);

    const medications = prescription.medications || [];
    medications.forEach((med, index) => {
        doc.setFont("helvetica", "bold");
        doc.text(`${index + 1}. ${med.name}`, margin + 5, currentY);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(51, 65, 85);
        
        let detailsText = `   Dosis / Posología: ${med.dosage || 'Según indicación médica'}`;
        if (med.quantity) detailsText += ` | Cantidad: ${med.quantity}`;
        doc.text(detailsText, margin + 5, currentY + 5);

        if (med.instructions) {
            doc.setFont("helvetica", "italic");
            doc.setTextColor(100, 116, 139);
            doc.text(`   Indicaciones: ${med.instructions}`, margin + 5, currentY + 10);
            currentY += 16;
        } else {
            currentY += 12;
        }
    });

    // Diagnosis (CIE-11) if present
    if (prescription.diagnosis) {
        currentY += 4;
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text("Diagnóstico (CIE-11 OMS):", margin, currentY);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        doc.text(prescription.diagnosis, margin + 48, currentY);
        currentY += 8;
    }

    if (prescription.observations) {
        currentY += 2;
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text("Observaciones Sanitarias:", margin, currentY);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        doc.text(prescription.observations, margin, currentY + 5);
        currentY += 12;
    }

    // Signature Area at bottom right
    const signatureY = 220;

    if (prescription.useDigitalSignature && prescription.signatureUrl) {
        try {
            doc.addImage(prescription.signatureUrl, "PNG", pageWidth - margin - 60, signatureY - 20, 55, 25);
        } catch (e) {
            console.error("Error adding signature image to PDF:", e);
        }
        doc.setDrawColor(71, 85, 105);
        doc.setLineWidth(0.3);
        doc.line(pageWidth - margin - 65, signatureY + 6, pageWidth - margin, signatureY + 6);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(prescription.professionalName || "Firma Digitalizada", pageWidth - margin - 32.5, signatureY + 10, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.text(`M.P. / M.N. N° ${prescription.professionalMatricula || 'S/D'}`, pageWidth - margin - 32.5, signatureY + 14, { align: "center" });
    } else {
        // Manual Signature Box
        doc.setDrawColor(148, 163, 184);
        doc.setLineWidth(0.4);
        doc.line(pageWidth - margin - 65, signatureY + 6, pageWidth - margin, signatureY + 6);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text("Firma y Sello del Profesional (Manual)", pageWidth - margin - 32.5, signatureY + 10, { align: "center" });
        doc.text(`M.N./M.P. N° ${prescription.professionalMatricula || 'S/D'}`, pageWidth - margin - 32.5, signatureY + 14, { align: "center" });
    }

    // Validation & QR Section at bottom left
    const qrY = 230;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://neoconta.com.ar';
    const validationUrl = `${origin}/validar-receta/${prescription.id}`;
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(validationUrl)}`;

    try {
        doc.addImage(qrApiUrl, "PNG", margin, qrY - 12, 28, 28);
    } catch (e) {
        // Ignore QR image load errors if offline
    }

    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 118, 110);
    doc.text("VERIFICACIÓN DE AUTENTICIDAD DE RECETA", margin + 32, qrY - 6);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`Escanee el código QR para validar la firma y emisión en farmacia o ingrese a:`, margin + 32, qrY - 2);
    doc.setTextColor(15, 118, 110);
    doc.text(validationUrl, margin + 32, qrY + 2);

    doc.setFont("courier", "normal");
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text(`HASH SHA-256: ${prescription.hash || 'N/A'}`, margin + 32, qrY + 7);
    doc.text(`ID RECETA: ${prescription.id} | VENCIMIENTO: ${new Date(prescription.expiresAt).toLocaleDateString('es-AR')}`, margin + 32, qrY + 11);

    // Save/Download PDF
    doc.save(`Receta_${prescription.patientName.replace(/\s+/g, '_')}_${prescription.id}.pdf`);
}
