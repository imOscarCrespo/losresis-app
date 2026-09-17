/**
 * Genera el catálogo geográfico propio a partir de `country-state-city`.
 *
 * Por qué existe:
 * `country-state-city` hace `require("./assets/city.json")` en la raíz de su
 * index, así que importar `Country` o `City` arrastra las 148.038 ciudades del
 * mundo. Como los tres consumidores (ExternalRotationsScreen, RotationModal,
 * RotationReviewModal) cuelgan del grafo de imports de App.js, Hermes
 * materializaba ese array literal de 148.038 elementos EN CADA ARRANQUE, dentro
 * de `createArrayFromBuffer`, internando un identificador por entrada. Reventaba
 * a media faena (SIGSEGV en `StringPrimitive::castToUTF16Ref`, en índices
 * 130.382-141.504) y se llevaba la app por delante antes del primer render.
 *
 * Qué hace esto:
 * - `data/geo/countries.json`: los 250 países, solo con lo que usa la app.
 * - `data/geo/cities/<ISO>.json`: un fichero por país, cargado de forma perezosa.
 *   Lo que mata el crash es que en el arranque no se materializa ninguno: el
 *   array literal solo se construye cuando el usuario elige un país, y el país
 *   más grande (US) son 19.821 ciudades, muy lejos de las 148.038 que reventaban.
 *
 * Uso: node scripts/generate_geo_catalog.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(REPO_ROOT, "node_modules", "country-state-city", "lib", "assets");
const OUT = path.join(REPO_ROOT, "data", "geo");
const CITIES_OUT = path.join(OUT, "cities");

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

// city.json ya viene compacto: [name, countryCode, stateCode, lat, lng].
const CITY_NAME = 0;
const CITY_COUNTRY = 1;
const CITY_LAT = 3;
const CITY_LNG = 4;

const cities = readJson(path.join(SRC, "city.json"));
const countries = readJson(path.join(SRC, "country.json"));

fs.rmSync(CITIES_OUT, { recursive: true, force: true });
fs.mkdirSync(CITIES_OUT, { recursive: true });

// Agrupar por país, quedándonos solo con los campos que la app lee de verdad
// (nombre, latitud y longitud). El stateCode no lo usa nadie.
const byCountry = new Map();
for (const row of cities) {
  const code = row[CITY_COUNTRY];
  if (!code) continue;
  if (!byCountry.has(code)) byCountry.set(code, []);
  byCountry.get(code).push([row[CITY_NAME], row[CITY_LAT], row[CITY_LNG]]);
}

// `City.getCitiesOfCountry` ordenaba por nombre con el comparador de la librería
// (`<`/`>` sobre el string, no `localeCompare`). Los selectores de ciudad
// dependen de ese orden, así que lo reproducimos aquí: agrupar preserva el orden
// del fichero, igual que hacía su `filter`, y encima va un sort estable por
// nombre. Con eso la salida es idéntica a la que devolvía la librería.
const byName = (a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);

const codes = [...byCountry.keys()].sort();
for (const code of codes) {
  const rows = byCountry.get(code).sort(byName);
  fs.writeFileSync(path.join(CITIES_OUT, `${code}.json`), JSON.stringify(rows) + "\n");
}

// Metro no resuelve requires con ruta variable, así que el mapa de cargadores se
// genera estático. Cada entrada es perezosa: el fichero del país no se evalúa
// hasta que alguien lo pide.
const loaderEntries = codes
  .map((code) => `  ${JSON.stringify(code)}: () => require("./cities/${code}.json"),`)
  .join("\n");

fs.writeFileSync(
  path.join(OUT, "cityLoaders.js"),
  `// GENERADO por scripts/generate_geo_catalog.mjs — no editar a mano.\n` +
    `// Un require perezoso por país: solo se materializa el que se pide.\n` +
    `export const CITY_LOADERS = {\n${loaderEntries}\n};\n`
);

fs.writeFileSync(
  path.join(OUT, "countries.json"),
  JSON.stringify(
    countries.map(({ name, isoCode }) => ({ name, isoCode })),
    null,
    0
  ) + "\n"
);

const totalCities = codes.reduce((n, c) => n + byCountry.get(c).length, 0);
const biggest = codes
  .map((c) => [c, byCountry.get(c).length])
  .sort((a, b) => b[1] - a[1])[0];

console.log(`✅ ${countries.length} países -> data/geo/countries.json`);
console.log(
  `✅ ${codes.length} ficheros de ciudades (${totalCities.toLocaleString()} ciudades) -> data/geo/cities/`
);
console.log(`   el país más grande es ${biggest[0]} con ${biggest[1].toLocaleString()} ciudades`);
