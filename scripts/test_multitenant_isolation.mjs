import { canAccessUserData, sanitizeUserId } from '../lib/auth.js';

console.log('=== PRUEBAS CONTROLADAS DE SEPARACIÓN MULTI-TENANT (IDOR) ===');

// Caso 1: Usuario de Empresa A intentando acceder a Empresa A (Legítimo)
const sessionUserA = { id: 'empresa_alfa_101', role: 'user', email: 'alfa@empresa.com' };
const canAccessSelf = canAccessUserData(sessionUserA, 'empresa_alfa_101');
console.log('1. Empresa A -> Datos de Empresa A:', canAccessSelf ? 'PERMITIDO (Esperado)' : 'FALLO');

// Caso 2: Usuario de Empresa A intentando acceder a Empresa B (IDOR)
const canAccessUserB = canAccessUserData(sessionUserA, 'empresa_beta_202');
console.log('2. Empresa A -> Datos de Empresa B:', !canAccessUserB ? 'BLOQUEADO 403 (Esperado)' : 'VULNERABILIDAD');

// Caso 3: Usuario de Empresa B intentando acceder a Empresa A (IDOR)
const sessionUserB = { id: 'empresa_beta_202', role: 'user', email: 'beta@empresa.com' };
const canAccessUserAFromB = canAccessUserData(sessionUserB, 'empresa_alfa_101');
console.log('3. Empresa B -> Datos de Empresa A:', !canAccessUserAFromB ? 'BLOQUEADO 403 (Esperado)' : 'VULNERABILIDAD');

// Caso 4: Intento de Directory Traversal en identificador de usuario
const traversalId = sanitizeUserId('../../../etc/passwd');
console.log('4. Sanitización Traversal (../../../etc/passwd):', traversalId === null ? 'RECHAZADO NULL (Esperado)' : 'FALLO');

const traversalId2 = sanitizeUserId('empresa_alfa/subcuenta');
console.log('5. Sanitización Caracteres Especiales (slash):', traversalId2 === null ? 'RECHAZADO NULL (Esperado)' : 'FALLO');

// Caso 5: Subcuenta Vitacore legítima perteneciente al Tenant Padre
const subaccount = { id: 'profesional_dr_perez', role: 'vitacore-professional', parentId: 'empresa_alfa_101' };
const canSubAccessParent = canAccessUserData(subaccount, 'empresa_alfa_101');
console.log('6. Subcuenta legítima -> Datos de Tenant Padre:', canSubAccessParent ? 'PERMITIDO (Esperado)' : 'FALLO');

// Caso 6: Subcuenta Vitacore intentando acceder a OTRA empresa ajena
const canSubAccessOther = canAccessUserData(subaccount, 'empresa_beta_202');
console.log('7. Subcuenta legítima -> Datos de Empresa Ajena:', !canSubAccessOther ? 'BLOQUEADO 403 (Esperado)' : 'VULNERABILIDAD');

// Caso 7: Rol Owner (superadministrador de la plataforma)
const sessionOwner = { id: 'super_admin', role: 'owner' };
const canOwnerAccess = canAccessUserData(sessionOwner, 'empresa_alfa_101');
console.log('8. Rol Owner -> Soporte y Auditoría:', canOwnerAccess ? 'PERMITIDO (Esperado)' : 'FALLO');
