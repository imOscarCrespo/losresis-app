#!/usr/bin/env node
// Apunta en una tarea de Freedcamp la versión a la que va (p. ej. "1.0.97"), para las tareas
// que llegan sin tag de versión y cuya versión ha decidido el usuario.
//
// Uso: node fc_add_tag.mjs <url-o-id> <versión>
//
// La API de Freedcamp no permite crear tags (POST /tags responde "Parameters are missed" con
// cualquier combinación, probado 2026-11-04), así que la versión se deja como comentario
// «Versión: <versión>». fc_fetch_task.mjs lo lee de vuelta en `version`. Si ya hay un comentario
// con esa versión, no hace nada. Credenciales: ver freedcamp_api.mjs.

import { api, getTask, parseTaskRef } from "./freedcamp_api.mjs";

const [input, versionInput] = process.argv.slice(2);
if (!input || !versionInput) {
  console.error("Uso: node fc_add_tag.mjs <url-o-id> <versión>");
  process.exit(2);
}
const version = versionInput.trim();
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`INVALID_VERSION: "${version}" no parece una versión (x.y.z)`);
  process.exit(2);
}

const taskId = parseTaskRef(input);
const { task } = await getTask(taskId);
const already = (task.comments || []).some((comment) =>
  new RegExp(`Versi[oó]n:\\s*${version.replace(/\./g, "\\.")}\\b`).test(comment.description || "")
);
if (already) {
  console.log(`UNCHANGED ${taskId}: ya tenía el comentario de versión ${version}`);
  process.exit(0);
}

const response = await api("comments", {
  method: "POST",
  body: { item_id: String(taskId), app_id: "2", description: `<p>Versión: ${version}</p>` },
  soft: true,
});
if (response.status >= 300) {
  console.error(`FREEDCAMP_ERROR ${response.status} comentando la versión: ${JSON.stringify(response).slice(0, 300)}`);
  process.exit(1);
}
console.log(`VERSION_COMMENTED ${taskId}: "Versión: ${version}"`);
