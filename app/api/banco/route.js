import fs from 'fs/promises';
import path from 'path';

// GET: Retrieve all bank transactions
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return new Response(JSON.stringify({ error: 'userId is required' }), { status: 400 });
        }

        const transactionsFilePath = path.join(process.cwd(), 'data', 'users', userId, 'banco', '_transactions.json');

        try {
            const data = await fs.readFile(transactionsFilePath, 'utf-8');
            const transactions = JSON.parse(data);
            return new Response(JSON.stringify(transactions), { status: 200 });
        } catch (error) {
            if (error.code === 'ENOENT') {
                return new Response(JSON.stringify([]), { status: 200 }); // File doesn't exist yet
            }
            throw error;
        }

    } catch (error) {
        console.error('Error in /api/banco GET:', error);
        return new Response(JSON.stringify({ error: 'Error interno de servidor' }), { status: 500 });
    }
}

// POST: Add a single manual transaction
export async function POST(request) {
    try {
        const data = await request.json();
        const { userId, transaction } = data;

        if (!userId || !transaction) {
            return new Response(JSON.stringify({ error: 'userId and transaction object required' }), { status: 400 });
        }

        const userDir = path.join(process.cwd(), 'data', 'users', userId);
        const bancoDir = path.join(userDir, 'banco');

        try {
            await fs.mkdir(bancoDir, { recursive: true });
        } catch (err) {
            console.error('Error creating banco directory:', err);
        }

        const transactionsFilePath = path.join(bancoDir, '_transactions.json');

        let transactions = [];
        try {
            const fileData = await fs.readFile(transactionsFilePath, 'utf-8');
            transactions = JSON.parse(fileData);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('Error reading _transactions.json:', error);
            }
        }

        const newTx = {
            id: Math.random().toString(36).substring(2, 15) + Date.now().toString(36),
            transaction_date: transaction.transaction_date,
            concept: transaction.concept || 'Manual',
            voucher_number: transaction.voucher_number || '',
            amount: parseFloat(transaction.amount) || 0,
            description: transaction.description || '',
            client_name: transaction.client_name || '',
            bank_name: transaction.bank_name || 'MANUAL',
            is_transferred: false,
            linked_invoices: [],
            created_at: new Date().toISOString()
        };

        transactions.push(newTx);
        transactions.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));

        await fs.writeFile(transactionsFilePath, JSON.stringify(transactions, null, 2));

        return new Response(JSON.stringify({ message: 'Movimiento agregado', transaction: newTx }), { status: 201 });

    } catch (error) {
        console.error('Error in /api/banco POST:', error);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
    }
}
