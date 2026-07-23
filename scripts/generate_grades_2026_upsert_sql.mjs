#!/usr/bin/env node
/**
 * generate_grades_2026_upsert_sql.mjs
 *
 * Convierte scripts/output/grades_2026_upsert.recovered.json en un fichero SQL
 * para ejecutar A MANO en el SQL Editor de la web de Supabase:
 *
 *   INSERT INTO hospital_speciality_grades (hospital_id, speciality_id, year, slots, grades)
 *   VALUES (...), (...) ...
 *   ON CONFLICT (hospital_id, speciality_id, year) DO UPDATE
 *     SET slots = EXCLUDED.slots, grades = EXCLUDED.grades;
 *
 * La PK de la tabla es compuesta (hospital_id, speciality_id, year) y `grades`
 * es integer[], verificado contra el OpenAPI de PostgREST el 2026-07-22.
 * Todo va en una única transacción con un SELECT de verificación al final.
 *
 * Salida: scripts/output/grades_2026_upsert.sql
 * No toca la base de datos.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IN = path.join(__dirname, 'output', 'grades_2026_upsert.recovered.json');
const OUT = path.join(__dirname, 'output', 'grades_2026_upsert.sql');

const rows = JSON.parse(fs.readFileSync(IN, 'utf-8'));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const values = rows.map((r) => {
  if (!UUID.test(r.hospital_id) || !UUID.test(r.speciality_id)) {
    throw new Error(`UUID inválido en ${JSON.stringify(r)}`);
  }
  if (!Number.isInteger(r.year) || !Number.isInteger(r.slots)) {
    throw new Error(`year/slots no enteros en ${JSON.stringify(r)}`);
  }
  if (!Array.isArray(r.grades) || r.grades.some((g) => !Number.isInteger(g))) {
    throw new Error(`grades no es int[] en ${JSON.stringify(r)}`);
  }
  return `('${r.hospital_id}','${r.speciality_id}',${r.year},${r.slots},'{${r.grades.join(',')}}')`;
});

const totalNotas = rows.reduce((s, r) => s + r.grades.length, 0);

const sql = `-- Upsert de notas MIR 2026 en hospital_speciality_grades
-- Generado por scripts/generate_grades_2026_upsert_sql.mjs
-- Fuente: scripts/output/grades_2026_upsert.recovered.json
-- ${rows.length} filas, ${totalNotas} notas. slots = nº de notas de la columna 2026 de CTO.
-- Ejecutar en: Supabase web -> SQL Editor -> pegar/abrir este fichero -> Run.

BEGIN;

INSERT INTO public.hospital_speciality_grades (hospital_id, speciality_id, year, slots, grades) VALUES
${values.join(',\n')}
ON CONFLICT (hospital_id, speciality_id, year) DO UPDATE
  SET slots = EXCLUDED.slots,
      grades = EXCLUDED.grades;

COMMIT;

-- Verificación (debe salir en el panel de resultados):
SELECT
  count(*)                                        AS filas_2026,
  count(*) FILTER (WHERE cardinality(grades) > 0) AS filas_con_notas,
  coalesce(sum(cardinality(grades)), 0)           AS notas_totales
FROM public.hospital_speciality_grades
WHERE year = 2026;
`;

fs.writeFileSync(OUT, sql, 'utf-8');
console.log(`SQL generado: ${OUT}`);
console.log(`  filas en el upsert: ${rows.length}`);
console.log(`  notas totales:      ${totalNotas}`);
console.log(`  tamaño:             ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
