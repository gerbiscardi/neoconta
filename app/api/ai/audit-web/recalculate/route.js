import { NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request) {
    try {
        const { userId, reportId, urlToExclude } = await request.json();

        if (!userId || !reportId || !urlToExclude) {
            return NextResponse.json({ error: "Faltan datos requeridos (userId, reportId, urlToExclude)" }, { status: 400 });
        }

        const userDir = join(process.cwd(), 'data', 'users', userId);
        const historyPath = join(userDir, 'reviews_analysis.json');
        
        let history = [];
        try {
            const histData = await readFile(historyPath, 'utf-8');
            history = JSON.parse(histData);
        } catch (e) {
            return NextResponse.json({ error: "No se encontró el historial de reportes para este usuario." }, { status: 404 });
        }

        const reportIndex = history.findIndex(r => r.id === reportId);
        if (reportIndex === -1) {
            return NextResponse.json({ error: "No se encontró el reporte especificado." }, { status: 404 });
        }

        const report = history[reportIndex];

        // Ensure safety arrays are initialized
        if (!report.poolSources) report.poolSources = [];
        if (!report.excludedSources) report.excludedSources = [];
        if (!report.results || !report.results.sources) {
            return NextResponse.json({ error: "El reporte no tiene fuentes cargadas para analizar." }, { status: 400 });
        }

        // 1. Exclude the selected source
        const sourceIndex = report.results.sources.findIndex(s => s.url === urlToExclude);
        if (sourceIndex === -1) {
            return NextResponse.json({ error: "El resultado a excluir no se encuentra activo en este reporte." }, { status: 404 });
        }

        const [excludedSource] = report.results.sources.splice(sourceIndex, 1);
        report.excludedSources.push(excludedSource);

        // 2. Pull in a new source from the backfill pool if available
        if (report.poolSources.length > 0) {
            const nextInPool = report.poolSources.shift();
            // Append to active sources so we can re-evaluate the whole set
            report.results.sources.push({
                title: nextInPool.title,
                url: nextInPool.url,
                snippet: nextInPool.snippet,
                category: "otro",
                sentiment: "neutro"
            });
            console.log(`Backfilled 1 result from pool. Remaining pool size: ${report.poolSources.length}`);
        }

        // 3. Compile the updated search results list to re-run the Gemini audit
        const activeSearchResults = report.results.sources.map(s => ({
            title: s.title,
            link: s.url,
            snippet: s.snippet
        }));

        if (activeSearchResults.length === 0) {
            return NextResponse.json({ error: "No quedan resultados para auditar en este reporte." }, { status: 400 });
        }

        // 4. Run the recalculation with Gemini
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey.trim() === "") {
            return NextResponse.json({ 
                error: "La API Key de Gemini (GEMINI_API_KEY) no está configurada." 
            }, { status: 550 });
        }

        const ai = new GoogleGenerativeAI(apiKey);
        const query = report.query;

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
            generationConfig: {
                responseMimeType: 'application/json'
            }
        });

        const responseText = result.response.text().trim();
        let analysisResult;
        try {
            analysisResult = JSON.parse(responseText);
        } catch (parseError) {
            console.error("Gemini recalculation parsing error:", parseError);
            console.log("Raw output was:", responseText);
            return NextResponse.json({ error: "La IA no devolvió un formato JSON válido durante el recálculo." }, { status: 500 });
        }

        // 5. Update the report object with new results
        report.results = {
            ...analysisResult,
            sources: analysisResult.sources.map((s, idx) => ({
                ...s,
                url: activeSearchResults[idx] ? activeSearchResults[idx].link : s.url
            }))
        };

        // Save updated history
        history[reportIndex] = report;
        await writeFile(historyPath, JSON.stringify(history, null, 2), 'utf-8');

        return NextResponse.json({ success: true, report });

    } catch (error) {
        console.error("Error in AI web audit recalculate route:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
