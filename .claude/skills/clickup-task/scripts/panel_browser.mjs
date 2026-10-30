#!/usr/bin/env node
// Prueba en navegador de losresis-panel: entra con una cuenta de pruebas y ejecuta el
// recorrido de la tarea, sacando capturas y comprobando textos.
//
// Uso:
//   node panel_browser.mjs <baseUrl> <recorrido.mjs> <dirCapturas> [--rol TUTOR|OWNER] [--abierto]
//
//   baseUrl       http://localhost:3100 (next dev) o https://panel.losresis.com
//   recorrido.mjs módulo de la tarea (en el scratchpad) con
//                   export default async ({ page, base, shot, check, mock }) => { ... }
//   --rol         cuenta de ~/.config/losresis/e2e-panel.env: TUTOR (Responsable de
//                 especialidad del Hospital E2E, por defecto) u OWNER.
//   --abierto     navegador visible y se queda abierto al terminar, para mirarlo a mano.
//
// Helpers del recorrido:
//   shot(nombre)              captura a <dirCapturas>/<nombre>.png
//   check(nombre, texto, [esperados])   apunta OK/FALLA si faltan textos
//   mock(handler)             intercepta /rest/v1/** ; handler(route, { tabla, select, url })
//                             devuelve true si respondió; lo demás va a la base real.
//
// La contraseña se lee del .env y no se imprime. NO hagas capturas antes de que el login
// termine: este script no te deja (el recorrido empieza ya dentro del panel).
//
// Playwright no está en el repo: instálalo en el scratchpad y pásalo con PW_DIR
//   npm i --prefix <scratchpad>/pw playwright@1.56.1
//   PW_DIR=<scratchpad>/pw node panel_browser.mjs ...
// Si no hay navegador de Playwright descargado: PW_DIR=... npx --prefix <scratchpad>/pw playwright install chromium

import { existsSync, readdirSync, readFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const [base, recorridoPath, out] = args.filter((arg, i) => !arg.startsWith("--") && args[i - 1] !== "--rol");
if (!base || !recorridoPath || !out) {
  console.error("Uso: node panel_browser.mjs <baseUrl> <recorrido.mjs> <dirCapturas> [--rol TUTOR|OWNER] [--abierto]");
  process.exit(2);
}
const rol = option("--rol", "TUTOR").toUpperCase();
const abierto = flag("--abierto");

const pwDir = process.env.PW_DIR;
if (!pwDir || !existsSync(join(pwDir, "node_modules/playwright"))) {
  console.error("MISSING_PLAYWRIGHT: npm i --prefix <scratchpad>/pw playwright@1.56.1 y pasa PW_DIR=<scratchpad>/pw");
  process.exit(2);
}
const { chromium } = await import(pathToFileURL(join(pwDir, "node_modules/playwright/index.mjs")).href);

const envFile = join(homedir(), ".config/losresis/e2e-panel.env");
if (!existsSync(envFile)) {
  console.error(`MISSING_CREDENTIALS: falta ${envFile} (PANEL_${rol}_EMAIL / PANEL_${rol}_PASSWORD)`);
  process.exit(2);
}
const env = Object.fromEntries(
  readFileSync(envFile, "utf8")
    .split("\n")
    .filter((line) => line.includes("="))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).trim()])
);
if (!env[`PANEL_${rol}_EMAIL`] || !env[`PANEL_${rol}_PASSWORD`]) {
  console.error(`MISSING_CREDENTIALS: ${envFile} no tiene PANEL_${rol}_EMAIL / PANEL_${rol}_PASSWORD`);
  process.exit(2);
}

// Usa el Chromium que Playwright tenga descargado; si su versión no cuadra, el más reciente
// de la caché (el binario de la revisión que pide la librería puede no estar).
const executablePath = (() => {
  try {
    const own = chromium.executablePath();
    if (existsSync(own)) return own;
  } catch {
    // Sigue abajo.
  }
  const cache = join(homedir(), "Library/Caches/ms-playwright");
  const revision = existsSync(cache)
    ? readdirSync(cache).filter((dir) => /^chromium-\d+$/.test(dir)).sort().pop()
    : null;
  const candidate = revision
    ? join(cache, revision, "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing")
    : null;
  return candidate && existsSync(candidate) ? candidate : undefined;
})();

mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: !abierto, executablePath });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(90000);

// next dev compila /login en frío: se espera al formulario con margen.
await page.goto(`${base}/login`, { waitUntil: "networkidle" });
await page.waitForSelector("#email");
await page.fill("#email", env[`PANEL_${rol}_EMAIL`]);
await page.fill("#password", env[`PANEL_${rol}_PASSWORD`]);
await page.keyboard.press("Enter");
await page.waitForURL(/dashboard/);
console.log(`LOGIN ${rol} en ${base}`);

const fallos = [];
const shot = async (nombre) => {
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(out, `${nombre}.png`) });
  console.log(`SHOT ${join(out, `${nombre}.png`)}`);
};
const check = (nombre, texto, esperados) => {
  const faltan = esperados.filter((esperado) => !String(texto).includes(esperado));
  faltan.forEach((esperado) => fallos.push(`${nombre}: falta «${esperado}»`));
  console.log(`${faltan.length ? "FALLA" : "OK   "} ${nombre}`);
};
const mock = async (handler) => {
  await page.unroute("**/rest/v1/**").catch(() => {});
  await page.route("**/rest/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const tabla = url.pathname.split("/rest/v1/")[1];
    const select = url.searchParams.get("select") || "";
    if (!(await handler(route, { tabla, select, url }))) await route.continue();
  });
};

const { default: recorrido } = await import(pathToFileURL(resolve(recorridoPath)).href);
try {
  await recorrido({ page, base, shot, check, mock });
} catch (err) {
  fallos.push(`recorrido: ${err.message.split("\n")[0]}`);
  await page.screenshot({ path: join(out, "error.png") }).catch(() => {});
}

console.log(fallos.length ? `\nFALLOS:\n${fallos.join("\n")}` : "\nTODO_OK");
if (abierto && !fallos.length) {
  console.log("Navegador abierto: ciérralo para terminar.");
  await new Promise((done) => browser.on("disconnected", done));
} else {
  await browser.close();
}
process.exit(fallos.length ? 1 : 0);
