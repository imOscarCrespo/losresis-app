#!/usr/bin/env node
// Cambia el estado de una tarea de Freedcamp (por defecto a "complete") al terminarla.
//
// Uso: node fc_set_status.mjs <url-o-id> [estado]
//
// Estados de Freedcamp: "not started", "in progress", "complete", "review", "invalid".
// No toca nada más de la tarea. Credenciales: ver freedcamp_api.mjs.

import { STATUSES, STATUS_NAMES, api, getTask, parseTaskRef } from "./freedcamp_api.mjs";

const [input, wanted = "complete"] = process.argv.slice(2);
if (!input) {
  console.error("Uso: node fc_set_status.mjs <url-o-id> [estado]");
  process.exit(2);
}

const status = STATUSES[wanted.toLowerCase()];
if (status === undefined) {
  console.error(`UNKNOWN_STATUS: "${wanted}" no existe; disponibles: ${Object.values(STATUS_NAMES).join(", ")}`);
  process.exit(1);
}

const taskId = parseTaskRef(input);
const { task } = await getTask(taskId);
const before = STATUS_NAMES[task.status] ?? task.status;
if (Number(task.status) === status) {
  console.log(`UNCHANGED ${taskId}: ya estaba en "${before}"`);
  process.exit(0);
}

const { data } = await api(`tasks/${taskId}`, { method: "POST", body: { status } });
const after = data?.tasks?.[0]?.status;
if (Number(after) !== status) {
  console.error(`FREEDCAMP_ERROR ${taskId}: se pidió "${STATUS_NAMES[status]}" y quedó en "${STATUS_NAMES[after] ?? after}"`);
  process.exit(1);
}
console.log(`STATUS_CHANGED ${taskId}: "${before}" → "${STATUS_NAMES[after]}"`);
