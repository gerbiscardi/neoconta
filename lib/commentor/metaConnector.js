/**
 * NeoConta - Meta Graph API Connector (Facebook Pages & Instagram Professional)
 * Handles authentic Facebook Graph API operations, token exchange, Page discovery,
 * Instagram Business account linking verification, and feed/media comment retrieval.
 */

export const META_GRAPH_VERSION = 'v22.0';
export const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

/**
 * Exchanges a short-lived user access token for a long-lived user access token (approx 60 days).
 * @param {string} shortLivedToken
 * @returns {Promise<{ accessToken: string, expiresIn: number }>}
 */
export async function exchangeMetaToken(shortLivedToken) {
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    if (!appId || !appSecret) {
        throw new Error('Credenciales de Meta (META_APP_ID / META_APP_SECRET) no configuradas en el servidor.');
    }
    if (!shortLivedToken || typeof shortLivedToken !== 'string' || shortLivedToken.startsWith('mock_')) {
        throw new Error('Token corto de Meta inválido o ausente.');
    }

    const url = new URL(`${META_GRAPH_BASE}/oauth/access_token`);
    url.searchParams.set('grant_type', 'fb_exchange_token');
    url.searchParams.set('client_id', appId);
    url.searchParams.set('client_secret', appSecret);
    url.searchParams.set('fb_exchange_token', shortLivedToken);

    const res = await fetch(url.toString());
    const data = await res.json();

    if (!res.ok || !data.access_token) {
        const err = new Error(data.error?.message || 'Error al obtener token de larga duración de Meta');
        err.status = res.status;
        err.code = data.error?.code === 190 ? 'TOKEN_EXPIRED' : 'AUTH_ERROR';
        err.metaError = data.error;
        throw err;
    }

    return {
        accessToken: data.access_token,
        expiresIn: data.expires_in || (60 * 24 * 3600)
    };
}

/**
 * Inspects authorized Facebook Pages and linked Instagram Professional accounts.
 * Returns both available Facebook pages and discovered Instagram business accounts.
 *
 * @param {string} userAccessToken
 * @returns {Promise<{
 *   pages: Array<{ id: string, name: string, category: string, accessToken: string, tasks: string[] }>,
 *   instagramAccounts: Array<{ id: string, username: string, name: string, linkedPageId: string, linkedPageName: string }>,
 *   instagramAvailable: boolean,
 *   instagramReason: string|null
 * }>}
 */
export async function listMetaPagesAndInstagram(userAccessToken) {
    if (!userAccessToken) throw new Error('Token de usuario de Meta requerido');

    const url = new URL(`${META_GRAPH_BASE}/me/accounts`);
    url.searchParams.set('fields', 'id,name,category,access_token,tasks,instagram_business_account{id,username,name}');
    url.searchParams.set('limit', '100');
    url.searchParams.set('access_token', userAccessToken);

    const res = await fetch(url.toString());
    const data = await res.json();

    if (!res.ok) {
        const metaError = data.error || {};
        const err = new Error(metaError.message || 'Error al listar páginas de Facebook');
        err.status = res.status;
        err.code = metaError.code === 190 ? 'TOKEN_EXPIRED' : (metaError.code === 200 ? 'PERMISSION_DENIED' : 'API_ERROR');
        err.metaError = metaError;
        throw err;
    }

    const rawList = Array.isArray(data.data) ? data.data : [];
    const pages = [];
    const instagramAccounts = [];

    for (const item of rawList) {
        pages.push({
            id: item.id,
            name: item.name || `Página ${item.id}`,
            category: item.category || 'Empresa',
            accessToken: item.access_token || '', // Page access token (used for reading feed/comments)
            tasks: Array.isArray(item.tasks) ? item.tasks : []
        });

        if (item.instagram_business_account && item.instagram_business_account.id) {
            const ig = item.instagram_business_account;
            instagramAccounts.push({
                id: ig.id,
                username: ig.username || `ig_${ig.id}`,
                name: ig.name || item.name,
                linkedPageId: item.id,
                linkedPageName: item.name
            });
        }
    }

    const instagramAvailable = instagramAccounts.length > 0;
    const instagramReason = instagramAvailable
        ? null
        : 'Las páginas de Facebook autorizadas no tienen vinculada una cuenta de Instagram Profesional / Business.';

    return {
        pages,
        instagramAccounts,
        instagramAvailable,
        instagramReason
    };
}

/**
 * Fetches feed posts and their comments from an authorized Facebook Page with multi-page cursor pagination.
 *
 * @param {object} params
 * @param {string} params.pageId
 * @param {string} params.pageAccessToken
 * @param {number} [params.postLimit=15]
 * @param {number} [params.commentLimit=50]
 * @param {number} [params.maxPages=3]
 * @param {string} [params.afterCursor=null]
 * @returns {Promise<{
 *   comments: Array<object>,
 *   nextCursor: string|null,
 *   hasMore: boolean,
 *   postsProcessed: number,
 *   pagesFetched: number
 * }>}
 */
