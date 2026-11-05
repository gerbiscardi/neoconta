// scripts/test_live_http_permissions.mjs
// Suite de verificación HTTP real contra endpoints de Next.js para permisos y estado vigente
import prisma from '../lib/db.js';
import { SignJWT } from 'jose';
import fs from 'fs';
import path from 'path';

function getSecret() {
    let secret = process.env.JWT_SECRET;
    if (!secret) {
        try {
            const envContent = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
            for (const line of envContent.split('\n')) {
                if (line.startsWith('JWT_SECRET=')) {
                    secret = line.substring('JWT_SECRET='.length).trim();
                    break;
                }
            }
        } catch (e) {}
    }
    return secret;
}

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';

async function mintToken(payload, secretStr) {
    const secret = new TextEncoder().encode(secretStr);
    return new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('2h')
        .sign(secret);
}

async function runHttpPermissionSuite() {
    const secretStr = getSecret();
    if (!secretStr) {
        console.error('FATAL: JWT_SECRET no disponible para pruebas HTTP.');
        process.exit(1);
    }

    console.log(`=== INICIO DE PRUEBAS HTTP REALES DE AUTORIZACIÓN DINÁMICA ===`);
    console.log(`Servidor destino: ${BASE_URL}\n`);

    let passed = 0;
    let failed = 0;

    const assert = (desc, condition) => {
        if (condition) {
            console.log(`[PASS] ${desc}`);
            passed++;
        } else {
            console.error(`[FAIL] ${desc}`);
            failed++;
        }
    };

    const testUserId = 'usr_http_audit_live_01';
    const testAdminId = 'usr_http_audit_admin_01';

    try {
        // Setup: Crear usuario en base de datos
        await prisma.user.upsert({
            where: { email: 'http_test_user@neoconta.com' },
            update: { status: 'active', role: 'user', parentId: 'comp_alpha' },
            create: {
                id: testUserId,
                nombre: 'HTTP Test User',
                email: 'http_test_user@neoconta.com',
                password: '$2b$10$invaliddummypasswordhashhereforsecurity000000000',
                role: 'user',
                status: 'active',
                parentId: 'comp_alpha'
            }
        });

        // Crear usuario admin/owner de prueba
        await prisma.user.upsert({
            where: { email: 'http_test_admin@neoconta.com' },
            update: { status: 'active', role: 'owner', parentId: null },
            create: {
                id: testAdminId,
                nombre: 'HTTP Test Admin',
                email: 'http_test_admin@neoconta.com',
                password: '$2b$10$invaliddummypasswordhashhereforsecurity000000000',
                role: 'owner',
                status: 'active'
            }
        });

        // 1. Token válido para usuario activo -> Debe responder HTTP 200
        const tokenUser = await mintToken({
            id: testUserId,
            email: 'http_test_user@neoconta.com',
            role: 'user',
            parentId: 'comp_alpha'
        }, secretStr);

        const res1 = await fetch(`${BASE_URL}/api/user/config`, {
            headers: {
                'Cookie': `neoconta_session=${tokenUser}`
            }
        });
        assert('1. Usuario activo con JWT válido accede exitosamente (HTTP 200)', res1.status === 200);

        // 2. Desactivar usuario en BD -> Debe responder HTTP 401 a pesar de tener JWT firmado válido
        await prisma.user.update({
            where: { id: testUserId },
            data: { status: 'inactive' }
        });

        const res2 = await fetch(`${BASE_URL}/api/user/config`, {
            headers: {
                'Cookie': `neoconta_session=${tokenUser}`
            }
        });
        assert('2. Usuario desactivado en BD (status="inactive") es rechazado inmediatamente por HTTP (HTTP 401)', res2.status === 401);

        // 3. Reactivar y luego eliminar usuario de BD -> Debe responder HTTP 401
        await prisma.user.delete({
            where: { id: testUserId }
        });

        const res3 = await fetch(`${BASE_URL}/api/user/config`, {
            headers: {
                'Cookie': `neoconta_session=${tokenUser}`
            }
        });
        assert('3. Usuario eliminado de la BD pierde acceso inmediatamente por HTTP (HTTP 401)', res3.status === 401);

        // 4. Cambio de rol en tiempo real: Token afirma ser 'owner'
        const tokenAdmin = await mintToken({
            id: testAdminId,
            email: 'http_test_admin@neoconta.com',
            role: 'owner'
        }, secretStr);

        // Acceso como owner -> HTTP 200 en endpoint de administración
        const resAdmin1 = await fetch(`${BASE_URL}/api/admin/users?callerRole=owner`, {
            headers: {
                'Cookie': `neoconta_session=${tokenAdmin}`
            }
        });
        assert('4a. Usuario con rol "owner" en BD accede a endpoint administrativo (HTTP 200)', resAdmin1.status === 200);

        // Degradamos el rol en BD a 'user' sin modificar el JWT
        await prisma.user.update({
            where: { id: testAdminId },
            data: { role: 'user' }
        });

        // La misma solicitud HTTP con el token que decía 'owner' ahora debe ser rechazada con HTTP 403
        const resAdmin2 = await fetch(`${BASE_URL}/api/admin/users?callerRole=owner`, {
            headers: {
                'Cookie': `neoconta_session=${tokenAdmin}`
            }
        });
        assert('4b. Degradación de rol en BD ("owner" -> "user") revoca acceso administrativo en tiempo real (HTTP 403)', resAdmin2.status === 403);

        // 5. Verificación de vinculación multi-tenant en tiempo real
        await prisma.user.upsert({
            where: { email: 'http_tenant_user@neoconta.com' },
            update: { status: 'active', role: 'user', parentId: 'tenant_target_01' },
            create: {
                id: 'usr_tenant_test_01',
                nombre: 'Tenant User',
                email: 'http_tenant_user@neoconta.com',
                password: '$2b$10$invaliddummypasswordhashhereforsecurity000000000',
                role: 'user',
                status: 'active',
                parentId: 'tenant_target_01'
            }
        });

        const tokenTenant = await mintToken({
            id: 'usr_tenant_test_01',
            email: 'http_tenant_user@neoconta.com',
            role: 'user',
            parentId: 'tenant_target_01'
        }, secretStr);

        // Intento de acceso a recursos de otro tenant ('tenant_forbidden_99') -> HTTP 403
        const resTenant1 = await fetch(`${BASE_URL}/api/arca/historial?targetUserId=tenant_forbidden_99`, {
            headers: {
                'Cookie': `neoconta_session=${tokenTenant}`
            }
        });
        assert('5a. Intento de acceso IDOR a otro tenant bloqueado por HTTP (HTTP 403)', resTenant1.status === 403);

        // Intento de acceso a sus propios recursos -> HTTP 200
        const resTenant2 = await fetch(`${BASE_URL}/api/arca/historial?targetUserId=usr_tenant_test_01`, {
            headers: {
                'Cookie': `neoconta_session=${tokenTenant}`
            }
        });
        assert('5b. Acceso a recursos de su propio tenant permitido por HTTP (HTTP 200)', resTenant2.status === 200);

        // Limpieza
        await prisma.user.deleteMany({
            where: { email: { in: ['http_test_user@neoconta.com', 'http_test_admin@neoconta.com', 'http_tenant_user@neoconta.com'] } }
        });
        assert('6. Limpieza de usuarios sintéticos completada', true);

    } catch (err) {
        console.error('Error durante ejecución de la suite HTTP:', err);
        assert(`Excepción en suite HTTP: ${err.message}`, false);
    }

    console.log(`\n=== RESUMEN SUITE HTTP: ${passed} PASADOS, ${failed} FALLADOS ===`);
    if (failed > 0) process.exit(1);
}

runHttpPermissionSuite()
    .catch(err => {
        console.error('Error fatal:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
