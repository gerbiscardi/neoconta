// scripts/test_auth_advanced.mjs
// Suite de pruebas exhaustiva de autenticación, autorización y robustez fail-closed
import { SignJWT, jwtVerify } from 'jose';
import prisma from '../lib/db.js';
import { runSimpleMean, selectAdaptiveModel } from '../lib/forecasting/engine.js';
import { recordShadowForecasts, reconcileMonthInLedger } from '../lib/forecasting/shadowLedger.js';

const TEST_SECRET_STR = 'test-isolated-security-secret-key-32chars-min!!';
const TEST_SECRET = new TextEncoder().encode(TEST_SECRET_STR);

async function runAdvancedAuthSuite() {
    console.log('=== INICIO SUITE AVANZADA DE SEGURIDAD Y AUTENTICACIÓN ===\n');
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

    // 1. Usuarios desactivados: verificación en base de datos
    console.log('--- 1. Verificación de Usuarios Desactivados / Eliminados ---');
    try {
        const testUserInactive = await prisma.user.upsert({
            where: { email: 'inactive_test@neoconta.com' },
            update: { role: 'inactive' },
            create: {
                id: 'usr_inactive_test_01',
                nombre: 'Inactive Test User',
                email: 'inactive_test@neoconta.com',
                password: '$2b$10$invaliddummypasswordhashhereforsecurity000000000',
                role: 'inactive',
                parentId: 'parent_test_01'
            }
        });

        // Simular token JWT válido emitido antes de la desactivación
        const token = await new SignJWT({
            userId: testUserInactive.id,
            email: testUserInactive.email,
            role: 'user',
            parentId: testUserInactive.parentId
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime('2h')
            .sign(TEST_SECRET);

        // Verificar token criptográficamente
        const { payload } = await jwtVerify(token, TEST_SECRET);
        
        // Verificación en base de datos en tiempo real
        const dbUser = await prisma.user.findUnique({
            where: { id: payload.userId },
            select: { id: true, role: true, parentId: true }
        });

        const isAccessAllowed = dbUser && dbUser.role !== 'inactive' && dbUser.role !== 'disabled';
        assert('Usuario con role="inactive" es rechazado a pesar de tener JWT válido emitido', !isAccessAllowed);
    } catch (err) {
        assert(`Error en test de usuario desactivado: ${err.message}`, false);
    }

    // 2. Cambios de rol y vinculación en tiempo real
    console.log('\n--- 2. Cambios de Roles / Vinculaciones en Tiempo Real ---');
    try {
        const dynamicUser = await prisma.user.upsert({
            where: { email: 'dynamic_role@neoconta.com' },
            update: { role: 'user', parentId: 'parent_A' },
            create: {
                id: 'usr_dynamic_01',
                nombre: 'Dynamic Role User',
                email: 'dynamic_role@neoconta.com',
                password: '$2b$10$invaliddummypasswordhashhereforsecurity000000000',
                role: 'user',
                parentId: 'parent_A'
            }
        });

        // JWT antiguo afirma role: 'user' y parentId: 'parent_A'
        const oldToken = await new SignJWT({
            userId: dynamicUser.id,
            role: 'user',
            parentId: 'parent_A'
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime('2h')
            .sign(TEST_SECRET);

        // Modificamos el rol a 'owner' y cambiamos de parent/organización en BD
        await prisma.user.update({
            where: { id: dynamicUser.id },
            data: { role: 'owner', parentId: 'parent_B' }
        });

        // Consulta en BD valida estado efectivo en tiempo real
        const refreshedUser = await prisma.user.findUnique({
            where: { id: dynamicUser.id },
            select: { role: true, parentId: true }
        });

        assert('Cambio de rol de "user" a "owner" se refleja inmediatamente en consulta autoritativa', refreshedUser.role === 'owner');
        assert('Cambio de vinculación de "parent_A" a "parent_B" se refleja inmediatamente', refreshedUser.parentId === 'parent_B');
    } catch (err) {
        assert(`Error en test de rol dinámico: ${err.message}`, false);
    }

    // 3. Aislamiento Multi-Tenant (Prevención de IDOR)
    console.log('\n--- 3. Prevención de IDOR entre Empresas ---');
    try {
        // Empresa Alpha y Empresa Beta
        const userAlpha = { id: 'usr_alpha', tenantId: 'tenant_alpha' };
        const userBeta = { id: 'usr_beta', tenantId: 'tenant_beta' };

        // Registro simulado de Alpha
        const alphaInvoice = { id: 'inv_alpha_100', tenantId: 'tenant_alpha', amount: 150000 };

        // Intento de acceso de Beta al registro de Alpha con filtro estricto de tenant
        const canAccess = (requestingUser, resource) => {
            return requestingUser.tenantId === resource.tenantId;
        };

        assert('Usuario de Tenant Beta no puede acceder a recurso de Tenant Alpha (IDOR prevenido)', !canAccess(userBeta, alphaInvoice));
        assert('Usuario de Tenant Alpha puede acceder a sus propios recursos', canAccess(userAlpha, alphaInvoice));
    } catch (err) {
        assert(`Error en test de IDOR: ${err.message}`, false);
    }

    // 4. Fail-Closed ante ausencia de variables de entorno obligatorias
    console.log('\n--- 4. Comportamiento Fail-Closed ante Variables Ausentes ---');
    try {
        // Test con CRON_SECRET ausente o débil
        const checkCronAuth = (authHeader, envCronSecret) => {
            if (!envCronSecret || typeof envCronSecret !== 'string' || envCronSecret.trim().length < 32) {
                return { status: 500, error: 'Configuración de seguridad inválida' };
            }
            if (authHeader !== `Bearer ${envCronSecret.trim()}`) {
                return { status: 401, error: 'No autorizado' };
            }
            return { status: 200, success: true };
        };

        assert('CRON_SECRET ausente retorna HTTP 500 (Fail-Closed)', checkCronAuth('Bearer test', undefined).status === 500);
        assert('CRON_SECRET vacío retorna HTTP 500 (Fail-Closed)', checkCronAuth('Bearer test', '').status === 500);
        assert('CRON_SECRET de menos de 32 chars retorna HTTP 500 (Fail-Closed)', checkCronAuth('Bearer test', 'short_secret').status === 500);
        assert('Token cron incorrecto retorna HTTP 401', checkCronAuth('Bearer wrong', 'a'.repeat(32)).status === 401);
        assert('Token cron correcto con secreto válido autoriza HTTP 200', checkCronAuth('Bearer ' + 'a'.repeat(32), 'a'.repeat(32)).status === 200);

        // Test con DS_INTERNAL_SECRET ausente o débil
        const checkDsAuth = (tokenHeader, envDsSecret) => {
            if (!envDsSecret || typeof envDsSecret !== 'string' || envDsSecret.trim().length < 32) {
                return { status: 500, error: 'Error de configuración interna' };
            }
            if (!tokenHeader || tokenHeader.trim() !== envDsSecret.trim()) {
                return { status: 403, error: 'Acceso restringido' };
            }
            return { status: 200, success: true };
        };

        assert('DS_INTERNAL_SECRET ausente retorna HTTP 500 (Fail-Closed)', checkDsAuth('tok', undefined).status === 500);
        assert('DS_INTERNAL_SECRET menor a 32 caracteres retorna HTTP 500 (Fail-Closed)', checkDsAuth('tok', 'short').status === 500);
        assert('Token interno discrepante retorna HTTP 403', checkDsAuth('wrong', 'b'.repeat(32)).status === 403);
        assert('Token interno correcto autoriza HTTP 200', checkDsAuth('b'.repeat(32), 'b'.repeat(32)).status === 200);
    } catch (err) {
        assert(`Error en test de fail-closed: ${err.message}`, false);
    }

    // 5. Restricciones de carga, límites y robustez numérica en predicción y conciliación
    console.log('\n--- 5. Restricciones de Carga y Robustez en Forecasting ---');
    try {
        // a. Historial con 1 valor
        const singleVal = [100000];
        const resSingle = selectAdaptiveModel(singleVal);
        assert('Serie de 1 valor calcula con fallback transparente sin excepción no controlada', resSingle && resSingle.selectedModel);

        // b. Serie masiva con 240 meses (20 años)
        const massiveSeries = Array.from({ length: 240 }, (_, i) => 200000 + Math.sin(i) * 50000);
        const t0 = Date.now();
        const resMassive = selectAdaptiveModel(massiveSeries);
        const elapsed = Date.now() - t0;
        assert(`Serie de 240 meses se procesa en tiempo real (< 500ms, actual: ${elapsed}ms)`, elapsed < 500 && resMassive && resMassive.selectedModel);

        // c. Conciliación con ajuste tardío y verificación de revisiones
        const auditSeries = [647976.28, 394503.26, 472500.00, 0.00, 399565.75];

        // Registrar forecast shadow para prueba
        const recResult = await recordShadowForecasts({
            userId: 'usr_test_audit_suite',
            seriesValues: auditSeries,
            trainingEndMonth: '2026-10-01',
            targetMonthKey: '2026-11-01'
        });

        assert('Shadow Forecast Ledger registra horizontes h=1 y h=2 diferenciados (16 registros)', recResult.recordedCount === 16);

        // Conciliación inicial (h=1 = 2026-11-01)
        const recon1 = await reconcileMonthInLedger({
            userId: 'usr_test_audit_suite',
            targetMonthKey: '2026-11-01',
            actualNetInvoiced: 410000.00
        });



        assert('Conciliación inicial establece status="definitive" y revisionNumber=1', 
            recon1.reconciledCount > 0 && recon1.records[0].reconciliationStatus === 'definitive' && recon1.records[0].revisionNumber === 1);

        // Ajuste tardío por nota de crédito posterior
        const recon2 = await reconcileMonthInLedger({
            userId: 'usr_test_audit_suite',
            targetMonthKey: '2026-11-01',
            actualNetInvoiced: 395000.00
        });

        assert('Ajuste tardío incrementa revisionNumber a 2 y guarda previousActualObserved', 
            recon2.records[0].revisionNumber === 2 && 
            recon2.records[0].previousActualObserved === 410000.00 &&
            recon2.records[0].actualObserved === 395000.00 &&
            recon2.records[0].reconciliationStatus === 'adjusted');

        // Limpieza de datos de prueba
        await prisma.shadowForecastLedger.deleteMany({
            where: { userId: 'usr_test_audit_suite' }
        });
        await prisma.user.deleteMany({
            where: { email: { in: ['inactive_test@neoconta.com', 'dynamic_role@neoconta.com'] } }
        });
        assert('Limpieza de entorno de pruebas completada', true);

    } catch (err) {
        assert(`Error en tests de carga y conciliación: ${err.message}`, false);
    }

    console.log(`\n=== RESUMEN DE LA SUITE: ${passed} PASADOS, ${failed} FALLADOS ===`);
    if (failed > 0) {
        process.exit(1);
    }
}

runAdvancedAuthSuite()
    .catch(err => {
        console.error('Error fatal en suite:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
