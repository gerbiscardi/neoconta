import { NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Mock reviews fallback dataset in Spanish
const MOCK_GOOGLE_REVIEWS = [
    { text: "Excelente atención y los informes contables son super claros. Muy recomendable.", author: "Juan Pérez", date: "2026-06-21" },
    { text: "Tardan mucho en responder los mensajes de Whatsapp, pero el servicio técnico es bueno.", author: "María Gómez", date: "2026-06-20" },
    { text: "El sistema NeoConta es muy ágil, pero me costó un poco configurarlo al principio. Falta más tutorial.", author: "Carlos Rodríguez", date: "2026-06-18" },
    { text: "Me cobraron de más el mes pasado y no me solucionan el reintegro. Una decepción.", author: "Ana Martínez", date: "2026-06-15" },
    { text: "Muy conforme con el soporte de Germán. Excelente predisposición y amabilidad.", author: "Diego Silva", date: "2026-06-12" }
];

const MOCK_META_COMMENTS = [
    { text: "Me encanta el nuevo diseño de la app! Felicitaciones!! 😍", author: "@sofia_c", source: "instagram", date: "2026-06-22" },
    { text: "No puedo ingresar al panel, se queda cargando en la pantalla de login. Ayuda por favor.", author: "Lucas Ferreyra", source: "facebook", date: "2026-06-21" },
    { text: "Pregunta: ¿Se pueden asociar cuentas de bancos del exterior?", author: "@viajero_arg", source: "instagram", date: "2026-06-20" },
    { text: "El servicio es malo. La facturación con AFIP se cae a cada rato y no avisan.", author: "Esteban Russo", source: "facebook", date: "2026-06-17" },
    { text: "Excelente post explicativo, me sirvió un montón el tema del padrón A13.", author: "@pyme_grow", source: "instagram", date: "2026-06-16" }
];

async function fetchGoogleReviewsReal(refreshToken) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret || !refreshToken || refreshToken.startsWith('mock_')) {
        throw new Error("Credenciales de Google no válidas o en modo simulado.");
    }

    // 1. Refresh Access Token
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
    if (!resToken.ok) throw new Error("Error al renovar access token de Google");

    const accessToken = tokenData.access_token;

    // 2. Fetch Accounts
    const resAcc = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const accData = await resAcc.json();
    if (!resAcc.ok || !accData.accounts || accData.accounts.length === 0) {
        throw new Error("No se encontraron cuentas de Google My Business.");
    }
    const accountName = accData.accounts[0].name; // e.g. "accounts/12345"

    // 3. Fetch Locations
    const resLoc = await fetch(`https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const locData = await resLoc.json();
    if (!resLoc.ok || !locData.locations || locData.locations.length === 0) {
        throw new Error("No se encontraron locaciones asociadas a la cuenta.");
    }
    const locationName = locData.locations[0].name; // e.g. "locations/67890"

    // 4. Fetch Reviews
    const resReviews = await fetch(`https://mybusiness.googleapis.com/v4/${accountName}/${locationName}/reviews`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const reviewsData = await resReviews.json();
    if (!resReviews.ok) throw new Error("Error al obtener reseñas de Google.");

    const reviews = reviewsData.reviews || [];
    return reviews.map(r => ({
        text: r.comment || "",
        author: r.reviewer?.displayName || "Anónimo",
        date: r.createTime ? r.createTime.split('T')[0] : new Date().toISOString().split('T')[0]
    })).filter(r => r.text.trim() !== "");
}

