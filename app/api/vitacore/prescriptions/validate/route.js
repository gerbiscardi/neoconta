import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const prescriptionId = searchParams.get('id');

        if (!prescriptionId) {
            return NextResponse.json({ error: 'ID de receta es requerido' }, { status: 400 });
        }

        const usersDir = path.join(process.cwd(), 'data', 'users');
        let foundPrescription = null;

        try {
            const userFolders = await fs.readdir(usersDir);
            for (const folder of userFolders) {
                const filePath = path.join(usersDir, folder, 'vitacore', 'prescriptions.json');
                try {
                    const data = await fs.readFile(filePath, 'utf-8');
                    const prescriptions = JSON.parse(data);
                    const match = prescriptions.find(p => p.id === prescriptionId);
                    if (match) {
                        foundPrescription = match;
                        break;
                    }
                } catch (e) {
                    // Skip folders without prescriptions
                }
            }
        } catch (e) {
            console.error("Error reading users dir during validation:", e);
        }

        if (!foundPrescription) {
            return NextResponse.json({ 
                success: false, 
                isValid: false, 
                message: 'La receta consultada no existe o no ha sido emitida en la plataforma NeoConta Vitacore.' 
            }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            isValid: foundPrescription.status !== 'anulada',
            prescription: {
                id: foundPrescription.id,
                hash: foundPrescription.hash,
                status: foundPrescription.status,
                issuedAt: foundPrescription.issuedAt,
                expiresAt: foundPrescription.expiresAt,
                patientName: foundPrescription.patientName,
                patientDni: foundPrescription.patientDni,
                professionalName: foundPrescription.professionalName,
                professionalMatricula: foundPrescription.professionalMatricula,
                professionalSpecialty: foundPrescription.professionalSpecialty,
                medications: foundPrescription.medications,
                diagnosis: foundPrescription.diagnosis,
                useDigitalSignature: foundPrescription.useDigitalSignature
            }
        });

    } catch (error) {
        console.error('Error in validation API:', error);
        return NextResponse.json({ error: 'Error al verificar la receta' }, { status: 500 });
    }
}
