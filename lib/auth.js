import { jwtVerify } from 'jose';

export const JWT_SECRET = process.env.JWT_SECRET || 'neoconta_super_secret_jwt_key_2026_pro';

/**
 * Extracts and verifies the authenticated user session from a Request.
 * Supports cookies (neoconta_session) and Authorization header (Bearer token).
 * @param {Request} request
 * @returns {Promise<{id: string, email: string, role: string, parentId?: string} | null>}
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

        const secret = new TextEncoder().encode(JWT_SECRET);
        const { payload } = await jwtVerify(token, secret);
        return payload;
    } catch (err) {
        return null;
    }
}

/**
 * Validates that an authenticated session has permission to access or modify data for targetUserId.
 * - 'owner' role has universal access.
 * - Regular users can access their own data (session.id === targetUserId).
 * - Vitacore sub-accounts (professionals/receptionists) can access their parent's account data.
 */
export function canAccessUserData(session, targetUserId) {
    if (!session || !targetUserId) return false;
    if (session.role === 'owner') return true;
    if (session.id === targetUserId) return true;
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
    
    // Check if storedPassword is a bcrypt hash
    if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2y$')) {
        const bcrypt = await import('bcryptjs');
        return bcrypt.default.compare(plainPassword, storedPassword);
    }

    // Graceful fallback for legacy plaintext passwords
    return plainPassword === storedPassword;
}
