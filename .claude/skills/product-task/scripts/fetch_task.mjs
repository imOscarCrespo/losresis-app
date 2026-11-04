#!/usr/bin/env node
// Descarga una tarea de ClickUp (descripción, checklists, subtareas, comentarios, adjuntos)
// y guarda sus imágenes en local para que Claude pueda verlas.
//
// Uso: node fetch_task.mjs <url-o-taskId> <directorio-salida>
//
// Acepta https://app.clickup.com/t/<workspaceId>/<taskId>, https://app.clickup.com/t/<taskId>
// o el taskId a secas. Los IDs personalizados (p. ej. LR-123) necesitan el workspaceId en la URL.
//
// Credenciales (por este orden):
//   1. Variable de entorno CLICKUP_TOKEN
//   2. Fichero ~/.config/clickup/credentials con una línea CLICKUP_TOKEN=pk_...

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp)$/i;

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
  // Los IDs nativos son alfanuméricos sin guion; los personalizados llevan prefijo (LR-123).
  const isCustom = taskId.includes("-");
  if (isCustom && !workspaceId) {
    console.error(`INVALID_TASK: "${taskId}" es un ID personalizado; pasa la URL completa con el workspace`);
    process.exit(2);
  }
  return { workspaceId, taskId, isCustom };
}

async function api(path, token, params = {}) {
  const url = new URL(`https://api.clickup.com/api/v2/${path}`);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  const response = await fetch(url, { headers: { Authorization: token } });
  if (!response.ok) {
    console.error(`CLICKUP_ERROR ${response.status} en ${path}: ${await response.text()}`);
    process.exit(1);
  }
  return response.json();
}

function safeName(name) {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
}

async function download(url, token, target) {
  // Los adjuntos de ClickUp suelen ir firmados; si no, se reintenta con el token.
  let response = await fetch(url);
  if (!response.ok && /clickup/.test(new URL(url).hostname)) {
    response = await fetch(url, { headers: { Authorization: token } });
  }
  if (!response.ok) return `error ${response.status}`;
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
  return null;
}

function isoDate(ms) {
  return ms ? new Date(Number(ms)).toISOString() : null;
}

const [input, outDir] = process.argv.slice(2);
if (!input || !outDir) {
  console.error("Uso: node fetch_task.mjs <url-o-taskId> <directorio-salida>");
  process.exit(2);
}

const token = await loadToken();
const { workspaceId, taskId, isCustom } = parseTaskRef(input);
const idParams = isCustom ? { custom_task_ids: "true", team_id: workspaceId } : {};

const task = await api(`task/${taskId}`, token, {
  ...idParams,
  include_subtasks: "true",
  include_markdown_description: "true",
});
const { comments } = await api(`task/${task.id}/comment`, token);

await mkdir(join(outDir, "images"), { recursive: true });

const description = task.markdown_description || task.text_content || task.description || "";

// Imágenes adjuntas + imágenes enlazadas en la descripción con sintaxis markdown.
const attachments = task.attachments || [];
const imageSources = attachments
  .filter((att) => att.mimetype?.startsWith("image/") || IMAGE_EXT.test(att.title || att.url))
  .map((att) => ({ name: att.title || att.url.split("/").pop(), url: att.url }));
for (const match of description.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g)) {
  if (!imageSources.some((img) => img.url === match[1])) {
    imageSources.push({ name: match[1].split("/").pop().split("?")[0], url: match[1] });
  }
}

const images = [];
for (const [index, img] of imageSources.entries()) {
  const file = join(outDir, "images", `${String(index + 1).padStart(2, "0")}_${safeName(img.name)}`);
  const error = await download(img.url, token, file);
  images.push({ name: img.name, url: img.url, file: error ? null : file, error });
}

const result = {
  id: task.id,
  number: task.custom_id || task.id,
  title: task.name,
  url: task.url,
  space: task.space?.id,
  folder: task.folder?.name,
  list: task.list?.name,
  status: task.status?.status,
  priority: task.priority?.priority ?? null,
  tags: (task.tags || []).map((tag) => tag.name),
  assignees: (task.assignees || []).map((user) => user.username || user.email),
  due: isoDate(task.due_date),
  lastActivity: isoDate(task.date_updated),
  description,
  customFields: (task.custom_fields || [])
    .filter((field) => field.value !== undefined && field.value !== null && field.value !== "")
    .map((field) => ({ name: field.name, type: field.type, value: field.value })),
  checklists: (task.checklists || []).map((checklist) => ({
    name: checklist.name,
    items: [...(checklist.items || [])]
      .sort((a, b) => a.orderindex - b.orderindex)
      .map((item) => ({ text: item.name, done: Boolean(item.resolved) })),
  })),
  subtasks: (task.subtasks || []).map((sub) => ({
    id: sub.id,
    title: sub.name,
    status: sub.status?.status,
    url: sub.url,
  })),
  comments: (comments || [])
    .map((comment) => ({
      author: comment.user?.username || comment.user?.email,
      date: isoDate(comment.date),
      text: comment.comment_text,
    }))
    .sort((a, b) => (a.date || "").localeCompare(b.date || "")),
  links: attachments
    .filter((att) => !imageSources.some((img) => img.url === att.url))
    .map((att) => ({ name: att.title, url: att.url })),
  images,
};

await writeFile(join(outDir, "task.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
