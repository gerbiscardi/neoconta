/**
 * NeoConta - Web Reputation Audit Engine
 * Real search provider querying, deterministic score calculation,
 * source lineage tracking, and traceable revision generation.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { sanitizeUntrustedCommentText } from './reputationEngine.js';

/**
 * Categorizes a domain into a trust tier and category.
 * @param {string} urlStr
 * @returns {{ domain: string, category: string, weight: number }}
 */
export function classifyDomain(urlStr) {
    try {
        const parsed = new URL(urlStr);
        const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');

        // Press / Major news
        if (/(clarin|lanacion|infobae|ambito|cronista|perfil|pagina12|reuters|bloomberg|forbes|elpais|bbc)\b/.test(hostname)) {
            return { domain: hostname, category: 'prensa', weight: 1.5 };
        }
        // Institutional / Government / Official
        if (hostname.endsWith('.gov.ar') || hostname.endsWith('.gob.ar') || hostname.endsWith('.edu.ar') || /(afip|arca|argentina\.gob)\b/.test(hostname)) {
            return { domain: hostname, category: 'institucional', weight: 1.6 };
        }
        // Professional Profiles / Corporate Registry
        if (/(linkedin|crunchbase|glassdoor|opencorporates|cuitonline|dateas|boletinoficial)\b/.test(hostname)) {
            return { domain: hostname, category: 'directorio', weight: 1.1 };
        }
        // Forums / Social Discussion / Reviews
        if (/(reddit|tuquejasuma|taringa|foros|trustpilot|tripadvisor|facebook|twitter|instagram|tiktok)\b/.test(hostname)) {
            return { domain: hostname, category: 'foro', weight: 0.8 };
        }

        return { domain: hostname, category: 'otro', weight: 1.0 };
    } catch {
        return { domain: 'desconocido', category: 'otro', weight: 1.0 };
    }
}

/**
 * Queries authentic web search providers (Google Custom Search or Serper).
 *
 * @param {string} query
 * @returns {Promise<{
 *   provider: string,
 *   items: Array<{ title: string, link: string, snippet: string, position: number }>
 * }>}
 */
export async function fetchWebSearchResults(query) {
    const cleanQuery = typeof query === 'string' ? query.trim() : '';
    if (cleanQuery.length < 2) {
        throw new Error('La consulta de búsqueda debe tener al menos 2 caracteres.');
    }

    const serperKey = process.env.SERPER_API_KEY;
    const googleKey = process.env.GOOGLE_SEARCH_KEY;
    const googleCx = process.env.GOOGLE_SEARCH_CX;

    // 1. Try Serper if configured
    if (serperKey && serperKey.trim() !== '') {
        const searchUrl = 'https://google.serper.dev/search';
        const res = await fetch(searchUrl, {
            method: 'POST',
            headers: {
                'X-API-KEY': serperKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ q: cleanQuery, num: 20 })
        });
        const data = await res.json();

        if (res.ok) {
            const organic = Array.isArray(data.organic) ? data.organic : [];
            return {
                provider: 'serper',
                items: organic.slice(0, 20).map((item, idx) => ({
                    title: item.title || '',
                    link: item.link || item.url || '',
                    snippet: item.snippet || '',
                    position: idx + 1
                })).filter(item => item.link.startsWith('http'))
            };
        }
        throw new Error(`Serper API: ${data.message || 'Error en búsqueda Serper'}`);
    }

    // 2. Try Google Custom Search
    if (googleKey && googleCx && googleKey.trim() !== '' && googleCx.trim() !== '') {
        const searchUrl = new URL('https://www.googleapis.com/customsearch/v1');
        searchUrl.searchParams.set('key', googleKey);
        searchUrl.searchParams.set('cx', googleCx);
        searchUrl.searchParams.set('q', cleanQuery);
        searchUrl.searchParams.set('num', '10');

        const res = await fetch(searchUrl.toString());
        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error?.message || 'Error al realizar la búsqueda web en Google Custom Search.');
        }

        const rawItems = Array.isArray(data.items) ? data.items : [];
        return {
            provider: 'google_custom_search',
            items: rawItems.map((item, idx) => ({
                title: item.title || '',
                link: item.link || '',
                snippet: item.snippet || '',
                position: idx + 1
            })).filter(item => item.link.startsWith('http'))
        };
    }

    throw new Error('No hay proveedores de búsqueda web configurados en el servidor (GOOGLE_SEARCH_KEY / GOOGLE_SEARCH_CX o SERPER_API_KEY).');
}

/**
 * Calculates deterministic mathematical reputation metrics for audited web sources.
 * If no sources have validated sentiment, calculatedScore is null.
 *
 * @param {Array<object>} sources
 * @returns {object}
 */
