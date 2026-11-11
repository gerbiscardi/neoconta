import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { encryptOAuthToken, decryptOAuthToken, isEncryptedOAuthToken } from '../lib/tokenCrypto.js';

const PORT = 3099;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const TEST_PREFIX = `sec_test_${Date.now()}`;

function resolveSourceSqlitePath() {
    const dbUrl = process.env.DATABASE_URL || 'file:./neoconta.db';
    const rawRel = dbUrl.replace(/^file:/i, '');
    const candidates = [
        path.resolve(process.cwd(), 'prisma', rawRel),
        path.resolve(process.cwd(), rawRel)
    ];
    for (const c of candidates) {
        if (existsSync(c) && statSync(c).size > 0) {
            return c;
        }
    }
    throw new Error(`Could not locate non-empty SQLite database from DATABASE_URL=${dbUrl}`);
}

async function waitForServer(url, timeoutMs = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const res = await fetch(`${url}/login`);
            if (res.ok || res.status === 200) return;
        } catch {
            // retry
        }
        await new Promise(r => setTimeout(r, 400));
    }
    throw new Error(`Timed out waiting for Next server at ${url}`);
}

function makeCookie(user, secret) {
    const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, parentId: user.parentId || null },
        secret,
        { expiresIn: '1h' }
    );
    return `neoconta_session=${encodeURIComponent(token)}`;
}

async function req(route, { method = 'GET', cookie = null, body = null, headers = {} } = {}) {
    const reqHeaders = { ...headers };
    if (cookie) reqHeaders.Cookie = cookie;
    if (body !== null && !reqHeaders['Content-Type']) {
        reqHeaders['Content-Type'] = 'application/json';
    }
    const res = await fetch(`${BASE_URL}${route}`, {
        method,
        headers: reqHeaders,
        body: body !== null ? JSON.stringify(body) : undefined,
        redirect: 'manual'
    });
    const text = await res.text();
    let json = null;
    try {
        json = JSON.parse(text);
    } catch {
        // non-json
    }
    return { status: res.status, json, text, headers: res.headers };
}

function runNodeScript(scriptRelPath, args = [], env = {}) {
    return new Promise((resolve, reject) => {
        const proc = spawn(process.execPath, [scriptRelPath, ...args], {
            cwd: process.cwd(),
            env: { ...process.env, ...env },
            stdio: ['ignore', 'pipe', 'pipe']
        });
        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', d => { stdout += d.toString(); });
        proc.stderr.on('data', d => { stderr += d.toString(); });
        proc.on('close', code => {
            if (code === 0) resolve({ stdout, stderr });
            else reject(new Error(`${scriptRelPath} exited with ${code}: ${stderr || stdout}`));
        });
    });
}

