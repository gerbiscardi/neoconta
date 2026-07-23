import jsPDF from "jspdf";

export function generatePrescriptionPDF(rx) {
    const doc = new jsPDF();

    // Color Palette
    const primaryColor = [15, 118, 110]; // Teal 700
    const textColor = [15, 23, 42];     // Slate 900
    const lightBg = [248, 250, 252];    // Slate 50

    // Header Background Accent Bar
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 8, 'F');

    // Header Header Brand
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...primaryColor);
    doc.text("VITACORE", 14, 20);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("SISTEMA DE HISTORIA CLÍNICA DIGITAL Y PRESCRIPCIÓN MÉDICA", 14, 25);
    doc.text("Ley N° 27.553 de Receta Electrónica y Salud Digital", 14, 29);

    // Right Header - Prescription ID & Date
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...textColor);
    doc.text(`RECETA N°: ${rx.id}`, 196, 20, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Fecha Emisión: ${new Date(rx.createdAt).toLocaleDateString('es-AR')}`, 196, 25, { align: "right" });
    doc.text(`Vencimiento: ${new Date(rx.expirationDate).toLocaleDateString('es-AR')}`, 196, 29, { align: "right" });

    // Divider Line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(14, 33, 196, 33);

    // Doctor Details Section (Membrete del Médico)
    doc.setFillColor(...lightBg);
    doc.roundedRect(14, 37, 182, 26, 3, 3, 'F');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...primaryColor);
    doc.text(rx.professionalName || "Dr. Profesional Tratante", 18, 44);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...textColor);
    doc.text(`Especialidad: ${rx.professionalSpecialty || 'Medicina General'}`, 18, 50);
    doc.text(`Matrícula Profesional: M.N. / M.P. ${rx.professionalMatricula || 'Registrada'}`, 18, 56);

    if (rx.professionalCuit) {
        doc.text(`CUIT: ${rx.professionalCuit}`, 140, 50);
    }

    // Patient Details Box
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...primaryColor);
    doc.text("DATOS DEL PACIENTE", 14, 70);

    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, 73, 182, 24, 2, 2, 'S');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...textColor);
    doc.text(`Paciente: `, 18, 80);
    doc.setFont("helvetica", "normal");
    doc.text(rx.patientName || '', 35, 80);

    doc.setFont("helvetica", "bold");
    doc.text(`DNI / LE / LC: `, 120, 80);
    doc.setFont("helvetica", "normal");
    doc.text(rx.patientDni || 'N/A', 145, 80);

    doc.setFont("helvetica", "bold");
    doc.text(`Cobertura: `, 18, 89);
    doc.setFont("helvetica", "normal");
    doc.text(rx.patientObraSocial || 'Particular', 35, 89);

    doc.setFont("helvetica", "bold");
    doc.text(`N° Afiliado: `, 120, 89);
    doc.setFont("helvetica", "normal");
    doc.text(rx.patientNumeroAfiliado || 'N/A', 140, 89);

    // Diagnosis Section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...primaryColor);
    doc.text("DIAGNÓSTICO (CIE-11 OMS)", 14, 105);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...textColor);
    doc.text(rx.diagnosis || 'Consulta Médica General', 14, 111);

    // Prescription Rp/ Section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...primaryColor);
    doc.text("Rp/", 14, 123);

    // Medications Table Header
    doc.setFillColor(241, 245, 249);
    doc.rect(14, 127, 182, 7, 'F');
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text("MEDICAMENTO / PRINCIPIO ACTIVO", 18, 132);
    doc.text("DOSIS / FRECUENCIA", 100, 132);
    doc.text("DURACIÓN", 150, 132);
    doc.text("CANT.", 182, 132);

    let currentY = 139;
    (rx.items || []).forEach((item, index) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...textColor);
        doc.text(`${index + 1}. ${item.drugName}`, 18, currentY);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text(item.dosage || 'Según indicación médica', 100, currentY);
        doc.text(item.duration || 'N/A', 150, currentY);
        doc.text(String(item.totalQuantity || '1'), 184, currentY);

        if (item.frequency) {
            currentY += 4.5;
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(`Frecuencia: ${item.frequency}`, 22, currentY);
        }

        currentY += 7;
        doc.setDrawColor(241, 245, 249);
        doc.line(14, currentY - 2, 196, currentY - 2);
    });

    // Observations
    if (rx.observations) {
        currentY += 4;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...primaryColor);
        doc.text("INDICACIONES GENERALES / HIGIÉNICO-DIETÉTICAS:", 14, currentY);
        currentY += 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...textColor);
        const splitObs = doc.splitTextToSize(rx.observations, 180);
        doc.text(splitObs, 14, currentY);
        currentY += (splitObs.length * 4) + 4;
    }

    // Signature and Stamp Box Section
    const footerY = 225;

    // Left Footer: QR Code & Cryptographic Verification
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`https://neoconta.com.ar/validar-receta/${rx.id}`)}`;
    
    try {
        doc.addImage(qrUrl, 'PNG', 14, footerY - 5, 28, 28);
    } catch (e) {
        doc.rect(14, footerY - 5, 28, 28);
        doc.setFontSize(6);
        doc.text("QR VERIF", 16, footerY + 10);
    }

    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...primaryColor);
    doc.text("VERIFICACIÓN LEGAL DIGITAL (Ley 27.553)", 46, footerY);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("Escanee el código QR para validar la autenticidad e inalterabilidad de esta receta.", 46, footerY + 4);
    doc.text(`Hash SHA-256: ${rx.verificationHash ? rx.verificationHash.substring(0, 32) + '...' : 'OK'}`, 46, footerY + 8);
    doc.text(`Estado: ${rx.status ? rx.status.toUpperCase() : 'VIGENTE'} — Emitida vía NeoConta Vitacore`, 46, footerY + 12);

    // Right Footer: Signature & Stamp
    if (rx.useDigitalSignature && rx.signatureBase64) {
        try {
            doc.addImage(rx.signatureBase64, 'PNG', 140, footerY - 12, 48, 22);
        } catch (e) {
            console.error("Error adding signature image to PDF:", e);
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(...textColor);
        doc.text(rx.professionalName, 164, footerY + 12, { align: "center" });
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.text(`M.N. / M.P. N° ${rx.professionalMatricula || 'Registrada'}`, 164, footerY + 16, { align: "center" });
        doc.text(rx.professionalSpecialty || '', 164, footerY + 19, { align: "center" });
        doc.setFontSize(6.5);
        doc.setTextColor(16, 185, 129);
        doc.text("✔ Firmado Digitalmente", 164, footerY + 23, { align: "center" });
    } else {
        // Manual Holographic Signature Box
        doc.setDrawColor(148, 163, 184);
        doc.setLineDashPattern([1.5, 1.5], 0);
        doc.line(130, footerY + 10, 196, footerY + 10);
        doc.setLineDashPattern([], 0); // reset

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...textColor);
        doc.text("FIRMA Y SELLO HOLOGRÁFICO", 163, footerY + 14, { align: "center" });
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.text(rx.professionalName, 163, footerY + 18, { align: "center" });
        doc.text(`Matrícula N°: ${rx.professionalMatricula || '_______________'}`, 163, footerY + 22, { align: "center" });
    }

    // Save PDF
    const cleanPatientName = (rx.patientName || 'paciente').replace(/\s+/g, '_');
    doc.save(`Receta_${cleanPatientName}_${rx.id}.pdf`);
}
