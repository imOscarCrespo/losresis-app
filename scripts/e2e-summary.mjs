#!/usr/bin/env node
// Resume un commands.json de Maestro sin imprimir las variables de entorno (credenciales).
// Uso: node scripts/e2e-summary.mjs <ruta/commands.json>
import { readFileSync } from "node:fs";

const commands = JSON.parse(readFileSync(process.argv[2], "utf8"));
for (const entry of commands) {
  const [name] = Object.keys(entry.command);
  if (name === "defineVariablesCommand") continue;
  const detail = JSON.stringify(entry.command[name]).replace(/"text":"[^"]*"/g, '"text":"…"');
  const error = entry.metadata?.error?.message ?? "";
  console.log(`${entry.metadata?.status ?? "?"}  ${name}  ${detail.slice(0, 90)}  ${error.slice(0, 160)}`);
}
