#!/usr/bin/env node
/**
 * dryrun_grades_2026_upsert.mjs
 *
 * DRY RUN — no toca Supabase. Verifica que las notas scrapeadas (salida de
 * scrape_cto_grades_2026.mjs) casan correctamente con el catálogo y prepara el
 * JSON de upsert para `hospital_speciality_grades` (año 2026).
 *
 * Verificación del match DOBLE (hospital + especialidad):
 *   1. especialidad (texto CTO) -> speciality_id vía specialities.json (+ alias).
 *   2. hospital_id ya viene resuelto en la salida del scraper.
 *   3. Se confirma el par (hospital_id, speciality_id) contra las filas de 2026
 *      que YA existen en hospital_speciality_grades.json (hoy con grades: []).
 *      Si el par existe, el match es correcto y conocemos los `slots` ofertados.
 *   4. Se contrasta nº de notas scrapeadas vs `slots` del catálogo.
 *
 * Salidas:
 *   scripts/output/grades_2026_upsert.json  -> filas listas para upsert
 *        [{ hospital_id, speciality_id, year, slots, grades }]
 *   scripts/output/grades_2026_dryrun_report.json -> detalle por registro
 *        (incluye nombres legibles, estado y checks) para revisión manual.
 *
 * Uso:
 *   node scripts/dryrun_grades_2026_upsert.mjs
 *   node scripts/dryrun_grades_2026_upsert.mjs --in scripts/output/cto_grades_2026.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const CATALOG = path.join(REPO_ROOT, 'data', 'staticCatalog');

// ---------- args ----------
function parseArgs(argv) {
  const args = {
    in: path.join(__dirname, 'output', 'cto_grades_2026.json'),
    year: 2026,
    outUpsert: path.join(__dirname, 'output', 'grades_2026_upsert.json'),
    outReport: path.join(__dirname, 'output', 'grades_2026_dryrun_report.json'),
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--in') args.in = path.resolve(argv[++i]);
    else if (k === '--year') args.year = parseInt(argv[++i], 10);
    else if (k === '--out-upsert') args.outUpsert = path.resolve(argv[++i]);
    else if (k === '--out-report') args.outReport = path.resolve(argv[++i]);
  }
  return args;
}
const ARGS = parseArgs(process.argv.slice(2));

// ---------- helpers ----------
function normKey(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf-8'));

// Alias de especialidades: normKey del texto CTO -> normKey del catálogo.
// El catálogo tiene el typo "OFTAMOLOGIA" (le falta la L) frente a "OFTALMOLOGÍA".
const SPECIALITY_ALIASES = {
  oftalmologia: 'oftamologia',
};

// ---------- carga ----------
const scrape = readJson(ARGS.in);
const specialities = readJson(path.join(CATALOG, 'specialities.json'));
const hospitals = readJson(path.join(CATALOG, 'hospitals.json'));
const gradesTable = readJson(path.join(CATALOG, 'hospital_speciality_grades.json'));

const specByKey = new Map();
for (const s of specialities) specByKey.set(normKey(s.name), s);
const hospitalById = new Map(hospitals.map((h) => [h.id, h]));

// Índice de filas del catálogo para el año objetivo: "hid|sid" -> fila
const catalogYear = new Map();
for (const r of gradesTable) {
  if (r.year === ARGS.year) catalogYear.set(`${r.hospital_id}|${r.speciality_id}`, r);
}

function resolveSpecialityId(especialidad) {
  const key = normKey(especialidad);
  const direct = specByKey.get(key);
  if (direct) return direct;
  const aliased = SPECIALITY_ALIASES[key];
  if (aliased && specByKey.get(aliased)) return specByKey.get(aliased);
  return null;
}

// ---------- clasificación ----------
const report = [];
const seenPairs = new Map(); // hid|sid -> índice en report (para detectar duplicados)

for (const rec of scrape) {
  const spec = resolveSpecialityId(rec.especialidad);
  const speciality_id = spec ? spec.id : null;
  const hospital_id = rec.hospital_id || null;
  const grades = Array.isArray(rec.grades_2026) ? [...rec.grades_2026].sort((a, b) => a - b) : [];

  let status;
  let catalogRow = null;
  if (!hospital_id) status = 'NO_HOSPITAL_MATCH';
  else if (!speciality_id) status = 'NO_SPECIALITY_MATCH';
  else {
    const pairKey = `${hospital_id}|${speciality_id}`;
    catalogRow = catalogYear.get(pairKey) || null;
    status = catalogRow ? 'VERIFIED' : 'PAIR_NOT_IN_CATALOG';
  }

  const catalogSlots = catalogRow ? catalogRow.slots : null;
  const slotsCheck =
    catalogRow != null ? (catalogSlots === grades.length ? 'OK' : 'MISMATCH') : 'N/A';

  const entry = {
    status,
    slotsCheck,
    especialidad: rec.especialidad,
    speciality_id,
    speciality_name: spec ? spec.name : null,
    hospital: rec.hospital,
    hospital_raw: rec.hospital_raw,
    hospital_id,
    hospital_name_catalog: hospital_id ? hospitalById.get(hospital_id)?.name ?? null : null,
    provincia: rec.provincia,
    detalle_id: rec.detalle_id,
    grades_count: grades.length,
    catalog_slots: catalogSlots,
    grades,
  };

  // detectar par duplicado (dos centros CTO que colapsan al mismo hospital_id)
  if (hospital_id && speciality_id) {
    const pairKey = `${hospital_id}|${speciality_id}`;
    if (seenPairs.has(pairKey)) {
      entry.status = 'DUPLICATE_PAIR';
      report[seenPairs.get(pairKey)].status = 'DUPLICATE_PAIR';
    } else {
      seenPairs.set(pairKey, report.length);
    }
  }
  report.push(entry);
}

// ---------- upsert ----------
// Se incluyen los pares con match doble correcto:
//   - VERIFIED: fila 2026 ya existe -> UPDATE (rellena grades).
//   - PAIR_NOT_IN_CATALOG: par válido sin fila 2026 sembrada -> INSERT nueva fila.
// slots = nº de filas con valor en la columna 2026 de CTO (el header "(Sin
// plazas)" es un bug de la web); los pares sin ninguna nota no aportan nada.
const UPSERTABLE = new Set(['VERIFIED', 'PAIR_NOT_IN_CATALOG']);
const upsert = report
  .filter((r) => UPSERTABLE.has(r.status) && r.grades.length > 0)
  .map((r) => ({
    hospital_id: r.hospital_id,
    speciality_id: r.speciality_id,
    year: ARGS.year,
    slots: r.grades.length,
    grades: r.grades,
  }));

// ---------- escritura ----------
fs.mkdirSync(path.dirname(ARGS.outUpsert), { recursive: true });
fs.writeFileSync(ARGS.outUpsert, JSON.stringify(upsert, null, 2), 'utf-8');
fs.writeFileSync(ARGS.outReport, JSON.stringify(report, null, 2), 'utf-8');

// ---------- resumen ----------
const by = (s) => report.filter((r) => r.status === s).length;
const verified = report.filter((r) => r.status === 'VERIFIED');
const slotMismatch = verified.filter((r) => r.slotsCheck === 'MISMATCH');
const gradesInUpsert = upsert.reduce((s, r) => s + r.grades.length, 0);
const gradesTotal = report.reduce((s, r) => s + r.grades_count, 0);

console.log('===== DRY RUN — hospital_speciality_grades', ARGS.year, '=====');
console.log(`Registros scrapeados:        ${report.length}`);
console.log(`  VERIFIED (par en catálogo): ${by('VERIFIED')}`);
console.log(`  PAIR_NOT_IN_CATALOG:        ${by('PAIR_NOT_IN_CATALOG')}`);
console.log(`  NO_SPECIALITY_MATCH:        ${by('NO_SPECIALITY_MATCH')}`);
console.log(`  NO_HOSPITAL_MATCH:          ${by('NO_HOSPITAL_MATCH')}`);
console.log(`  DUPLICATE_PAIR:             ${by('DUPLICATE_PAIR')}`);
console.log('');
console.log(`Filas listas para upsert:    ${upsert.length}`);
console.log(`  · UPDATE (fila 2026 ya existe): ${by('VERIFIED')}`);
console.log(`  · INSERT (fila 2026 nueva):     ${by('PAIR_NOT_IN_CATALOG')}`);
console.log(`  notas en el upsert:        ${gradesInUpsert} / ${gradesTotal} scrapeadas`);
console.log(`  slots == nº notas (OK):    ${verified.length - slotMismatch.length}/${verified.length}`);
console.log(`  slots != nº notas (revisar): ${slotMismatch.length}`);
if (slotMismatch.length) {
  console.log('\n  Ejemplos de discrepancia slots vs notas:');
  for (const r of slotMismatch.slice(0, 10)) {
    console.log(`    · ${r.hospital_raw} | ${r.especialidad}: slots=${r.catalog_slots}, notas=${r.grades_count}`);
  }
}
console.log('');
console.log(`Upsert  -> ${ARGS.outUpsert}`);
console.log(`Reporte -> ${ARGS.outReport}`);
console.log('\n(DRY RUN: no se ha escrito nada en Supabase.)');
