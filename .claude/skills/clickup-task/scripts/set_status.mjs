#!/usr/bin/env node
// Cambia el estado de una tarea de ClickUp (por defecto a "complete") al terminarla.
//
// Uso: node set_status.mjs <url-o-taskId> [estado]
//
// Comprueba antes que el estado existe en la lista de la tarea (los nombres cambian por lista)
// y no toca nada más de la tarea. Mismas credenciales que fetch_task.mjs:
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
  return response.json();
}

const [input, wanted = "complete"] = process.argv.slice(2);
if (!input) {
  console.error("Uso: node set_status.mjs <url-o-taskId> [estado]");
  process.exit(2);
}

const token = await loadToken();
const { workspaceId, taskId, isCustom } = parseTaskRef(input);
const params = isCustom ? { custom_task_ids: "true", team_id: workspaceId } : {};

const task = await api(`task/${taskId}`, token, { params });
const list = await api(`list/${task.list.id}`, token);
const status = (list.statuses || []).find(
  (candidate) => candidate.status.toLowerCase() === wanted.toLowerCase()
);
if (!status) {
  const available = (list.statuses || []).map((candidate) => candidate.status).join(", ");
  console.error(`UNKNOWN_STATUS: "${wanted}" no existe en la lista; disponibles: ${available}`);
  process.exit(1);
}

const before = task.status?.status;
if (before?.toLowerCase() === status.status.toLowerCase()) {
  console.log(`UNCHANGED ${taskId}: ya estaba en "${before}"`);
  process.exit(0);
}

const updated = await api(`task/${taskId}`, token, {
  method: "PUT",
  params,
  body: { status: status.status },
});
console.log(`STATUS_CHANGED ${taskId}: "${before}" → "${updated.status?.status}"`);
