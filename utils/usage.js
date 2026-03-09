/**
 * Daily usage tracking and cost estimation.
 * Resets automatically at midnight (UTC). Stored in chrome.storage.local.
 *
 * @module usage
 */

const USAGE_KEY = "usage";

/** Estimated cost per analysis call, by model ID. */
const COST_PER_ANALYSIS = {
  "claude-haiku-4-5-20251001": 0.006,
  "claude-sonnet-4-5-20250514": 0.018,
};

/** @returns {string} Today's date in YYYY-MM-DD format (UTC). */
function todayStr() {
  return new Date().toISOString().split("T")[0];
}

/**
 * Retrieves today's usage stats. Auto-resets if the day has changed.
 * @returns {Promise<{date: string, count: number, estimatedCostUsd: number}>}
 */
export async function getUsage() {
  const data = await chrome.storage.local.get(USAGE_KEY);
  const usage = data[USAGE_KEY] || { date: todayStr(), count: 0, estimatedCostUsd: 0 };

  // Reset if new day
  if (usage.date !== todayStr()) {
    const fresh = { date: todayStr(), count: 0, estimatedCostUsd: 0 };
    await chrome.storage.local.set({ [USAGE_KEY]: fresh });
    return fresh;
  }

  return usage;
}

/**
 * Increments today's usage count and adds the estimated cost for the given model.
 * @param {string} model - The Claude model ID used for the analysis.
 * @returns {Promise<{date: string, count: number, estimatedCostUsd: number}>}
 */
export async function trackUsage(model) {
  const usage = await getUsage();
  const cost = COST_PER_ANALYSIS[model] || COST_PER_ANALYSIS["claude-haiku-4-5-20251001"];

  usage.count += 1;
  usage.estimatedCostUsd = Math.round((usage.estimatedCostUsd + cost) * 1000) / 1000;

  await chrome.storage.local.set({ [USAGE_KEY]: usage });
  return usage;
}
