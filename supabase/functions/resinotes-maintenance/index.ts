// ResiNotes (ClickUp 124b4z9w0qg, pasada B): mantenimiento con service role.
//
// La llama la BD con pg_net (losresis-db 20261111120000_resinotes_pass_b.sql):
//   * { action: "extract", attachment_id }  al subir un PDF: saca su texto
//     para la búsqueda (resinotes_attachments.extracted_text).
//   * { action: "daily" }  cada noche (pg_cron):
//       1. purga la papelera (resinotes_purge_expired: borra las filas
//          caducadas y apunta sus ficheros en resinotes_storage_deletions);
//       2. vacía esa cola borrando los ficheros del bucket (desde SQL no se
//          puede): solo quita de la cola lo que storage confirma;
//       3. pide el texto de los PDFs que se quedaran pendientes, uno por
//          llamada (cada llamada tiene su propio límite de CPU).
//
// Autorización: Bearer RESINOTES_MAINTENANCE_SECRET (verify_jwt desactivado,
// como weekly-courses-bot). El secreto vive en los secrets de la función y en
// Vault (resinotes_maintenance_secret), nunca en el repo.
//
// Despliegue: supabase functions deploy resinotes-maintenance --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getDocumentProxy } from "https://esm.sh/unpdf@1.9.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SECRET = Deno.env.get("RESINOTES_MAINTENANCE_SECRET");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SECRET) {
  throw new Error("Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or RESINOTES_MAINTENANCE_SECRET");
}

const BUCKET = "resinotes";
// El mismo plazo que enseña la app en la papelera (utils/resinotes.js, TRASH_RETENTION_DAYS).
const TRASH_RETENTION_DAYS = 30;
// Topes para no pasarse del límite de CPU de una llamada con un PDF enorme.
const MAX_PAGES = 300;
const MAX_TEXT_CHARS = 200000;
// Cada extracción espera su llamada: pocas por noche para no pasarse del tiempo máximo.
const PENDING_PER_RUN = 10;
// Claves por lote de la cola: van en la URL de PostgREST (`in.(...)`), que tiene límite.
const QUEUE_BATCH = 50;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const timingSafeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

// ---------------------------------------------------------------------------
// Texto de un PDF
// ---------------------------------------------------------------------------

const normalizeText = (text: string) =>
  text
    .replace(/\u0000/g, "")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const extractAttachment = async (attachmentId: string) => {
  const { data: attachment, error } = await admin
    .from("resinotes_attachments")
    .select("id, storage_key, mime_type, text_extraction_status")
    .eq("id", attachmentId)
    .maybeSingle();
  if (error) throw error;
  if (!attachment || attachment.mime_type !== "application/pdf") return { skipped: "not_pdf" };
  if (attachment.text_extraction_status) return { skipped: attachment.text_extraction_status };

  // Se marca «failed» antes de empezar: si la llamada muere por CPU o memoria,
  // el PDF no se vuelve a intentar cada noche. Al terminar se sobrescribe.
  await admin
    .from("resinotes_attachments")
    .update({ text_extraction_status: "failed", text_extracted_at: new Date().toISOString() })
    .eq("id", attachmentId)
    .is("text_extraction_status", null);

  try {
    const { data: blob, error: downloadError } = await admin.storage.from(BUCKET).download(attachment.storage_key);
    if (downloadError || !blob) throw downloadError || new Error("download_failed");

    const pdf = await getDocumentProxy(new Uint8Array(await blob.arrayBuffer()));
    const pages = Math.min(pdf.numPages, MAX_PAGES);
    let text = "";
    for (let n = 1; n <= pages && text.length < MAX_TEXT_CHARS; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      text += content.items
        .map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : ""))
        .join("");
      text += "\n\n";
      page.cleanup();
    }
    await pdf.cleanup();

    const clean = normalizeText(text).slice(0, MAX_TEXT_CHARS);
    // Un PDF escaneado (solo imágenes) no tiene texto: lo dirá el OCR de la fase 2.
    const status = clean.replace(/\s/g, "").length >= 20 ? "ok" : "empty";
    const { error: updateError } = await admin
      .from("resinotes_attachments")
      .update({
        extracted_text: status === "ok" ? clean : null,
        text_extraction_status: status,
        text_extracted_at: new Date().toISOString(),
      })
      .eq("id", attachmentId);
    if (updateError) throw updateError;
    return { status, chars: clean.length, pages };
  } catch (e) {
    console.error("resinotes-maintenance · extract", attachmentId, e);
    return { status: "failed" };
  }
};

