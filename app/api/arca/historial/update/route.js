import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function PATCH(request) {
    try {
        const body = await request.json();
        const { userId, invoiceId } = body;

        if (!userId || !invoiceId) {
            return NextResponse.json({ error: 'Missing userId or invoiceId parameter' }, { status: 400 });
        }

        const invoicesDir = path.join(process.cwd(), 'data', 'invoices');
        const historyFile = path.join(invoicesDir, `${userId}_history.json`);

        let history = [];
        try {
            const fileData = await fs.readFile(historyFile, 'utf8');
            history = JSON.parse(fileData);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return NextResponse.json({ error: 'Invoice history not found' }, { status: 404 });
            }
            throw error;
        }

        // Find the invoice and update it
        let updated = false;
        const newHistory = history.map(invoice => {
            // We match by unique AFIP CAE since that's completely unique for approved invoices
            if (invoice.cae === invoiceId) {
                updated = true;
                const updatedInvoice = { ...invoice };
                for (const key in body) {
                    if (key !== 'userId' && key !== 'invoiceId') {
                        updatedInvoice[key] = body[key];
                    }
                }
                return updatedInvoice;
            }
            return invoice;
        });

        if (!updated) {
            return NextResponse.json({ error: 'Invoice not found in history' }, { status: 404 });
        }

        // Save back
        await fs.writeFile(historyFile, JSON.stringify(newHistory, null, 2), 'utf8');

        return NextResponse.json({ success: true, message: 'Invoice updated successfully' });

    } catch (error) {
        console.error('Error updating invoice history:', error);
        return NextResponse.json({ error: 'Failed to update invoice history' }, { status: 500 });
    }
}
