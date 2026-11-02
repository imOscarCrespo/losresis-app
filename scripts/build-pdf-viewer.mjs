// Envuelve el visor de PDFs compilado (pdf-web/build/index.html) en un módulo
// JS que la app importa. Lo lanza `npm run pdfviewer:build`.
import { readFileSync, writeFileSync } from "node:fs";

const html = readFileSync("pdf-web/build/index.html", "utf8");
const out = "components/resinotes/pdf/pdfViewerHtml.js";
writeFileSync(
  out,
  "// @ts-nocheck\n/* eslint-disable */\n" +
    "// Generado con `npm run pdfviewer:build` desde pdf-web/. No editar a mano.\n" +
    `export const pdfViewerHtml = ${JSON.stringify(html)};\n`
);
console.log(`Built PDF viewer: ${out} (${Math.round(html.length / 1024)} KB)`);
