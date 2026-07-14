import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
// import nodemailer from 'nodemailer'; // For later implementation once SMTP credentials are provided

export async function GET(request) {
    // SECURITY: In production, verify an Authorization header matching a CRON_SECRET env variable
    const authHeader = request.headers.get('authorization');
    if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const dataDir = path.join(process.cwd(), 'data', 'invoices');
        let files = [];
        try {
            files = await fs.readdir(dataDir);
        } catch (err) {
            // Directory might not exist if no invoices ever generated
            return NextResponse.json({ message: 'No invoice history found' });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // We are looking for invoices expiring in exactly 10 days
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + 10);
        const targetDateString = targetDate.toISOString().split('T')[0];

        let notificationsSent = 0;
        const pendingNotifications = [];

        // Scan all users' history files
        for (const file of files) {
            if (!file.endsWith('_history.json')) continue;

            const userId = file.split('_')[0];
            const fileData = await fs.readFile(path.join(dataDir, file), 'utf8');
            const history = JSON.parse(fileData);

            // Filter for invoices that are UNPAID and match exactly the target expiration date
            const dueInvoices = history.filter(inv => !inv.isPaid && inv.expirationDate === targetDateString);

            if (dueInvoices.length > 0) {
                // In a real scenario, we would join the `userId` with the `users` database 
                // to get their client contact list and email addresses.
                pendingNotifications.push({
                    userId,
                    invoices: dueInvoices.map(inv => ({
                        nro: inv.cae,
                        cliente: inv.RazonSocial || inv.Nombre || 'Consumidor Final',
                        monto: inv.Importe || inv.Total
                    }))
                });
                notificationsSent += dueInvoices.length;

                // Example Nodemailer logic:
                /*
                let transporter = nodemailer.createTransport({
                    host: process.env.SMTP_HOST,
                    port: process.env.SMTP_PORT,
                    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
                });

                for(let inv of dueInvoices) {
                    await transporter.sendMail({
                        from: '"NeoConta" <alertas@neoconta.app>',
                        to: 'cliente@ejemplo.com', // Would fetch from user's client list
                        subject: `Aviso de Vencimiento: Factura ${inv.cae}`,
                        text: `Estimado cliente, su factura por $${inv.Importe} vence en 10 días (${inv.expirationDate}).`
                    });
                }
                */
            }
        }

        return NextResponse.json({
            success: true,
            message: `Cron job executed correctly. Found ${notificationsSent} invoices expiring on ${targetDateString}.`,
            details: pendingNotifications
        });

    } catch (error) {
        console.error('Error running notification cron job:', error);
        return NextResponse.json({ error: 'Failed to execute cron job' }, { status: 500 });
    }
}
