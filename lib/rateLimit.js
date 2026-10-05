/**
 * Extracts client IP from request headers or connection.
 * @param {Request} request
 * @returns {string}
 */
export function getClientIp(request) {
    if (!request) return '127.0.0.1';

    try {
        const forwardedFor = request.headers.get('x-forwarded-for');
        if (forwardedFor) {
            const ip = forwardedFor.split(',')[0].trim();
            if (ip) return ip;
        }

        const realIp = request.headers.get('x-real-ip');
        if (realIp) return realIp.trim();

        const cfIp = request.headers.get('cf-connecting-ip');
        if (cfIp) return cfIp.trim();

        if (request.ip) return request.ip;
    } catch {
        // fallback
    }

    return '127.0.0.1';
}

/**
 * In-memory sliding window / fixed window counter rate limiter.
 */
export class RateLimiter {
    constructor({ windowMs, maxRequests, name = 'default' }) {
        this.windowMs = windowMs;
        this.maxRequests = maxRequests;
        this.name = name;
        this.hits = new Map();

        if (typeof setInterval !== 'undefined') {
            const cleanupInterval = Math.max(windowMs, 60000);
            const timer = setInterval(() => this.cleanup(), cleanupInterval);
            if (timer && typeof timer.unref === 'function') {
                timer.unref();
            }
        }
    }

    check(key) {
        const now = Date.now();
        const record = this.hits.get(key);

        if (!record || now > record.resetTime) {
            const resetTime = now + this.windowMs;
            this.hits.set(key, { count: 1, resetTime });
            return {
                allowed: true,
                current: 1,
                remaining: this.maxRequests - 1,
                resetTime,
                retryAfter: 0
            };
        }

        if (record.count >= this.maxRequests) {
            const retryAfter = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
            return {
                allowed: false,
                current: record.count,
                remaining: 0,
                resetTime: record.resetTime,
                retryAfter
            };
        }

        record.count++;
        return {
            allowed: true,
            current: record.count,
            remaining: this.maxRequests - record.count,
            resetTime: record.resetTime,
            retryAfter: 0
        };
    }

    reset(key) {
        this.hits.delete(key);
    }

    cleanup() {
        const now = Date.now();
        for (const [key, record] of this.hits.entries()) {
            if (now > record.resetTime) {
                this.hits.delete(key);
            }
        }
    }
}

/**
 * Returns a standard JSON 429 Too Many Requests response with standard rate limit headers.
 * @param {object} limitResult
 * @param {string} [customMessage]
 * @returns {Response}
 */
export function rateLimitResponse(limitResult, customMessage) {
    const { retryAfter, resetTime } = limitResult;
    const body = {
        error: "Demasiadas solicitudes.",
        details: customMessage || `Ha superado el límite de intentos permitido. Por favor intente nuevamente en ${retryAfter} segundos.`,
        retryAfter
    };

    const init = {
        status: 429,
        headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Reset': String(Math.ceil(resetTime / 1000)),
            'Content-Type': 'application/json'
        }
    };

    if (typeof Response !== 'undefined' && typeof Response.json === 'function') {
        return Response.json(body, init);
    }
    return new Response(JSON.stringify(body), init);
}

// Pre-configured rate limiters
// 1. Login: Max 5 failed attempts per 15 minutes per IP + account
export const loginLimiter = new RateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
    name: 'login'
});

// 2. Registro: Max 5 registrations per hour per IP
export const registerLimiter = new RateLimiter({
    windowMs: 60 * 60 * 1000,
    maxRequests: 5,
    name: 'register'
});

// 3. Contact Form: Max 5 messages per 10 minutes per IP
export const contactLimiter = new RateLimiter({
    windowMs: 10 * 60 * 1000,
    maxRequests: 5,
    name: 'contact'
});

// 4. ARCA CUIT Lookup: Max 30 requests per minute per IP
export const arcaQueryLimiter = new RateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 30,
    name: 'arcaQuery'
});

// 5. Appointments Confirm / Cancel: Max 15 requests per 10 minutes per IP
export const appointmentsConfirmLimiter = new RateLimiter({
    windowMs: 10 * 60 * 1000,
    maxRequests: 15,
    name: 'appointmentsConfirm'
});

// 6. Prescriptions Validate: Max 30 requests per 10 minutes per IP
export const prescriptionsValidateLimiter = new RateLimiter({
    windowMs: 10 * 60 * 1000,
    maxRequests: 30,
    name: 'prescriptionsValidate'
});
