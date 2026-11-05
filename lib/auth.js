import { jwtVerify } from 'jose';
import prisma from './db.js';

/**
 * Retrieves the cryptographic JWT secret from the environment.
 * Fails safely and immediately if missing or insufficiently secure.
 */
export function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret || typeof secret !== 'string' || secret.trim().length < 32) {
        throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable is missing, empty, or insufficiently secure (minimum 32 characters required).');
    }
    return secret.trim();
}

export const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Extracts, cryptographically verifies, and authoritatively validates
 * the authenticated user session against the database.
 * 
 * Inmunidad ante Tokens obsoletos:
 * 1. Verifica la firma criptográfica del JWT.
 * 2. Consulta en tiempo real el registro autoritativo del usuario en Prisma.
 * 3. Si el usuario fue eliminado, o si su status es inactivo/desactivado,
 *    o si su rol fue revocado/degradado, el acceso se deniega inmediatamente (fail-closed).
 * 4. Devuelve el rol y vinculación empresarial (parentId) vigentes en la base de datos.
 * 
 * @param {Request} request
 * @returns {Promise<{id: string, userId: string, email: string, nombre: string, role: string, parentId?: string, status: string} | null>}
 */
export async function getServerSession(request) {
    try {
        let token = null;

        // 1. Try reading from NextRequest cookies object
        if (request?.cookies?.get) {
            token = request.cookies.get('neoconta_session')?.value;
        }

        // 2. Try parsing Cookie header string
        if (!token && request?.headers?.get) {
            const cookieHeader = request.headers.get('cookie') || '';
            const match = cookieHeader.match(/(?:^|;\s*)neoconta_session=([^;]+)/);
            if (match) {
                token = decodeURIComponent(match[1]);
            }
        }

        // 3. Try reading from Authorization: Bearer <token>
        if (!token && request?.headers?.get) {
            const authHeader = request.headers.get('authorization') || '';
            if (authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7).trim();
            }
        }

        if (!token) {
            return null;
        }

        const secretStr = getJwtSecret();
        const secret = new TextEncoder().encode(secretStr);
        const { payload } = await jwtVerify(token, secret);
        if (!payload) return null;

        const userId = payload.id || payload.userId || payload.sub;
        if (!userId) return null;

        // Verificación autoritativa en la base de datos en tiempo real
        const dbUser = await prisma.user.findUnique({
            where: { id: String(userId) },
            select: {
                id: true,
                nombre: true,
                email: true,
                role: true,
                parentId: true,
                status: true
            }
        });

        // Fail-closed: El usuario fue eliminado de la base de datos
        if (!dbUser) {
            return null;
        }

        // Fail-closed: El usuario fue desactivado o suspendido
        if (dbUser.status && dbUser.status !== 'active') {
            return null;
        }
        if (dbUser.role === 'inactive' || dbUser.role === 'disabled') {
            return null;
        }

        // Sesión autoritativa con permisos y roles vigentes en tiempo real
        return {
            ...payload,
            id: dbUser.id,
            userId: dbUser.id,
            nombre: dbUser.nombre,
            email: dbUser.email,
            role: dbUser.role, // Rol vigente en base de datos
            parentId: dbUser.parentId, // Vinculación vigente en base de datos
            status: dbUser.status || 'active'
        };
    } catch (err) {
        console.error('SERVER_SESSION_ERROR:', err.message);
        return null;
    }
}

/**
 * Validates that an authenticated session has permission to access or modify data for targetUserId.
 * - Verifica que el usuario de la sesión se encuentre activo.
 * - 'owner' role has universal access.
 * - Regular users can access their own data (session.id === targetUserId).
 * - Sub-accounts can access their parent's account data.
 */
export function canAccessUserData(session, targetUserId) {
    if (!session || !targetUserId) return false;
    if (session.status && session.status !== 'active') return false;
    if (session.role === 'inactive' || session.role === 'disabled') return false;
    if (session.role === 'owner') return true;
    if (session.id === targetUserId || session.userId === targetUserId) return true;
    if (session.parentId && session.parentId === targetUserId) return true;
    return false;
}

/**
 * Sanitizes a userId to prevent Directory Traversal attacks.
 * Rejects paths with "..", "/", or illegal characters.
 */
export function sanitizeUserId(userId) {
    if (!userId || typeof userId !== 'string') return null;
    const clean = userId.trim();
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(clean)) return null;
    if (clean.includes('..')) return null;
    return clean;
}

/**
 * Generates a salted bcrypt hash for a plaintext password.
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function hashPassword(password) {
    const bcrypt = await import('bcryptjs');
    return bcrypt.default.hash(password, 10);
}

/**
 * Verifies a plaintext password against a stored password.
 * Supports both bcrypt hashes ($2a$, $2b$, $2y$) and legacy plaintext passwords for transparent migration.
 * @param {string} plainPassword
 * @param {string} storedPassword
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(plainPassword, storedPassword) {
    if (!plainPassword || !storedPassword) return false;
    
    // Check if storedPassword is a bcrypt hash ($2a$, $2b$, $2y$)
    if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2y$')) {
        const bcrypt = await import('bcryptjs');
        return bcrypt.default.compare(plainPassword, storedPassword);
    }

    // Fail closed: Plaintext passwords are not supported for security
    return false;
}
