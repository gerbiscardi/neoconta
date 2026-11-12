import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { getServerSession, authorizeTenantAccess } from '@/lib/auth';
import { getUserDataDir, writeJsonAtomic } from '@/lib/dataPaths';
import {
    calculateWebReputationMetrics,
    runAIWebAudit,
    classifyDomain
} from '@/lib/commentor/webAuditEngine';
import { acquireCommentorLock } from '@/lib/commentor/commentorLocker';

export async function POST(request) {
    let releaseLock = null;
    try {
        const session = await getServerSession(request);
        const body = await request.json().catch(() => ({}));
        const { userId: requestedUserId, reportId, urlToExclude, reason } = body || {};

        const auth = authorizeTenantAccess(session, requestedUserId);
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }
        const userId = auth.tenantId;

        if (!reportId || !urlToExclude) {
            return NextResponse.json({ error: 'Faltan datos requeridos (reportId, urlToExclude)' }, { status: 400 });
        }

        releaseLock = await acquireCommentorLock(userId);

        const userDir = getUserDataDir(userId);
        const historyPath = join(userDir, 'reviews_analysis.json');

        let history = [];
        try {
            const histData = await readFile(historyPath, 'utf-8');
            history = JSON.parse(histData);
            if (!Array.isArray(history)) history = [];
        } catch {
            return NextResponse.json({ error: 'No se encontró el historial de reportes para este usuario.' }, { status: 404 });
        }

        const reportIndex = history.findIndex(r => r.id === reportId);
        if (reportIndex === -1) {
            return NextResponse.json({ error: 'No se encontró el reporte especificado.' }, { status: 404 });
        }

        const report = history[reportIndex];

        if (!report.poolSources) report.poolSources = [];
        if (!report.excludedSources) report.excludedSources = [];
        if (!report.revisionHistory) report.revisionHistory = [];
        if (!report.results || !Array.isArray(report.results.sources)) {
            return NextResponse.json({ error: 'El reporte no tiene fuentes cargadas para analizar.' }, { status: 400 });
        }

        // 1. Locate and exclude the requested source
        const sourceIndex = report.results.sources.findIndex(s => s.url === urlToExclude);
        if (sourceIndex === -1) {
            return NextResponse.json({ error: 'El resultado a excluir no se encuentra activo en este reporte.' }, { status: 404 });
        }

        const [excludedSource] = report.results.sources.splice(sourceIndex, 1);
        const exclusionRecord = {
            ...excludedSource,
            excludedAt: new Date().toISOString(),
            exclusionReason: reason || 'Excluido por el usuario (fuente irrelevante, homónima o no aplicable)'
        };
        report.excludedSources.push(exclusionRecord);

        // Record a FULL, IMMUTABLE snapshot of previous revision state
        const previousScore = report.results.brandScore ?? null;
        const currentRevision = report.revision || 0;
        report.revisionHistory.push({
            revision: currentRevision,
            timestamp: new Date().toISOString(),
            brandScore: previousScore,
            aiValidated: report.results.aiValidated !== false,
            publicSentiment: report.results.publicSentiment ? JSON.parse(JSON.stringify(report.results.publicSentiment)) : null,
            summary: report.results.summary,
            sources: JSON.parse(JSON.stringify(report.results.sources)),
            excludedSources: JSON.parse(JSON.stringify(report.excludedSources)),
            metrics: report.metrics ? JSON.parse(JSON.stringify(report.metrics)) : null,
            poolSourcesCount: report.poolSources.length,
            action: 'exclude_source',
            excludedUrl: urlToExclude,
            reason: reason || ''
        });

        // 2. Backfill from pool if available
        let backfilledItem = null;
        if (report.poolSources.length > 0) {
            const nextInPool = report.poolSources.shift();
            const domainInfo = classifyDomain(nextInPool.url);
            backfilledItem = {
                id: `src_backfill_${Date.now()}`,
                title: nextInPool.title,
                url: nextInPool.url,
                snippet: nextInPool.snippet,
                domain: domainInfo.domain,
                domainWeight: domainInfo.weight,
                category: domainInfo.category,
                sentiment: 'indeterminado',
                captureDate: new Date().toISOString(),
                inclusionReason: 'Promovido desde el pool de resultados tras exclusión de fuente'
            };
            report.results.sources.push(backfilledItem);
        }

        if (report.results.sources.length === 0) {
            return NextResponse.json({ error: 'No quedan resultados para auditar en este reporte tras la exclusión.' }, { status: 400 });
        }

        // 3. Re-evaluate with Gemini PR audit or graceful fallback
        let aiAudit = null;
        let aiFailed = false;
        try {
            aiAudit = await runAIWebAudit(report.query, report.results.sources.map(s => ({
                link: s.url,
                title: s.title,
                snippet: s.snippet
            })));
        } catch (aiErr) {
            console.warn('Advertencia en recálculo IA web:', aiErr.message);
            aiFailed = true;
        }

        if (aiFailed || !aiAudit) {
            report.results.sources = report.results.sources.map(s => ({
                ...s,
                sentiment: 'indeterminado',
                aiJustification: 'Análisis de sentimiento no disponible.'
            }));
            report.results.brandScore = null;
            report.results.aiValidated = false;
            report.results.publicSentiment = null;
            report.results.summary = 'Análisis de sentimiento no disponible (se conservan las fuentes verificadas tras la exclusión).';
            report.scoreDelta = null;
            report.lastChangeLog = `Revisión #${currentRevision + 1}: Se excluyó "${urlToExclude}". Análisis de sentimiento no disponible.${backfilledItem ? ' Se promovió 1 resultado del pool.' : ''}`;
        } else {
            const aiMap = new Map();
            if (Array.isArray(aiAudit.sourcesAnalysis)) {
                for (const item of aiAudit.sourcesAnalysis) {
                    if (item?.url) aiMap.set(item.url, item);
                }
            }

            report.results.sources = report.results.sources.map(s => {
                const aiData = aiMap.get(s.url);
                if (aiData) {
                    return {
                        ...s,
                        category: ['prensa', 'directorio', 'foro', 'perfil_profesional', 'institucional', 'otro'].includes(aiData.category)
                            ? aiData.category
                            : s.category,
                        sentiment: ['positivo', 'neutro', 'negativo'].includes(aiData.sentiment)
                            ? aiData.sentiment
                            : 'indeterminado',
                        aiJustification: aiData.justification || ''
                    };
                }
                return {
                    ...s,
                    sentiment: 'indeterminado',
                    aiJustification: 'No clasificado por IA.'
                };
            });

            const metrics = calculateWebReputationMetrics(report.results.sources);
            const newScore = metrics.calculatedScore;
            const scoreDelta = previousScore !== null && newScore !== null ? newScore - previousScore : null;

            report.metrics = metrics;
            report.results.brandScore = newScore;
            report.results.aiValidated = true;
            report.results.publicSentiment = {
                positive: metrics.sentimentPercentages.positivo,
                neutral: metrics.sentimentPercentages.neutro,
                negative: metrics.sentimentPercentages.negativo
            };
            report.results.summary = aiAudit.summary || report.results.summary;
            if (Array.isArray(aiAudit.reconciliations) && aiAudit.reconciliations.length > 0) {
                report.results.reconciliations = aiAudit.reconciliations;
            }
            report.scoreDelta = scoreDelta;
            report.lastChangeLog = `Revisión #${currentRevision + 1}: Se excluyó "${urlToExclude}". Variación de puntuación: ${scoreDelta !== null ? (scoreDelta >= 0 ? `+${scoreDelta}` : scoreDelta) + ' pts' : 'N/D'}.${backfilledItem ? ' Se promovió 1 resultado del pool.' : ''}`;
        }

        report.revision = currentRevision + 1;
        report.lastRecalculatedAt = new Date().toISOString();

        // Save updated history atomically
        history[reportIndex] = report;
        await writeJsonAtomic(historyPath, history);

        return NextResponse.json({
            success: true,
            report,
            scoreDelta: report.scoreDelta,
            changeLog: report.lastChangeLog
        });
    } catch (error) {
        console.error('Error en AI web audit recalculate route:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        if (releaseLock) {
            releaseLock();
        }
    }
}
