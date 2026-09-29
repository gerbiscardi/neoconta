import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'neoconta_super_secret_jwt_key_2026_pro';

export async function middleware(request) {
    const { pathname } = request.nextUrl;

    // Protect all /dashboard routes
    if (pathname.startsWith('/dashboard')) {
        const sessionToken = request.cookies.get('neoconta_session')?.value;

        if (!sessionToken) {
            const loginUrl = new URL('/login', request.url);
            return NextResponse.redirect(loginUrl);
        }

        try {
            const secret = new TextEncoder().encode(JWT_SECRET);
            await jwtVerify(sessionToken, secret);
            return NextResponse.next();
        } catch (err) {
            console.warn('Invalid or expired session token:', err.message);
            const loginUrl = new URL('/login', request.url);
            const response = NextResponse.redirect(loginUrl);
            response.cookies.delete('neoconta_session');
            return response;
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/dashboard/:path*'],
};
