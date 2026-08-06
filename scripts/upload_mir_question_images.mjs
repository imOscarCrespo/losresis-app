// Sube las ~75 imágenes del banco de preguntas MIR al bucket
// mir-question-images y fija mir_questions.image_url.
//
// Origen: repo foundation29org/MIR_AI_F29 (MIT), rama main, rutas tipo
// images/24/image_1.png (las mismas guardadas en mir_questions.image_path).
//
// Requiere haber aplicado 20260802130000_mir_question_bank.sql y el seed
// seeds/mir_questions_seed.sql de losresis-db.
//
// Uso:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/upload_mir_question_images.mjs
//
// Idempotente: se salta las preguntas que ya tienen image_url; con --force
// re-sube y sobreescribe todo.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing env vars. Set SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY."
  );
  process.exit(1);
}

// Con la anon key la RLS devuelve 0 filas en silencio: comprobar el rol del JWT.
try {
  const payload = JSON.parse(
    Buffer.from(serviceRoleKey.split(".")[1], "base64url").toString("utf8")
  );
  if (payload.role !== "service_role") {
    console.error(
      `The key provided has role "${payload.role}", not "service_role". ` +
        "Use the service_role secret from Supabase Settings -> API."
    );
    process.exit(1);
  }
} catch {
  console.warn("Could not decode the key to verify its role; continuing anyway.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const BUCKET = "mir-question-images";
const SOURCE_BASE =
  "https://raw.githubusercontent.com/foundation29org/MIR_AI_F29/main/";
const force = process.argv.includes("--force");

const CONTENT_TYPES = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

const getPublicObjectUrl = (path) =>
  `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}`;

const main = async () => {
  const { data: questions, error } = await supabase
    .from("mir_questions")
    .select("id, source_id, image_path, image_url")
    .eq("has_image", true)
    .not("image_path", "is", null);

  if (error) {
    console.error("Failed to list questions:", error.message);
    process.exit(1);
  }

  console.log(`${questions.length} questions with image`);

  let uploaded = 0;
  let skipped = 0;
  const failures = [];

  for (const q of questions) {
    if (q.image_url && !force) {
      skipped += 1;
      continue;
    }

    const extension = q.image_path.split(".").pop().toLowerCase();
    const contentType = CONTENT_TYPES[extension];

    try {
      if (!contentType) {
        throw new Error(`unsupported image extension: ${extension}`);
      }

      const response = await fetch(SOURCE_BASE + q.image_path);
      if (!response.ok) {
        throw new Error(`source HTTP ${response.status}`);
      }
      const body = new Uint8Array(await response.arrayBuffer());

      // La ruta en el bucket replica la del origen: images/24/image_1.png.
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(q.image_path, body, {
          upsert: true,
          contentType,
          cacheControl: "public, max-age=31536000, immutable",
        });
      if (uploadError) {
        throw new Error(`upload failed: ${uploadError.message}`);
      }

      const publicUrl = getPublicObjectUrl(q.image_path);
      const { error: updateError } = await supabase
        .from("mir_questions")
        .update({ image_url: publicUrl })
        .eq("id", q.id);
      if (updateError) {
        throw new Error(`image_url update failed: ${updateError.message}`);
      }

      uploaded += 1;
      console.log(`ok ${q.source_id} -> ${publicUrl}`);
    } catch (err) {
      failures.push({ source_id: q.source_id, reason: err.message });
      console.error(`FAIL ${q.source_id}: ${err.message}`);
    }
  }

  console.log(
    `\ndone: ${uploaded} uploaded, ${skipped} skipped (already had image_url), ${failures.length} failed`
  );
  if (failures.length > 0) {
    process.exit(1);
  }
};

main();
