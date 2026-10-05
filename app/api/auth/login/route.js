import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import jwt from 'jsonwebtoken';
import { verifyPassword, hashPassword, JWT_SECRET } from '@/lib/auth';
import { getClientIp, loginLimiter, rateLimitResponse } from '@/lib/rateLimit';

export async function POST(request) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json({ error: "Faltan datos (email, contraseña)" }, { status: 400 });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const ip = getClientIp(request);
        const rateLimitKey = `${ip}:${normalizedEmail}`;

        // Verify Rate Limit (Brute Force Protection)
        const limitCheck = loginLimiter.check(rateLimitKey);
        if (!limitCheck.allowed) {
            return rateLimitResponse(limitCheck, "Demasiados intentos fallidos de inicio de sesión. Por motivos de seguridad, espere unos minutos antes de intentar nuevamente.");
        }

        const user = await prisma.user.findFirst({
            where: { email: normalizedEmail }
        });

        if (!user) {
            return NextResponse.json({ error: "Correo electrónico o contraseña incorrectos." }, { status: 401 });
        }

        const isMatch = await verifyPassword(password, user.password);
        if (!isMatch) {
            return NextResponse.json({ error: "Correo electrónico o contraseña incorrectos." }, { status: 401 });
        }

        // Reset rate limit counter upon successful authentication
        loginLimiter.reset(rateLimitKey);

        // Automatic transparent migration: upgrade legacy plaintext password to salted bcrypt hash
        if (!user.password.startsWith('$2')) {
            try {
                const newHash = await hashPassword(password);
                await prisma.user.update({
                    where: { id: user.id },
                    data: { password: newHash }
                });
            } catch (hashErr) {
                console.error("Error auto-upgrading user password to bcrypt:", hashErr);
            }
        }

        // Return user info excluding password
        const { password: _, ...userInfo } = user;
        userInfo.mustChangePassword = user.mustChangePassword === true;

        // Generate JWT Token
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, parentId: user.parentId },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        const response = NextResponse.json({ success: true, user: userInfo });

        // Set HttpOnly Cookie
        response.cookies.set('neoconta_session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7 // 7 days
        });

        return response;

    } catch (error) {
        console.error("Error in login API:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
