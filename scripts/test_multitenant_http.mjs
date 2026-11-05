import assert from 'node:assert/strict';
import { SignJWT } from 'jose';

// Read or default JWT_SECRET for test environment
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
            headers: { 'Authorization': `Bearer ${tokenTenantA}` }
        });
        assert.strictEqual(res.status, 403, 'Debe devolver 403 Forbidden ante acceso cruzado');
        assert.strictEqual(res.data?.error, 'Acceso no autorizado');
    });

    await test('Aislamiento IDOR: Tenant B no puede consultar banco de Tenant A (403)', async () => {
        const res = await request('/api/banco?userId=tenant_alfa_test_01', {
            headers: { 'Authorization': `Bearer ${tokenTenantB}` }
        });
        assert.strictEqual(res.status, 403, 'Debe devolver 403 Forbidden');
        assert.strictEqual(res.data?.error, 'Acceso no autorizado');
    });

    await test('Aislamiento IDOR: Tenant A no puede modificar configuración de Tenant B (403)', async () => {
        const res = await request('/api/user/config?userId=tenant_beta_test_02', {
            headers: { 'Authorization': `Bearer ${tokenTenantA}` }
        });
        assert.strictEqual(res.status, 403, 'Debe devolver 403 Forbidden');
        assert.strictEqual(res.data?.error, 'Acceso no autorizado');
    });

    // 3. Path Traversal Protection
    await test('Protección Directory Traversal en identificador de usuario (403)', async () => {
        const res = await request('/api/arca/historial?userId=../../etc/passwd', {
            headers: { 'Authorization': `Bearer ${tokenTenantA}` }
        });
        assert.strictEqual(res.status, 403, 'Debe rechazar caracteres de traversal con 403');
    });

    // 4. Subaccount access scoping
    await test('Subcuenta autorizada accede a datos de empresa matriz (200/empty)', async () => {
        const res = await request('/api/arca/historial?userId=tenant_alfa_test_01', {
            headers: { 'Authorization': `Bearer ${tokenSubaccount}` }
        });
        assert.strictEqual(res.status, 200, 'Subcuenta de Vitacore debe poder consultar a su tenant matriz');
    });

    await test('Subcuenta bloqueada ante intento de acceso a empresa tercera (403)', async () => {
        const res = await request('/api/arca/historial?userId=tenant_beta_test_02', {
            headers: { 'Authorization': `Bearer ${tokenSubaccount}` }
        });
        assert.strictEqual(res.status, 403, 'Subcuenta no debe tener acceso a terceros');
    });

    // 5. Cache-Control Header Enforcement
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
