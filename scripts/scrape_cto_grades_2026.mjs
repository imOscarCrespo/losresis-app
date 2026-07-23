#!/usr/bin/env node
/**
 * scrape_cto_grades_2026.mjs
 *
 * Scrapea TODAS las notas 2026 de BuscaResidencia (Grupo CTO) vía el filtro de
 * especialidad del buscador (home.php -> buscar.php), que es la enumeración
 * completa: incluye pares hospital+especialidad sin ninguna plaza asignada en
 * 2026, que el "Listado de plazas" (flujo anterior) no mostraba.
 *
 * Flujo:
 *   1. home.php -> opciones del filtro de especialidad (GUID + nombre).
 *   2. Por cada especialidad: buscar.php?a=<AULA>&esp=<GUID>&ecom=&eprv=
 *      Cada <li class="elemento_busqueda"> trae "<ESPECIALIDAD> en <HOSPITAL>",
 *      la provincia y el enlace al detalle plazas.php?id=<GUID>.
 *      Se contrasta el nº de items parseados con el "N resultados" de la página.
 *   3. Cross-check: buscar.php?esp=all debe devolver el mismo conjunto de ids
 *      que la unión de las búsquedas por especialidad (si no, se avisa y se
 *      añaden los que falten).
 *   4. Cada detalle se descarga una vez. La tabla `tabla_plazas` ("La elección
 *      de plaza") está siempre en el HTML aunque en la web quede oculta tras el
 *      tab ESTADÍSTICAS. Se toma la columna 2026 y sus valores no vacíos: el
 *      nº de filas con valor ES el total de plazas (el header "(Sin plazas)"
 *      de 2026 es un bug de la web y se ignora).
 *   5. Los detalles sin tabla o sin columna 2026 se listan al final con su URL,
 *      especialidad y hospital (status NO_TABLE / NO_YEAR_COLUMN).
 *   6. Normaliza el nombre del hospital y, si es posible, lo cruza con
 *      data/staticCatalog/hospitals.json para adjuntar el UUID del catálogo.
 *
 * Salida: JSON (array), por defecto en scripts/output/cto_grades_2026.json.
 *   [{ especialidad, hospital, hospital_raw, hospital_id, provincia,
 *      detalle_id, url, status, slots_2026, grades_2026: number[] }, ...]
 *   (slots_2026 = nº de filas con valor en la columna 2026)
 *
 * Uso:
 *   node scripts/scrape_cto_grades_2026.mjs
 *   node scripts/scrape_cto_grades_2026.mjs --out ruta.json --concurrency 8 --a <AULA_GUID>
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

// ---------- args ----------
function parseArgs(argv) {
  const args = { a: '7CC37438-32E7-89DC-C35D-A5F1C65CDA94', concurrency: 8, out: null, year: '2026', maxPages: 200, limitDetails: 0 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--a') args.a = argv[++i];
    else if (k === '--concurrency') args.concurrency = parseInt(argv[++i], 10);
    else if (k === '--out') args.out = argv[++i];
    else if (k === '--year') args.year = argv[++i];
    else if (k === '--max-pages') args.maxPages = parseInt(argv[++i], 10);
    else if (k === '--limit-details') args.limitDetails = parseInt(argv[++i], 10); // solo para pruebas
  }
  return args;
}
const ARGS = parseArgs(process.argv.slice(2));
const BASE = 'https://buscaresidencia.grupocto.com';
const OUT = ARGS.out
  ? path.resolve(ARGS.out)
  : path.join(__dirname, 'output', `cto_grades_${ARGS.year}.json`);

// ---------- http ----------
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

async function fetchText(url, { retries = 4, timeoutMs = 30000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      clearTimeout(t);
      lastErr = err;
      if (attempt < retries) await sleep(500 * (attempt + 1)); // backoff
    }
  }
  throw new Error(`fetch failed for ${url}: ${lastErr?.message}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- html helpers ----------
const ENTITIES = {
  '&amp;': '&', '&nbsp;': ' ', '&quot;': '"', '&#34;': '"', '&#39;': "'", '&apos;': "'",
  '&lt;': '<', '&gt;': '>', '&aacute;': 'á', '&eacute;': 'é', '&iacute;': 'í', '&oacute;': 'ó',
  '&uacute;': 'ú', '&Aacute;': 'Á', '&Eacute;': 'É', '&Iacute;': 'Í', '&Oacute;': 'Ó',
  '&Uacute;': 'Ú', '&ntilde;': 'ñ', '&Ntilde;': 'Ñ', '&uuml;': 'ü', '&Uuml;': 'Ü', '&ordf;': 'ª',
  '&ordm;': 'º', '&deg;': '°',
};
function decodeEntities(s) {
  if (!s) return '';
  let out = s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)));
  out = out.replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)));
  return out.replace(/&[a-zA-Z]+;|&#\d+;/g, (m) => ENTITIES[m] ?? ENTITIES[m.toLowerCase()] ?? m);
}
const stripTags = (s) => (s || '').replace(/<[^>]*>/g, '');
const clean = (s) => decodeEntities(stripTags(s)).replace(/\s+/g, ' ').trim();

// Title Case respetando acrónimos cortos y siglas comunes de unidades docentes.
const KEEP_UPPER = new Set(['UD', 'UDM', 'AFYC', 'MPYSP', 'H', 'HU', 'HGU', 'CS', 'AGS']);
const KEEP_LOWER = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'en', 'a']);
function titleCase(s) {
  const words = s.split(/\s+/);
  return words
    .map((w, i) => {
      const bare = w.replace(/[.,]/g, '');
      if (KEEP_UPPER.has(bare.toUpperCase()) && bare === bare.toUpperCase()) return w; // ya en mayúsculas
      const lower = w.toLowerCase();
      if (i > 0 && KEEP_LOWER.has(lower.replace(/[.,]/g, ''))) return lower;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}

// clave para matching insensible a acentos/mayúsculas/puntuación
function normKey(s) {
  return clean(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------- buscador por especialidad ----------
// Opciones del filtro "Selecciona especialidad..." del home (GUID + nombre).
// El GUID de Psiquiatría infantil va en minúsculas, de ahí [A-Fa-f0-9-].
function parseEspecialidadesFiltro(html) {
  const start = html.indexOf('id="opciones_esp"');
  const end = html.indexOf('id="opciones_ecom"');
  if (start === -1) throw new Error('home.php: no se encontró el filtro de especialidades (opciones_esp)');
  const sec = html.slice(start, end === -1 ? undefined : end);
  const out = [];
  const re = /class="opcion" id="([A-Fa-f0-9-]{36})">\s*<p class="titulo">([\s\S]*?)<\/p>/g;
  let m;
  while ((m = re.exec(sec)) !== null) out.push({ id: m[1], name: clean(m[2]) });
  return out;
}

// Resultados de buscar.php: cada <li class="elemento_busqueda"> contiene
// "<ESPECIALIDAD> en <HOSPITAL>", la provincia y el enlace al detalle.
function parseBusqueda(html) {
  const items = [];
  const chunks = html.split('<li class="elemento_busqueda">').slice(1);
  for (const chunk of chunks) {
    const nombre = chunk.match(/<p class="nombre_busqueda">([\s\S]*?)<\/p>/);
    const prov = chunk.match(/<p class="provincia_busqueda">([\s\S]*?)<\/p>/);
    const link = chunk.match(/<a href="(plazas\.php\?a=[^"]*?id=([A-Fa-f0-9-]+))"[^>]*class="acceso_busqueda"/);
    if (!nombre || !link) continue;
    items.push({
      nombre: clean(nombre[1]),
      provincia: prov ? clean(prov[1]) : '',
      detalleId: link[2],
      href: `${BASE}/${link[1]}`,
    });
  }
  const declared = html.match(/(\d+)\s+resultados/);
  return { items, declared: declared ? parseInt(declared[1], 10) : null };
}

// "<ESPECIALIDAD> en <HOSPITAL>": el separador es el primer " en " en minúscula
// (especialidad y hospital se muestran en mayúsculas).
function splitNombreBusqueda(nombre) {
  const i = nombre.indexOf(' en ');
  if (i === -1) return { especialidad: '', centro: nombre };
  return { especialidad: nombre.slice(0, i).trim(), centro: nombre.slice(i + 4).trim() };
}

// ---------- detalle ----------
function parseDetalleGrades(html, year) {
  const tblMatch = html.match(/<table class="tabla_plazas"[\s\S]*?<\/table>/);
  if (!tblMatch) return null; // no hay tabla de elección de plaza
  const table = tblMatch[0];
  const rows = table.match(/<tr[\s\S]*?<\/tr>/g) || [];
  if (rows.length === 0) return null;

  // encabezado: cada <th> contiene <p>AÑO</p>
  const headerYears = (rows[0].match(/<p>\s*(\d{4})\s*<\/p>/g) || []).map((p) =>
    p.replace(/<[^>]*>/g, '').trim(),
  );
  const colIdx = headerYears.indexOf(String(year));
  if (colIdx === -1) return { years: headerYears, grades: [] };

  const grades = [];
  for (const row of rows.slice(1)) {
    const tds = (row.match(/<td[\s\S]*?<\/td>/g) || []).map((td) => clean(td));
    if (tds.length <= colIdx) continue;
    const raw = tds[colIdx];
    if (raw === '') continue;
    const num = parseInt(raw.replace(/[^\d]/g, ''), 10);
    if (!Number.isNaN(num)) grades.push(num);
  }
  return { years: headerYears, grades: grades.sort((a, b) => a - b) };
}

// ---------- catálogo de hospitales ----------
function loadHospitalIndex() {
  const p = path.join(REPO_ROOT, 'data', 'staticCatalog', 'hospitals.json');
  const index = new Map();
  try {
    const list = JSON.parse(fs.readFileSync(p, 'utf-8'));
    for (const h of list) {
      if (h?.name) index.set(normKey(h.name), { id: h.id, name: h.name });
    }
    console.log(`Catálogo de hospitales: ${index.size} nombres cargados`);
  } catch (err) {
    console.warn(`No se pudo cargar hospitals.json (${err.message}); se omite el matching por UUID.`);
  }
  return index;
}
function matchHospital(centro, index) {
  const key = normKey(centro);
  return index.get(key) || null; // solo match exacto normalizado (conservador)
}

// ---------- pool de concurrencia ----------
async function pool(items, limit, worker, onProgress) {
  const results = new Array(items.length);
  let next = 0;
  let done = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
      done++;
      if (onProgress && done % 50 === 0) onProgress(done, items.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

// ---------- main ----------
async function main() {
  console.log(`Aula (a): ${ARGS.a}`);
  console.log(`Año objetivo: ${ARGS.year} · concurrencia: ${ARGS.concurrency}`);

  // 1) Especialidades del filtro del home
  const homeHtml = await fetchText(`${BASE}/home.php?a=${ARGS.a}`);
  const especialidades = parseEspecialidadesFiltro(homeHtml);
  console.log(`Especialidades en el filtro: ${especialidades.length}`);

  // 2) Búsqueda por cada especialidad
  const byId = new Map(); // detalleId -> item
  const buscarUrl = (esp) => `${BASE}/buscar.php?a=${ARGS.a}&esp=${esp}&ecom=&eprv=`;
  for (const esp of especialidades) {
    const { items, declared } = parseBusqueda(await fetchText(buscarUrl(esp.id)));
    if (declared !== null && declared !== items.length) {
      console.warn(`  ⚠ ${esp.name}: la página declara ${declared} resultados pero se parsearon ${items.length}`);
    }
    for (const it of items) {
      const { especialidad, centro } = splitNombreBusqueda(it.nombre);
      if (normKey(especialidad) !== normKey(esp.name)) {
        console.warn(`  ⚠ "${it.nombre}": el prefijo no casa con la especialidad del filtro (${esp.name})`);
      }
      if (!byId.has(it.detalleId)) {
        byId.set(it.detalleId, { especialidad, centro, provincia: it.provincia, detalleId: it.detalleId, href: it.href });
      }
    }
    console.log(`  ${esp.name}: ${items.length} centros (acumulado ${byId.size})`);
  }

  // 3) Cross-check con "Todas las especialidades". esp=all incluye además las
  // especialidades EIR (ENFERMERÍA ...), que no están en el filtro MIR ni en
  // nuestro catálogo: se excluyen (son otro ranking de examen), solo se cuentan.
  const all = parseBusqueda(await fetchText(buscarUrl('all')));
  console.log(`Cross-check esp=all: ${all.items.length} resultados (declarados: ${all.declared})`);
  let extras = 0;
  let enfermeria = 0;
  for (const it of all.items) {
    if (byId.has(it.detalleId)) continue;
    const { especialidad, centro } = splitNombreBusqueda(it.nombre);
    if (/^ENFERMER/i.test(normKey(especialidad).toUpperCase())) {
      enfermeria++;
      continue;
    }
    extras++;
    console.warn(`  ⚠ solo en esp=all: ${it.nombre} (${it.detalleId})`);
    byId.set(it.detalleId, { especialidad, centro, provincia: it.provincia, detalleId: it.detalleId, href: it.href });
  }
  console.log(`  excluidos EIR (ENFERMERÍA, fuera del catálogo): ${enfermeria}`);
  if (extras === 0) console.log('  unión por especialidad MIR == esp=all ✓');

  let unique = [...byId.values()];
  if (ARGS.limitDetails > 0) {
    unique = unique.slice(0, ARGS.limitDetails);
    console.log(`(modo prueba) limitado a ${unique.length} detalles`);
  }
  console.log(`Detalles únicos a descargar (hospital+especialidad): ${unique.length}`);

  // 4) Descargar detalles y extraer notas 2026
  const hospitalIndex = loadHospitalIndex();
  const results = await pool(
    unique,
    ARGS.concurrency,
    async (r) => {
      let detalle;
      let status;
      try {
        const html = await fetchText(r.href);
        detalle = parseDetalleGrades(html, ARGS.year);
        if (detalle === null) status = 'NO_TABLE';
        else if (!detalle.years.includes(String(ARGS.year))) status = 'NO_YEAR_COLUMN';
        else status = 'OK';
      } catch (err) {
        console.warn(`  ✗ detalle ${r.detalleId} (${r.centro}): ${err.message}`);
        detalle = null;
        status = 'FETCH_ERROR';
      }
      const match = matchHospital(r.centro, hospitalIndex);
      const grades = detalle?.grades ?? [];
      return {
        especialidad: r.especialidad,
        hospital: match ? match.name : titleCase(r.centro),
        hospital_raw: r.centro,
        hospital_id: match ? match.id : null,
        provincia: r.provincia,
        detalle_id: r.detalleId,
        url: r.href,
        status,
        slots_2026: grades.length, // nº de filas con valor en la columna 2026 = total de plazas
        grades_2026: grades,
      };
    },
    (done, total) => console.log(`  detalles procesados: ${done}/${total}`),
  );

  // 5) Escribir salida
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(results, null, 2), 'utf-8');

  // Resumen
  const conNotas = results.filter((r) => r.grades_2026.length > 0).length;
  const totalNotas = results.reduce((s, r) => s + r.grades_2026.length, 0);
  const conMatch = results.filter((r) => r.hospital_id).length;
  const sinInfo = results.filter((r) => r.status !== 'OK');
  const vacios = results.filter((r) => r.status === 'OK' && r.grades_2026.length === 0);
  console.log('\n===== RESUMEN =====');
  console.log(`Registros (hospital+especialidad): ${results.length}`);
  console.log(`  con al menos 1 nota 2026:       ${conNotas}`);
  console.log(`  columna 2026 vacía (0 plazas):  ${vacios.length}`);
  console.log(`  notas 2026 totales extraídas:   ${totalNotas}`);
  console.log(`  hospital cruzado con catálogo:  ${conMatch}/${results.length} (por UUID)`);
  console.log(`  sin información (revisar):      ${sinInfo.length}`);
  for (const r of sinInfo) {
    console.log(`    ✗ [${r.status}] ${r.especialidad} | ${r.hospital_raw} -> ${r.url}`);
  }
  console.log(`Archivo generado: ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
