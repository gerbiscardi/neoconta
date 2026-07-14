import fs from 'fs/promises';
import path from 'path';
import * as xlsx from 'xlsx';
export async function POST(request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file');
        const userId = formData.get('userId');

        if (!file || !userId) {
            return new Response(JSON.stringify({ error: 'File and userId are required' }), { status: 400 });
        }

        // Validate user folder
        const userDir = path.join(process.cwd(), 'data', 'users', userId);
        const bancoDir = path.join(userDir, 'banco');

        try {
            await fs.mkdir(bancoDir, { recursive: true });
        } catch (err) {
            console.error('Error creating banco directory:', err);
        }

        const transactionsFilePath = path.join(bancoDir, '_transactions.json');

        let existingTransactions = [];
        try {
            const historyData = await fs.readFile(transactionsFilePath, 'utf-8');
            existingTransactions = JSON.parse(historyData);
        } catch (error) {
            // File might not exist yet, that's fine
            if (error.code !== 'ENOENT') {
                console.error('Error parsing _transactions.json:', error);
            }
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

        let importedCount = 0;
        let skippedCount = 0;
        let errors = [];

        // Helper to parse date DD/MM/YYYY
        const parseDate = (dateStr) => {
            if (!dateStr) return null;
            // Handle Excel serial date
            if (typeof dateStr === 'number') {
                const date = new Date(Math.round((dateStr - 25569) * 86400 * 1000));
                return date;
            }
            if (dateStr instanceof Date) {
                return dateStr;
            }
            const parts = String(dateStr).split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1; // 0-indexed
                const year = parseInt(parts[2], 10);

                // Deal with 2 digit years if present
                const fullYear = year < 100 ? 2000 + year : year;
                const d = new Date(fullYear, month, day);
                if (!isNaN(d.getTime())) {
                    return d;
                }
            }
            return null;
        };

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;

            // Structure per original Starbase implementation
            // Col 0: TRF.RED / SUPERVIELLE (Concept / Bank Indicator)
            // Col 1: Date
            // Col 2: Voucher / ID
            // Col 4: Amount
            // Col 5: Description
            // Col 8: Client Name

            const col0 = String(row[0] || '').trim();
            const col1 = row[1]; // Date
            const col2 = row[2]; // Voucher
            const col4 = row[4]; // Amount
            const col5 = row[5]; // Description
            const col8 = row[8]; // Client Name

            // Skip if no date or amount
            if (!col1 || col4 === undefined || col4 === null) continue;

            const transactionDate = parseDate(col1);
            if (!transactionDate) {
                // Header row or invalid
                continue;
            }

            const bankName = col0.toUpperCase().includes('SUPERVIELLE') ? 'SUPERVIELLE' : 'BNA';
            const concept = col0; // Use col 0 as concept code as well
            const voucherNumber = String(col2 || '').trim();

            // Clean amount if it comes with weird signs
            const amountStr = String(col4).replace(/[$,]/g, '').trim();
            const amount = parseFloat(amountStr);

            const description = String(col5 || '').trim();
            const clientName = String(col8 || '').trim();

            if (isNaN(amount)) continue;

            // Extract CUIT if present anywhere in the row or description
            let cuitOriginante = null;
            for (let j = 0; j < row.length; j++) {
                if (row[j] !== undefined && row[j] !== null) {
                    const cellStr = String(row[j]).trim();
                    // Match a CUIT: exactly 11 digits, or 2 digits - 8 digits - 1 digit
                    const match = cellStr.match(/\b\d{2}-?\d{8}-?\d{1}\b/);
                    if (match) {
                        cuitOriginante = match[0].replace(/[^0-9]/g, '');
                        break;
                    }
                }
            }

            // Basic duplicate check against existing parsed transactions
            // Exact same Date, Voucher, Amount -> Skip duplication

            const trDateString = transactionDate.toISOString().split('T')[0];

            const isDuplicate = existingTransactions.some(tr =>
                String(tr.transaction_date).split('T')[0] === trDateString &&
                String(tr.voucher_number || '').trim() === voucherNumber &&
                parseFloat(tr.amount) === amount
            );

            if (isDuplicate) {
                skippedCount++;
                continue;
            }

            const newTransaction = {
                id: Math.random().toString(36).substring(2, 15) + Date.now().toString(36), // pseudo-uuid
                transaction_date: trDateString,
                concept: concept,
                voucher_number: voucherNumber,
                amount: amount,
                description: description,
                client_name: clientName,
                bank_name: bankName,
                cuit_originante: cuitOriginante,
                is_transferred: false,
                linked_invoices: [],
                created_at: new Date().toISOString()
            };

            existingTransactions.push(newTransaction);
            importedCount++;
        }

        // Sort globally by date descending
        existingTransactions.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));

        await fs.writeFile(transactionsFilePath, JSON.stringify(existingTransactions, null, 2));

        return new Response(JSON.stringify({
            message: 'Importación completada',
            imported: importedCount,
            skipped: skippedCount,
            errors: errors.length > 0 ? errors : undefined
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error('Error in /api/banco/import:', error);
        return new Response(JSON.stringify({ error: 'Error procesando la importación: ' + error.message }), { status: 500 });
    }
}
