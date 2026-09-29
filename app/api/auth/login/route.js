import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'neoconta_super_secret_jwt_key_2026_pro';

export async function POST(request) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json({ error: "Faltan datos (email, contraseña)" }, { status: 400 });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const user = await prisma.user.findFirst({
            where: {
                email: normalizedEmail,
                password: password
            }
        });

        if (!user) {
            return NextResponse.json({ error: "Correo electrónico o contraseña incorrectos." }, { status: 401 });
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
