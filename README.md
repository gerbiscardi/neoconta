# Glosario médico bilingüe integrado

Base SQLite generada a partir de archivos oficiales aportados por el usuario.

## Fuentes
- ICD-11 MMS 2025-01, español e inglés
- LOINC 2.82, inglés y variante española de Argentina
- RxNorm Current Prescribable Content 2026-07-06
- NCI Thesaurus 26.06e FLAT
- MeSH Descriptors 2026
- MeSH Supplementary Concept Records 2026, importación completa
- Orphanet 2026-06-23, español e inglés

## Resultado
- Integridad SQLite: ok
- Términos del índice unificado: 4,693,049
- MeSH Supplemental: 324,040 registros
- Términos MeSH Supplemental: 728,984
- Tamaño SQLite: 1.730 GiB
- SHA-256: `0a96424909c94bd9d4169d65d474fabadb5eee9550ec569a937b33b370014da3`

## Uso básico
```sql
SELECT source, concept_id, language, term
FROM glossary_terms
WHERE term = 'diabetes mellitus' COLLATE NOCASE;

SELECT source, concept_id, language, term
FROM glossary_terms
WHERE term LIKE 'cardiomiopat%' COLLATE NOCASE
LIMIT 100;
```

## Advertencia
La base es terminológica y documental. No reemplaza validación médica ni constituye un sistema de apoyo a decisiones clínicas.
Las licencias y atribuciones de cada fuente deben conservarse en cualquier redistribución o producto derivado.
