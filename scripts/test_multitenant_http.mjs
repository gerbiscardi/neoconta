import assert from 'node:assert/strict';
import { SignJWT } from 'jose';
import fs from 'node:fs';
import path from 'node:path';

// Load JWT_SECRET from .env if running from script runner
if (!process.env.JWT_SECRET) {
    try {
        const envPath = path.resolve(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
            const lines = fs.readFileSync(envPath, 'utf8').split('\n');
            for (const line of lines) {
                if (line.trim().startsWith('JWT_SECRET=')) {
                    const idx = line.indexOf('=');
                    process.env.JWT_SECRET = line.substring(idx + 1).trim().replace(/['"]/g, '');
                    break;
                }
            }
        }
    } catch {}
}

const JWT_SECRET = process.env.JWT_SECRET || 'test_suite_cryptographic_secret_key_minimum_32_chars_ok';
const BASE_URL = process.env.TEST_BASE_URL || 'https://neoconta.com.ar';

console.log('================================================================');
console.log('NEOCONTA — SUITE DE PRUEBAS AUTOMATIZADAS DE SEGURIDAD Y AISLAMIENTO');
console.log(`Objetivo: ${BASE_URL}`);
console.log('================================================================\n');

async function createToken(payload) {
    const secret = new TextEncoder().encode(JWT_SECRET);
    return new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(secret);
}

async function request(path, options = {}) {
    const url = `${BASE_URL}${path}`;
    const headers = {
        'User-Agent': 'NeoConta-Security-Audit/2.0',
        ...(options.headers || {})
    };
    const res = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
    });
    let data = null;
    try {
        data = await res.json();
    } catch {
        data = null;
    }
    return { status: res.status, headers: res.headers, data };
}

