/**
 * Daily usage tracking and cost estimation.
 */

const USAGE_KEY = "usage";

const COST_PER_ANALYSIS = {
  "claude-haiku-4-5-20251001": 0.006,
  "claude-sonnet-4-5-20241022": 0.018,
};

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

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

export async function trackUsage(model) {
  const usage = await getUsage();
  const cost = COST_PER_ANALYSIS[model] || COST_PER_ANALYSIS["claude-haiku-4-5-20251001"];

  usage.count += 1;
  usage.estimatedCostUsd = Math.round((usage.estimatedCostUsd + cost) * 1000) / 1000;

  await chrome.storage.local.set({ [USAGE_KEY]: usage });
  return usage;
}
