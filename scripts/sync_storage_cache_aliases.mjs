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

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const bucket = "cache";
const pairs = [
  ["hospitals.json", "/hospitals.json"],
  ["hospital_speciality.json", "/hospital_speciality.json"],
];

const getPublicObjectUrl = (path) =>
  `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;

const fetchSource = async (path) => {
  const response = await fetch(getPublicObjectUrl(path));
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: HTTP ${response.status}`);
  }

  const contentType =
    response.headers.get("content-type") || "application/octet-stream";
  const cacheControl =
    response.headers.get("cache-control") || "max-age=3600";
  const arrayBuffer = await response.arrayBuffer();

  return {
    body: new Uint8Array(arrayBuffer),
    contentType,
    cacheControl,
  };
};

const ensureAlias = async ([sourcePath, aliasPath]) => {
  const source = await fetchSource(sourcePath);

  const { error } = await supabase.storage.from(bucket).upload(aliasPath, source.body, {
    upsert: true,
    contentType: source.contentType,
    cacheControl: source.cacheControl,
  });

  if (error) {
    throw new Error(`Failed to upload alias ${aliasPath}: ${error.message}`);
  }

  const [sourceHead, aliasHead] = await Promise.all([
    fetch(getPublicObjectUrl(sourcePath), { method: "HEAD" }),
    fetch(getPublicObjectUrl(aliasPath), { method: "HEAD" }),
  ]);

  if (!sourceHead.ok || !aliasHead.ok) {
    throw new Error(
      `Verification failed for ${sourcePath} -> ${aliasPath}: source ${sourceHead.status}, alias ${aliasHead.status}`
    );
  }

  const sourceLength = sourceHead.headers.get("content-length");
  const aliasLength = aliasHead.headers.get("content-length");

  if (sourceLength && aliasLength && sourceLength !== aliasLength) {
    throw new Error(
      `Length mismatch for ${sourcePath} -> ${aliasPath}: ${sourceLength} vs ${aliasLength}`
    );
  }

  console.log(`Synced ${sourcePath} -> ${aliasPath}`);
};

const run = async () => {
  for (const pair of pairs) {
    await ensureAlias(pair);
  }

  console.log("Cache aliases are in sync.");
};

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