async function runTests() {
    let passed = 0;
    let failed = 0;

    async function test(name, fn) {
        process.stdout.write(`• ${name} ... `);
        try {
            await fn();
            console.log('✅ APROBADO');
            passed++;
        } catch (err) {
            console.log(`❌ FALLÓ: ${err.message}`);
            failed++;
        }
    }

    // Identidades sintéticas de prueba
    const tokenTenantA = await createToken({ id: 'tenant_alfa_test_01', email: 'alfa@test.neoconta', role: 'user' });
    const tokenTenantB = await createToken({ id: 'tenant_beta_test_02', email: 'beta@test.neoconta', role: 'user' });
    const tokenSubaccount = await createToken({ id: 'profesional_perez', email: 'perez@test.neoconta', role: 'vitacore-professional', parentId: 'tenant_alfa_test_01' });
    const tokenOwner = await createToken({ id: 'super_owner_admin', email: 'owner@test.neoconta', role: 'owner' });

    // Helper to build headers with Cookie and Bearer
    const authHeaders = (token) => ({
        'Cookie': `neoconta_session=${token}`,
        'Authorization': `Bearer ${token}`
    });

    // 1. Unauthenticated requests
    await test('Rechazo a solicitud anónima en API Arca Historial (401)', async () => {
        const res = await request('/api/arca/historial');
        assert.strictEqual(res.status, 401, 'Debe devolver 401 Unauthorized');
        assert.strictEqual(res.data?.error, 'No autenticado');
    });

    await test('Rechazo a solicitud anónima en API Predict Cashflow (401)', async () => {
        const res = await request('/api/predict/cashflow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { history: [{ ds: '2026-01-01', y: 100 }, { ds: '2026-02-01', y: 200 }], periods: 2 }
        });
        assert.strictEqual(res.status, 401, 'Debe devolver 401 Unauthorized');
        assert.strictEqual(res.data?.error, 'No autenticado');
    });

    await test('Rechazo a solicitud anónima en API Reconcile Match (401)', async () => {
        const res = await request('/api/reconcile/match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { movement: { amount: 100, date: '2026-01-01', description: 'test' }, invoices: [] }
        });
        assert.strictEqual(res.status, 401, 'Debe devolver 401 Unauthorized');
        assert.strictEqual(res.data?.error, 'No autenticado');
    });

    // 2. Multi-tenant isolation & IDOR
    await test('Aislamiento IDOR: Tenant A no puede acceder a historial de Tenant B (403)', async () => {
        const res = await request('/api/arca/historial?userId=tenant_beta_test_02', {
            headers: authHeaders(tokenTenantA)
        });
        assert.strictEqual(res.status, 403, 'Debe devolver 403 Forbidden ante acceso cruzado');
        assert.strictEqual(res.data?.error, 'Acceso no autorizado');
    });

    await test('Aislamiento IDOR: Tenant B no puede consultar banco de Tenant A (403)', async () => {
        const res = await request('/api/banco?userId=tenant_alfa_test_01', {
            headers: authHeaders(tokenTenantB)
        });
        assert.strictEqual(res.status, 403, 'Debe devolver 403 Forbidden');
        assert.strictEqual(res.data?.error, 'Acceso no autorizado');
    });

    await test('Aislamiento IDOR: Tenant A no puede modificar configuración de Tenant B (403)', async () => {
        const res = await request('/api/user/config?userId=tenant_beta_test_02', {
            headers: authHeaders(tokenTenantA)
        });
        assert.strictEqual(res.status, 403, 'Debe devolver 403 Forbidden');
        assert.strictEqual(res.data?.error, 'Acceso no autorizado');
    });

    // 3. Path Traversal Protection
    await test('Protección Directory Traversal en identificador de usuario (403)', async () => {
        const res = await request('/api/arca/historial?userId=../../etc/passwd', {
            headers: authHeaders(tokenTenantA)
        });
        assert.strictEqual(res.status, 403, 'Debe rechazar caracteres de traversal con 403');
    });

    // 4. Subaccount access scoping
    await test('Subcuenta autorizada accede a datos de empresa matriz (200/empty)', async () => {
        const res = await request('/api/arca/historial?userId=tenant_alfa_test_01', {
            headers: authHeaders(tokenSubaccount)
        });
        assert.strictEqual(res.status, 200, 'Subcuenta de Vitacore debe poder consultar a su tenant matriz');
    });

    await test('Subcuenta bloqueada ante intento de acceso a empresa tercera (403)', async () => {
        const res = await request('/api/arca/historial?userId=tenant_beta_test_02', {
            headers: authHeaders(tokenSubaccount)
        });
        assert.strictEqual(res.status, 403, 'Subcuenta no debe tener acceso a terceros');
    });

    // 5. Data Science Surface Hardening
    await test('Bloqueo perimetral Nginx a cálculo directo en /api-ds/api/predict/cashflow (404)', async () => {
        const res = await request('/api-ds/api/predict/cashflow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { history: [], periods: 2 }
        });
        assert.strictEqual(res.status, 404, 'Nginx debe rechazar llamadas externas con 404');
    });

    await test('Bloqueo perimetral Nginx a cálculo directo en /api-ds/api/reconcile/match (404)', async () => {
        const res = await request('/api-ds/api/reconcile/match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { movement: {}, invoices: [] }
        });
        assert.strictEqual(res.status, 404, 'Nginx debe rechazar llamadas externas con 404');
    });

    await test('Disponibilidad de diagnóstico perimetral en /api-ds/health (200)', async () => {
        const res = await request('/api-ds/health');
        assert.strictEqual(res.status, 200, 'Endpoint de salud debe responder 200');
        assert.strictEqual(res.data?.status, 'ok');
    });

    await test('Comunicación legítima autenticada a través del proxy Next.js /api/predict/cashflow (200)', async () => {
        const res = await request('/api/predict/cashflow', {
            method: 'POST',
            headers: {
                ...authHeaders(tokenTenantA),
                'Content-Type': 'application/json'
            },
            body: {
                history: [
                    { ds: '2026-05-01', y: 350000 },
                    { ds: '2026-06-01', y: 380000 },
                    { ds: '2026-07-01', y: 410000 }
                ],
                periods: 2,
                freq: 'MS'
            }
        });
        assert.strictEqual(res.status, 200, 'Debe devolver 200 OK para usuario autenticado');
        assert.strictEqual(res.data?.success, true);
        assert.ok(Array.isArray(res.data?.forecast), 'Debe devolver arreglo de proyecciones');
    });

    // 6. Cache-Control Header Enforcement
    await test('Cabecera Cache-Control en /dashboard redirecciona a login con private, no-store', async () => {
        const res = await fetch(`${BASE_URL}/dashboard`, {
            redirect: 'manual',
            headers: { 'User-Agent': 'NeoConta-Security-Audit/2.0' }
        });
        assert.strictEqual(res.status, 307, 'Debe responder 307 Temporary Redirect');
        const cc = res.headers.get('cache-control') || '';
        assert.match(cc, /private/, 'Debe contener directiva private');
        assert.match(cc, /no-store/, 'Debe contener directiva no-store');
    });

    await test('Cabecera Cache-Control en API protegida incluye private, no-store', async () => {
        const res = await request('/api/arca/historial');
        const cc = res.headers.get('cache-control') || '';
        assert.match(cc, /private/, 'Debe contener directiva private');
        assert.match(cc, /no-store/, 'Debe contener directiva no-store');
    });

    console.log('\n================================================================');
    console.log(`TOTAL PRUEBAS EJECUTADAS: ${passed + failed}`);
    console.log(`EXITOSAS: ${passed}`);
    console.log(`FALLIDAS: ${failed}`);
    console.log('================================================================');

    if (failed > 0) {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('ERROR FATAL EN SUITE DE PRUEBAS:', err);
    process.exit(1);
});
