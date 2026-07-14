import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import forge from 'node-forge';

export async function POST(request) {
    try {
        const { userId, cuit, companyName } = await request.json();

        if (!userId || !cuit || !companyName) {
            return NextResponse.json({ error: "Faltan datos (User ID, CUIT, Razón Social)" }, { status: 400 });
        }

        const cleanCuit = cuit.replace(/[^0-9]/g, '');
        if (cleanCuit.length !== 11) {
            return NextResponse.json({ error: "El CUIT debe tener exactamente 11 dígitos numéricos." }, { status: 400 });
        }

        // Directory: data/users/{userId}
        const userDir = join(process.cwd(), 'data', 'users', userId);
        await mkdir(userDir, { recursive: true });

        // 1. Generate Private Key
        const keys = forge.pki.rsa.generateKeyPair(2048);
        const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);

        // Save Private Key LOCALLY (Server-side only)
        await writeFile(join(userDir, 'private.key'), privateKeyPem);

        // 2. Generate CSR
        const csr = forge.pki.createCertificationRequest();
        csr.publicKey = keys.publicKey;
        csr.setSubject([
            { name: 'commonName', value: companyName },
            { name: 'organizationName', value: companyName },
            { name: 'countryName', value: 'AR' },
            { name: 'serialNumber', value: `CUIT ${cleanCuit}` }
        ]);

        csr.sign(keys.privateKey);
        const csrPem = forge.pki.certificationRequestToPem(csr);

        // Save CSR locally too (optional, but good for record)
        await writeFile(join(userDir, 'pedido.csr'), csrPem);

        // Return CSR to Frontend
        return NextResponse.json({
            success: true,
            csr: csrPem,
            message: "Clave Privada generada y guardada. CSR generado exitosamente."
        });

    } catch (error) {
        console.error("Error generating CSR:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