async function runTests() {
    const jwtSecret = process.env.JWT_SECRET;
    assert(jwtSecret && jwtSecret.length >= 32, 'JWT_SECRET must be set (>= 32 chars)');

    // Provision strictly isolated copies of SQLite DB and users.json inside OS temp dir
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'neoconta-sec-suite-'));
    const sourceDbPath = resolveSourceSqlitePath();
    const isolatedDbPath = path.join(tmpRoot, 'isolated.db');
    await fs.copyFile(sourceDbPath, isolatedDbPath);
    const isolatedDbUrl = `file:${isolatedDbPath.replace(/\\/g, '/')}`;

    const prodUsersJsonPath = path.join(process.cwd(), 'data', 'users.json');
    const isolatedUsersJsonPath = path.join(tmpRoot, 'users.json');
    try {
        await fs.copyFile(prodUsersJsonPath, isolatedUsersJsonPath);
    } catch {
        await fs.writeFile(isolatedUsersJsonPath, '[]', 'utf-8');
    }

    const prisma = new PrismaClient({
        datasources: { db: { url: isolatedDbUrl } }
    });

    const cronSecret = `cron_test_secret_${crypto.randomBytes(16).toString('hex')}`;
    const passwordHash = await bcrypt.hash('TestPass123!', 10);
    const ids = {
        clienteA: `${TEST_PREFIX}_cliA`,
        clienteB: `${TEST_PREFIX}_cliB`,
        owner: `${TEST_PREFIX}_owner`,
        profA: `${TEST_PREFIX}_profA`,
        recepA: `${TEST_PREFIX}_recepA`
    };

    const createdUsers = [
        { id: ids.clienteA, nombre: 'Test Clinic A', email: `${ids.clienteA}@example.test`, password: passwordHash, role: 'cliente', parentId: null, status: 'active' },
        { id: ids.clienteB, nombre: 'Test Clinic B', email: `${ids.clienteB}@example.test`, password: passwordHash, role: 'cliente', parentId: null, status: 'active' },
        { id: ids.owner, nombre: 'Test Owner', email: `${ids.owner}@example.test`, password: passwordHash, role: 'owner', parentId: null, status: 'active' },
        { id: ids.profA, nombre: 'Dr. Test Prof', email: `${ids.profA}@example.test`, password: passwordHash, role: 'vitacore-professional', parentId: ids.clienteA, status: 'active' },
        { id: ids.recepA, nombre: 'Recep Test', email: `${ids.recepA}@example.test`, password: passwordHash, role: 'vitacore-receptionist', parentId: ids.clienteA, status: 'active' }
    ];

    let serverProc = null;
    const cleanupDirs = [
        path.join(process.cwd(), 'data', 'users', ids.clienteA),
        path.join(process.cwd(), 'data', 'users', ids.clienteB),
        path.join(process.cwd(), 'data', 'users', ids.owner),
        path.join(process.cwd(), 'data', 'invoices', `${ids.clienteA}_history.json`),
        path.join(process.cwd(), 'data', 'invoices', `${ids.clienteB}_history.json`)
    ];

    try {
        for (const u of createdUsers) {
            await prisma.user.create({ data: u });
        }

        // Seed isolated users.json mirror alongside Prisma
        const isolatedUsers = JSON.parse(await fs.readFile(isolatedUsersJsonPath, 'utf-8'));
        for (const u of createdUsers) {
            isolatedUsers.push({
                id: u.id,
                nombre: u.nombre,
                email: u.email,
                password: u.password,
                role: u.role,
                parentId: u.parentId,
                tipoUsuario: 'empresa',
                isInternal: true,
                status: 'active',
                createdAt: new Date().toISOString()
            });
        }
        await fs.writeFile(isolatedUsersJsonPath, JSON.stringify(isolatedUsers, null, 2), 'utf-8');

        const cookies = {
            clienteA: makeCookie(createdUsers[0], jwtSecret),
            clienteB: makeCookie(createdUsers[1], jwtSecret),
            owner: makeCookie(createdUsers[2], jwtSecret),
            profA: makeCookie(createdUsers[3], jwtSecret),
            recepA: makeCookie(createdUsers[4], jwtSecret)
        };

        const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
        serverProc = spawn(npxCmd, ['next', 'start', '-p', String(PORT)], {
            cwd: process.cwd(),
            env: {
                ...process.env,
                DATABASE_URL: isolatedDbUrl,
                USERS_JSON_PATH: isolatedUsersJsonPath,
                CRON_SECRET: cronSecret
            },
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: process.platform === 'win32'
        });

        await waitForServer(BASE_URL);
        console.log('1. Isolated server ready on port', PORT, 'using', isolatedDbPath);

        // --- TEST 1: Fase 0 Commander SQL/Cloud Disabled ---
        {
            const unauth = await req('/api/commander/ingest', { method: 'POST', body: { userId: ids.clienteA, ingestionType: 'sql' } });
            assert.equal(unauth.status, 401, 'Unauthenticated commander ingest must return 401');

            const sqlRes = await req('/api/commander/ingest', { method: 'POST', cookie: cookies.clienteA, body: { userId: ids.clienteA, ingestionType: 'sql' } });
            assert.equal(sqlRes.status, 501, 'SQL simulation must return 501');
            assert.equal(sqlRes.json?.error, 'Integración todavía no disponible');

            const cloudRes = await req('/api/commander/ingest', { method: 'POST', cookie: cookies.clienteA, body: { userId: ids.clienteA, ingestionType: 'cloud' } });
            assert.equal(cloudRes.status, 501, 'Cloud simulation must return 501');
            assert.equal(cloudRes.json?.error, 'Integración todavía no disponible');

            let invExists = true;
            try {
                await fs.access(path.join(process.cwd(), 'data', 'invoices', `${ids.clienteA}_history.json`));
            } catch {
                invExists = false;
            }
            assert.equal(invExists, false, 'Disabled SQL/Cloud ingestion must not create financial files');
            console.log('PASS: Test 1 - Fase 0 Commander SQL/Cloud containment');
        }

        // --- TEST 2: Fase 0 Commander Excel Import Provenance & Non-Destructive Rollback ---
        {
            const invPath = path.join(process.cwd(), 'data', 'invoices', `${ids.clienteA}_history.json`);
            await fs.mkdir(path.dirname(invPath), { recursive: true });
            const realFiscalInvoice = {
                id: 'arca_real_1',
                cae: '75111111111111',
                caeVto: '20261120',
                cbteFch: '20261110',
                RazonSocial: 'Cliente Fiscal Real S.A.',
                CUIT: '30711111119',
                Importe: 50000,
                status: 'aprobado',
                CbteTipo: 11,
                PtoVta: 1,
                CbteDesde: 42
            };
            await fs.writeFile(invPath, JSON.stringify([realFiscalInvoice], null, 2));

            const badExcel = await req('/api/commander/ingest', {
                method: 'POST',
                cookie: cookies.clienteA,
                body: { userId: ids.clienteA, ingestionType: 'excel', dataType: 'invoices', data: [{ client_name: 'Sin CUIT', amount: -10 }] }
            });
            assert.equal(badExcel.status, 400, 'Invalid Excel rows must fail validation');

            const goodExcel = await req('/api/commander/ingest', {
                method: 'POST',
                cookie: cookies.clienteA,
                body: {
                    userId: ids.clienteA,
                    ingestionType: 'excel',
                    dataType: 'invoices',
                    fileName: 'externo_noviembre.xlsx',
                    data: [{ client_name: 'Proveedor Externo SRL', cuit: '30-72222222-3', amount: 15000, date: '2026-11-11', cbteTipo: 11, ptoVta: 2, cbteDesde: 99 }]
                }
            });
            assert.equal(goodExcel.status, 200);
            const batchId = goodExcel.json.batchId;

            const savedAfterImport = JSON.parse(await fs.readFile(invPath, 'utf-8'));
            assert.equal(savedAfterImport.length, 2, 'Pre-existing fiscal invoice must be preserved');
            const imported = savedAfterImport.find(i => i.batchId === batchId);
            assert.equal(imported.cae, null);
            assert.equal(imported.caeVto, null);
            assert.equal(imported.status, 'importado_externo');
            assert.equal(imported.isFiscalVerified, false);
            assert.equal(imported.verificationStatus, 'external_unverified');
            assert.equal(imported.source, 'excel_import');

            const rb = await req(`/api/commander/ingest?batchId=${encodeURIComponent(batchId)}`, { method: 'DELETE', cookie: cookies.clienteA });
            assert.equal(rb.status, 200);
            const savedAfterRollback = JSON.parse(await fs.readFile(invPath, 'utf-8'));
            assert.equal(savedAfterRollback.length, 1);
            assert.equal(savedAfterRollback[0].id, 'arca_real_1');
            console.log('PASS: Test 2 - Fase 0 Excel provenance & non-destructive preservation');
        }

        // --- TEST 3: Fase 0 Commentor No Mock Fallbacks & OAuth Gate ---
        {
            const userADir = path.join(process.cwd(), 'data', 'users', ids.clienteA);
            await fs.mkdir(userADir, { recursive: true });
            await fs.writeFile(
                path.join(userADir, 'connections.json'),
                JSON.stringify({
                    google: { connected: true, refreshToken: 'mock_google_refresh_token', locationName: 'Mock Biz' },
                    meta: { connected: true, accessToken: 'mock_meta_long_lived_token', pageName: 'Mock FB' }
                })
            );

            const connRes = await req('/api/ai/connections', { cookie: cookies.clienteA });
            assert.equal(connRes.status, 200);
            assert.equal(connRes.json.connections.google.connected, false);
            assert.equal(connRes.json.connections.meta.connected, false);

            const syncRes = await req('/api/ai/sync', { method: 'POST', cookie: cookies.clienteA, body: {} });
            assert.equal(syncRes.status, 400);

            let analysisExists = true;
            try {
                await fs.access(path.join(userADir, 'reviews_analysis.json'));
            } catch {
                analysisExists = false;
            }
            assert.equal(analysisExists, false);

            const googleOauth = await req('/api/auth/google', { cookie: cookies.clienteA, headers: { Accept: 'application/json' } });
            assert.equal(googleOauth.status, 501);

            const badCb = await req('/api/auth/google/callback?code=mock_code&state=tampered');
            assert.equal(badCb.status, 403);
            console.log('PASS: Test 3 - Fase 0 Commentor zero mock fallbacks & OAuth state verification');
        }

        // --- TEST 4: Fase 1 Auth, Cross-Tenant & SaaS Owner Isolation ---
        {
            const protectedEndpoints = [
                ['/api/commander/stats', 'GET'],
                ['/api/commander/widgets', 'GET'],
                ['/api/commander/widgets/data', 'POST', { widgets: [] }],
                ['/api/ai/connections', 'GET'],
                ['/api/ai/history', 'GET'],
                ['/api/vitacore/patients', 'GET'],
                ['/api/vitacore/appointments', 'GET'],
                ['/api/vitacore/prescriptions', 'GET'],
                ['/api/vitacore/orders', 'GET'],
                ['/api/vitacore/professionals', 'GET'],
                ['/api/vitacore/medical-terms?q=diab', 'GET'],
                ['/api/vitacore/consultations', 'POST', { patientId: 'x', consultation: { reason: 'y' } }],
                ['/api/vitacore/ai', 'POST', { action: 'soep', draftText: 'abc' }]
            ];

            for (const [ep, method, body] of protectedEndpoints) {
                const unauth = await req(ep, { method, body });
                assert.equal(unauth.status, 401, `Unauthenticated ${method} ${ep} must return 401`);

                const sep = ep.includes('?') ? '&' : '?';
                const targetEp = method === 'GET' ? `${ep}${sep}userId=${ids.clienteA}` : ep;
                const targetBody = body ? { ...body, userId: ids.clienteA } : undefined;
                if (ep !== '/api/vitacore/medical-terms?q=diab') {
                    const cross = await req(targetEp, { method, cookie: cookies.clienteB, body: targetBody });
                    assert.equal(cross.status, 403, `Cross-tenant ${method} ${ep} must return 403`);

                    const ownerCross = await req(targetEp, { method, cookie: cookies.owner, body: targetBody });
                    assert.equal(ownerCross.status, 403, `SaaS owner cross-tenant ${method} ${ep} must return 403`);
                }
            }
            console.log('PASS: Test 4 - Fase 1 authentication, cross-tenant & Owner isolation');
        }

        // --- TEST 5 & 10B: Fase 1 Vitacore Role Scoping, IDOR, Scoped Tokens & Legacy Compatibility ---
        {
            const createPat = await req('/api/vitacore/patients', {
                method: 'POST',
                cookie: cookies.profA,
                body: {
                    patient: { name: 'Paciente Prueba', dni: '35123456', importantDetails: 'Alergia penicilina' }
                }
            });
            assert.equal(createPat.status, 200);
            const patId = createPat.json.patient.id;

            const createApp = await req('/api/vitacore/appointments', {
                method: 'POST',
                cookie: cookies.recepA,
                body: {
                    appointment: {
                        patientId: patId,
                        patientName: 'Paciente Prueba',
                        patientPhone: '1155551234',
                        date: '2026-11-20',
                        time: '10:30'
                    }
                }
            });
            assert.equal(createApp.status, 201);
            const appId = createApp.json.appointment.id;
            const confirmToken = createApp.json.appointment.confirmToken;
            assert.ok(confirmToken);

            // Role scoping checks for receptionist
            const recListPat = await req('/api/vitacore/patients', { cookie: cookies.recepA });
            assert.equal(recListPat.status, 200);
            assert.deepEqual(recListPat.json.patients[0].consultations, []);
            assert.equal((await req('/api/vitacore/prescriptions', { cookie: cookies.recepA })).status, 403);
            assert.equal((await req('/api/vitacore/orders', { cookie: cookies.recepA })).status, 403);
            assert.equal((await req('/api/vitacore/consultations', { method: 'POST', cookie: cookies.recepA, body: { patientId: patId, consultation: { reason: 'Test' } } })).status, 403);
            assert.equal((await req('/api/vitacore/ai', { method: 'POST', cookie: cookies.recepA, body: { action: 'soep', draftText: 'abc' } })).status, 403);

            // Cross-tenant IDOR checks
            assert.equal((await req('/api/vitacore/patients', {
                method: 'PUT',
                cookie: cookies.clienteB,
                body: { patient: { id: patId, name: 'Hijacked', dni: '99999999' } }
            })).status, 404);
            assert.equal((await req(`/api/vitacore/appointments?appointmentId=${encodeURIComponent(appId)}`, {
                method: 'DELETE',
                cookie: cookies.clienteB
            })).status, 404);

            // Signed appointment link verification
            const noTokApp = await req(`/api/vitacore/appointments/confirm?id=${encodeURIComponent(appId)}`);
            assert.equal(noTokApp.status, 401);
            assert.equal(noTokApp.json.requiresLegacyVerification, true);
            assert.equal((await req(`/api/vitacore/appointments/confirm?id=${encodeURIComponent(appId)}&token=fake.token`)).status, 403);

            // Legacy appointment verification with phoneLast4 (wrong rejected without PII leak, right succeeds)
            const badLast4 = await req(`/api/vitacore/appointments/confirm?id=${encodeURIComponent(appId)}&phoneLast4=9999`);
            assert.equal(badLast4.status, 403);
            assert.equal(badLast4.json.appointment, undefined);

            const okLegacyAppGet = await req(`/api/vitacore/appointments/confirm?id=${encodeURIComponent(appId)}&phoneLast4=1234`);
            assert.equal(okLegacyAppGet.status, 200);
            assert.equal(okLegacyAppGet.json.appointment.patientPhone, undefined);

            const okConfirm = await req('/api/vitacore/appointments/confirm', {
                method: 'POST',
                body: { appointmentId: appId, action: 'confirm', token: confirmToken }
            });
            assert.equal(okConfirm.status, 200);
            assert.equal(okConfirm.json.appointment.status, 'confirmado');
            assert.equal(okConfirm.json.appointment.patientPhone, undefined);

            // Signed prescription link + legacy SHA-256 hash fallback
            const createPresc = await req('/api/vitacore/prescriptions', {
                method: 'POST',
                cookie: cookies.profA,
                body: {
                    prescription: {
                        patientId: patId,
                        patientName: 'Paciente Prueba',
                        patientDni: '35123456',
                        medications: [{ name: 'Ibuprofeno 400mg', dosage: 'c/8h', quantity: '1' }]
                    }
                }
            });
            assert.equal(createPresc.status, 201);
            const prescId = createPresc.json.prescription.id;
            const prescHash = createPresc.json.prescription.hash;
            const validateToken = createPresc.json.prescription.validateToken;
            assert.ok(validateToken && prescHash);

            const noTokRx = await req(`/api/vitacore/prescriptions/validate?id=${encodeURIComponent(prescId)}`);
            assert.equal(noTokRx.status, 401);
            assert.equal(noTokRx.json.requiresHashFallback, true);

            const badHashRx = await req(`/api/vitacore/prescriptions/validate?id=${encodeURIComponent(prescId)}&hash=${'0'.repeat(64)}`);
            assert.equal(badHashRx.status, 404);

            const okLegacyRx = await req(`/api/vitacore/prescriptions/validate?id=${encodeURIComponent(prescId)}&hash=${encodeURIComponent(prescHash)}`);
            assert.equal(okLegacyRx.status, 200);
            assert.equal(okLegacyRx.json.isValid, true);
            assert.equal(okLegacyRx.json.prescription.patientDni, '***456');

            const okRx = await req(`/api/vitacore/prescriptions/validate?id=${encodeURIComponent(prescId)}&token=${encodeURIComponent(validateToken)}`);
            assert.equal(okRx.status, 200);
            assert.equal(okRx.json.isValid, true);

            // Verify PDF generators embed validateToken in QR URLs
            const rxPdfSrc = await fs.readFile(path.join(process.cwd(), 'app', 'lib', 'generatePrescriptionPDF.js'), 'utf-8');
            const ordPdfSrc = await fs.readFile(path.join(process.cwd(), 'app', 'lib', 'generateOrderPDF.js'), 'utf-8');
            assert.ok(rxPdfSrc.includes('validateToken'), 'generatePrescriptionPDF must include validateToken in validationUrl');
            assert.ok(ordPdfSrc.includes('validateToken'), 'generateOrderPDF must include validateToken in validationUrl');

            console.log('PASS: Test 5 - Vitacore role boundaries, signed tokens, PDF QR tokens & legacy compatibility');
        }

        // --- TEST 6: Fase 1 Vitacore Credentials Bcrypt + Non-Exposure ---
        {
            const newProfEmail = `${TEST_PREFIX}_newprof@example.test`;
            const newProfPass = 'MedSecure!2026';

            assert.equal((await req('/api/vitacore/professionals', {
                method: 'POST',
                cookie: cookies.profA,
                body: { professional: { nombre: 'X', email: newProfEmail, password: newProfPass } }
            })).status, 403);

            const createdProfRes = await req('/api/vitacore/professionals', {
                method: 'POST',
                cookie: cookies.clienteA,
                body: {
                    professional: {
                        nombre: 'Dra. Bcrypt Verified',
                        email: newProfEmail,
                        password: newProfPass,
                        specialty: 'Clínica Médica',
                        matricula: 'MN 123456',
                        role: 'vitacore-professional'
                    }
                }
            });
            assert.equal(createdProfRes.status, 201);
            assert.equal(createdProfRes.json.professional.password, undefined);

            const listRes = await req('/api/vitacore/professionals', { cookie: cookies.clienteA });
            assert.equal(listRes.status, 200);
            const listed = listRes.json.professionals.find(p => p.email === newProfEmail);
            assert.ok(listed && listed.password === undefined);

            const prismaProf = await prisma.user.findUnique({ where: { email: newProfEmail } });
            assert.ok(prismaProf && prismaProf.password.startsWith('$2'));

            const jsonUsers = JSON.parse(await fs.readFile(isolatedUsersJsonPath, 'utf-8'));
            const jsonProf = jsonUsers.find(u => u.email === newProfEmail);
            assert.ok(jsonProf && jsonProf.password.startsWith('$2'));

            const loginRes = await req('/api/auth/login', {
                method: 'POST',
                body: { email: newProfEmail, password: newProfPass }
            });
            assert.equal(loginRes.status, 200);
            assert.equal(loginRes.json.user.role, 'vitacore-professional');
            console.log('PASS: Test 6 - Vitacore bcrypt credentials & isolated login sync');
        }

        // --- TEST 7 (Obs 1): canAccessUserData Hardening on Bank, ARCA, Remit, CSR, Config, Benchmark & Change-Password ---
        {
            const bancoDir = path.join(process.cwd(), 'data', 'users', ids.clienteA, 'banco');
            await fs.mkdir(bancoDir, { recursive: true });
            await fs.writeFile(path.join(bancoDir, '_transactions.json'), JSON.stringify([{ id: 'tx_1', amount: 1200 }]));

            const crossOwnerRoutes = [
                [`/api/banco?userId=${ids.clienteA}`, 'GET'],
                ['/api/banco', 'POST', { userId: ids.clienteA, transaction: { amount: 500, transaction_date: '2026-11-11' } }],
                [`/api/banco/tx_1?userId=${ids.clienteA}`, 'GET'],
                ['/api/banco/tx_1', 'PUT', { userId: ids.clienteA, updates: { is_transferred: true } }],
                [`/api/banco/tx_1?userId=${ids.clienteA}`, 'DELETE'],
                ['/api/accounting/remit', 'POST', { userId: ids.clienteA, fechaDesde: '2026-01-01', fechaHasta: '2026-12-31' }],
                ['/api/arca/consultar-cuit', 'POST', { userId: ids.clienteA, cuit: '30711111119' }],
                ['/api/arca/facturar', 'POST', { userId: ids.clienteA, invoices: [] }],
                [`/api/arca/historial?userId=${ids.clienteA}`, 'GET'],
                ['/api/arca/historial/update', 'PATCH', { userId: ids.clienteA, invoiceId: '75111111111111' }],
                ['/api/arca/nota-debito', 'POST', { userId: ids.clienteA, invoiceId: '75111111111111', amount: 100 }],
                [`/api/forecasting/benchmark?userId=${ids.clienteA}`, 'GET'],
                [`/api/user/config?userId=${ids.clienteA}`, 'GET'],
                ['/api/user/config', 'POST', { userId: ids.clienteA, razonSocial: 'Hack SA', cuit: '30711111119' }],
                ['/api/user/csr', 'POST', { userId: ids.clienteA, companyName: 'Hack SA', cuit: '30711111119' }],
                ['/api/auth/change-password', 'POST', { userId: ids.clienteA, currentPassword: 'TestPass123!', newPassword: 'NewPass!99' }]
            ];

            for (const [ep, method, body] of crossOwnerRoutes) {
                const ownerRes = await req(ep, { method, cookie: cookies.owner, body });
                assert.equal(ownerRes.status, 403, `Owner must receive 403 on cross-tenant ${method} ${ep} (got ${ownerRes.status})`);

                const cliBRes = await req(ep, { method, cookie: cookies.clienteB, body });
                assert.equal(cliBRes.status, 403, `ClienteB must receive 403 on cross-tenant ${method} ${ep} (got ${cliBRes.status})`);
            }

            // Sub-user (receptionist) must NEVER overwrite parent clinic password, config, or CSR
            assert.equal((await req('/api/auth/change-password', {
                method: 'POST',
                cookie: cookies.recepA,
                body: { userId: ids.clienteA, currentPassword: 'TestPass123!', newPassword: 'Hijacked!99' }
            })).status, 403);
            assert.equal((await req('/api/user/config', {
                method: 'POST',
                cookie: cookies.recepA,
                body: { userId: ids.clienteA, razonSocial: 'Hijacked', cuit: '30711111119' }
            })).status, 403);
            assert.equal((await req('/api/user/csr', {
                method: 'POST',
                cookie: cookies.recepA,
                body: { userId: ids.clienteA, companyName: 'Hijacked', cuit: '30711111119' }
            })).status, 403);

            // Legitimate self config & admin management remain functional
            assert.equal((await req(`/api/user/config?userId=${ids.owner}`, { cookie: cookies.owner })).status, 200);
            assert.equal((await req(`/api/banco?userId=${ids.clienteA}`, { cookie: cookies.clienteA })).status, 200);
            const adminList = await req('/api/admin/users', { cookie: cookies.owner });
            assert.equal(adminList.status, 200);
            assert.equal(adminList.json.success, true);

            console.log('PASS: Test 7 - Bank/ARCA/Remit/Config/CSR/Change-Password isolation & Owner self/admin access');
        }

        // --- TEST 8 (Obs 2): Cron WhatsApp Reminders Separation from Owner Session ---
        {
            const tDate = new Date();
            tDate.setDate(tDate.getDate() + 1);
            const tomorrow = tDate.toISOString().split('T')[0];
            await prisma.appointment.create({
                data: {
                    id: `${TEST_PREFIX}_cron_app`,
                    userId: ids.clienteA,
                    patientName: 'Juan Cron Secreto',
                    patientPhone: '5491144445555',
                    date: tomorrow,
                    time: '15:00',
                    status: 'reservado'
                }
            });

            // Unauthenticated & wrong secret -> 401
            assert.equal((await req('/api/vitacore/cron/whatsapp-reminders')).status, 401);
            assert.equal((await req('/api/vitacore/cron/whatsapp-reminders?secret=wrong_secret')).status, 401);

            // Owner web session WITHOUT CRON_SECRET must be denied 403 (zero cross-tenant patient PII)
            const ownerCronRes = await req('/api/vitacore/cron/whatsapp-reminders', { cookie: cookies.owner });
            assert.equal(ownerCronRes.status, 403, 'Owner web session must NOT access cross-tenant patient reminders');
            assert.equal(ownerCronRes.json.reminders, undefined);

            // Technical cron call with Authorization: Bearer CRON_SECRET succeeds with signed confirmation URL
            const validCronRes = await req('/api/vitacore/cron/whatsapp-reminders', {
                headers: { Authorization: `Bearer ${cronSecret}` }
            });
            assert.equal(validCronRes.status, 200);
            const matchRem = validCronRes.json.reminders.find(r => r.appointmentId === `${TEST_PREFIX}_cron_app`);
            assert.ok(matchRem && matchRem.whatsappUrl.includes('token%3D'), 'Cron reminder must carry signed token');
            console.log('PASS: Test 8 - Cron WhatsApp Reminders strict separation from Owner session');
        }

        // --- TEST 9 (Obs 3): Password Migration Script, Legacy Users, Rollback Redaction & Prisma/JSON Consistency ---
        {
            const legacySubId = `${TEST_PREFIX}_legacy_sub`;
            const legacyCliId = `${TEST_PREFIX}_legacy_cli`;
            const activePrismaId = `${TEST_PREFIX}_active_prisma`;
            const activePrismaHash = await bcrypt.hash('ActivePass!99', 10);

            await prisma.user.create({
                data: {
                    id: legacyCliId,
                    nombre: 'Legacy Cliente',
                    email: `${legacyCliId}@example.test`,
                    password: 'LegacyPlainCli!22',
                    role: 'cliente',
                    status: 'active'
                }
            });
            await prisma.user.create({
                data: {
                    id: activePrismaId,
                    nombre: 'Active Hash User',
                    email: `${activePrismaId}@example.test`,
                    password: activePrismaHash,
                    role: 'cliente',
                    status: 'active'
                }
            });

            const currUsers = JSON.parse(await fs.readFile(isolatedUsersJsonPath, 'utf-8'));
            currUsers.push(
                {
                    id: legacySubId,
                    nombre: 'Legacy Vitacore Sub',
                    email: `${legacySubId}@example.test`,
                    password: 'PlainSubPass!88',
                    role: 'vitacore-professional',
                    parentId: ids.clienteA,
                    status: 'active'
                },
                {
                    id: legacyCliId,
                    nombre: 'Legacy Cliente',
                    email: `${legacyCliId}@example.test`,
                    password: 'LegacyPlainCli!22',
                    role: 'cliente',
                    status: 'active'
                },
                {
                    id: activePrismaId,
                    nombre: 'Active Hash User',
                    email: `${activePrismaId}@example.test`,
                    password: 'StaleOldPlainPassword',
                    role: 'cliente',
                    status: 'active'
                }
            );
            await fs.writeFile(isolatedUsersJsonPath, JSON.stringify(currUsers, null, 2), 'utf-8');

            const { stdout: migOut } = await runNodeScript(
                'scripts/migrate_vitacore_passwords.mjs',
                ['--users-json', isolatedUsersJsonPath],
                { DATABASE_URL: isolatedDbUrl }
            );
            const migSummary = JSON.parse(migOut.slice(migOut.indexOf('{')));
            assert.equal(migSummary.success, true);
            assert.ok(migSummary.backupPath, 'Migration must generate a backup file');

            // Verify backup never stores plaintext passwords (rollback safety)
            const bakContent = await fs.readFile(migSummary.backupPath, 'utf-8');
            assert.equal(bakContent.includes('PlainSubPass!88'), false, 'Backup must NEVER retain plaintext sub-user password');
            assert.equal(bakContent.includes('LegacyPlainCli!22'), false, 'Backup must NEVER retain plaintext client password');
            assert.equal(bakContent.includes('StaleOldPlainPassword'), false, 'Backup must NEVER retain stale plaintext password');
            assert.ok(bakContent.includes('[REDACTED_PLAINTEXT_REMOVED]'), 'Backup must mark redacted plaintext credentials');

            // Verify all migrated records in isolated DB + JSON work via /api/auth/login
            const migratedSubLogin = await req('/api/auth/login', {
                method: 'POST',
                body: { email: `${legacySubId}@example.test`, password: 'PlainSubPass!88' }
            });
            assert.equal(migratedSubLogin.status, 200, 'Migrated legacy vitacore-professional must authenticate via bcrypt');

            const migratedCliLogin = await req('/api/auth/login', {
                method: 'POST',
                body: { email: `${legacyCliId}@example.test`, password: 'LegacyPlainCli!22' }
            });
            assert.equal(migratedCliLogin.status, 200, 'Migrated legacy client must authenticate via bcrypt');

            const activeOkLogin = await req('/api/auth/login', {
                method: 'POST',
                body: { email: `${activePrismaId}@example.test`, password: 'ActivePass!99' }
            });
            assert.equal(activeOkLogin.status, 200, 'Active Prisma bcrypt hash must be preserved against stale JSON plaintext');

            const staleDenied = await req('/api/auth/login', {
                method: 'POST',
                body: { email: `${activePrismaId}@example.test`, password: 'StaleOldPlainPassword' }
            });
            assert.equal(staleDenied.status, 401);

            // Verify API write consistency: PATCH /api/admin/users syncs role to BOTH JSON and Prisma
            const patchRes = await req('/api/admin/users', {
                method: 'PATCH',
                cookie: cookies.owner,
                body: { userId: legacyCliId, newRole: 'no-cliente' }
            });
            assert.equal(patchRes.status, 200);
            const dbAfterPatch = await prisma.user.findUnique({ where: { id: legacyCliId } });
            assert.equal(dbAfterPatch.role, 'no-cliente', 'PATCH admin role must sync to Prisma');

            // Verify self change-password syncs BOTH Prisma and JSON cleanly
            const legacyCliCookie = makeCookie({ id: legacyCliId, email: `${legacyCliId}@example.test`, role: 'no-cliente' }, jwtSecret);
            const chgRes = await req('/api/auth/change-password', {
                method: 'POST',
                cookie: legacyCliCookie,
                body: { currentPassword: 'LegacyPlainCli!22', newPassword: 'RotatedNewPass!77' }
            });
            assert.equal(chgRes.status, 200);
            assert.equal((await req('/api/auth/login', {
                method: 'POST',
                body: { email: `${legacyCliId}@example.test`, password: 'RotatedNewPass!77' }
            })).status, 200);

            console.log('PASS: Test 9 - Password migration, legacy compatibility, redacted backups & Prisma/JSON sync');
        }

        // --- TEST 10 (Obs 4): OAuth Token Encryption at Rest ---
        {
            const sampleSecret = 'ya29.real_google_secret_token_xyz';
            const enc = encryptOAuthToken(sampleSecret);
            assert.ok(isEncryptedOAuthToken(enc), 'Encrypted OAuth token must use ENC_OAUTH:v1 prefix');
            assert.equal(enc.includes(sampleSecret), false, 'Encrypted payload must not expose plaintext');
            assert.equal(decryptOAuthToken(enc), sampleSecret, 'Decryption roundtrip must match original token');
            assert.throws(() => decryptOAuthToken(`${enc.slice(0, -4)}ffff`), 'Tampered GCM auth tag must throw');

            const userBDir = path.join(process.cwd(), 'data', 'users', ids.clienteB);
            const connPathB = path.join(userBDir, 'connections.json');
            await fs.mkdir(userBDir, { recursive: true });
            await fs.writeFile(connPathB, JSON.stringify({
                google: {
                    connected: true,
                    refreshToken: '1//real_plaintext_google_refresh',
                    accessToken: 'ya29.real_plaintext_access',
                    locationName: 'Clínica B'
                },
                meta: {
                    connected: true,
                    accessToken: 'EAAB_real_plaintext_meta_token',
                    pageName: 'Meta Clínica B'
                }
            }, null, 2));

            const connGetB = await req(`/api/ai/connections?userId=${ids.clienteB}`, { cookie: cookies.clienteB });
            assert.equal(connGetB.status, 200);
            assert.equal(connGetB.json.connections.google.refreshToken, undefined);
            assert.equal(connGetB.json.connections.meta.accessToken, undefined);

            const upgradedDisk = JSON.parse(await fs.readFile(connPathB, 'utf-8'));
            assert.ok(isEncryptedOAuthToken(upgradedDisk.google.refreshToken), 'Legacy Google refreshToken must be upgraded & encrypted at rest');
            assert.ok(isEncryptedOAuthToken(upgradedDisk.google.accessToken), 'Legacy Google accessToken must be upgraded & encrypted at rest');
            assert.ok(isEncryptedOAuthToken(upgradedDisk.meta.accessToken), 'Legacy Meta accessToken must be upgraded & encrypted at rest');
            assert.equal(decryptOAuthToken(upgradedDisk.google.refreshToken), '1//real_plaintext_google_refresh');
            assert.equal(decryptOAuthToken(upgradedDisk.meta.accessToken), 'EAAB_real_plaintext_meta_token');

            console.log('PASS: Test 10 - OAuth AES-256-GCM token encryption & automatic at-rest upgrade');
        }

        console.log('\nALL FASE 0 & FASE 1 PRE-MERGE SECURITY TESTS PASSED (ZERO FAILURES).');
    } finally {
        if (serverProc && serverProc.pid) {
            try {
                if (process.platform === 'win32') {
                    execSync(`taskkill /PID ${serverProc.pid} /T /F`, { stdio: 'ignore' });
                } else {
                    serverProc.kill('SIGKILL');
                }
            } catch {
                // already exited
            }
        }
        await prisma.$disconnect().catch(() => {});
        await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
        for (const p of cleanupDirs) {
            await fs.rm(p, { recursive: true, force: true }).catch(() => {});
        }
    }
}

runTests().catch(err => {
    console.error('\nSECURITY TEST FAILED:', err);
    process.exit(1);
});
