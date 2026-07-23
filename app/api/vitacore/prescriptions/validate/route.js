import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const rxId = searchParams.get('id');

        if (!rxId) {
            return NextResponse.json({ error: 'ID de receta no especificado' }, { status: 400 });
        }

        const usersDir = path.join(process.cwd(), 'data', 'users');
        let foundRx = null;

        try {
            const userFolders = await fs.readdir(usersDir);
            for (const folder of userFolders) {
                const rxFile = path.join(usersDir, folder, 'vitacore', 'prescriptions.json');
                try {
                    const data = await fs.readFile(rxFile, 'utf-8');
                    const prescriptions = JSON.parse(data);
                    const rx = prescriptions.find(p => p.id === rxId);
                    if (rx) {
                        foundRx = rx;
                        break;
                    }
                } catch (e) {
                    // Ignore missing prescription files
                }
            }
        } catch (err) {
            console.error('Error scanning user directories:', err);
        }

        if (!foundRx) {
            return NextResponse.json({ 
                success: false, 
                valid: false, 
                message: 'La receta consultada no existe o ha sido dada de baja del sistema oficial.' 
            }, { status: 404 });
        }

        const isExpired = new Date(foundRx.expirationDate) < new Date();

        return NextResponse.json({
            success: true,
            valid: !isExpired,
            isExpired,
            prescription: {
                id: foundRx.id,
                patientName: foundRx.patientName,
                patientDni: foundRx.patientDni,
                patientObraSocial: foundRx.patientObraSocial,
                patientNumeroAfiliado: foundRx.patientNumeroAfiliado,
                professionalName: foundRx.professionalName,
                professionalSpecialty: foundRx.professionalSpecialty,
                professionalMatricula: foundRx.professionalMatricula,
                diagnosis: foundRx.diagnosis,
                items: foundRx.items,
                observations: foundRx.observations,
                createdAt: foundRx.createdAt,
                expirationDate: foundRx.expirationDate,
                verificationHash: foundRx.verificationHash,
                useDigitalSignature: foundRx.useDigitalSignature,
                status: isExpired ? 'VENCIDA' : 'VIGENTE'
            }
        });

    } catch (error) {
        console.error('Error in /api/vitacore/prescriptions/validate GET:', error);
        return NextResponse.json({ error: 'Error al validar la receta' }, { status: 500 });
    }
}
