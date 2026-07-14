const fs = require('fs');
const path = require('path');
const forge = require('node-forge');

try {
    const userId = 'admin';
    const userDir = path.join(process.cwd(), 'data', 'users', userId);
    const certPath = path.join(userDir, 'cert.crt');
    const keyPath = path.join(userDir, 'private.key');

    const certContent = fs.readFileSync(certPath, 'utf8');
    const keyContent = fs.readFileSync(keyPath, 'utf8');

    const cert = forge.pki.certificateFromPem(certContent);
    const privateKey = forge.pki.privateKeyFromPem(keyContent);

    const certPublicKey = forge.pki.publicKeyToPem(cert.publicKey);
    const privateKeyPublic = forge.pki.publicKeyToPem(forge.pki.setRsaPublicKey(privateKey.n, privateKey.e));

    if (certPublicKey === privateKeyPublic) {
        console.log("MATCH: The certificate AND private key match perfectly.");
    } else {
        console.log("MISMATCH: The certificate was NOT generated from this private key!");
    }
} catch (e) {
    console.error("Error analyzing keys:", e.message);
}
