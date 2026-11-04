#!/usr/bin/env node
// Pone a una tarea de ClickUp el tag de la versión a la que va (p. ej. "1.0.95"), para las
// tareas que llegan sin tag y cuya versión ha decidido el usuario.
//
// Uso: node add_tag.mjs <url-o-taskId> <tag>
//
// Si el tag no existe todavía en el espacio de la tarea, lo crea. No toca nada más de la
// tarea. Mismas credenciales que fetch_task.mjs:
//   1. Variable de entorno CLICKUP_TOKEN
//   2. Fichero ~/.config/clickup/credentials con una línea CLICKUP_TOKEN=pk_...

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

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

async function api(path, token, { method = "GET", params = {}, body } = {}) {
  const url = new URL(`https://api.clickup.com/api/v2/${path}`);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  const response = await fetch(url, {
    method,
    headers: { Authorization: token, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    console.error(`CLICKUP_ERROR ${response.status} en ${method} ${path}: ${await response.text()}`);
    process.exit(1);
  }
  return response.status === 204 ? {} : response.json();
}

const [input, tagInput] = process.argv.slice(2);
if (!input || !tagInput) {
  console.error("Uso: node add_tag.mjs <url-o-taskId> <tag>");
  process.exit(2);
}
// ClickUp guarda los tags en minúsculas.
const tag = tagInput.trim().toLowerCase();

const token = await loadToken();
const { workspaceId, taskId, isCustom } = parseTaskRef(input);
const params = isCustom ? { custom_task_ids: "true", team_id: workspaceId } : {};

const task = await api(`task/${taskId}`, token, { params });
if ((task.tags || []).some((existing) => existing.name.toLowerCase() === tag)) {
  console.log(`UNCHANGED ${taskId}: ya tenía el tag "${tag}"`);
  process.exit(0);
}

const spaceId = task.space?.id;
const { tags: spaceTags = [] } = await api(`space/${spaceId}/tag`, token);
if (!spaceTags.some((existing) => existing.name.toLowerCase() === tag)) {
  await api(`space/${spaceId}/tag`, token, { method: "POST", body: { tag: { name: tag } } });
  console.log(`TAG_CREATED "${tag}" en el espacio ${spaceId}`);
}

await api(`task/${taskId}/tag/${encodeURIComponent(tag)}`, token, { method: "POST", params });
console.log(`TAG_ADDED ${taskId}: "${tag}"`);