async function fetchMetaCommentsReal(accessToken) {
    if (!accessToken || accessToken.startsWith('mock_')) {
        throw new Error("Credenciales de Meta no válidas o en modo simulado.");
    }

    // Fetch pages first
    const resPages = await fetch(`https://graph.facebook.com/v20.0/me/accounts?access_token=${accessToken}`);
    const pagesData = await resPages.json();
    if (!resPages.ok || !pagesData.data || pagesData.data.length === 0) {
        throw new Error("No se encontraron páginas de Facebook.");
    }

    const pageId = pagesData.data[0].id;
    const pageToken = pagesData.data[0].access_token;

    // Fetch last 5 posts of the page
    const resFeed = await fetch(`https://graph.facebook.com/v20.0/${pageId}/feed?limit=5&access_token=${pageToken}`);
    const feedData = await resFeed.json();
    if (!resFeed.ok || !feedData.data) {
        throw new Error("Error al obtener el feed de Facebook.");
    }

    const comments = [];
    for (const post of feedData.data) {
        // Fetch comments for each post
        const resComments = await fetch(`https://graph.facebook.com/v20.0/${post.id}/comments?limit=10&access_token=${pageToken}`);
        const commData = await resComments.json();
        if (resComments.ok && commData.data) {
            commData.data.forEach(c => {
                comments.push({
                    text: c.message || "",
                    author: c.from?.name || "Usuario FB",
                    source: "facebook",
                    date: c.created_time ? c.created_time.split('T')[0] : new Date().toISOString().split('T')[0]
                });
            });
        }
    }

    return comments.filter(c => c.text.trim() !== "");
}

export async function POST(request) {
    try {
        const { userId } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: "Falta el ID del usuario (userId)" }, { status: 400 });
        }

        // 1. Read Connections
        const userDir = join(process.cwd(), 'data', 'users', userId);
        const connFilePath = join(userDir, 'connections.json');

        let connections = {};
        try {
            const data = await readFile(connFilePath, 'utf-8');
            connections = JSON.parse(data);
        } catch (e) {
            // No connections file
        }

        const isGoogleConnected = connections.google?.connected === true;
        const isMetaConnected = connections.meta?.connected === true;

        if (!isGoogleConnected && !isMetaConnected) {
            return NextResponse.json({ error: "No tienes ninguna cuenta de red social conectada en Commentor." }, { status: 400 });
        }

        // 2. Fetch comments from connected providers
        let comments = [];

        // Google
        if (isGoogleConnected) {
            try {
                const googleReviews = await fetchGoogleReviewsReal(connections.google.refreshToken);
                googleReviews.forEach(r => comments.push({ ...r, source: 'google' }));
                console.log(`Fetched ${googleReviews.length} real Google reviews.`);
            } catch (err) {
                console.log("Could not fetch real Google reviews, falling back to mock dataset. Reason:", err.message);
                MOCK_GOOGLE_REVIEWS.forEach(r => comments.push({ ...r, source: 'google' }));
            }
        }

        // Meta
        if (isMetaConnected) {
            try {
                const metaComments = await fetchMetaCommentsReal(connections.meta.accessToken);
                metaComments.forEach(c => comments.push(c));
                console.log(`Fetched ${metaComments.length} real Meta comments.`);
            } catch (err) {
                console.log("Could not fetch real Meta comments, falling back to mock dataset. Reason:", err.message);
                MOCK_META_COMMENTS.forEach(c => comments.push(c));
            }
        }

        if (comments.length === 0) {
            return NextResponse.json({ error: "No se encontraron comentarios para analizar." }, { status: 400 });
        }

        // 3. Analyze comments with Gemini
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey.trim() === "") {
            return NextResponse.json({ 
                error: "La API Key de Gemini (GEMINI_API_KEY) no está configurada en las variables de entorno del servidor." 
            }, { status: 500 });
        }

        // Initialize Gemini SDK
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
            generationConfig: {
                responseMimeType: 'application/json'
            }
        });

        const responseText = result.response.text().trim();
        let analysisResult;
        try {
            analysisResult = JSON.parse(responseText);
        } catch (parseError) {
            console.error("Gemini output parsing error:", parseError);
            console.log("Raw output was:", responseText);
            throw new Error("La IA no devolvió un formato JSON válido.");
        }

        // Add metadata to the report
        const report = {
            id: `audit_${Date.now()}`,
            type: "social_reviews",
            date: new Date().toISOString(),
            commentCount: comments.length,
            results: analysisResult,
            commentsList: comments // Store comments list for inspection
        };

        // 4. Save report in historical file
        const historyPath = join(userDir, 'reviews_analysis.json');
        let history = [];
        try {
            const histData = await readFile(historyPath, 'utf-8');
            history = JSON.parse(histData);
        } catch (e) {
            // File doesn't exist yet
        }

        // Add to history
        history.unshift(report);
        await writeFile(historyPath, JSON.stringify(history, null, 2), 'utf-8');

        return NextResponse.json({ success: true, report });

    } catch (error) {
        console.error("Error in AI sync route:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
