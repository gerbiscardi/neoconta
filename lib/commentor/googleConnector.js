/**
 * NeoConta - Google Business Profile OAuth & Data Connector
 * Handles real Google Business Profile authentication, account listing,
 * multi-location discovery, and full/incremental reviews retrieval.
 */

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';
const GBP_ACCOUNTS_ENDPOINT = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts';
const GBP_LOCATIONS_ENDPOINT = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const GBP_REVIEWS_ENDPOINT = 'https://mybusiness.googleapis.com/v4';

/**
 * Maps Google's star rating enum to numeric stars (1-5).
 * @param {string|number} starRating
 * @returns {number}
 */
export function mapGoogleStarRating(starRating) {
    if (typeof starRating === 'number') {
        return Math.max(1, Math.min(5, Math.round(starRating)));
    }
    const normalized = String(starRating || '').trim().toUpperCase();
    switch (normalized) {
        case 'FIVE':
            return 5;
        case 'FOUR':
            return 4;
        case 'THREE':
            return 3;
        case 'TWO':
            return 2;
        case 'ONE':
            return 1;
        default: {
            const parsed = parseInt(normalized, 10);
            return Number.isFinite(parsed) && parsed >= 1 && parsed <= 5 ? parsed : 0;
        }
    }
}

/**
 * Renews an expired access token using Google's OAuth2 refresh token grant.
 * @param {string} refreshToken
 * @returns {Promise<{ accessToken: string, expiresIn: number }>}
 */
export async function refreshGoogleAccessToken(refreshToken) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error('Credenciales OAuth de Google (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) no configuradas.');
    }
    if (!refreshToken || typeof refreshToken !== 'string' || refreshToken.startsWith('mock_')) {
        throw new Error('Refresh token de Google no proporcionado o inválido.');
    }

    const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            refresh_token: refreshToken,
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'refresh_token'
        })
    });

    const data = await response.json();
    if (!response.ok || !data.access_token) {
        const errorDesc = data.error_description || data.error || 'Error al renovar token de Google';
        const isRevokedOrExpired = data.error === 'invalid_grant';
        const err = new Error(errorDesc);
        err.code = isRevokedOrExpired ? 'TOKEN_EXPIRED' : 'AUTH_ERROR';
        err.status = response.status;
        throw err;
    }

    return {
        accessToken: data.access_token,
        expiresIn: data.expires_in || 3600
    };
}

/**
 * Revokes a Google token at Google's revocation endpoint.
 * @param {string} token
 */
