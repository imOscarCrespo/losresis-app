#!/usr/bin/env node
/**
 * validate_historical_2026.mjs
 *
 * Verificación por HISTÓRICO: para cada centro resuelto por fuzzy/override
 * (los que NO casaban por nombre exacto), re-descarga el detalle completo de CTO
 * (columnas de todos los años) y compara sus notas históricas (2019-2025) contra
 * las que el catálogo tiene guardadas para el hospital_id PROPUESTO.
 *
 * Idea: las notas históricas son la "huella" del hospital+especialidad. Si el
 * mapping es correcto, deben coincidir casi exactamente (misma fuente oficial).
 *
 * Verdicto por par (centro, especialidad):
 *   CONFIRMED   -> solape alto en los años comparables.
 *   WEAK        -> solape parcial (revisar).
 *   MISMATCH    -> no coincide (mapping probablemente erróneo).
 *   NO_HISTORY  -> el catálogo no tiene notas históricas para ese par (no se puede cruzar).
 *
 * Salida: scripts/output/historical_validation_2026.json
 * DRY RUN.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const CATALOG = path.join(REPO_ROOT, 'data', 'staticCatalog');
const OUT = path.join(__dirname, 'output');
const BASE = 'https://buscaresidencia.grupocto.com';
const AULA = process.argv.includes('--a') ? process.argv[process.argv.indexOf('--a') + 1] : '7CC37438-32E7-89DC-C35D-A5F1C65CDA94';
const CONCURRENCY = 8;
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf-8'));

// ---------- http ----------
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchText(url, { retries = 4, timeoutMs = 30000 } = {}) {
  let lastErr;
  for (let a = 0; a <= retries; a++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      clearTimeout(t);
      lastErr = e;
      if (a < retries) await sleep(500 * (a + 1));
    }
  }
  throw new Error(`fetch failed ${url}: ${lastErr?.message}`);
}
async function pool(items, limit, worker) {
  const out = new Array(items.length);
  let i = 0;
  const run = async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await worker(items[idx], idx);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return out;
}

// ---------- parse detalle: {year: [grades]} ----------
const clean = (s) => (s || '').replace(/<[^>]*>/g, '').replace(/&[a-zA-Z#0-9]+;/g, ' ').replace(/\s+/g, ' ').trim();
function parseAllYears(html) {
  const m = html.match(/<table class="tabla_plazas"[\s\S]*?<\/table>/);
  if (!m) return null;
  const rows = m[0].match(/<tr[\s\S]*?<\/tr>/g) || [];
  if (!rows.length) return null;
  const years = (rows[0].match(/<p>\s*(\d{4})\s*<\/p>/g) || []).map((p) => parseInt(p.replace(/<[^>]*>/g, ''), 10));
  const cols = years.map(() => []);
  for (const r of rows.slice(1)) {
    const tds = (r.match(/<td[\s\S]*?<\/td>/g) || []).map(clean);
    tds.forEach((v, ci) => {
      if (ci < cols.length && v) {
        const n = parseInt(v.replace(/[^\d]/g, ''), 10);
        if (!Number.isNaN(n)) cols[ci].push(n);
      }
    });
  }
  const byYear = {};
  years.forEach((y, ci) => (byYear[y] = cols[ci].sort((a, b) => a - b)));
  return byYear;
}

// ---------- comparación de conjuntos ----------
function jaccard(a, b) {
  const A = new Set(a), B = new Set(b);
  if (!A.size && !B.size) return 1;
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

// ---------- carga ----------
const fuzzy = readJson(path.join(OUT, 'fuzzy_matches_2026.json'));
const report = readJson(path.join(OUT, 'grades_2026_dryrun_report.json'));
const gradesTable = readJson(path.join(CATALOG, 'hospital_speciality_grades.json'));

// mapping propuesto: hospital_raw -> {hospital_id, hospital_name, tier}
const proposed = new Map();
for (const d of fuzzy) {
  if ((d.tier === 'AUTO' || d.tier === 'OVERRIDE') && d.best?.hospital_id) {
    proposed.set(d.hospital_raw, { hospital_id: d.best.hospital_id, hospital_name: d.best.name, tier: d.tier });
  }
}

// catálogo: (hid|sid|year) -> grades[]
const catByKey = new Map();
for (const r of gradesTable) catByKey.set(`${r.hospital_id}|${r.speciality_id}|${r.year}`, r.grades || []);

// filas a validar: NO_HOSPITAL_MATCH con mapping propuesto
const targets = report
  .filter((r) => r.status === 'NO_HOSPITAL_MATCH' && proposed.has(r.hospital_raw))
  .map((r) => ({ ...r, prop: proposed.get(r.hospital_raw) }));

console.log(`Pares a validar por histórico: ${targets.length} (de ${proposed.size} centros resueltos por fuzzy/override)`);

// ---------- fetch + comparar ----------
const HIST_YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025];
const results = await pool(targets, CONCURRENCY, async (t) => {
  const url = `${BASE}/plazas.php?a=${AULA}&id=${t.detalle_id}`;
  let byYear;
  try {
    byYear = parseAllYears(await fetchText(url));
  } catch (e) {
    return { ...stripInternal(t), verdict: 'FETCH_ERROR', error: e.message };
  }
  const hid = t.prop.hospital_id;
  const perYear = [];
  for (const y of HIST_YEARS) {
    const cto = byYear?.[y] || [];
    const cat = catByKey.get(`${hid}|${t.speciality_id}|${y}`) || [];
    if (cat.length === 0) continue; // catálogo sin histórico ese año
    const jac = +jaccard(cto, cat).toFixed(3);
    perYear.push({ year: y, cto_n: cto.length, cat_n: cat.length, exact: JSON.stringify(cto) === JSON.stringify(cat), jaccard: jac });
  }
  const comparable = perYear.length;
  const avgJac = comparable ? +(perYear.reduce((s, p) => s + p.jaccard, 0) / comparable).toFixed(3) : null;
  const exactYears = perYear.filter((p) => p.exact).length;
  let verdict;
  if (comparable === 0) verdict = 'NO_HISTORY';
  else if (avgJac >= 0.6 || exactYears >= 1) verdict = 'CONFIRMED';
  else if (avgJac >= 0.25) verdict = 'WEAK';
  else verdict = 'MISMATCH';
  return { ...stripInternal(t), verdict, comparable, exactYears, avgJaccard: avgJac, perYear };
});
function stripInternal(t) {
  return {
    tier: t.prop.tier,
    hospital_raw: t.hospital_raw,
    proposed_hospital: t.prop.hospital_name,
    proposed_hospital_id: t.prop.hospital_id,
    especialidad: t.especialidad,
    provincia: t.provincia,
  };
}

fs.writeFileSync(path.join(OUT, 'historical_validation_2026.json'), JSON.stringify(results, null, 2), 'utf-8');

// ---------- resumen por centro ----------
const byCentro = new Map();
for (const r of results) {
  if (!byCentro.has(r.hospital_raw)) byCentro.set(r.hospital_raw, { prop: r.proposed_hospital, tier: r.tier, prov: r.provincia, items: [] });
  byCentro.get(r.hospital_raw).items.push(r);
}
const count = (v) => results.filter((r) => r.verdict === v).length;
console.log('\n===== VALIDACIÓN HISTÓRICA =====');
console.log(`  CONFIRMED:  ${count('CONFIRMED')}`);
console.log(`  WEAK:       ${count('WEAK')}`);
console.log(`  MISMATCH:   ${count('MISMATCH')}`);
console.log(`  NO_HISTORY: ${count('NO_HISTORY')}`);
console.log(`  FETCH_ERROR:${count('FETCH_ERROR')}`);

console.log('\n--- por centro (verdicto agregado) ---');
for (const [raw, c] of [...byCentro.entries()].sort()) {
  const v = c.items.map((i) => i.verdict);
  const conf = v.filter((x) => x === 'CONFIRMED').length;
  const mis = v.filter((x) => x === 'MISMATCH').length;
  const weak = v.filter((x) => x === 'WEAK').length;
  const noh = v.filter((x) => x === 'NO_HISTORY').length;
  const tag = mis > 0 ? '⚠️ MISMATCH' : conf > 0 && mis === 0 && weak === 0 ? '✅' : conf > 0 ? '🟡 mixto' : noh === v.length ? '❔ sin histórico' : '🟡';
  console.log(`  ${tag}  ${raw}`);
  console.log(`        -> ${c.prop} [${c.tier}] | ${c.items.length} esp: CONF=${conf} WEAK=${weak} MIS=${mis} NOHIST=${noh}`);
  // mostrar detalle si hay algún mismatch o weak
  for (const it of c.items) {
    if (it.verdict === 'MISMATCH' || it.verdict === 'WEAK') {
      const yrs = (it.perYear || []).map((p) => `${p.year}:j${p.jaccard}(${p.cto_n}v${p.cat_n})`).join(' ');
      console.log(`           · ${it.especialidad} [${it.verdict}] ${yrs || 'sin años comparables'}`);
    }
  }
}
console.log('\nDetalle -> scripts/output/historical_validation_2026.json');
console.log('(DRY RUN)');
