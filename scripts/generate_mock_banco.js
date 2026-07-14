import fs from 'fs/promises';
import path from 'path';

async function generateMockTransactions() {
    const userId = 'admin';
    const bancoDir = path.join(process.cwd(), 'data', 'users', userId, 'banco');

    try {
        await fs.mkdir(bancoDir, { recursive: true });
    } catch (e) { }

    const filePath = path.join(bancoDir, '_transactions.json');
    let transactions = [];

    try {
        const data = await fs.readFile(filePath, 'utf-8');
        transactions = JSON.parse(data);
    } catch (e) {
        // File might not exist
    }

    const mockClients = ['El Puente SA', 'La Soga SAS', 'Juan Pérez', 'Tech Solutions SRL', 'Gómez Hermanos'];
    const mockConcepts = ['HONORARIOS', 'ABONO MENSUAL', 'SERVICIOS', 'CONSULTORIA', 'PAGO FACTURA'];

    for (let i = 0; i < 10; i++) {
        const date = new Date();
        date.setDate(date.getDate() - Math.floor(Math.random() * 30)); // Last 30 days

        const tx = {
            id: Math.random().toString(36).substring(2, 15) + Date.now().toString(36),
            transaction_date: date.toISOString().split('T')[0],
            concept: mockConcepts[Math.floor(Math.random() * mockConcepts.length)],
            voucher_number: Math.floor(10000000 + Math.random() * 90000000).toString(),
            amount: Math.floor(10000 + Math.random() * 90000) * 1.5,
            description: 'Transferencia recibida ' + (Math.random() > 0.5 ? 'BNA' : 'Supervielle'),
            client_name: mockClients[Math.floor(Math.random() * mockClients.length)],
            bank_name: Math.random() > 0.5 ? 'BNA' : 'SUPERVIELLE',
            is_transferred: false,
            linked_invoices: [],
            created_at: new Date().toISOString()
        };
        transactions.push(tx);
    }

    transactions.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));

    await fs.writeFile(filePath, JSON.stringify(transactions, null, 2));
    console.log(`Successfully generated 10 mock transactions for user ${userId}`);
}

generateMockTransactions().catch(console.error);
