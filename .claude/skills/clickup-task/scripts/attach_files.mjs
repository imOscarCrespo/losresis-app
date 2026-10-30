#!/usr/bin/env node
// Sube ficheros (capturas de la prueba en navegador) como adjuntos de una tarea de ClickUp.
//
// Uso: node attach_files.mjs <url-o-taskId> <fichero> [fichero...]
//
// Un fichero cuyo nombre ya está adjunto en la tarea no se vuelve a subir (una segunda
// pasada no duplica). Nombra las capturas con el número de la tarea y lo que enseñan
// (p. ej. 86cbm0wun-inicio-mixto.png). No toca nada más de la tarea.
// Mismas credenciales que fetch_task.mjs:
//   1. Variable de entorno CLICKUP_TOKEN
//   2. Fichero ~/.config/clickup/credentials con una línea CLICKUP_TOKEN=pk_...

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";

async function loadToken() {
  let token = process.env.CLICKUP_TOKEN;
  if (token) return token;
  try {
    const raw = await readFile(join(homedir(), ".config/clickup/credentials"), "utf8");
    for (const line of raw.split("\n")) {
      const match = line.match(/^\s*CLICKUP_TOKEN\s*=\s*"?([^"\s]+)"?/);
      if (match) token ||= match[1];
    }
  } catch {
    // Sin fichero: se informa abajo.
  }
  if (!token) {
    console.error("MISSING_CREDENTIALS: define CLICKUP_TOKEN o crea ~/.config/clickup/credentials");
    process.exit(2);
  }
  return token;
}

function parseTaskRef(input) {
  const url = input.match(/clickup\.com\/t\/(?:(\d+)\/)?([A-Za-z0-9_-]+)/);
  const [workspaceId, taskId] = url ? [url[1], url[2]] : [undefined, input];
  if (!/^[A-Za-z0-9_-]+$/.test(taskId)) {
    console.error(`INVALID_TASK: no reconozco "${input}" como URL o ID de tarea de ClickUp`);
    process.exit(2);
  }
  const isCustom = taskId.includes("-");
  if (isCustom && !workspaceId) {
    console.error(`INVALID_TASK: "${taskId}" es un ID personalizado; pasa la URL completa con el workspace`);
    process.exit(2);
  }
  return { workspaceId, taskId, isCustom };
}

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".pdf": "application/pdf" };

const [input, ...files] = process.argv.slice(2);
if (!input || files.length === 0) {
  console.error("Uso: node attach_files.mjs <url-o-taskId> <fichero> [fichero...]");
  process.exit(2);
}

const token = await loadToken();
const { workspaceId, taskId, isCustom } = parseTaskRef(input);
const query = isCustom ? `?custom_task_ids=true&team_id=${workspaceId}` : "";

const taskResponse = await fetch(`https://api.clickup.com/api/v2/task/${taskId}${query}`, {
  headers: { Authorization: token },
});
if (!taskResponse.ok) {
  console.error(`CLICKUP_ERROR ${taskResponse.status} en GET task/${taskId}: ${await taskResponse.text()}`);
  process.exit(1);
}
const task = await taskResponse.json();
const existing = new Set((task.attachments || []).map((attachment) => attachment.title));

let failed = 0;
for (const file of files) {
  const name = basename(file);
  if (existing.has(name)) {
    console.log(`SKIPPED ${name}: ya estaba adjunto`);
    continue;
  }
  const extension = name.slice(name.lastIndexOf(".")).toLowerCase();
  const form = new FormData();
  form.append(
    "attachment",
    new Blob([await readFile(file)], { type: MIME[extension] || "application/octet-stream" }),
    name
  );
  const response = await fetch(`https://api.clickup.com/api/v2/task/${taskId}/attachment${query}`, {
    method: "POST",
    headers: { Authorization: token },
    body: form,
  });
  if (!response.ok) {
    console.error(`CLICKUP_ERROR ${response.status} subiendo ${name}: ${await response.text()}`);
    failed += 1;
    continue;
  }
  const body = await response.json();
  console.log(`ATTACHED ${name} → ${body.url || "ok"}`);
}
process.exit(failed ? 1 : 0);