export function calculateWebReputationMetrics(sources) {
    const total = sources.length;
    if (total === 0) {
        return {
            totalSources: 0,
            classifiedCount: 0,
            calculatedScore: null,
            sentimentCounts: { positivo: 0, neutro: 0, negativo: 0, indeterminado: 0 },
            sentimentPercentages: { positivo: 0, neutro: 0, negativo: 0, indeterminado: 0 },
            categoryBreakdown: {}
        };
    }

    const sentimentCounts = { positivo: 0, neutro: 0, negativo: 0, indeterminado: 0 };
    const categoryBreakdown = {};

    let weightedScoreSum = 0;
    let totalWeight = 0;
    let classifiedCount = 0;

    sources.forEach((s, idx) => {
        const sentiment = ['positivo', 'neutro', 'negativo'].includes(s.sentiment)
            ? s.sentiment
            : 'indeterminado';
        sentimentCounts[sentiment]++;

        const category = s.category || 'otro';
        categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1;

        if (sentiment !== 'indeterminado') {
            classifiedCount++;
            const posWeight = idx < 3 ? 1.3 : (idx < 6 ? 1.0 : 0.8);
            const domainWeight = Number.isFinite(s.domainWeight) ? s.domainWeight : 1.0;
            const combinedWeight = posWeight * domainWeight;
            const sentimentPoints = sentiment === 'positivo' ? 100 : (sentiment === 'neutro' ? 60 : 15);
            weightedScoreSum += sentimentPoints * combinedWeight;
            totalWeight += combinedWeight;
        }
    });

    const calculatedScore = classifiedCount > 0 && totalWeight > 0
        ? Math.min(100, Math.max(0, Math.round(weightedScoreSum / totalWeight)))
        : null;

    const sentimentPercentages = {
        positivo: Number(((sentimentCounts.positivo / total) * 100).toFixed(1)),
        neutro: Number(((sentimentCounts.neutro / total) * 100).toFixed(1)),
        negativo: Number(((sentimentCounts.negativo / total) * 100).toFixed(1)),
        indeterminado: Number(((sentimentCounts.indeterminado / total) * 100).toFixed(1))
    };

    return {
        totalSources: total,
        classifiedCount,
        calculatedScore,
        sentimentCounts,
        sentimentPercentages,
        categoryBreakdown
    };
}

/**
 * Runs qualitative PR analysis with Gemini on authentic web search results.
 *
 * @param {string} query
 * @param {Array<object>} activeResults
 * @returns {Promise<object>}
 */
export async function runAIWebAudit(query, activeResults) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
        throw new Error('GEMINI_API_KEY no está configurada en el servidor.');
    }

    const sanitizedResults = activeResults.map(item => ({
        url: item.link || item.url,
        title: sanitizeUntrustedCommentText(item.title || '', 200),
        snippet: sanitizeUntrustedCommentText(item.snippet || '', 400),
        position: item.position || 0
    }));

    const systemPrompt = `
Actúa como un auditor experto en Relaciones Públicas (PR), Control de Daños e Inteligencia de Imagen Digital.
Analizarás resultados de búsqueda web reales de Google para la marca/entidad: "${query}".

REGLAS ESTRICTAS DE SEGURIDAD Y VERACIDAD:
1. Analiza EXCLUSIVAMENTE las fuentes proporcionadas en "RESULTADOS_BUSQUEDA".
2. NO inventes enlaces, URLs ni hechos inexistentes.
3. Clasifica el sentimiento de cada fuente de manera objetiva:
   - "positivo": elogios, noticias de crecimiento, reconocimientos, premios, página oficial.
   - "neutro": directorios, menciones de registro, fichas comerciales sin opiniones.
   - "negativo": denuncias, quejas de consumidores, demandas, estafas, caídas de servicio.
4. Categoriza cada fuente: "prensa" | "directorio" | "foro" | "perfil_profesional" | "institucional" | "otro".
5. Extrae recomendaciones estratégicas accionables de SEO y PR.

RESPONDE ÚNICAMENTE CON UN OBJETO JSON VÁLIDO CON ESTA ESTRUCTURA:
{
    "summary": "Diagnóstico detallado y profundo de 4 a 7 oraciones explicando la imagen pública de la marca en la web, el tono dominante y los factores clave encontrados.",
    "sourcesAnalysis": [
        {
            "url": "URL exacta de la fuente (debe coincidir con la provista)",
            "category": "prensa" | "directorio" | "foro" | "perfil_profesional" | "institucional" | "otro",
            "sentiment": "positivo" | "neutro" | "negativo",
            "justification": "Breve justificación de 1 oración del sentimiento y categoría asignados"
        }
    ],
    "reconciliations": [
        "Recomendación estratégica de PR o SEO concreta y accionable (mínimo 15 palabras)",
        "Segunda recomendación estratégica..."
    ]
}
No agregues formato markdown ni \`\`\`json. Solo la cadena JSON cruda.
`;

    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const userContent = `RESULTADOS_BUSQUEDA:\n${JSON.stringify(sanitizedResults, null, 2)}`;

    const result = await model.generateContent({
        contents: [
            { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userContent}` }] }
        ],
        generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2
        }
    });

    const responseText = result.response.text().trim();
    let parsed;
    try {
        parsed = JSON.parse(responseText);
    } catch (parseError) {
        console.error('Error al parsear salida de Gemini en auditoría web:', parseError, responseText);
        throw new Error('La IA no devolvió un formato JSON válido para la auditoría web.');
    }

    return parsed;
}
