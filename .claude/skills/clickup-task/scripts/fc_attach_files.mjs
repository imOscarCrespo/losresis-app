#!/usr/bin/env node
// Sube ficheros (capturas de la prueba en navegador) como adjuntos de una tarea de Freedcamp.
//
// Uso: node fc_attach_files.mjs <url-o-id> <fichero> [fichero...]
//
// Un fichero cuyo nombre ya está adjunto en la tarea no se vuelve a subir (una segunda
// pasada no duplica). El plan gratuito de Freedcamp limita cada fichero a 10 MB.
// No toca nada más de la tarea. Credenciales: ver freedcamp_api.mjs.

import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";
import { api, getTask, parseTaskRef } from "./freedcamp_api.mjs";

const MAX_BYTES = 10 * 1024 * 1024;
const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".pdf": "application/pdf" };

const [input, ...files] = process.argv.slice(2);
if (!input || files.length === 0) {
  console.error("Uso: node fc_attach_files.mjs <url-o-id> <fichero> [fichero...]");
  process.exit(2);
}

const taskId = parseTaskRef(input);
const { task } = await getTask(taskId);
const existing = new Set((task.files || []).map((file) => file.name || file.title));

let failed = 0;
for (const file of files) {
  const name = basename(file);
  if (existing.has(name)) {
    console.log(`SKIPPED ${name}: ya estaba adjunto`);
    continue;
  }
  if ((await stat(file)).size > MAX_BYTES) {
    console.error(`TOO_LARGE ${name}: pasa de 10 MB (límite del plan gratuito); redúcelo o recórtalo`);
    failed += 1;
    continue;
  }
  const extension = name.slice(name.lastIndexOf(".")).toLowerCase();
  const form = new FormData();
  form.append(
    "data",
    JSON.stringify({ project_id: String(task.project_id), application_id: "2", item_id: String(taskId), temporary: 0 })
  );
  form.append("file", new Blob([await readFile(file)], { type: MIME[extension] || "application/octet-stream" }), name);
  const response = await api("files", { method: "POST", form, soft: true });
  const uploaded = response.data?.files?.[0];
  if (response.status >= 300 || !uploaded) {
    console.error(`FREEDCAMP_ERROR ${response.status} subiendo ${name}: ${JSON.stringify(response).slice(0, 300)}`);
    failed += 1;
    continue;
  }
  console.log(`ATTACHED ${name} → file ${uploaded.id}`);
}
process.exit(failed ? 1 : 0);
