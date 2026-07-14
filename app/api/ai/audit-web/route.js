import { NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Mock Web Search Results Fallback in Spanish
const getMockSearchResults = (query) => [
    {
        title: `${query} - Servicios Profesionales y Opiniones`,
        link: "https://www.directorioslocales.com.ar/profesional/guerrero-rodolfo-manuel",
        snippet: "Encuentra valoraciones reales de clientes sobre los servicios de kinesiología y rehabilitación física de Guerrero Rodolfo Manuel. Puntuación promedio de 4.8 estrellas."
    },
    {
        title: "Kinesiología Guerrero: Rehabilitación Deportiva y Atención en Consultorio",
        link: "https://www.saludybienestar.com.ar/kinesiologia-guerrero",
        snippet: "El consultorio de Guerrero Rodolfo Manuel destaca por su aparatología moderna y atención personalizada en tratamientos de columna y lesiones deportivas. Teléfono y turnos online."
    },
    {
        title: "Manuel Guerrero (Kinesiólogo) - Perfil de Linkedin",
        link: "https://ar.linkedin.com/in/manuel-guerrero-kine",
        snippet: "Visualiza el perfil profesional de Manuel Guerrero en LinkedIn. Experiencia en kinesiología respiratoria, docencia universitaria y consultoría en salud ocupacional."
    },
    {
        title: "Colegio de Kinesiólogos de la Provincia - Registro de Matriculados",
        link: "https://www.colegiokinesiologos.org.ar/matriculados/guerrero",
        snippet: "Matrícula habilitada para Guerrero Rodolfo Manuel. Profesional registrado y certificado para el ejercicio legal de la kinesiología y fisioterapia en el territorio bonaerense."
    },
    {
        title: "Opinión: ¿Cuál es el mejor consultorio de rehabilitación en la zona?",
        link: "https://foro.vecinosactivos.com/t/rehabilitacion-zona-norte/10294",
        snippet: "Foro de vecinos: 'Yo me atendí con Manuel Guerrero por un esguince de tobillo y la verdad que excelente profesional, muy atento y te explica todo el proceso.'"
    }
];

async function fetchGoogleSearchResultsReal(query) {
    const apiKey = process.env.GOOGLE_SEARCH_KEY;
    const cx = process.env.GOOGLE_SEARCH_CX;
    const serperKey = process.env.SERPER_API_KEY;

    // 1. Try Serper.dev first if configured (recommending this to bypass Google Custom Search web-wide limits)
    if (serperKey && serperKey.trim() !== "") {
        const searchUrl = 'https://google.serper.dev/search';
        const res = await fetch(searchUrl, {
            method: 'POST',
            headers: {
                'X-API-KEY': serperKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ q: query, num: 20 }) // Fetch 20 results
        });
        const data = await res.json();
        
        if (res.ok) {
            const organic = data.organic || [];
            return organic.slice(0, 20).map(item => ({ // Return up to 20 results
                title: item.title,
                link: item.link || item.url,
                snippet: item.snippet || item.snippet
            }));
        } else {
            throw new Error(`Serper API: ${data.message || "Créditos agotados o API Key inválida"}`);
        }
    }

    // 2. Fallback to Google Custom Search API
    if (!apiKey || !cx || apiKey.trim() === "" || cx.trim() === "") {
        throw new Error("Credenciales de búsqueda no configuradas (se requiere SERPER_API_KEY).");
    }

    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl);
    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.error?.message || "Error al realizar la búsqueda web en Google");
    }

    const items = data.items || [];
    return items.map(item => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet
    }));
}

export async function POST(request) {
    try {
        const { userId, query } = await request.json();

        if (!userId || !query) {
            return NextResponse.json({ error: "Faltan datos requeridos (userId, query)" }, { status: 400 });
        }

        // 1. Fetch search results from Google Search API
        let searchResults = [];
        try {
            searchResults = await fetchGoogleSearchResultsReal(query);
            console.log(`Fetched ${searchResults.length} real search results for query: "${query}"`);
        } catch (err) {
            console.error(`Search error:`, err.message);
            return NextResponse.json({ 
                error: `La búsqueda en la web falló: ${err.message}. Verifique el saldo de su cuenta de Serper.dev.` 
            }, { status: 400 });
        }

        if (searchResults.length === 0) {
            return NextResponse.json({ error: "No se encontraron resultados de búsqueda web." }, { status: 400 });
        }

        // Split into active sources (first 10) and pool sources (the rest)
        const activeSearchResults = searchResults.slice(0, 10);
        const poolSearchResults = searchResults.slice(10);

        // 2. Process active search results with Gemini
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey.trim() === "") {
            return NextResponse.json({ 
                error: "La API Key de Gemini (GEMINI_API_KEY) no está configurada." 
            }, { status: 500 });
        }

        const ai = new GoogleGenerativeAI(apiKey);

        const prompt = `
            Actúa como un auditor experto en Relaciones Públicas (PR) e Imagen Pública Digital.
            Analiza los siguientes resultados de búsqueda web arrojados al buscar el nombre de la marca/persona: "${query}".
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
                "summary": "Un análisis y diagnóstico detallado, exhaustivo y profundo de la presencia digital e imagen pública en la web. Debe tener entre 5 y 8 oraciones completas, explaining de forma precisa por qué se obtuvo dicho puntaje, los hallazgos principales (fortalezas, debilidades, control de la narrativa digital, coherencia de marca o la existencia de perfiles homónimos) y el impacto percibido de las menciones.",
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
            type: "web_audit",
            query: query,
            date: new Date().toISOString(),
            results: {
                ...analysisResult,
                // Ensure link paths remain correct
                sources: analysisResult.sources.map((s, idx) => ({
                    ...s,
                    // If Gemini hallucinated another URL, preserve the real source link from the active search results
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

        // 3. Save report in user's historical file
        const userDir = join(process.cwd(), 'data', 'users', userId);
        const historyPath = join(userDir, 'reviews_analysis.json');
        let history = [];
        try {
            const histData = await readFile(historyPath, 'utf-8');
            history = JSON.parse(histData);
        } catch (e) {
            // File doesn't exist yet
        }

        history.unshift(report);
        await writeFile(historyPath, JSON.stringify(history, null, 2), 'utf-8');

        return NextResponse.json({ success: true, report });

    } catch (error) {
        console.error("Error in AI web audit route:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
