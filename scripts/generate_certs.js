const forge = require('node-forge');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const CERT_DIR = path.join(__dirname, '../cert');

if (!fs.existsSync(CERT_DIR)) {
    fs.mkdirSync(CERT_DIR);
}

console.log("=== Generador de Certificados para AFIP (NeoConta) ===");
console.log("Este script generará la Clave Privada y el Pedido de Certificado (CSR).");

rl.question('Ingresa tu CUIT (solo números): ', (cuit) => {
    rl.question('Ingresa la Razón Social o Nombre de Empresa: ', (companyName) => {

        console.log("\nGenerando claves... Por favor espera (esto puede tomar unos segundos)...");

        // 1. Generate Private Key
        const keys = forge.pki.rsa.generateKeyPair(2048);
        const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);

        fs.writeFileSync(path.join(CERT_DIR, 'private.key'), privateKeyPem);
        console.log("✅ Clave Privada generada (cert/private.key)");

        // 2. Generate CSR
        const csr = forge.pki.createCertificationRequest();
        csr.publicKey = keys.publicKey;
        csr.setSubject([
            { name: 'commonName', value: companyName },
            { name: 'organizationName', value: companyName },
            { name: 'countryName', value: 'AR' },
            { name: 'serialNumber', value: `CUIT ${cuit}` }
        ]);

        // Sign the CSR
        csr.sign(keys.privateKey);
        const csrPem = forge.pki.certificationRequestToPem(csr);

        fs.writeFileSync(path.join(CERT_DIR, 'pedido.csr'), csrPem);
        console.log("✅ Pedido de Certificado generado (cert/pedido.csr)");

        console.log("\n=== ¡Listo! Siguientes pasos: ===");
        console.log("1. Ingresa a AFIP con Clave Fiscal.");
        console.log("2. Ve a 'WSASS - Autogestión Certificados Homologación'.");
        console.log("3. Crea un Nuevo Certificado y sube el archivo 'cert/pedido.csr'.");
        console.log("4. Descarga el certificado resultante, renómbralo a 'cert.crt' y guárdalo en la carpeta 'cert'.");
        console.log("5. ¡Ya puedes facturar!");

        rl.close();
    });
});
