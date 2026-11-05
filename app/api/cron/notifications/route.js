import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
// import nodemailer from 'nodemailer'; // For later implementation once SMTP credentials are provided

export async function GET(request) {
    // Verificación estricta Fail-Closed: La ausencia o discrepancia de CRON_SECRET bloquea la ejecución
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || typeof cronSecret !== 'string' || cronSecret.trim().length < 32) {
        return NextResponse.json({ 
            error: 'Configuración de seguridad inválida: CRON_SECRET no está definido o es insuficiente en el servidor.' 
        }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret.trim()}`) {
        return NextResponse.json({ error: 'No autorizado para ejecutar tarea programada' }, { status: 401 });
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