export async function fetchFacebookComments({
    pageId,
    pageAccessToken,
    postLimit = 15,
    commentLimit = 50,
    maxPages = 3,
    afterCursor = null
}) {
    if (!pageId || !pageAccessToken) {
        throw new Error('pageId y pageAccessToken requeridos para consultar comentarios de Facebook');
    }

    const comments = [];
    let currentCursor = afterCursor;
    let pagesFetched = 0;
    let postsProcessed = 0;

    while (pagesFetched < maxPages) {
        const feedUrl = new URL(`${META_GRAPH_BASE}/${pageId}/feed`);
        feedUrl.searchParams.set('fields', `id,message,created_time,permalink_url,comments.limit(${commentLimit}){id,message,created_time,from,like_count}`);
        feedUrl.searchParams.set('limit', String(postLimit));
        feedUrl.searchParams.set('access_token', pageAccessToken);
        if (currentCursor) {
            feedUrl.searchParams.set('after', currentCursor);
        }

        const res = await fetch(feedUrl.toString());
        const data = await res.json();

        if (!res.ok) {
            const metaError = data.error || {};
            const err = new Error(metaError.message || `Error al obtener publicaciones de Facebook para página ${pageId}`);
            err.status = res.status;
            err.code = metaError.code === 190 ? 'TOKEN_EXPIRED' : (metaError.code === 200 || metaError.code === 10 ? 'PERMISSION_DENIED' : 'API_ERROR');
            err.metaError = metaError;
            throw err;
        }

        const posts = Array.isArray(data.data) ? data.data : [];
        postsProcessed += posts.length;

        for (const post of posts) {
            const postComments = post.comments && Array.isArray(post.comments.data) ? post.comments.data : [];
            for (const c of postComments) {
                const rawText = typeof c.message === 'string' ? c.message.trim() : '';
                comments.push({
                    id: `meta_fb_${c.id}`,
                    externalId: c.id,
                    provider: 'facebook',
                    accountId: pageId,
                    postId: post.id,
                    postSnippet: post.message ? post.message.slice(0, 100) : '',
                    postUrl: post.permalink_url || null,
                    author: c.from?.name || 'Usuario de Facebook',
                    authorId: c.from?.id || null,
                    text: rawText,
                    isStarOnly: false,
                    rating: null,
                    date: c.created_time ? c.created_time.split('T')[0] : new Date().toISOString().split('T')[0],
                    createdAt: c.created_time || new Date().toISOString(),
                    likeCount: Number.isFinite(c.like_count) ? c.like_count : 0
                });
            }
        }

        pagesFetched++;
        currentCursor = data.paging?.cursors?.after || null;
        if (!currentCursor || posts.length === 0) {
            currentCursor = null;
            break;
        }
    }

    return {
        comments,
        nextCursor: currentCursor,
        hasMore: Boolean(currentCursor),
        postsProcessed,
        pagesFetched
    };
}

/**
 * Fetches media and their comments from an authorized Instagram Professional account with multi-page cursor pagination.
 *
 * @param {object} params
 * @param {string} params.igUserId
 * @param {string} params.pageAccessToken - Token of the linked Facebook Page with instagram scopes
 * @param {number} [params.mediaLimit=15]
 * @param {number} [params.commentLimit=50]
 * @param {number} [params.maxPages=3]
 * @param {string} [params.afterCursor=null]
 * @returns {Promise<{
 *   comments: Array<object>,
 *   nextCursor: string|null,
 *   hasMore: boolean,
 *   mediaProcessed: number,
 *   pagesFetched: number
 * }>}
 */
export async function fetchInstagramComments({
    igUserId,
    pageAccessToken,
    mediaLimit = 15,
    commentLimit = 50,
    maxPages = 3,
    afterCursor = null
}) {
    if (!igUserId || !pageAccessToken) {
        throw new Error('igUserId y pageAccessToken requeridos para consultar comentarios de Instagram');
    }

    const comments = [];
    let currentCursor = afterCursor;
    let pagesFetched = 0;
    let mediaProcessed = 0;

    while (pagesFetched < maxPages) {
        const mediaUrl = new URL(`${META_GRAPH_BASE}/${igUserId}/media`);
        mediaUrl.searchParams.set('fields', `id,caption,timestamp,permalink,comments.limit(${commentLimit}){id,text,timestamp,username,like_count}`);
        mediaUrl.searchParams.set('limit', String(mediaLimit));
        mediaUrl.searchParams.set('access_token', pageAccessToken);
        if (currentCursor) {
            mediaUrl.searchParams.set('after', currentCursor);
        }

        const res = await fetch(mediaUrl.toString());
        const data = await res.json();

        if (!res.ok) {
            const metaError = data.error || {};
            const err = new Error(metaError.message || `Error al obtener publicaciones de Instagram para cuenta ${igUserId}`);
            err.status = res.status;
            err.code = metaError.code === 190 ? 'TOKEN_EXPIRED' : (metaError.code === 200 || metaError.code === 10 ? 'PERMISSION_DENIED' : 'API_ERROR');
            err.metaError = metaError;
            throw err;
        }

        const mediaList = Array.isArray(data.data) ? data.data : [];
        mediaProcessed += mediaList.length;

        for (const media of mediaList) {
            const mediaComments = media.comments && Array.isArray(media.comments.data) ? media.comments.data : [];
            for (const c of mediaComments) {
                const rawText = typeof c.text === 'string' ? c.text.trim() : '';
                comments.push({
                    id: `meta_ig_${c.id}`,
                    externalId: c.id,
                    provider: 'instagram',
                    accountId: igUserId,
                    mediaId: media.id,
                    mediaSnippet: media.caption ? media.caption.slice(0, 100) : '',
                    mediaUrl: media.permalink || null,
                    author: c.username || 'Usuario de Instagram',
                    text: rawText,
                    isStarOnly: false,
                    rating: null,
                    date: c.timestamp ? c.timestamp.split('T')[0] : new Date().toISOString().split('T')[0],
                    createdAt: c.timestamp || new Date().toISOString(),
                    likeCount: Number.isFinite(c.like_count) ? c.like_count : 0
                });
            }
        }

        pagesFetched++;
        currentCursor = data.paging?.cursors?.after || null;
        if (!currentCursor || mediaList.length === 0) {
            currentCursor = null;
            break;
        }
    }

    return {
        comments,
        nextCursor: currentCursor,
        hasMore: Boolean(currentCursor),
        mediaProcessed,
        pagesFetched
    };
}