// ---------------------------------------------------------------------------
// Papelera y cola de ficheros
// ---------------------------------------------------------------------------

const drainStorageQueue = async () => {
  let removed = 0;
  let failed = 0;
  for (let round = 0; round < 40; round++) {
    const { data: rows, error } = await admin
      .from("resinotes_storage_deletions")
      .select("storage_key, attempts")
      .order("created_at")
      .limit(QUEUE_BATCH);
    if (error) throw error;
    if (!rows?.length) break;

    const keys = rows.map((r) => r.storage_key);
    const { error: removeError } = await admin.storage.from(BUCKET).remove(keys);
    if (removeError) {
      // Se reintenta la noche siguiente; la fila de la BD ya no existe, el fichero sí.
      failed += keys.length;
      for (const row of rows) {
        await admin
          .from("resinotes_storage_deletions")
          .update({ attempts: (row.attempts ?? 0) + 1, last_error: String(removeError.message || removeError).slice(0, 500) })
          .eq("storage_key", row.storage_key);
      }
      break;
    }
    // storage.remove no falla por una clave que ya no existe: se puede quitar todo.
    const { error: deleteError } = await admin.from("resinotes_storage_deletions").delete().in("storage_key", keys);
    if (deleteError) throw deleteError;
    removed += keys.length;
    if (rows.length < QUEUE_BATCH) break;
  }
  return { removed, failed };
};

const purgeTrash = async () => {
  const totals = { folders: 0, items: 0, queued_files: 0 };
  for (let round = 0; round < 10; round++) {
    const { data, error } = await admin.rpc("resinotes_purge_expired", { p_days: TRASH_RETENTION_DAYS, p_limit: 500 });
    if (error) throw error;
    totals.folders += data?.folders ?? 0;
    totals.items += data?.items ?? 0;
    totals.queued_files += data?.queued_files ?? 0;
    if ((data?.folders ?? 0) < 500 && (data?.items ?? 0) < 500) break;
  }
  return totals;
};

const requestPendingExtractions = async (authHeader: string) => {
  const { data: pending, error } = await admin
    .from("resinotes_attachments")
    .select("id")
    .eq("mime_type", "application/pdf")
    .is("text_extraction_status", null)
    .lt("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
    .order("created_at")
    .limit(PENDING_PER_RUN);
  if (error) throw error;

  const results = [];
  for (const row of pending || []) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/resinotes-maintenance`, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "extract", attachment_id: row.id }),
    }).catch((e) => ({ ok: false, status: String(e) }));
    results.push({ id: row.id, ok: (res as Response).ok });
  }
  return results;
};

// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  if (!timingSafeEqual(authHeader, `Bearer ${SECRET}`)) return json({ error: "unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  try {
    if (body?.action === "extract" && typeof body.attachment_id === "string") {
      return json(await extractAttachment(body.attachment_id));
    }
    if (body?.action === "daily") {
      const purge = await purgeTrash();
      const storage = await drainStorageQueue();
      const extractions = await requestPendingExtractions(authHeader);
      const result = { purge, storage, extractions: extractions.length };
      console.log("resinotes-maintenance · daily", JSON.stringify(result));
      return json(result);
    }
    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("resinotes-maintenance", e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
