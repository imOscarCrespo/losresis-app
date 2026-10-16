#!/usr/bin/env node
// Descarga una tarjeta de Trello (descripción, checklists, comentarios, adjuntos)
// y guarda sus imágenes en local para que Claude pueda verlas.
//
// Uso: node fetch_card.mjs <url-o-shortLink> <directorio-salida>
//
// Credenciales (por este orden):
//   1. Variables de entorno TRELLO_API_KEY y TRELLO_TOKEN
//   2. Fichero ~/.config/trello/credentials con líneas TRELLO_API_KEY=... y TRELLO_TOKEN=...

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp)$/i;

async function loadCredentials() {
  let key = process.env.TRELLO_API_KEY;
  let token = process.env.TRELLO_TOKEN;
  if (key && token) return { key, token };
  try {
    const raw = await readFile(join(homedir(), ".config/trello/credentials"), "utf8");
    for (const line of raw.split("\n")) {
      const match = line.match(/^\s*(TRELLO_API_KEY|TRELLO_TOKEN)\s*=\s*"?([^"\s]+)"?/);
      if (match?.[1] === "TRELLO_API_KEY") key ||= match[2];
      if (match?.[1] === "TRELLO_TOKEN") token ||= match[2];
    }
  } catch {
    // Sin fichero: se informa abajo.
  }
  if (!key || !token) {
    console.error(
      "MISSING_CREDENTIALS: define TRELLO_API_KEY y TRELLO_TOKEN o crea ~/.config/trello/credentials"
    );
    process.exit(2);
  }
  return { key, token };
}

function parseCardId(input) {
  const match = input.match(/trello\.com\/c\/([A-Za-z0-9]+)/);
  if (match) return match[1];
  if (/^[A-Za-z0-9]+$/.test(input)) return input;
  console.error(`INVALID_CARD: no reconozco "${input}" como URL o shortLink de Trello`);
  process.exit(2);
}

function authHeader({ key, token }) {
  return { Authorization: `OAuth oauth_consumer_key="${key}", oauth_token="${token}"` };
}

async function api(path, creds, params = {}) {
  const url = new URL(`https://api.trello.com/1/${path}`);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  const response = await fetch(url, { headers: authHeader(creds) });
  if (!response.ok) {
    console.error(`TRELLO_ERROR ${response.status} en ${path}: ${await response.text()}`);
    process.exit(1);
  }
  return response.json();
}

function safeName(name) {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
}

async function download(url, creds, target) {
  // Los adjuntos subidos a Trello exigen la cabecera OAuth; los externos no la aceptan.
  const headers = /trello\.com/.test(new URL(url).hostname) ? authHeader(creds) : {};
  const response = await fetch(url, { headers });
  if (!response.ok) return `error ${response.status}`;
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
  return null;
}

const [input, outDir] = process.argv.slice(2);
if (!input || !outDir) {
  console.error("Uso: node fetch_card.mjs <url-o-shortLink> <directorio-salida>");
  process.exit(2);
}

const creds = await loadCredentials();
const cardId = parseCardId(input);

const card = await api(`cards/${cardId}`, creds, {
  fields: "name,desc,idShort,shortUrl,url,labels,due,dateLastActivity",
  attachments: "true",
  attachment_fields: "id,name,url,mimeType,isUpload,date",
  checklists: "all",
  list: "true",
  list_fields: "name",
  board: "true",
  board_fields: "name,url",
  members: "true",
  member_fields: "fullName,username",
  actions: "commentCard",
  actions_limit: "100",
});

await mkdir(join(outDir, "images"), { recursive: true });

// Imágenes adjuntas + imágenes enlazadas en la descripción con sintaxis markdown.
const imageSources = card.attachments
  .filter((att) => att.mimeType?.startsWith("image/") || IMAGE_EXT.test(att.name || att.url))
  .map((att) => ({ name: att.name, url: att.url }));
for (const match of card.desc.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g)) {
  if (!imageSources.some((img) => img.url === match[1])) {
    imageSources.push({ name: match[1].split("/").pop(), url: match[1] });
  }
}

const images = [];
for (const [index, img] of imageSources.entries()) {
  const file = join(outDir, "images", `${String(index + 1).padStart(2, "0")}_${safeName(img.name)}`);
  const error = await download(img.url, creds, file);
  images.push({ name: img.name, url: img.url, file: error ? null : file, error });
}

const result = {
  id: card.id,
  number: card.idShort,
  title: card.name,
  url: card.shortUrl,
  board: card.board?.name,
  list: card.list?.name,
  labels: card.labels.map((label) => label.name || label.color),
  members: card.members.map((member) => member.fullName),
  due: card.due,
  lastActivity: card.dateLastActivity,
  description: card.desc,
  checklists: card.checklists.map((checklist) => ({
    name: checklist.name,
    items: checklist.checkItems
      .sort((a, b) => a.pos - b.pos)
      .map((item) => ({ text: item.name, done: item.state === "complete" })),
  })),
  comments: card.actions
    .map((action) => ({
      author: action.memberCreator?.fullName,
      date: action.date,
      text: action.data?.text,
    }))
    .reverse(),
  links: card.attachments
    .filter((att) => !att.isUpload)
    .map((att) => ({ name: att.name, url: att.url })),
  images,
};

await writeFile(join(outDir, "card.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
