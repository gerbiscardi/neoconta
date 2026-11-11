import { NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getServerSession, authorizeTenantAccess } from '@/lib/auth';
import { aiOperationLimiter, rateLimitResponse } from '@/lib/rateLimit';

async function fetchGoogleReviewsReal(refreshToken) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret || !refreshToken || String(refreshToken).startsWith('mock_')) {
        throw new Error('Credenciales de Google no configuradas o autorización OAuth no válida.');
    }

    const resToken = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            refresh_token: refreshToken,
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'refresh_token'
        })
    });

    const tokenData = await resToken.json();
    if (!resToken.ok || !tokenData.access_token) {
        throw new Error('Error al renovar access token de Google.');
    }

    const accessToken = tokenData.access_token;

    const resAcc = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    const accData = await resAcc.json();
    if (!resAcc.ok || !accData.accounts || accData.accounts.length === 0) {
        throw new Error('No se encontraron cuentas de Google Business Profile.');
    }
    const accountName = accData.accounts[0].name;

    const resLoc = await fetch(`https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    const locData = await resLoc.json();
    if (!resLoc.ok || !locData.locations || locData.locations.length === 0) {
        throw new Error('No se encontraron ubicaciones asociadas a la cuenta de Google.');
    }
    const locationName = locData.locations[0].name;

    const resReviews = await fetch(`https://mybusiness.googleapis.com/v4/${accountName}/${locationName}/reviews`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    const reviewsData = await resReviews.json();
    if (!resReviews.ok) {
        throw new Error('Error al obtener reseñas reales desde Google Business Profile.');
    }

    const reviews = reviewsData.reviews || [];
    return reviews
        .map(r => ({
            text: r.comment || '',
            author: r.reviewer?.displayName || 'Anónimo',
            date: r.createTime ? r.createTime.split('T')[0] : new Date().toISOString().split('T')[0]
        }))
        .filter(r => r.text.trim() !== '');
}

async function fetchMetaCommentsReal(accessToken) {
    if (!accessToken || String(accessToken).startsWith('mock_')) {
        throw new Error('Credenciales de Meta no configuradas o autorización OAuth no válida.');
    }

    const resPages = await fetch(`https://graph.facebook.com/v20.0/me/accounts?access_token=${encodeURIComponent(accessToken)}`);
    const pagesData = await resPages.json();
    if (!resPages.ok || !pagesData.data || pagesData.data.length === 0) {
        throw new Error('No se encontraron páginas de Facebook autorizadas.');
    }

    const pageId = pagesData.data[0].id;
    const pageToken = pagesData.data[0].access_token;

    const resFeed = await fetch(`https://graph.facebook.com/v20.0/${pageId}/feed?limit=5&access_token=${encodeURIComponent(pageToken)}`);
    const feedData = await resFeed.json();
    if (!resFeed.ok || !feedData.data) {
        throw new Error('Error al obtener publicaciones reales de Meta.');
    }

    const comments = [];
    for (const post of feedData.data) {
        const resComments = await fetch(`https://graph.facebook.com/v20.0/${post.id}/comments?limit=10&access_token=${encodeURIComponent(pageToken)}`);
        const commData = await resComments.json();
        if (resComments.ok && commData.data) {
            commData.data.forEach(c => {
                comments.push({
                    text: c.message || '',
                    author: c.from?.name || 'Usuario FB',
                    source: 'facebook',
                    date: c.created_time ? c.created_time.split('T')[0] : new Date().toISOString().split('T')[0]
                });
            });
        }
    }

    return comments.filter(c => c.text.trim() !== '');
}

