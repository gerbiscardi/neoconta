import fs from 'fs/promises';
import path from 'path';
import { getServerSession, canAccessUserData, sanitizeUserId } from '@/lib/auth';

// GET: Retrieve a specific transaction and its details by ID
export async function GET(request, { params }) {
    try {
        const session = await getServerSession(request);
        if (!session) {
            return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const { id } = await params;

        const targetUserId = sanitizeUserId(userId || session.id);
        if (!targetUserId || !canAccessUserData(session, targetUserId)) {
            return new Response(JSON.stringify({ error: 'Acceso no autorizado' }), { status: 403 });
        }

        const userDir = path.join(process.cwd(), 'data', 'users', targetUserId);
        const transactionsFilePath = path.join(userDir, 'banco', '_transactions.json');

        let transactions = [];
        try {
            const fileData = await fs.readFile(transactionsFilePath, 'utf-8');
            transactions = JSON.parse(fileData);
        } catch (error) {
            return new Response(JSON.stringify({ error: 'No se encontraron movimientos' }), { status: 404 });
        }

        const transaction = transactions.find(t => t.id === id);
        if (!transaction) {
            return new Response(JSON.stringify({ error: 'Movimiento no encontrado' }), { status: 404 });
        }

        // To mimic the Starbase behavior exactly, we also need to return the invoices that it's linked to.
        // We will read the history.json to map the linked_invoices array to actual invoice objects
        const invoicesDir = path.join(process.cwd(), 'data', 'invoices');
        const invoicesFilePath = path.join(invoicesDir, `${targetUserId}_history.json`);
        let allInvoices = [];
        try {
            const historyData = await fs.readFile(invoicesFilePath, 'utf-8');
            allInvoices = JSON.parse(historyData);
        } catch (error) {
            // It's okay if they have no invoices yet
        }

        // transaction.linked_invoices = [{ invoice_id: '...', amount: 1000, association_date: '2023-01-01', payment_order_number: '123' }]
        const populatedInvoices = (transaction.linked_invoices || []).map(link => {
            const invoiceData = allInvoices.find(inv => inv.cae === link.invoice_id || inv.id === link.invoice_id) || {};
            return {
                ...invoiceData,
                link_amount: link.amount,
                association_date: link.association_date,
                payment_order_number: link.payment_order_number
            };
        });

        return new Response(JSON.stringify({
            transaction,
            invoices: populatedInvoices
        }), { status: 200 });

    } catch (error) {
        console.error('Error in /api/banco/[id] GET:', error);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
    }
}

// PUT: Update transaction details (e.g., is_transferred flag) or its linked invoices
export async function PUT(request, { params }) {
    try {
        const session = await getServerSession(request);
        if (!session) {
            return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });
        }

        const data = await request.json();
        const { userId, updates } = data;
        const { id } = await params;

        const targetUserId = sanitizeUserId(userId || session.id);
        if (!targetUserId || !canAccessUserData(session, targetUserId)) {
            return new Response(JSON.stringify({ error: 'Acceso no autorizado' }), { status: 403 });
        }

        if (!updates) {
            return new Response(JSON.stringify({ error: 'updates object required' }), { status: 400 });
        }

        const transactionsFilePath = path.join(process.cwd(), 'data', 'users', targetUserId, 'banco', '_transactions.json');

        let transactions = [];
        try {
            const fileData = await fs.readFile(transactionsFilePath, 'utf-8');
            transactions = JSON.parse(fileData);
        } catch (error) {
            return new Response(JSON.stringify({ error: 'No se encontraron movimientos' }), { status: 404 });
        }

        const txIndex = transactions.findIndex(t => t.id === id);
        if (txIndex === -1) {
            return new Response(JSON.stringify({ error: 'Movimiento no encontrado' }), { status: 404 });
        }

        // Apply arbitrary updates allowed (is_transferred, linked_invoices, etc.)
        transactions[txIndex] = {
            ...transactions[txIndex],
            ...updates,
            updated_at: new Date().toISOString()
        };

        await fs.writeFile(transactionsFilePath, JSON.stringify(transactions, null, 2));

        return new Response(JSON.stringify({ message: 'Movimiento actualizado', transaction: transactions[txIndex] }), { status: 200 });

    } catch (error) {
        console.error('Error in /api/banco/[id] PUT:', error);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
    }
}

// DELETE: Remove a transaction entirely
export async function DELETE(request, { params }) {
    try {
        const session = await getServerSession(request);
        if (!session) {
            return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const { id } = await params;

        const targetUserId = sanitizeUserId(userId || session.id);
        if (!targetUserId || !canAccessUserData(session, targetUserId)) {
            return new Response(JSON.stringify({ error: 'Acceso no autorizado' }), { status: 403 });
        }

        const transactionsFilePath = path.join(process.cwd(), 'data', 'users', targetUserId, 'banco', '_transactions.json');

        let transactions = [];
        try {
            const fileData = await fs.readFile(transactionsFilePath, 'utf-8');
            transactions = JSON.parse(fileData);
        } catch (error) {
            return new Response(JSON.stringify({ error: 'No se encontraron movimientos' }), { status: 404 });
        }

        const filtered = transactions.filter(t => t.id !== id);

        if (filtered.length === transactions.length) {
            return new Response(JSON.stringify({ error: 'Movimiento no encontrado' }), { status: 404 });
        }

        await fs.writeFile(transactionsFilePath, JSON.stringify(filtered, null, 2));

        return new Response(JSON.stringify({ message: 'Movimiento eliminado' }), { status: 200 });

    } catch (error) {
        console.error('Error in /api/banco/[id] DELETE:', error);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
    }
}