export async function revokeGoogleToken(token) {
    if (!token || typeof token !== 'string') return;
    try {
        await fetch(`${GOOGLE_REVOKE_ENDPOINT}?token=${encodeURIComponent(token)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
    } catch (e) {
        // Best effort revocation
    }
}

/**
 * Lists authorized Google Business Profile accounts.
 * @param {string} accessToken
 * @returns {Promise<Array<{ id: string, name: string, type: string, role?: string }>>}
 */
export async function listGoogleAccounts(accessToken) {
    if (!accessToken) throw new Error('Token de acceso requerido');

    const res = await fetch(GBP_ACCOUNTS_ENDPOINT, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await res.json();

    if (!res.ok) {
        const err = new Error(data.error?.message || 'Error al listar cuentas de Google Business');
        err.status = res.status;
        err.code = res.status === 401 ? 'TOKEN_EXPIRED' : (res.status === 403 ? 'PERMISSION_DENIED' : 'API_ERROR');
        throw err;
    }

    const accounts = Array.isArray(data.accounts) ? data.accounts : [];
    return accounts.map(a => ({
        id: a.name, // Format: "accounts/123456789"
        name: a.accountName || a.name,
        type: a.type || 'PERSONAL',
        role: a.role || 'OWNER'
    }));
}

/**
 * Lists locations belonging to a specific Google Business account.
 * @param {string} accessToken
 * @param {string} accountName - e.g. "accounts/123456789"
 * @param {object} [options]
 * @param {number} [options.pageSize=100]
 * @returns {Promise<Array<{ id: string, title: string, address: string, websiteUri?: string }>>}
 */
export async function listGoogleLocations(accessToken, accountName, options = {}) {
    if (!accessToken) throw new Error('Token de acceso requerido');
    if (!accountName) throw new Error('Nombre de cuenta de Google Business requerido');

    const cleanAccount = accountName.startsWith('accounts/') ? accountName : `accounts/${accountName}`;
    const pageSize = options.pageSize || 100;
    const locations = [];
    let pageToken = '';

    do {
        const url = new URL(`${GBP_LOCATIONS_ENDPOINT}/${cleanAccount}/locations`);
        url.searchParams.set('readMask', 'name,title,storefrontAddress,websiteUri');
        url.searchParams.set('pageSize', String(pageSize));
        if (pageToken) url.searchParams.set('pageToken', pageToken);

        const res = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const data = await res.json();

        if (!res.ok) {
            const err = new Error(data.error?.message || 'Error al listar ubicaciones de Google Business');
            err.status = res.status;
            err.code = res.status === 401 ? 'TOKEN_EXPIRED' : (res.status === 403 ? 'PERMISSION_DENIED' : 'API_ERROR');
            throw err;
        }

        const items = Array.isArray(data.locations) ? data.locations : [];
        for (const loc of items) {
            const addrParts = [];
            if (loc.storefrontAddress?.addressLines) addrParts.push(...loc.storefrontAddress.addressLines);
            if (loc.storefrontAddress?.locality) addrParts.push(loc.storefrontAddress.locality);
            if (loc.storefrontAddress?.administrativeArea) addrParts.push(loc.storefrontAddress.administrativeArea);

            locations.push({
                id: loc.name, // Format: "locations/987654321" or "accounts/.../locations/..."
                title: loc.title || 'Ubicación sin título',
                address: addrParts.join(', ') || 'Dirección no especificada',
                websiteUri: loc.websiteUri || ''
            });
        }

        pageToken = data.nextPageToken || '';
    } while (pageToken);

    return locations;
}

/**
 * Fetches reviews for a specific Google Business account and location.
 * Preserves star-only reviews without inventing artificial text.
 *
 * @param {object} params
 * @param {string} params.accessToken
 * @param {string} params.accountName
 * @param {string} params.locationName
 * @param {string} [params.pageToken]
 * @param {number} [params.pageSize=50]
 * @param {number} [params.maxPages=5]
 * @returns {Promise<{
 *   reviews: Array<object>,
 *   nextPageToken: string|null,
 *   totalReviewCount: number,
 *   averageRating: number
 * }>}
 */
export async function fetchGoogleLocationReviews({
    accessToken,
    accountName,
    locationName,
    pageToken = '',
    pageSize = 50,
    maxPages = 5
}) {
    if (!accessToken) throw new Error('Token de acceso requerido');
    if (!accountName || !locationName) throw new Error('AccountName y LocationName son requeridos');

    const cleanAccount = accountName.startsWith('accounts/') ? accountName : `accounts/${accountName}`;
    const cleanLocation = locationName.includes('/') ? locationName.split('/').pop() : locationName;

    const allReviews = [];
    let currentPageToken = pageToken;
    let pagesFetched = 0;
    let reportedTotal = 0;
    let reportedAvg = 0;

    while (pagesFetched < maxPages) {
        const url = new URL(`${GBP_REVIEWS_ENDPOINT}/${cleanAccount}/locations/${cleanLocation}/reviews`);
        url.searchParams.set('pageSize', String(pageSize));
        if (currentPageToken) {
            url.searchParams.set('pageToken', currentPageToken);
        }

        const res = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const data = await res.json();

        if (!res.ok) {
            const err = new Error(data.error?.message || 'Error al obtener reseñas de Google Business');
            err.status = res.status;
            err.code = res.status === 401 ? 'TOKEN_EXPIRED' : (res.status === 403 ? 'PERMISSION_DENIED' : 'API_ERROR');
            throw err;
        }

        if (typeof data.totalReviewCount === 'number') reportedTotal = data.totalReviewCount;
        if (typeof data.averageRating === 'number') reportedAvg = data.averageRating;

        const rawReviews = Array.isArray(data.reviews) ? data.reviews : [];
        for (const r of rawReviews) {
            const numericRating = mapGoogleStarRating(r.starRating);
            const rawComment = typeof r.comment === 'string' ? r.comment.trim() : '';
            const isStarOnly = rawComment.length === 0;

            allReviews.push({
                id: `google_${r.reviewId || r.name || Math.random().toString(36).slice(2)}`,
                externalId: r.reviewId || r.name,
                provider: 'google',
                accountId: cleanAccount,
                locationId: cleanLocation,
                locationTitle: r.locationTitle || undefined,
                author: r.reviewer?.displayName || 'Anónimo',
                authorPhoto: r.reviewer?.profilePhotoUrl || null,
                isAnonymous: r.reviewer?.isAnonymous || false,
                rating: numericRating,
                text: rawComment, // Left blank or empty if star-only; NEVER invent synthetic text!
                isStarOnly,
                date: r.createTime ? r.createTime.split('T')[0] : new Date().toISOString().split('T')[0],
                createdAt: r.createTime || new Date().toISOString(),
                updatedAt: r.updateTime || r.createTime || new Date().toISOString(),
                reviewReply: r.reviewReply ? {
                    comment: r.reviewReply.comment,
                    updatedAt: r.reviewReply.updateTime
                } : null
            });
        }

        pagesFetched++;
        currentPageToken = data.nextPageToken || '';
        if (!currentPageToken) break;
    }

    return {
        reviews: allReviews,
        nextPageToken: currentPageToken || null,
        hasMore: Boolean(currentPageToken),
        pagesFetched,
        totalReviewCount: reportedTotal || allReviews.length,
        averageRating: reportedAvg || (allReviews.length > 0 ? (allReviews.reduce((acc, r) => acc + r.rating, 0) / allReviews.length) : 0)
    };
}