export async function POST(request) {
    try {
        const session = await getServerSession(request);
        const body = await request.json();
        const auth = authorizeTenantAccess(session, body?.userId);
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const limitCheck = aiOperationLimiter.check(`commentor-sync:${auth.tenantId}`);
        if (!limitCheck.allowed) {
            return rateLimitResponse(limitCheck, 'Has alcanzado el límite temporal de sincronizaciones en Commentor.');
        }

        const userDir = join(process.cwd(), 'data', 'users', auth.tenantId);
        const connFilePath = join(userDir, 'connections.json');

        let connections = {};
        try {
            const data = await readFile(connFilePath, 'utf-8');
            connections = JSON.parse(data);
        } catch {
            // No connections file
        }

        const hasValidGoogle = Boolean(
            connections.google?.connected === true &&
            connections.google?.refreshToken &&
            !String(connections.google.refreshToken).startsWith('mock_')
        );
        const hasValidMeta = Boolean(
            connections.meta?.connected === true &&
            connections.meta?.accessToken &&
            !String(connections.meta.accessToken).startsWith('mock_')
        );

        if (!hasValidGoogle && !hasValidMeta) {
            return NextResponse.json({
                error: 'No hay cuentas conectadas con autorización OAuth real en Commentor.'
            }, { status: 400 });
        }

        const comments = [];
        const providerStatus = {};
        const providerErrors = [];
        let providersAttempted = 0;
        let providersSucceeded = 0;

        if (hasValidGoogle) {
            providersAttempted++;
            try {
                const googleReviews = await fetchGoogleReviewsReal(connections.google.refreshToken);
                googleReviews.forEach(r => comments.push({ ...r, source: 'google' }));
                providersSucceeded++;
                providerStatus.google = { status: 'ok', count: googleReviews.length };
            } catch (err) {
                providerStatus.google = { status: 'error', error: err.message, count: 0 };
                providerErrors.push({ provider: 'google', error: err.message });
            }
        }

        if (hasValidMeta) {
            providersAttempted++;
            try {
                const metaComments = await fetchMetaCommentsReal(connections.meta.accessToken);
                metaComments.forEach(c => comments.push(c));
                providersSucceeded++;
                providerStatus.meta = { status: 'ok', count: metaComments.length };
            } catch (err) {
                providerStatus.meta = { status: 'error', error: err.message, count: 0 };
                providerErrors.push({ provider: 'meta', error: err.message });
            }
        }

        const coverage = {
            providersAttempted,
            providersSucceeded,
            isPartial: providersAttempted > 0 && providersSucceeded < providersAttempted && providersSucceeded > 0,
            providerStatus
        };

        if (providersSucceeded === 0) {
            return NextResponse.json({
                success: false,
                error: 'No se pudo obtener datos reales de ninguno de los proveedores conectados.',
                providerErrors,
                coverage
            }, { status: 502 });
        }

        if (comments.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'Los proveedores respondieron correctamente, pero no se encontraron comentarios reales para analizar.',
                providerErrors,
                coverage
            }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey.trim() === '') {
            return NextResponse.json({
                error: 'La API Key de Gemini (GEMINI_API_KEY) no está configurada en el servidor.'
            }, { status: 500 });
        }

        const ai = new GoogleGenerativeAI(apiKey);
        const prompt = `
            Actúa como un analista experto de reputación corporativa y atención al cliente.
            Analiza el siguiente listado de comentarios reales de clientes recopilados de Google, Facebook e Instagram.
            Detecta sentimientos cualitativos, sensaciones emocionales específicas expresadas por los usuarios (como entusiasmo, enojo, alivio, frustración, impaciencia) junto con sus causas y extrae sugerencias concretas de mejora que proponen los clientes.
            Asigna un estado general (semáforo de recomendación) del negocio que puede ser: "MANTENER" (excelente feedback general), "MONITOREAR" (algunas críticas recurrentes) o "URGENTE" (muchos comentarios negativos o reclamos críticos).

            Comentarios a analizar:
            ${JSON.stringify(comments, null, 2)}

            RESPONDE ÚNICAMENTE CON UN OBJETO JSON VÁLIDO SIGUIENDO ESTE ESQUEMA ESTRICTO:
            {
                "status": "MANTENER" | "MONITOREAR" | "URGENTE",
                "sentiment": {
                    "positive": number (porcentaje del 0 al 100),
                    "neutral": number (porcentaje del 0 al 100),
                    "negative": number (porcentaje del 0 al 100)
                },
                "summary": "Resumen cualitativo de 2 o 3 oraciones de la situación actual.",
                "feelings": [
                    {
                        "feeling": "Nombre de la sensación o emoción detectada en español, ej. Frustración, Entusiasmo, Molestia",
                        "emoji": "Emoji correspondiente",
                        "reason": "Breve explicación de por qué los clientes sienten esto en base a los textos."
                    }
                ],
                "suggestions": [
                    "Sugerencia accionable número 1 extraída de los comentarios",
                    "Sugerencia accionable número 2..."
                ]
            }
            No agregues markdown adicional, explicaciones ni etiquetas (no utilices triple backtick \`\`\`json). Responde solo la cadena JSON.
        `;

        const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' }
        });

        const responseText = result.response.text().trim();
        let analysisResult;
        try {
            analysisResult = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Gemini output parsing error:', parseError);
            return NextResponse.json({ error: 'La IA no devolvió un formato JSON válido.' }, { status: 502 });
        }

        const report = {
            id: `audit_${Date.now()}`,
            type: 'social_reviews',
            date: new Date().toISOString(),
            commentCount: comments.length,
            isSimulated: false,
            coverage,
            providerErrors,
            results: analysisResult,
            commentsList: comments
        };

        await mkdir(userDir, { recursive: true });
        const historyPath = join(userDir, 'reviews_analysis.json');
        let history = [];
        try {
            const histData = await readFile(historyPath, 'utf-8');
            history = JSON.parse(histData);
        } catch {
            // File doesn't exist yet
        }

        history.unshift(report);
        await writeFile(historyPath, JSON.stringify(history, null, 2), 'utf-8');

        return NextResponse.json({ success: true, report, coverage, providerErrors });
    } catch (error) {
        console.error('Error in AI sync route:', error);
        return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
    }
}
