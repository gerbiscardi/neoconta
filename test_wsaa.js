const { Afip } = require('afip.ts');
const fs = require('fs');
const path = require('path');

async function testAuth() {
    try {
        const userId = 'admin'; // Testing with the main user
        const userDir = path.join(process.cwd(), 'data', 'users', userId);
        const certPath = path.join(userDir, 'cert.crt');
        const keyPath = path.join(userDir, 'private.key');
        const configPath = path.join(userDir, 'config.json');

        const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const cuit = parseInt(userConfig.cuit.replace(/[^0-9]/g, ''));

        console.log(`Testing with CUIT: ${cuit}`);

        const certContent = fs.readFileSync(certPath, 'utf8');
        const keyContent = fs.readFileSync(keyPath, 'utf8');

        console.log("Cert start:", certContent.substring(0, 30));
        console.log("Key start:", keyContent.substring(0, 30));

        const afip = new Afip({
            key: keyContent,
            cert: certContent,
            cuit: cuit,
            production: false,
        });

        console.log("Attempting to get WS Auth...");
        const res = await afip.electronicBillingService.getSalesPoints();
        console.log("Success! Points:");
        console.log(res);

    } catch (e) {
        console.error("FAILED:");
        console.error(e.message);
    }
}

testAuth();
