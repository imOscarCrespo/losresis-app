import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_PREFIX = "jsonCache:v1:";
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;

const inFlight = new Map();
const memoryCache = new Map();
const parsedCache = new Map();

const storageKeyFor = (url) => `${STORAGE_PREFIX}${url}`;

const readFromStorage = async (url) => {
  const memHit = memoryCache.get(url);
  if (memHit) return memHit;

  try {
    const raw = await AsyncStorage.getItem(storageKeyFor(url));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    memoryCache.set(url, parsed);
    return parsed;
  } catch (error) {
    console.warn("⚠️ jsonCacheStore: failed to read cache", url, error);
    return null;
  }
};

const writeToStorage = async (url, entry) => {
  memoryCache.set(url, entry);
  parsedCache.delete(url);
  try {
    await AsyncStorage.setItem(storageKeyFor(url), JSON.stringify(entry));
  } catch (error) {
    console.warn("⚠️ jsonCacheStore: failed to write cache", url, error);
  }
};

const parseEntry = (url, entry) => {
  if (parsedCache.has(url)) return parsedCache.get(url);
  const value = JSON.parse(entry.body);
  parsedCache.set(url, value);
  return value;
};

const refreshFetchedAt = async (url, entry) => {
  const next = { ...entry, fetchedAt: Date.now() };
  await writeToStorage(url, next);
  return next;
};

const fetchWithValidators = async (url, entry) => {
  const headers = {};
  if (entry?.etag) headers["If-None-Match"] = entry.etag;
  if (entry?.lastModified) headers["If-Modified-Since"] = entry.lastModified;

  const response = await fetch(url, { headers });

  if (response.status === 304 && entry) {
    return { status: 304, entry: await refreshFetchedAt(url, entry) };
  }

  if (!response.ok) {
    const error = new Error(`HTTP error! status: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  const text = await response.text();
  const newEntry = {
    body: text,
    etag: response.headers.get("etag") || null,
    lastModified: response.headers.get("last-modified") || null,
    fetchedAt: Date.now(),
  };
  await writeToStorage(url, newEntry);
  return { status: response.status, entry: newEntry };
};

/**
 * Fetch a JSON resource with persistent client-side caching to minimise
 * Supabase Storage egress. Uses ETag/Last-Modified validators so a server
 * 304 response avoids re-downloading the body.
 *
 * @param {string} url
 * @param {{ ttlMs?: number, label?: string }} [options]
 * @returns {Promise<any>} the parsed JSON
 */
export const getCachedJson = async (url, options = {}) => {
  const { ttlMs = DEFAULT_TTL_MS, label } = options;

  if (inFlight.has(url)) {
    return inFlight.get(url);
  }

  const promise = (async () => {
    const cached = await readFromStorage(url);
    const isFresh =
      cached && Date.now() - (cached.fetchedAt || 0) < ttlMs;

    if (isFresh && cached?.body) {
      return parseEntry(url, cached);
    }

    try {
      const { entry } = await fetchWithValidators(url, cached);
      return parseEntry(url, entry);
    } catch (error) {
      if (cached?.body) {
        console.warn(
          `⚠️ jsonCache ${label || url}: fetch failed, serving stale cache`,
          error
        );
        return parseEntry(url, cached);
      }
      throw error;
    }
  })();

  inFlight.set(url, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(url);
  }
};

export const clearJsonCache = async (url) => {
  memoryCache.delete(url);
  parsedCache.delete(url);
  try {
    await AsyncStorage.removeItem(storageKeyFor(url));
  } catch (error) {
    console.warn("⚠️ jsonCacheStore: failed to clear cache", url, error);
  }
};
