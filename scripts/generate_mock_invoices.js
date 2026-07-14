import fs from 'fs/promises';
import path from 'path';

async function generateMockInvoices() {
    const userId = 'admin';
    const invoicesDir = path.join(process.cwd(), 'data', 'invoices');

    try {
        await fs.mkdir(invoicesDir, { recursive: true });
    } catch (e) { }

    const historyFile = path.join(invoicesDir, `${userId}_history.json`);
    let history = [];

    try {
        const fileData = await fs.readFile(historyFile, 'utf8');
        history = JSON.parse(fileData);
    } catch (e) {
        // File might not exist
    }

    // Exact matches to the generated bank transfers to facilitate testing
    const targetMatches = [
        { client: 'Tech Solutions SRL', cuit: 30111111118, amount: 75447 },
        { client: 'Tech Solutions SRL', cuit: 30111111118, amount: 94524 },
        { client: 'La Soga SAS', cuit: 30222222227, amount: 99592.5 },
        { client: 'Tech Solutions SRL', cuit: 30111111118, amount: 142797 },
        { client: 'Gómez Hermanos', cuit: 30333333336, amount: 65943 }
    ];

    const newInvoices = [];

    // Add 5 exact matches
    for (let i = 0; i < 5; i++) {
        const match = targetMatches[i];
        const now = new Date();
        now.setDate(now.getDate() - (i + 5)); // Issued past days

        const exp = new Date(now);
        exp.setDate(now.getDate() + 30);

        newInvoices.push({
            status: "aprobado",
            cae: "8" + Math.floor(1000000000000 + Math.random() * 9000000000000).toString(),
            caeFchVto: exp.toISOString().split('T')[0].replace(/-/g, ''),
            cliente: match.client,
            DocNro: match.cuit,
            Total: match.amount,
            Importe: match.amount, // alias mostly
            created_at: now.toISOString(),
            expirationDate: exp.toISOString().split('T')[0],
            isPaid: false
        });
    }

    // Add 5 random unmatched ones
    const randomClients = ['El Puente SA', 'Juan Pérez', 'Empresa Generica SA'];
    for (let i = 0; i < 5; i++) {
        const now = new Date();
        now.setDate(now.getDate() - (i + 15));

        const exp = new Date(now);
        exp.setDate(now.getDate() + 30);

        const randomAmount = Math.floor(10000 + Math.random() * 90000);

        newInvoices.push({
            status: "aprobado",
            cae: "8" + Math.floor(1000000000000 + Math.random() * 9000000000000).toString(),
            caeFchVto: exp.toISOString().split('T')[0].replace(/-/g, ''),
            cliente: randomClients[Math.floor(Math.random() * randomClients.length)],
            DocNro: 30000000000 + Math.floor(Math.random() * 99999999),
            Total: randomAmount,
            Importe: randomAmount,
            created_at: now.toISOString(),
            expirationDate: exp.toISOString().split('T')[0],
            isPaid: false
        });
    }

    history = [...newInvoices, ...history];

    await fs.writeFile(historyFile, JSON.stringify(history, null, 2), 'utf8');
    console.log(`Successfully generated 10 mock invoices for user ${userId}`);
}

generateMockInvoices().catch(console.error);
