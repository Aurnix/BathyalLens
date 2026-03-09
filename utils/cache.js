/**
 * Analysis cache using chrome.storage.local.
 * SHA-256 keyed, 24hr TTL, LRU eviction at 2000 entries.
 *
 * True LRU: `cacheGet()` refreshes the timestamp on access so frequently-used
 * entries survive eviction even if they were created long ago.
 *
 * @module cache
 */

const CACHE_KEY = "cache";
const MAX_ENTRIES = 2000;
const EVICT_COUNT = 500;
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** @returns {Promise<Object>} The raw cache object from storage. */
async function getCache() {
  const data = await chrome.storage.local.get(CACHE_KEY);
  return data[CACHE_KEY] || {};
}

/** @param {Object} cache - The full cache object to persist. */
async function setCache(cache) {
  await chrome.storage.local.set({ [CACHE_KEY]: cache });
}

/**
 * Retrieves a cached analysis result by key.
 * Refreshes the entry's timestamp on access (LRU behavior).
 * @param {string} key - The SHA-256 cache key.
 * @returns {Promise<Object|null>} The cached result, or null if missing/expired.
 */
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

  // Refresh timestamp on access (true LRU)
  entry.timestamp = Date.now();
  await setCache(cache);

  return entry.result;
}

/**
 * Stores an analysis result in the cache. Evicts oldest entries if over limit.
 * @param {string} key - The SHA-256 cache key.
 * @param {Object} result - The analysis result to cache.
 * @param {string} platform - The platform name (for debugging).
 * @param {string} query - The original query (for debugging).
 */
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

/** Clears all cached entries. */
export async function cacheClear() {
  await chrome.storage.local.remove(CACHE_KEY);
}
