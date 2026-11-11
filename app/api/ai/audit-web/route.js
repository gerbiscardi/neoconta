import { NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getServerSession, authorizeTenantAccess } from '@/lib/auth';
import { aiOperationLimiter, rateLimitResponse } from '@/lib/rateLimit';

async function fetchGoogleSearchResultsReal(query) {
    const apiKey = process.env.GOOGLE_SEARCH_KEY;
    const cx = process.env.GOOGLE_SEARCH_CX;
    const serperKey = process.env.SERPER_API_KEY;

    if (serperKey && serperKey.trim() !== '') {
        const searchUrl = 'https://google.serper.dev/search';
        const res = await fetch(searchUrl, {
            method: 'POST',
            headers: {
                'X-API-KEY': serperKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ q: query, num: 20 })
        });
        const data = await res.json();

        if (res.ok) {
            const organic = data.organic || [];
            return {
                provider: 'serper',
                items: organic.slice(0, 20).map(item => ({
                    title: item.title,
                    link: item.link || item.url,
                    snippet: item.snippet
                }))
            };
        }
        throw new Error(`Serper API: ${data.message || 'Créditos agotados o API Key inválida'}`);
    }

    if (!apiKey || !cx || apiKey.trim() === '' || cx.trim() === '') {
        throw new Error('Credenciales de búsqueda web no configuradas en el servidor.');
    }

    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl);
    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.error?.message || 'Error al realizar la búsqueda web en Google.');
    }

    const items = data.items || [];
    return {
        provider: 'google_custom_search',
        items: items.map(item => ({
            title: item.title,
            link: item.link,
            snippet: item.snippet
        }))
    };
}

export async function POST(request) {
    try {
        const session = await getServerSession(request);
        const body = await request.json();
        const { userId, query } = body || {};

        const auth = authorizeTenantAccess(session, userId);
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const limitCheck = aiOperationLimiter.check(`commentor-audit:${auth.tenantId}`);
        if (!limitCheck.allowed) {
            return rateLimitResponse(limitCheck, 'Has alcanzado el límite temporal de auditorías web en Commentor.');
        }

        const cleanQuery = typeof query === 'string' ? query.trim() : '';
        if (cleanQuery.length < 2 || cleanQuery.length > 200) {
            return NextResponse.json({ error: 'La consulta debe tener entre 2 y 200 caracteres.' }, { status: 400 });
        }

        let searchOutcome;
        try {
            searchOutcome = await fetchGoogleSearchResultsReal(cleanQuery);
        } catch (err) {
            return NextResponse.json({
                success: false,
                error: `La búsqueda en la web falló: ${err.message}`,
                providerErrors: [{ provider: 'web_search', error: err.message }]
            }, { status: 502 });
        }

        const searchResults = searchOutcome.items || [];
        if (searchResults.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'No se encontraron resultados reales de búsqueda web para esa consulta.'
            }, { status: 404 });
        }

        const activeSearchResults = searchResults.slice(0, 10);
        const poolSearchResults = searchResults.slice(10);

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey.trim() === '') {
            return NextResponse.json({
                error: 'La API Key de Gemini (GEMINI_API_KEY) no está configurada.'
            }, { status: 500 });
        }

        const ai = new GoogleGenerativeAI(apiKey);
        const prompt = `
            Actúa como un auditor experto en Relaciones Públicas (PR) e Imagen Pública Digital.
            Analiza los siguientes resultados de búsqueda web arrojados al buscar el nombre de la marca/persona: "${cleanQuery}".
            Evalúa la imagen pública, el tono general de la web (positivo, neutro o negativo), categoriza de dónde provienen las menciones (prensa, directorio de negocios, foro de discusión, perfil profesional, sitio institucional) y otorga una calificación numérica global ("brandScore") del 0 al 100 basada en la solidez y positividad de su presencia en Google.
            Además, genera sugerencias/recomendaciones concretas de SEO y reputación para mejorar su posicionamiento o resolver debilidades.

            Resultados de búsqueda:
            ${JSON.stringify(activeSearchResults, null, 2)}

            RESPONDE ÚNICAMENTE CON UN OBJETO JSON VÁLIDO SIGUIENDO ESTE ESQUEMA ESTRICTO:
            {
                "brandScore": number (de 0 a 100),
                "publicSentiment": {
                    "positive": number (porcentaje del 0 al 100),
                    "neutral": number (porcentaje del 0 al 100),
                    "negative": number (porcentaje del 0 al 100)
                },
                "summary": "Un análisis y diagnóstico detallado, exhaustivo y profundo de la presencia digital e imagen pública en la web. Debe tener entre 5 y 8 oraciones completas, explicando de forma precisa por qué se obtuvo dicho puntaje, los hallazgos principales (fortalezas, debilidades, control de la narrativa digital, coherencia de marca o la existencia de perfiles homónimos) y el impacto percibido de las menciones.",
                "sources": [
                    {
                        "title": "Título del sitio web/artículo",
                        "url": "Enlace al sitio",
                        "snippet": "Fragmento analizado",
                        "category": "prensa" | "directorio" | "foro" | "perfil_profesional" | "otro",
                        "sentiment": "positivo" | "neutro" | "negativo"
                    }
                ],
                "reconciliations": [
                    "Recomendación estratégica de SEO o Relaciones Públicas detallada y accionable (mínimo 15 palabras), explicando el qué, el por qué y el cómo llevarla a cabo para mejorar el posicionamiento o mitigar debilidades.",
                    "Recomendación número 2..."
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
            type: 'web_audit',
            query: cleanQuery,
            date: new Date().toISOString(),
            isSimulated: false,
            coverage: {
                provider: searchOutcome.provider,
                fetchedResults: searchResults.length,
                analyzedResults: activeSearchResults.length,
                pooledResults: poolSearchResults.length
            },
            results: {
                ...analysisResult,
                sources: (analysisResult.sources || []).map((s, idx) => ({
                    ...s,
                    url: activeSearchResults[idx] ? activeSearchResults[idx].link : s.url
                }))
            },
            poolSources: poolSearchResults.map(item => ({
                title: item.title,
                url: item.link,
                snippet: item.snippet
            })),
            excludedSources: []
        };

        const userDir = join(process.cwd(), 'data', 'users', auth.tenantId);
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

        return NextResponse.json({ success: true, report });
    } catch (error) {
        console.error('Error in AI web audit route:', error);
        return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
    }
}
