#!/usr/bin/env node
// Descarga una tarea de Freedcamp (descripción, subtareas, comentarios, adjuntos, tags, campos
// personalizados) y guarda sus imágenes en local para que Claude pueda verlas.
//
// Uso: node fc_fetch_task.mjs <url-o-id> <directorio-salida>
//
// Acepta https://freedcamp.com/view/<proyecto>/tasks/panel/task/<id> (la que copia el
// navegador), …/tasks/<id>, …/todos/<id>/ o el id a secas. Credenciales: ver freedcamp_api.mjs.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { STATUS_NAMES, api, getTask, parseTaskRef } from "./freedcamp_api.mjs";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp)$/i;

function safeName(name) {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
}

function isoDate(seconds) {
  return seconds ? new Date(Number(seconds) * 1000).toISOString() : null;
}

// HTML de Freedcamp → texto legible (markdown aproximado). Los marcadores
// [fcattach=<id> …] de imágenes incrustadas se dejan como «[imagen <id>]».
function htmlToText(html = "") {
  return html
    .replace(/\[fcattach=(\d+)[^\]]*\]/g, "[imagen $1]")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/(p|div|li|h[1-6]|ul|ol)>/gi, "\n")
    .replace(/<h([1-6])[^>]*>/gi, (_, level) => `${"#".repeat(Number(level))} `)
    .replace(/<(strong|b)>/gi, "**")
    .replace(/<\/(strong|b)>/gi, "**")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function download(url, target) {
  // Las URLs de fichero de Freedcamp van firmadas (S3) y caducan: se descargan al momento.
  const response = await fetch(url);
  if (!response.ok) return `error ${response.status}`;
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
  return null;
}

const [input, outDir] = process.argv.slice(2);
if (!input || !outDir) {
  console.error("Uso: node fc_fetch_task.mjs <url-o-id> <directorio-salida>");
  process.exit(2);
}

const taskId = parseTaskRef(input);
const { task, data } = await getTask(taskId);

// Los tags llegan como ids; se resuelven con el catálogo de tags.
let tagNames = [];
if (task.tags?.length) {
  const { data: tagData } = await api("tags", { params: { project_id: task.project_id } });
  const byId = new Map((tagData?.tags || []).map((tag) => [String(tag.id), tag.title || tag.name]));
  tagNames = task.tags.map((tag) => byId.get(String(tag.id ?? tag)) || String(tag.title ?? tag.name ?? tag));
}

// Subtareas: vienen en `children`; si no, se piden aparte por h_parent_id.
let subtasks = task.children || [];
if (!subtasks.length && task.f_adv_subtask !== false) {
  const { data: listData } = await api("tasks", { params: { project_id: task.project_id, limit: 200 } });
  subtasks = (listData?.tasks || []).filter((candidate) => String(candidate.h_parent_id) === String(task.id));
}

await mkdir(join(outDir, "images"), { recursive: true });

// Ficheros de la tarea y de sus comentarios.
const commentFiles = (task.comments || []).flatMap((comment) => comment.files || []);
const allFiles = [...(task.files || []), ...commentFiles];
const imageFiles = allFiles.filter((file) => IMAGE_EXT.test(file.name || file.title || ""));

const images = [];
for (const [index, file] of imageFiles.entries()) {
  const name = file.name || file.title;
  const target = join(outDir, "images", `${String(index + 1).padStart(2, "0")}_${safeName(name)}`);
  const error = await download(file.url, target);
  images.push({ id: file.id, name, file: error ? null : target, error });
}

// Versión de la tarea: un tag x.y.z (lo pone producto en la app de Freedcamp) o, si no, el
// comentario «Versión: x.y.z» que deja fc_add_tag.mjs (la API no permite crear tags).
const VERSION = /^v?(\d+\.\d+\.\d+)$/;
const tagVersions = tagNames.map((name) => name.trim().match(VERSION)?.[1]).filter(Boolean);
const commentVersions = (task.comments || [])
  .map((comment) => htmlToText(comment.description).match(/Versi[oó]n:\s*v?(\d+\.\d+\.\d+)/)?.[1])
  .filter(Boolean);
const versions = [...new Set(tagVersions.length ? tagVersions : commentVersions.slice(-1))];

const result = {
  id: task.id,
  version: versions.length === 1 ? versions[0] : null,
  versionCandidates: versions,
  number: task.id,
  title: task.title,
  url: input.startsWith("http") ? input : task.url,
  project: task.project_id,
  list: task.list_title || task.task_group_name,
  status: STATUS_NAMES[task.status] ?? task.status_title,
  priority: task.priority_title,
  tags: tagNames,
  assignees: task.assigned_to_fullname ? [task.assigned_to_fullname] : [],
  due: isoDate(task.due_ts),
  lastActivity: isoDate(task.updated_ts),
  description: htmlToText(task.description),
  customFields: (task.custom_fields || [])
    .filter((field) => field.value !== undefined && field.value !== null && field.value !== "")
    .map((field) => {
      const template = (data.cf_templates || [])
        .flatMap((tpl) => tpl.fields || [])
        .find((candidate) => String(candidate.id) === String(field.field_id ?? field.id));
      return { name: template?.title || field.title || field.field_id, value: field.value };
    }),
  subtasks: subtasks.map((sub) => ({
    id: sub.id,
    title: sub.title,
    status: STATUS_NAMES[sub.status] ?? sub.status_title,
    description: htmlToText(sub.description),
  })),
  comments: (task.comments || [])
    .map((comment) => ({
      author: comment.user_full_name || comment.created_by_id,
      date: isoDate(comment.created_ts),
      text: htmlToText(comment.description),
    }))
    .sort((a, b) => (a.date || "").localeCompare(b.date || "")),
  links: allFiles
    .filter((file) => !imageFiles.includes(file))
    .map((file) => ({ id: file.id, name: file.name || file.title, url: file.url })),
  images,
};

await writeFile(join(outDir, "task.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
