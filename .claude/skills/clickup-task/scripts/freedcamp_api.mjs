// Cliente mínimo de la API v1 de Freedcamp (https://freedcamp.com/api/v1/), compartido por los
// scripts fc_*.mjs de esta skill.
//
// Autenticación con clave "secured": cada petición lleva api_key, timestamp y
// hash = HMAC-SHA1(api_key + timestamp, api_secret).
//
// Credenciales (por este orden):
//   1. Variables de entorno FREEDCAMP_API_KEY y FREEDCAMP_API_SECRET
//   2. Fichero ~/.config/freedcamp/credentials con esas dos líneas (permisos 600)

import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const BASE = "https://freedcamp.com/api/v1/";

let credentials;
async function loadCredentials() {
  if (credentials) return credentials;
  let key = process.env.FREEDCAMP_API_KEY;
  let secret = process.env.FREEDCAMP_API_SECRET;
  if (!key || !secret) {
    try {
      const raw = await readFile(join(homedir(), ".config/freedcamp/credentials"), "utf8");
      for (const line of raw.split("\n")) {
        const match = line.match(/^\s*(FREEDCAMP_API_KEY|FREEDCAMP_API_SECRET)\s*=\s*"?([^"\s]+)"?/);
        if (match?.[1] === "FREEDCAMP_API_KEY") key ||= match[2];
        if (match?.[1] === "FREEDCAMP_API_SECRET") secret ||= match[2];
      }
    } catch {
      // Sin fichero: se informa abajo.
    }
  }
  if (!key || !secret) {
    console.error(
      "MISSING_CREDENTIALS: define FREEDCAMP_API_KEY y FREEDCAMP_API_SECRET o crea ~/.config/freedcamp/credentials"
    );
    process.exit(2);
  }
  credentials = { key, secret };
  return credentials;
}

async function signedUrl(path, params = {}) {
  const { key, secret } = await loadCredentials();
  const url = new URL(path, BASE);
  for (const [name, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((item) => url.searchParams.append(`${name}[]`, item));
    else url.searchParams.set(name, value);
  }
  const timestamp = Math.floor(Date.now() / 1000).toString();
  url.searchParams.set("api_key", key);
  url.searchParams.set("timestamp", timestamp);
  url.searchParams.set("hash", createHmac("sha1", secret).update(key + timestamp).digest("hex"));
  return url;
}

// GET o POST con cuerpo JSON. `form` (FormData) sustituye al cuerpo JSON para subir ficheros.
// Sale con FREEDCAMP_ERROR si la respuesta no es 2xx, salvo con { soft: true }, que la devuelve.
export async function api(path, { method = "GET", params, body, form, soft = false } = {}) {
  const url = await signedUrl(path, params);
  const response = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!response.ok && !soft) {
    console.error(`FREEDCAMP_ERROR ${response.status} en ${method} ${path}: ${text.slice(0, 500)}`);
    process.exit(1);
  }
  return soft ? { status: response.status, ...json } : json;
}

// Acepta la URL de la tarea tal cual la copia el navegador
// (https://freedcamp.com/view/<proyecto>/tasks/panel/task/<id>, …/tasks/<id>, …/todos/<id>/)
// o el id numérico a secas.
export function parseTaskRef(input) {
  const match =
    input.match(/freedcamp\.com\/.*\/task\/(\d+)/) ||
    input.match(/freedcamp\.com\/.*\/(?:tasks|todos)\/(\d+)/) ||
    input.match(/^(\d+)$/);
  if (!match) {
    console.error(`INVALID_TASK: no reconozco "${input}" como URL o id de tarea de Freedcamp`);
    process.exit(2);
  }
  return match[1];
}

export async function getTask(taskId) {
  const { data } = await api(`tasks/${taskId}`, { params: { f_cf: 1, f_include_tags: 1 } });
  const task = data?.tasks?.[0];
  if (!task) {
    console.error(`FREEDCAMP_ERROR tarea ${taskId} no encontrada o sin acceso`);
    process.exit(1);
  }
  return { task, data };
}

// Estados de tarea de Freedcamp (status / status_id).
export const STATUSES = { "not started": 0, "complete": 1, "completed": 1, "in progress": 2, "invalid": 3, "review": 4 };
export const STATUS_NAMES = { 0: "not started", 1: "complete", 2: "in progress", 3: "invalid", 4: "review" };
