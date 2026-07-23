#!/usr/bin/env node
/**
 * fuzzy_match_hospitals_2026.mjs
 *
 * Recupera los hospitales que el match exacto dejó sin resolver
 * (NO_HOSPITAL_MATCH en el dry run) mediante matching difuso, decidiendo UN
 * hospital_id por CENTRO distinto (no por par centro+especialidad) y con
 * salvaguardas para no atribuir notas al hospital equivocado:
 *
 *   - nombre:    Dice de bigramas + Jaccard de tokens (insensible a acentos).
 *   - cobertura: fracción de las especialidades del centro para las que el
 *                candidato TIENE fila 2026 (libre) en hospital_speciality_grades.
 *                Es la corroboración más fuerte: el hospital correcto oferta casi
 *                todas las especialidades que el centro trae.
 *   - provincia: refuerzo suave (provincia scrape vs city/region catálogo).
 *
 * Tiers por centro:
 *   AUTO   -> match seguro -> se añade al upsert recuperado.
 *   REVIEW -> candidato plausible, requiere confirmación humana.
 *   NONE   -> sin candidato razonable (hospital probablemente ausente del catálogo).
 *
 * Al aplicar un centro AUTO se generan filas para TODAS sus especialidades:
 *   - si el candidato tiene fila 2026 para esa especialidad -> UPDATE (slots del catálogo).
 *   - si no -> INSERT nueva (slots = nº notas).
 *
 * Salidas:
 *   scripts/output/fuzzy_matches_2026.json           -> decisión por centro + candidatos
 *   scripts/output/grades_2026_upsert.recovered.json -> upsert = exacto + AUTO recuperados
 *
 * DRY RUN: no escribe en Supabase.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const CATALOG = path.join(REPO_ROOT, 'data', 'staticCatalog');
const OUT = path.join(__dirname, 'output');
const YEAR = 2026;
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf-8'));

// ---------- similitud ----------
function normKey(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
const STOP = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'en', 'a', 'h', 'ud', 'udm', 'c', 'd']);
function tokens(s) {
  return new Set(normKey(s).split(' ').filter((t) => t && !STOP.has(t)));
}
function bigrams(s) {
  const k = normKey(s).replace(/ /g, '');
  const b = new Set();
  for (let i = 0; i < k.length - 1; i++) b.add(k.slice(i, i + 2));
  return b;
}
function dice(a, b) {
  const A = bigrams(a), B = bigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return (2 * inter) / (A.size + B.size);
}
function jaccard(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}
const nameScore = (a, b) => +(0.5 * dice(a, b) + 0.5 * jaccard(a, b)).toFixed(3);
function provinceMatch(provincia, hosp) {
  const p = normKey(provincia);
  if (!p) return false;
  const city = normKey(hosp.city), region = normKey(hosp.region);
  const ptok = new Set(p.split(' '));
  const has = (s) => s.split(' ').some((t) => ptok.has(t));
  return has(city) || has(region) || city.includes(p) || region.includes(p);
}

// ---------- carga ----------
const hospitals = readJson(path.join(CATALOG, 'hospitals.json'));
const gradesTable = readJson(path.join(CATALOG, 'hospital_speciality_grades.json'));
const report = readJson(path.join(OUT, 'grades_2026_dryrun_report.json'));
const hospitalById = new Map(hospitals.map((h) => [h.id, h]));

// overrides manuales verificados: hospital_raw -> hospital_id (o null = dejar sin resolver)
let OVERRIDES = {};
const overridesPath = path.join(__dirname, 'hospital_overrides_2026.json');
if (fs.existsSync(overridesPath)) {
  OVERRIDES = readJson(overridesPath);
  delete OVERRIDES._comment;
}

// filas 2026: sid -> Map(hospital_id -> slots)
const rowsBySpec = new Map();
for (const r of gradesTable) {
  if (r.year !== YEAR) continue;
  if (!rowsBySpec.has(r.speciality_id)) rowsBySpec.set(r.speciality_id, new Map());
  rowsBySpec.get(r.speciality_id).set(r.hospital_id, r.slots);
}
// pares ya reclamados por match verificado
const claimed = new Set();
for (const r of report) if (r.status === 'VERIFIED') claimed.add(`${r.hospital_id}|${r.speciality_id}`);

// ---------- agrupar los sin match por CENTRO distinto ----------
const centros = new Map(); // hospital_raw -> { provincia, rows:[{sid, especialidad, grades}] }
for (const r of report) {
  if (r.status !== 'NO_HOSPITAL_MATCH') continue;
  if (!centros.has(r.hospital_raw)) centros.set(r.hospital_raw, { provincia: r.provincia, rows: [] });
  centros.get(r.hospital_raw).rows.push({ sid: r.speciality_id, especialidad: r.especialidad, grades: r.grades });
}

// candidatos: hospitales del catálogo con >=1 fila 2026 libre en alguna especialidad del centro
function candidatesFor(centro) {
  const pool = new Map(); // hid -> {coveredSids:Set}
  for (const row of centro.rows) {
    const spec = rowsBySpec.get(row.sid);
    if (!spec) continue;
    for (const [hid, slots] of spec) {
      if (claimed.has(`${hid}|${row.sid}`)) continue; // fila ya ocupada por otro match
      if (!pool.has(hid)) pool.set(hid, new Set());
      pool.get(hid).add(row.sid);
    }
  }
  return pool;
}

// ---------- decidir por centro ----------
const decisions = [];
for (const [raw, centro] of centros) {
  const nSpecs = new Set(centro.rows.map((r) => r.sid)).size;
  const pool = candidatesFor(centro);
  const scored = [...pool.entries()]
    .map(([hid, coveredSids]) => {
      const h = hospitalById.get(hid);
      if (!h) return null;
      const ns = nameScore(raw, h.name);
      const coverage = +(coveredSids.size / nSpecs).toFixed(3);
      const prov = provinceMatch(centro.provincia, h);
      const score = +(0.55 * ns + 0.3 * coverage + (prov ? 0.15 : 0)).toFixed(3);
      return { hospital_id: hid, name: h.name, city: h.city, region: h.region, nameScore: ns, coverage, prov, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  const best = scored[0] || null;
  const second = scored[1] || null;
  const margin = best ? +(best.score - (second?.score ?? 0)).toFixed(3) : 0;

  // AUTO exige separación clara sobre el 2º candidato (margin) para no elegir
  // "a ciegas" entre candidatos casi empatados (típico en las áreas de Asturias).
  let tier = 'NONE';
  if (best) {
    const single = scored.length === 1;
    if (best.nameScore >= 0.8 && (margin >= 0.05 || single)) tier = 'AUTO'; // nombre casi idéntico
    else if (best.nameScore >= 0.5 && best.coverage >= 0.8 && best.prov && (margin >= 0.1 || single)) tier = 'AUTO';
    else if (best.score >= 0.3) tier = 'REVIEW';
    else tier = 'REVIEW';
  }

  // override manual verificado: fija el hospital_id y marca el centro como OVERRIDE
  let chosen = best;
  if (Object.prototype.hasOwnProperty.call(OVERRIDES, raw)) {
    const hid = OVERRIDES[raw];
    if (hid) {
      const h = hospitalById.get(hid);
      chosen = { hospital_id: hid, name: h?.name ?? '(desconocido)', city: h?.city, region: h?.region, nameScore: nameScore(raw, h?.name), coverage: null, prov: h ? provinceMatch(centro.provincia, h) : null, score: null };
      tier = 'OVERRIDE';
    } else {
      tier = 'NONE'; // override explícito a null: dejar sin resolver
    }
  }

  decisions.push({
    tier,
    hospital_raw: raw,
    provincia: centro.provincia,
    n_especialidades: nSpecs,
    n_notas: centro.rows.reduce((s, r) => s + r.grades.length, 0),
    margin,
    best: chosen,
    candidates: scored.slice(0, 3),
    especialidades: centro.rows.map((r) => r.especialidad),
    _rows: centro.rows,
  });
}
decisions.sort((a, b) => (b.best?.score ?? 0) - (a.best?.score ?? 0));

// Detección de colisiones: un hospital del catálogo no puede corresponder a dos
// centros CTO distintos. Si varios AUTO apuntan al mismo hospital_id, son
// ambiguos -> se degradan todos a REVIEW.
const autoByHid = new Map();
for (const d of decisions) {
  if (d.tier === 'AUTO' && d.best) {
    // los OVERRIDE son decisiones humanas y no se degradan por colisión con un AUTO
    if (!autoByHid.has(d.best.hospital_id)) autoByHid.set(d.best.hospital_id, []);
    autoByHid.get(d.best.hospital_id).push(d);
  }
}
let collisions = 0;
for (const [, group] of autoByHid) {
  if (group.length > 1) {
    for (const d of group) {
      d.tier = 'REVIEW';
      d.collision = true;
    }
    collisions += group.length;
  }
}

// ---------- construir upsert recuperado ----------
const baseUpsert = readJson(path.join(OUT, 'grades_2026_upsert.json'));
const recoveredRows = [];
for (const d of decisions) {
  if ((d.tier !== 'AUTO' && d.tier !== 'OVERRIDE') || !d.best) continue;
  const hid = d.best.hospital_id;
  for (const row of d._rows) {
    if (row.grades.length === 0) continue; // sin notas 2026: nada que aportar
    recoveredRows.push({
      hospital_id: hid,
      speciality_id: row.sid,
      year: YEAR,
      // slots = nº de filas con valor en la columna 2026 (header "(Sin plazas)" = bug web)
      slots: row.grades.length,
      grades: [...row.grades].sort((a, b) => a - b),
    });
  }
}

// merge por (hospital_id, speciality_id): un override puede coincidir con una fila
// ya presente en el upsert base -> se fusionan las notas (unión ordenada).
const upsertByPair = new Map();
let merges = 0;
for (const r of [...baseUpsert, ...recoveredRows]) {
  const key = `${r.hospital_id}|${r.speciality_id}`;
  if (upsertByPair.has(key)) {
    const prev = upsertByPair.get(key);
    const union = [...new Set([...prev.grades, ...r.grades])].sort((a, b) => a - b);
    prev.grades = union;
    prev.slots = Math.max(prev.slots, union.length);
    merges++;
  } else {
    upsertByPair.set(key, { ...r });
  }
}
const recovered = [...upsertByPair.values()];

// salida (sin campos internos)
const clean = decisions.map(({ _rows, ...d }) => d);
fs.writeFileSync(path.join(OUT, 'fuzzy_matches_2026.json'), JSON.stringify(clean, null, 2), 'utf-8');
fs.writeFileSync(path.join(OUT, 'grades_2026_upsert.recovered.json'), JSON.stringify(recovered, null, 2), 'utf-8');

// ---------- resumen ----------
const by = (t) => decisions.filter((d) => d.tier === t);
console.log('===== FUZZY MATCH por centro —', YEAR, '=====');
console.log(`Centros distintos sin match: ${decisions.length}`);
console.log(`  OVERRIDE (manual):  ${by('OVERRIDE').length}  (${by('OVERRIDE').reduce((s, d) => s + d.n_notas, 0)} notas)`);
console.log(`  AUTO (fuzzy):       ${by('AUTO').length}  (${by('AUTO').reduce((s, d) => s + d.n_notas, 0)} notas)`);
console.log(`  REVIEW:             ${by('REVIEW').length}  (${by('REVIEW').reduce((s, d) => s + d.n_notas, 0)} notas)`);
console.log(`  NONE:               ${by('NONE').length}`);
console.log(`  (degradados a REVIEW por colisión: ${collisions})`);
console.log('');
console.log(`Upsert base: ${baseUpsert.length}  +recuperadas: ${recoveredRows.length}  merges: ${merges}  = ${recovered.length}`);
console.log('');
console.log('--- OVERRIDE (mapeo manual verificado) ---');
for (const d of by('OVERRIDE')) {
  console.log(`  # ${d.hospital_raw}  (${d.provincia}, ${d.n_especialidades} esp) -> ${d.best.name} [${d.best.city}]`);
}
console.log('\n--- AUTO (centro -> hospital catálogo) ---');
for (const d of by('AUTO')) {
  console.log(`  ✔ ${d.hospital_raw}  (${d.provincia}, ${d.n_especialidades} esp)`);
  console.log(`      -> ${d.best.name} [${d.best.city}] score=${d.best.score} nombre=${d.best.nameScore} cob=${d.best.coverage} prov=${d.best.prov} margen=${d.margin}`);
}
console.log('\n--- REVIEW (confirmar candidato) ---');
for (const d of by('REVIEW')) {
  console.log(`  ? ${d.hospital_raw}  (${d.provincia}, ${d.n_especialidades} esp, ${d.n_notas} notas)`);
  for (const c of d.candidates) console.log(`       · ${c.name} [${c.city}] score=${c.score} nombre=${c.nameScore} cob=${c.coverage} prov=${c.prov}`);
}
console.log('\n--- NONE ---');
for (const d of by('NONE')) console.log(`  ✗ ${d.hospital_raw} (${d.provincia})`);
console.log('\nDetalle -> scripts/output/fuzzy_matches_2026.json');
console.log('Upsert  -> scripts/output/grades_2026_upsert.recovered.json');
console.log('(DRY RUN)');
