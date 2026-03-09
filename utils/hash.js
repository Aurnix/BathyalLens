/**
 * SHA-256 hashing for cache keys.
 * Used by the service worker (background.js) via ES module import.
 *
 * @module hash
 */

/**
 * Generates a hex-encoded SHA-256 hash prefixed with "analysis_".
 * @param {string} text - The input string to hash.
 * @returns {Promise<string>} The cache key (e.g., "analysis_a1b2c3...").
 */
export async function getCacheKey(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return "analysis_" + hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}
