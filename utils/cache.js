/**
 * Analysis cache using chrome.storage.local.
 * SHA-256 keyed, 24hr TTL, LRU eviction at 2000 entries.
 */

const CACHE_KEY = "cache";
const MAX_ENTRIES = 2000;
const EVICT_COUNT = 500;
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function getCache() {
  const data = await chrome.storage.local.get(CACHE_KEY);
  return data[CACHE_KEY] || {};
}

async function setCache(cache) {
  await chrome.storage.local.set({ [CACHE_KEY]: cache });
}

export async function cacheGet(key) {
  const cache = await getCache();
  const entry = cache[key];
  if (!entry) return null;

  // Check TTL
  if (Date.now() - entry.timestamp > TTL_MS) {
    delete cache[key];
    await setCache(cache);
    return null;
  }

  return entry.result;
}

export async function cacheSet(key, result, platform, query) {
  const cache = await getCache();

  cache[key] = {
    result,
    timestamp: Date.now(),
    platform,
    query,
  };

  // LRU eviction if over limit
  const keys = Object.keys(cache);
  if (keys.length > MAX_ENTRIES) {
    const sorted = keys.sort((a, b) => cache[a].timestamp - cache[b].timestamp);
    const toRemove = sorted.slice(0, EVICT_COUNT);
    for (const k of toRemove) {
      delete cache[k];
    }
  }

  await setCache(cache);
}

export async function cacheClear() {
  await chrome.storage.local.remove(CACHE_KEY);
}
