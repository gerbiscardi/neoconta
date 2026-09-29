const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const dataDir = path.resolve(__dirname, '../data');

async function main() {
    console.log('--- Starting Migration from JSON files to SQLite Database ---');

    // 1. Migrate Users
    const usersJsonPath = path.join(dataDir, 'users.json');
    if (fs.existsSync(usersJsonPath)) {
        try {
            const usersData = JSON.parse(fs.readFileSync(usersJsonPath, 'utf8'));
            console.log(`Found ${usersData.length} users in users.json`);
            for (const u of usersData) {
                await prisma.user.upsert({
                    where: { id: u.id },
                    update: {
                        nombre: u.nombre || u.email,
                        email: u.email,
                        password: u.password,
                        role: u.role || 'cliente',
                        parentId: u.parentId || null,
                        mustChangePassword: Boolean(u.mustChangePassword)
                    },
                    create: {
                        id: u.id,
                        nombre: u.nombre || u.email,
                        email: u.email,
                        password: u.password,
                        role: u.role || 'cliente',
                        parentId: u.parentId || null,
                        mustChangePassword: Boolean(u.mustChangePassword)
                    }
                });
            }
            console.log('✓ Users migration complete.');
        } catch (err) {
            console.error('Error migrating users:', err.message);
        }
    }

    // 2. Scan User Directories in data/users/
    const usersDir = path.join(dataDir, 'users');
    if (fs.existsSync(usersDir)) {
        const userFolders = fs.readdirSync(usersDir);
        for (const userId of userFolders) {
            const userFolderPath = path.join(usersDir, userId);
            if (!fs.statSync(userFolderPath).isDirectory()) continue;

            // 2A. User Config
            const configPath = path.join(userFolderPath, 'config.json');
            if (fs.existsSync(configPath)) {
                try {
                    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                    await prisma.userConfig.upsert({
                        where: { userId: userId },
                        update: {
                            razonSocial: cfg.razonSocial || null,
                            cuit: cfg.cuit || null,
                            condicionIva: cfg.condicionIva || null,
                            direccion: cfg.direccion || null,
                            localidad: cfg.localidad || null,
                            provincia: cfg.provincia || null,
                            afipEnvironment: cfg.afipEnvironment || 'testing',
                            hasCertificates: Boolean(cfg.hasCertificates),
                            featuresJson: cfg.features ? JSON.stringify(cfg.features) : null,
                            medicalDetails: cfg.medicalDetails ? JSON.stringify(cfg.medicalDetails) : null,
                            whatsappDetails: cfg.whatsappDetails ? JSON.stringify(cfg.whatsappDetails) : null
                        },
                        create: {
                            userId: userId,
                            razonSocial: cfg.razonSocial || null,
                            cuit: cfg.cuit || null,
                            condicionIva: cfg.condicionIva || null,
                            direccion: cfg.direccion || null,
                            localidad: cfg.localidad || null,
                            provincia: cfg.provincia || null,
                            afipEnvironment: cfg.afipEnvironment || 'testing',
                            hasCertificates: Boolean(cfg.hasCertificates),
                            featuresJson: cfg.features ? JSON.stringify(cfg.features) : null,
                            medicalDetails: cfg.medicalDetails ? JSON.stringify(cfg.medicalDetails) : null,
                            whatsappDetails: cfg.whatsappDetails ? JSON.stringify(cfg.whatsappDetails) : null
                        }
                    });
                    console.log(`✓ UserConfig migrated for ${userId}`);
                } catch (e) {
                    console.error(`Error migrating config for ${userId}:`, e.message);
                }
            }

            // 2B. Bank Transactions
            const bankPath = path.join(userFolderPath, 'banco', '_transactions.json');
            if (fs.existsSync(bankPath)) {
                try {
                    const txs = JSON.parse(fs.readFileSync(bankPath, 'utf8'));
                    for (const tx of txs) {
                        const txId = tx.id || `tx_${Date.now()}_${Math.random()}`;
                        await prisma.bankTransaction.upsert({
                            where: { id: String(txId) },
                            update: {},
                            create: {
                                id: String(txId),
                                userId: userId,
                                date: tx.date || new Date().toISOString(),
                                description: tx.description || 'Transacción',
                                amount: Number(tx.amount) || 0,
                                category: tx.category || 'General',
                                source: tx.source || 'manual'
                            }
                        });
                    }
                    console.log(`✓ Bank transactions migrated for ${userId}`);
                } catch (e) {
                    console.error(`Error migrating bank transactions for ${userId}:`, e.message);
                }
            }

            // 2C. Vitacore Patients & Consultations
            const patientsPath = path.join(userFolderPath, 'vitacore', 'patients.json');
            if (fs.existsSync(patientsPath)) {
                try {
                    const patients = JSON.parse(fs.readFileSync(patientsPath, 'utf8'));
                    for (const p of patients) {
                        const pId = String(p.id || `pat_${Date.now()}`);
                        await prisma.patient.upsert({
                            where: { id: pId },
                            update: {
                                name: p.name,
                                dni: String(p.dni),
                                birthDate: p.birthDate || null,
                                phone: p.phone || null,
                                email: p.email || null,
                                obraSocial: p.obraSocial || null,
                                affiliateNumber: p.affiliateNumber || null,
                                importantDetails: p.importantDetails || null
                            },
                            create: {
                                id: pId,
                                userId: userId,
                                name: p.name,
                                dni: String(p.dni),
                                birthDate: p.birthDate || null,
                                phone: p.phone || null,
                                email: p.email || null,
                                obraSocial: p.obraSocial || null,
                                affiliateNumber: p.affiliateNumber || null,
                                importantDetails: p.importantDetails || null
                            }
                        });

                        if (Array.isArray(p.consultations)) {
                            for (const c of p.consultations) {
                                const cId = String(c.id || `c_${Date.now()}_${Math.random()}`);
                                await prisma.consultation.upsert({
                                    where: { id: cId },
                                    update: {},
                                    create: {
                                        id: cId,
                                        patientId: pId,
                                        date: c.date || new Date().toISOString(),
                                        reason: c.reason || null,
                                        observations: c.observations || null,
                                        prescription: c.prescription || null,
                                        professionalId: c.professionalId || null,
                                        professionalName: c.professionalName || null,
                                        professionalSpecialty: c.professionalSpecialty || null,
                                        isError: Boolean(c.isError)
                                    }
                                });
                            }
                        }
                    }
                    console.log(`✓ Vitacore patients & consultations migrated for ${userId}`);
                } catch (e) {
                    console.error(`Error migrating Vitacore patients for ${userId}:`, e.message);
                }
            }

            // 2D. Vitacore Appointments
            const appointmentsPath = path.join(userFolderPath, 'vitacore', 'appointments.json');
            if (fs.existsSync(appointmentsPath)) {
                try {
                    const apps = JSON.parse(fs.readFileSync(appointmentsPath, 'utf8'));
                    for (const a of apps) {
                        const aId = String(a.id || `app_${Date.now()}_${Math.random()}`);
                        await prisma.appointment.upsert({
                            where: { id: aId },
                            update: {
                                status: a.status || 'pendiente'
                            },
                            create: {
                                id: aId,
                                userId: userId,
                                patientId: a.patientId ? String(a.patientId) : null,
                                patientName: a.patientName || 'Paciente',
                                patientPhone: a.patientPhone || '',
                                date: a.date || new Date().toISOString().split('T')[0],
                                time: a.time || '09:00',
                                consultationType: a.consultationType || 'General',
                                reason: a.reason || null,
                                status: a.status || 'pendiente',
                                professionalId: a.professionalId || null,
                                professionalName: a.professionalName || null,
                                professionalSpecialty: a.professionalSpecialty || null,
                                notes: a.notes || null
                            }
                        });
                    }
                    console.log(`✓ Vitacore appointments migrated for ${userId}`);
                } catch (e) {
                    console.error(`Error migrating Vitacore appointments for ${userId}:`, e.message);
                }
            }
        }
    }

    // 3. Migrate Invoices
    const invoicesDir = path.join(dataDir, 'invoices');
    if (fs.existsSync(invoicesDir)) {
        const invFiles = fs.readdirSync(invoicesDir);
        for (const file of invFiles) {
            if (!file.endsWith('_history.json')) continue;
            const userId = file.replace('_history.json', '');
            try {
                const invoices = JSON.parse(fs.readFileSync(path.join(invoicesDir, file), 'utf8'));
                for (const inv of invoices) {
                    const invId = String(inv.id || `inv_${Date.now()}_${Math.random()}`);
                    await prisma.invoice.upsert({
                        where: { id: invId },
                        update: {},
                        create: {
                            id: invId,
                            userId: userId,
                            cbteTipo: Number(inv.CbteTipo || inv.cbteTipo || 11),
                            cbteDesde: Number(inv.CbteDesde || inv.cbteDesde || 1),
                            cbteHasta: Number(inv.CbteHasta || inv.cbteHasta || 1),
                            impTotal: Number(inv.ImpTotal || inv.impTotal || 0),
                            docTipo: inv.DocTipo ? Number(inv.DocTipo) : null,
                            docNro: inv.DocNro ? String(inv.DocNro) : null,
                            afipResponse: inv.afip_response ? JSON.stringify(inv.afip_response) : null,
                            cae: inv.cae || null,
                            caeVto: inv.caeVto || null
                        }
                    });
                }
                console.log(`✓ Invoices migrated for ${userId}`);
            } catch (e) {
                console.error(`Error migrating invoices for ${file}:`, e.message);
            }
        }
    }

    console.log('--- Migration Finished Successfully! ---');
}

main()
    .catch((e) => {
        console.error('Migration fatal error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
