import fs from 'fs/promises';
import path from 'path';
import { getUserDataDir, getInvoiceHistoryPath } from '../dataPaths.js';

export async function loadCommanderTenantData(userId) {
    const invoicesFilePath = getInvoiceHistoryPath(userId);
    const transactionsFilePath = path.join(getUserDataDir(userId), 'banco', '_transactions.json');

    let invoices = [];
    let invoicesUpdatedAt = null;
    try {
        const [raw, stat] = await Promise.all([
            fs.readFile(invoicesFilePath, 'utf-8'),
            fs.stat(invoicesFilePath)
        ]);
        const parsed = JSON.parse(raw);
        invoices = Array.isArray(parsed) ? parsed : [];
        invoicesUpdatedAt = stat.mtime.toISOString();
    } catch (error) {
        if (error.code !== 'ENOENT') console.error('Error reading invoices file:', error);
    }

    let transactions = [];
    let transactionsUpdatedAt = null;
    try {
        const [raw, stat] = await Promise.all([
            fs.readFile(transactionsFilePath, 'utf-8'),
            fs.stat(transactionsFilePath)
        ]);
        const parsed = JSON.parse(raw);
        transactions = Array.isArray(parsed) ? parsed : [];
        transactionsUpdatedAt = stat.mtime.toISOString();
    } catch (error) {
        if (error.code !== 'ENOENT') console.error('Error reading bank transactions file:', error);
    }

    return {
        invoices,
        transactions,
        sources: {
            invoices: { exists: invoicesUpdatedAt !== null, updatedAt: invoicesUpdatedAt, count: invoices.length },
            transactions: { exists: transactionsUpdatedAt !== null, updatedAt: transactionsUpdatedAt, count: transactions.length }
        }
    };
}
