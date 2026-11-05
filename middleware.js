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
            const redirectResponse = NextResponse.redirect(loginUrl);
            redirectResponse.headers.set('Cache-Control', 'private, no-cache, no-store, max-age=0, must-revalidate');
            redirectResponse.headers.set('Pragma', 'no-cache');
            redirectResponse.headers.set('Expires', '0');
            return redirectResponse;
        }

        try {
            const secret = new TextEncoder().encode(JWT_SECRET);
            await jwtVerify(sessionToken, secret);
        } catch (err) {
            console.warn('Invalid or expired session token:', err.message);
            const loginUrl = new URL('/login', request.url);
            const response = NextResponse.redirect(loginUrl);
            response.cookies.delete('neoconta_session');
            response.headers.set('Cache-Control', 'private, no-cache, no-store, max-age=0, must-revalidate');
            response.headers.set('Pragma', 'no-cache');
            response.headers.set('Expires', '0');
            return response;
        }
    }

    const response = NextResponse.next();

    // Security Headers (Hardening)
    response.headers.set('X-Frame-Options', 'SAMEORIGIN');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    if (process.env.NODE_ENV === 'production') {
        response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    // Cache-Control hardening for private / sensitive routes (Dashboard and APIs)
    const isPrivate = pathname.startsWith('/dashboard') || 
                      pathname.startsWith('/api/') || 
                      pathname === '/login' || 
                      pathname === '/register';

    if (isPrivate) {
        response.headers.set('Cache-Control', 'private, no-cache, no-store, max-age=0, must-revalidate');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');
    }

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - assets (public assets)
         */
        '/((?!_next/static|_next/image|favicon.ico|assets).*)',
    ],
};
