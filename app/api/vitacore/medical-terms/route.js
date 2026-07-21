import { NextResponse } from 'next/server';
import { join } from 'path';
import sqlite3 from 'sqlite3';

let dbInstance = null;

function getDb() {
    if (!dbInstance) {
        const dbPath = join(process.cwd(), 'data', 'glosario_medico_bilingue.sqlite');
        dbInstance = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                console.error('Error opening sqlite3 database:', err);
            }
        });
    }
    return dbInstance;
}

function runQuery(db, sql, params) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q');
        const source = searchParams.get('source'); // 'ICD-11', 'RxNorm', 'LOINC', 'Orphanet', etc.
        const limitParam = parseInt(searchParams.get('limit') || '25', 10);
        const limit = Math.min(Math.max(limitParam, 1), 100);

        if (!query || query.trim().length < 2) {
            return NextResponse.json({ success: true, terms: [] });
        }

        const db = getDb();
        const searchTerm = query.trim();
        const searchLike = `${searchTerm}%`;
        const searchContains = `%${searchTerm}%`;

        let sql = `
            SELECT 
                g.term_id,
                g.source,
                g.concept_id,
                g.language,
                g.term,
                g.preferred,
                g.term_type,
                i.code AS icd_code,
                i.chapter_no AS icd_chapter
            FROM glossary_terms g
            LEFT JOIN icd11 i ON g.source = 'ICD-11' AND g.concept_id = i.foundation_uri
            WHERE (g.term LIKE ? OR g.term LIKE ?)
        `;

        const params = [searchLike, searchContains];

        if (source && source !== 'all') {
            sql += ` AND g.source = ?`;
            params.push(source);
        }

        // Prioritize terms starting with search query and preferred terms
        sql += ` ORDER BY (CASE WHEN g.term LIKE ? THEN 0 ELSE 1 END), g.preferred DESC, LENGTH(g.term) ASC LIMIT ?`;
        params.push(searchLike, limit);

        const rows = await runQuery(db, sql, params);

        const terms = rows.map(r => {
            const cleanedTerm = (r.term || '').replace(/^[\s\-]+/, '');
            return {
                id: r.term_id,
                source: r.source,
                conceptId: r.concept_id,
                language: r.language,
                term: cleanedTerm,
                rawTerm: r.term,
                preferred: r.preferred === 1,
                termType: r.term_type,
                icdCode: r.icd_code || null,
                icdChapter: r.icd_chapter || null
            };
        });

        return NextResponse.json({ success: true, count: terms.length, terms });

    } catch (error) {
        console.error('Error in /api/vitacore/medical-terms:', error);
        return NextResponse.json({ error: error.message || 'Error al consultar la base médica.' }, { status: 500 });
    }
}
