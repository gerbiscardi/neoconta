import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const PORT = 3099;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const TEST_PREFIX = `sec_test_${Date.now()}`;
const USERS_JSON_PATH = path.join(process.cwd(), 'data', 'users.json');

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

async function runTests() {
    const jwtSecret = process.env.JWT_SECRET;
    assert(jwtSecret && jwtSecret.length >= 32, 'JWT_SECRET must be set (>= 32 chars)');

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

    let originalUsersJsonRaw = null;
    try {
        originalUsersJsonRaw = await fs.readFile(USERS_JSON_PATH, 'utf-8');
    } catch {
        originalUsersJsonRaw = '[]';
    }

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
            env: { ...process.env },
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: process.platform === 'win32'
        });

        await waitForServer(BASE_URL);
        console.log('1. Server ready on port', PORT);

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

            // Ensure no synthetic invoice file was created
            let invExists = true;
            try {
                await fs.access(path.join(process.cwd(), 'data', 'invoices', `${ids.clienteA}_history.json`));
            } catch {
                invExists = false;
            }
            assert.equal(invExists, false, 'Disabled SQL/Cloud ingestion must not create financial files');
            console.log('PASS: Fase 0 Commander SQL/Cloud containment');
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

            // Invalid Excel row must fail validation
            const badExcel = await req('/api/commander/ingest', {
                method: 'POST',
                cookie: cookies.clienteA,
                body: { userId: ids.clienteA, ingestionType: 'excel', dataType: 'invoices', data: [{ client_name: 'Sin CUIT', amount: -10 }] }
            });
            assert.equal(badExcel.status, 400, 'Invalid Excel rows must fail validation');

            // Valid Excel row without CAE must not fabricate random CAE or aprobado status
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
            assert.equal(imported.cae, null, 'Excel import must NOT fabricate random CAE');
            assert.equal(imported.caeVto, null, 'Excel import must NOT fabricate caeVto');
            assert.equal(imported.status, 'importado_externo', 'Excel import must NOT mark AFIP aprobado status');
            assert.equal(imported.isFiscalVerified, false);
            assert.equal(imported.verificationStatus, 'external_unverified');
            assert.equal(imported.source, 'excel_import');

            // Rollback must preserve pre-existing fiscal record
            const rb = await req(`/api/commander/ingest?batchId=${encodeURIComponent(batchId)}`, { method: 'DELETE', cookie: cookies.clienteA });
            assert.equal(rb.status, 200);
            const savedAfterRollback = JSON.parse(await fs.readFile(invPath, 'utf-8'));
            assert.equal(savedAfterRollback.length, 1);
            assert.equal(savedAfterRollback[0].id, 'arca_real_1');
            console.log('PASS: Fase 0 Excel provenance & non-destructive preservation');
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
            assert.equal(connRes.json.connections.google.connected, false, 'Mock Google tokens must never report connected=true');
            assert.equal(connRes.json.connections.meta.connected, false, 'Mock Meta tokens must never report connected=true');

            const syncRes = await req('/api/ai/sync', { method: 'POST', cookie: cookies.clienteA, body: {} });
            assert.equal(syncRes.status, 400, 'Sync with mock-only credentials must fail instead of falling back to mock reviews');

            // Ensure no reviews_analysis.json was created
            let analysisExists = true;
            try {
                await fs.access(path.join(userADir, 'reviews_analysis.json'));
            } catch {
                analysisExists = false;
            }
            assert.equal(analysisExists, false, 'Failed sync must not persist fake reports');

            const googleOauth = await req('/api/auth/google', { cookie: cookies.clienteA, headers: { Accept: 'application/json' } });
            assert.equal(googleOauth.status, 501, 'Google OAuth without server credentials must return 501, never redirect to mock_code');

            const badCb = await req(`/api/auth/google/callback?code=mock_code&state=tampered`);
            assert.equal(badCb.status, 403, 'Tampered OAuth state must be rejected with 403');
            console.log('PASS: Fase 0 Commentor zero mock fallbacks & OAuth state verification');
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
                assert.equal(unauth.status, 401, `Unauthenticated ${method} ${ep} must return 401 (got ${unauth.status})`);

                // Cross-tenant attacker (clienteB -> clienteA)
                const sep = ep.includes('?') ? '&' : '?';
                const targetEp = method === 'GET' ? `${ep}${sep}userId=${ids.clienteA}` : ep;
                const targetBody = body ? { ...body, userId: ids.clienteA } : undefined;
                if (ep !== '/api/vitacore/medical-terms?q=diab') {
                    const cross = await req(targetEp, { method, cookie: cookies.clienteB, body: targetBody });
                    assert.equal(cross.status, 403, `Cross-tenant ${method} ${ep} must return 403 (got ${cross.status})`);

                    // SaaS Owner accessing client private data without explicit grant
                    const ownerCross = await req(targetEp, { method, cookie: cookies.owner, body: targetBody });
                    assert.equal(ownerCross.status, 403, `SaaS owner cross-tenant ${method} ${ep} must return 403 (got ${ownerCross.status})`);
                }
            }
            console.log('PASS: Fase 1 authentication, cross-tenant isolation & Owner privacy');
        }

        // --- TEST 5 & 7: Fase 1 Vitacore Role Scoping, IDOR & Public Signed Tokens ---
        {
            // Prof creates a patient
            const createPat = await req('/api/vitacore/patients', {
                method: 'POST',
                cookie: cookies.profA,
                body: {
                    patient: { name: 'Paciente Prueba', dni: '35123456', importantDetails: 'Alergia penicilina' }
                }
            });
            assert.equal(createPat.status, 200);
            const patId = createPat.json.patient.id;

            // Clinic A creates a consultation record in JSON too? Let's test via Prisma consultation + prescriptions/orders/appointments
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
            assert.ok(confirmToken, 'Appointment must carry signed confirmToken');

            // Receptionist restrictions
            const recListPat = await req('/api/vitacore/patients', { cookie: cookies.recepA });
            assert.equal(recListPat.status, 200);
            assert.deepEqual(recListPat.json.patients[0].consultations, [], 'Receptionist must not see clinical consultations');

            const recPresc = await req('/api/vitacore/prescriptions', { cookie: cookies.recepA });
            assert.equal(recPresc.status, 403, 'Receptionist must be blocked from prescriptions');
            const recOrders = await req('/api/vitacore/orders', { cookie: cookies.recepA });
            assert.equal(recOrders.status, 403, 'Receptionist must be blocked from medical orders');
            const recCons = await req('/api/vitacore/consultations', { method: 'POST', cookie: cookies.recepA, body: { patientId: patId, consultation: { reason: 'Test' } } });
            assert.equal(recCons.status, 403, 'Receptionist must be blocked from consultations');
            const recAi = await req('/api/vitacore/ai', { method: 'POST', cookie: cookies.recepA, body: { action: 'soep', draftText: 'abc' } });
            assert.equal(recAi.status, 403, 'Receptionist must be blocked from Vitacore clinical AI');

            // Cross-tenant IDOR attempt by ClienteB using ClienteA's patientId / appointmentId
            const idorPat = await req('/api/vitacore/patients', {
                method: 'PUT',
                cookie: cookies.clienteB,
                body: { patient: { id: patId, name: 'Hijacked', dni: '99999999' } }
            });
            assert.equal(idorPat.status, 404, 'IDOR update patient across tenants must fail with 404');

            const idorApp = await req(`/api/vitacore/appointments?appointmentId=${encodeURIComponent(appId)}`, {
                method: 'DELETE',
                cookie: cookies.clienteB
            });
            assert.equal(idorApp.status, 404, 'IDOR delete appointment across tenants must fail with 404');

            // Scoped public confirmation token tests
            const noTokApp = await req(`/api/vitacore/appointments/confirm?id=${encodeURIComponent(appId)}`);
            assert.equal(noTokApp.status, 401);
            const badTokApp = await req(`/api/vitacore/appointments/confirm?id=${encodeURIComponent(appId)}&token=fake.token`);
            assert.equal(badTokApp.status, 403);
            const okConfirm = await req('/api/vitacore/appointments/confirm', {
                method: 'POST',
                body: { appointmentId: appId, action: 'confirm', token: confirmToken }
            });
            assert.equal(okConfirm.status, 200);
            assert.equal(okConfirm.json.appointment.status, 'confirmado');
            assert.equal(okConfirm.json.appointment.patientPhone, undefined, 'Public DTO must omit patientPhone');

            // Prescription validation token tests
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
            const validateToken = createPresc.json.prescription.validateToken;
            assert.ok(validateToken);

            const noTokRx = await req(`/api/vitacore/prescriptions/validate?id=${encodeURIComponent(prescId)}`);
            assert.equal(noTokRx.status, 401);
            const okRx = await req(`/api/vitacore/prescriptions/validate?id=${encodeURIComponent(prescId)}&token=${encodeURIComponent(validateToken)}`);
            assert.equal(okRx.status, 200);
            assert.equal(okRx.json.isValid, true);
            assert.equal(okRx.json.prescription.patientDni, '***456', 'Public validation must mask patient DNI');
            console.log('PASS: Fase 1 Vitacore role boundaries, IDOR fixes & scoped public tokens');
        }

        // --- TEST 6: Fase 1 Vitacore Credentials Bcrypt + Non-Exposure ---
        {
            const newProfEmail = `${TEST_PREFIX}_newprof@example.test`;
            const newProfPass = 'MedSecure!2026';

            // Receptionist or professional cannot create sub-users
            const profDenied = await req('/api/vitacore/professionals', {
                method: 'POST',
                cookie: cookies.profA,
                body: { professional: { nombre: 'X', email: newProfEmail, password: newProfPass } }
            });
            assert.equal(profDenied.status, 403, 'Sub-users must not create/modify team credentials');

            // Clinic A creates new professional
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
            assert.equal(createdProfRes.json.professional.password, undefined, 'POST response must never expose password');

            const listRes = await req('/api/vitacore/professionals', { cookie: cookies.clienteA });
            assert.equal(listRes.status, 200);
            const listed = listRes.json.professionals.find(p => p.email === newProfEmail);
            assert.ok(listed, 'New professional must appear in clinic list');
            assert.equal(listed.password, undefined, 'GET professionals must never expose password');

            const prismaProf = await prisma.user.findUnique({ where: { email: newProfEmail } });
            assert.ok(prismaProf && prismaProf.password.startsWith('$2'), 'Prisma stored password must be a bcrypt hash');

            const jsonUsers = JSON.parse(await fs.readFile(USERS_JSON_PATH, 'utf-8'));
            const jsonProf = jsonUsers.find(u => u.email === newProfEmail);
            assert.ok(jsonProf && jsonProf.password.startsWith('$2'), 'users.json stored password must be a bcrypt hash');

            // Verify login actually works with bcrypt hash via /api/auth/login
            const loginRes = await req('/api/auth/login', {
                method: 'POST',
                body: { email: newProfEmail, password: newProfPass }
            });
            assert.equal(loginRes.status, 200, 'Vitacore professional must be able to sign in with bcrypt credential');
            assert.equal(loginRes.json.user.role, 'vitacore-professional');
            console.log('PASS: Fase 1 Vitacore bcrypt credentials, Prisma sync & login verification');
        }

        console.log('\nALL FASE 0 & FASE 1 SECURITY TESTS PASSED (ZERO FAILURES).');
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
        // Clean up DB rows created by tests
        await prisma.appointment.deleteMany({ where: { userId: { in: Object.values(ids) } } }).catch(() => {});
        await prisma.patient.deleteMany({ where: { userId: { in: Object.values(ids) } } }).catch(() => {});
        await prisma.user.deleteMany({ where: { email: { startsWith: TEST_PREFIX } } }).catch(() => {});
        await prisma.user.deleteMany({ where: { id: { in: Object.values(ids) } } }).catch(() => {});
        // Restore users.json cleanly
        if (originalUsersJsonRaw !== null) {
            await fs.writeFile(USERS_JSON_PATH, originalUsersJsonRaw, 'utf-8').catch(() => {});
        }
        // Clean up temporary user folders/files
        for (const p of cleanupDirs) {
            await fs.rm(p, { recursive: true, force: true }).catch(() => {});
        }
        await prisma.$disconnect();
    }
}

runTests().catch(err => {
    console.error('\nSECURITY TEST FAILED:', err);
    process.exit(1);
});
