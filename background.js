/**
 * Bathyal Lens — Service Worker (background.js)
 *
 * Handles: API calls to Anthropic, caching, usage tracking, message routing, context menu.
 * All fetch calls use AbortController timeouts. Usage is tracked only on successful parse.
 * Cache keys include a prompt version to allow invalidation on prompt changes.
 *
 * @module background
 */

import { getCacheKey } from "./utils/hash.js";
import { parseAnalysisJSON } from "./utils/parse.js";
import { cacheGet, cacheSet } from "./utils/cache.js";
import { trackUsage } from "./utils/usage.js";

// --- Model constants (single source of truth) ---

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

/**
 * Bump this when the analysis prompt changes to invalidate stale cache entries.
 */
const PROMPT_VERSION = 2;

/** Maximum answer characters sent to Claude. Longer answers are truncated with a note. */
const MAX_ANSWER_CHARS = 12000;

const ANALYSIS_TIMEOUT_MS = 60000;
const VALIDATION_TIMEOUT_MS = 10000;

// --- Config helpers ---

/** @returns {Promise<Object>} The config object. */
async function getConfig() {
  const data = await chrome.storage.local.get("config");
  return data.config || {};
}

// --- Analysis prompt builder ---

/**
 * Builds the system + user prompt for Claude analysis.
 * Truncates very long answers to stay within token limits.
 * @param {Object} payload - The extraction payload from the content script.
 * @param {Object} config - The user config.
 * @returns {{system: string, user: string}} The prompt pair.
 */
function buildPrompt(payload, config) {
  const citations = payload.visible_citations || [];
  const citationsStr =
    citations.length > 0
      ? JSON.stringify(citations, null, 2)
      : "None found";

  const ownDomain = config.ownDomain || "Not configured";
  const competitors =
    config.competitors && config.competitors.length > 0
      ? JSON.stringify(config.competitors)
      : "None configured";

  // Truncate very long answers to prevent token overflow
  let answerText = payload.answer_text || "";
  let truncatedNote = "";
  if (answerText.length > MAX_ANSWER_CHARS) {
    answerText = answerText.slice(0, MAX_ANSWER_CHARS);
    truncatedNote = `\n[NOTE: Answer was truncated from ${payload.answer_text.length} to ${MAX_ANSWER_CHARS} characters. Analyze what is provided.]`;
  }

  return {
    system: `You are Bathyal Lens, an AI citation analysis engine. You analyze AI-generated answers to identify:
1. Explicit citations — domains visibly linked/referenced in the answer
2. Ghost sources — domains whose content likely informed the answer without explicit credit
3. Citation DNA — structural patterns that explain why certain sources were selected

CRITICAL: Respond with ONLY valid JSON. No markdown fences, no backticks, no prose before or after. Start with { and end with }.

Be precise and conservative. Do not guess or fabricate. If uncertain, omit rather than speculate.`,

    user: `Analyze this AI-generated answer from ${payload.platform}.

QUERY: ${payload.query || "(no query)"}

ANSWER TEXT:
${answerText}${truncatedNote}

VISIBLE CITATIONS/LINKS FOUND IN THE ANSWER:
${citationsStr}

TRACKED DOMAINS:
Own domain: ${ownDomain}
Competitors: ${competitors}

Return this exact JSON structure:
{
  "explicit_citations": [
    {
      "domain": "example.com",
      "count": 1,
      "prominence": "high",
      "context": "Used as primary source for X claim"
    }
  ],
  "ghost_sources": [
    {
      "domain": "example.com",
      "confidence": 0.75,
      "evidence": "Answer mirrors specific methodology from this source"
    }
  ],
  "citation_dna": [
    {
      "pattern": "authority_bias",
      "description": "Sources with .gov/.edu domains preferred for factual claims",
      "strength": "strong"
    }
  ],
  "own_domain_status": {
    "cited": false,
    "ghost": false,
    "recommendation": "Create comprehensive comparison content to compete for citation"
  },
  "stats": {
    "total_citations": 3,
    "unique_domains": 2,
    "ghost_count": 1,
    "answer_word_count": 150
  }
}

Rules:
- explicit_citations: Only include domains that appear as visible links/references in the answer. Use the VISIBLE CITATIONS list as your primary source. The "domain" field must be a bare domain (e.g. "example.com"), not a full URL.
- ghost_sources: Only include if confidence >= 0.6. A ghost source must show clear textual evidence — specific facts, phrasing, or data points that trace to a known authoritative source. Prioritize tracked domains. Do NOT fabricate ghost sources — return an empty array [] if none are identifiable with confidence.
- citation_dna: 2-4 patterns max. Focus on structural reasons: recency bias, authority signals, content format preferences, topical expertise signals.
- prominence: "high" = opening source or primary recommendation, "medium" = one of several sources, "low" = brief mention or passing reference.
- own_domain_status: If own domain is "Not configured", set all fields to null. The recommendation should be specific and actionable (reference the query topic and competitor landscape).
- stats.answer_word_count: Count words in the original answer text.
- All arrays must be present even if empty (use []).
- All numeric fields must be numbers, not strings.`,
  };
}

// --- Anthropic API caller ---

/**
 * Calls the Anthropic Messages API with an abort timeout.
 * @param {Object} prompt - The {system, user} prompt object.
 * @param {Object} config - The user config (must include apiKey).
 * @returns {Promise<string>} The raw text response from Claude.
 * @throws {Error} On timeout, network failure, or API error.
 */
async function callClaude(prompt, config) {
  const model = config.model || DEFAULT_MODEL;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);

  let response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        system: prompt.system,
        messages: [{ role: "user", content: prompt.user }],
      }),
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") throw new Error(`API request timed out after ${Math.round(ANALYSIS_TIMEOUT_MS / 1000)} seconds.`);
    throw err;
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    const status = response.status;
    let message;
    try {
      const err = await response.json();
      message = err.error?.message || `API error (${status})`;
    } catch {
      message = `API error (${status})`;
    }

    if (status === 401) throw new Error("API key invalid or expired. Check settings.");
    if (status === 429) throw new Error("Rate limited. Wait a moment and try again.");
    if (status >= 500) throw new Error("Anthropic API error. Try again shortly.");
    throw new Error(message);
  }

  const data = await response.json();

  if (!data.content || !data.content.length || !data.content[0].text) {
    throw new Error("Unexpected API response shape. No content returned.");
  }

  return data.content[0].text;
}

// --- Result normalization ---

/**
 * Ensures the parsed analysis result has all expected fields with safe defaults.
 * Protects the overlay from crashing on malformed or partial API responses.
 * @param {Object} raw - The raw parsed JSON from Claude.
 * @returns {Object} A normalized result with all fields guaranteed.
 */
function normalizeResult(raw) {
  return {
    explicit_citations: Array.isArray(raw.explicit_citations)
      ? raw.explicit_citations.map(c => ({
          domain: String(c.domain || ""),
          count: Number(c.count) || 1,
          prominence: ["high", "medium", "low"].includes(c.prominence) ? c.prominence : "medium",
          context: String(c.context || ""),
        }))
      : [],
    ghost_sources: Array.isArray(raw.ghost_sources)
      ? raw.ghost_sources
          .filter(g => (Number(g.confidence) || 0) >= 0.6)
          .map(g => ({
            domain: String(g.domain || ""),
            confidence: Math.min(1, Math.max(0, Number(g.confidence) || 0)),
            evidence: String(g.evidence || ""),
          }))
      : [],
    citation_dna: Array.isArray(raw.citation_dna)
      ? raw.citation_dna.slice(0, 4).map(d => ({
          pattern: String(d.pattern || ""),
          description: String(d.description || ""),
          strength: ["strong", "moderate"].includes(d.strength) ? d.strength : "moderate",
        }))
      : [],
    own_domain_status: raw.own_domain_status
      ? {
          cited: Boolean(raw.own_domain_status.cited),
          ghost: Boolean(raw.own_domain_status.ghost),
          recommendation: raw.own_domain_status.recommendation != null
            ? String(raw.own_domain_status.recommendation)
            : null,
        }
      : { cited: false, ghost: false, recommendation: null },
    stats: {
      total_citations: Number(raw.stats?.total_citations) || 0,
      unique_domains: Number(raw.stats?.unique_domains) || 0,
      ghost_count: Number(raw.stats?.ghost_count) || 0,
      answer_word_count: Number(raw.stats?.answer_word_count) || 0,
    },
  };
}

// --- Main analysis handler ---

/**
 * Handles a full analysis request: checks cache, calls Claude, parses, caches, tracks usage.
 * Only tracks usage on successful parse — no double-counting on retry.
 * @param {Object} payload - The extraction payload from the content script.
 * @returns {Promise<Object>} An ANALYZE_RESULT or ANALYZE_ERROR message.
 */
async function handleAnalyzeRequest(payload) {
  const config = await getConfig();

  if (!config.apiKey) {
    return {
      type: "ANALYZE_ERROR",
      error: "No API key configured. Click the Bathyal Lens icon to add your Claude API key.",
    };
  }

  // Validate payload has usable content
  const answerText = (payload.answer_text || "").trim();
  if (!answerText || answerText.length < 20) {
    return {
      type: "ANALYZE_ERROR",
      error: "Not enough text to analyze. Select a longer passage or wait for the full answer to load.",
    };
  }

  try {
    // Check cache — key includes all fields that affect analysis output
    const model = config.model || DEFAULT_MODEL;
    const cacheInput = payload.answer_text + "\0" + (payload.query || "") + "\0" + (payload.platform || "") + "\0" + model + "\0" + (config.ownDomain || "") + "\0" + (config.competitors || []).join("\0") + "\0v" + PROMPT_VERSION;
    const cacheKey = await getCacheKey(cacheInput);
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return { type: "ANALYZE_RESULT", payload: cached, cached: true };
    }

    // Build prompt and call API
    const prompt = buildPrompt(payload, config);
    let responseText = await callClaude(prompt, config);
    let result = parseAnalysisJSON(responseText);

    // Retry once on parse failure (don't track usage for failed attempt)
    if (!result) {
      responseText = await callClaude(prompt, config);
      result = parseAnalysisJSON(responseText);
    }

    if (!result) {
      return {
        type: "ANALYZE_ERROR",
        error: "Unexpected response format. Try switching to Sonnet for more reliable parsing.",
      };
    }

    // Normalize result — ensure all expected fields exist with safe defaults
    result = normalizeResult(result);

    // Track usage only after successful parse (single count regardless of retry)
    await trackUsage(model);

    // Cache result
    await cacheSet(cacheKey, result, payload.platform, payload.query);

    return { type: "ANALYZE_RESULT", payload: result, cached: false };
  } catch (err) {
    return { type: "ANALYZE_ERROR", error: err.message || "Analysis failed." };
  }
}

// --- Message listener ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ANALYZE_REQUEST") {
    const tabId = sender.tab?.id;
    if (!tabId) return false; // No tab to reply to — skip
    handleAnalyzeRequest(message.payload).then((response) => {
      chrome.tabs.sendMessage(tabId, response).catch(() => {
        // Tab may have closed or navigated away
      });
    }).catch((err) => {
      // Catch any unhandled rejection so loading state doesn't hang
      chrome.tabs.sendMessage(tabId, {
        type: "ANALYZE_ERROR",
        error: err.message || "Analysis failed unexpectedly.",
      }).catch(() => {});
    });
    return false;
  }

  if (message.type === "VALIDATE_API_KEY") {
    validateApiKey(message.apiKey).then(sendResponse);
    return true; // Keep channel open for async response
  }

  if (message.type === "GET_USAGE") {
    import("./utils/usage.js")
      .then(({ getUsage }) => getUsage())
      .then(sendResponse)
      .catch(() => sendResponse({ date: "", count: 0, estimatedCostUsd: 0 }));
    return true;
  }
});

// --- API key validation ---

/**
 * Validates an API key by sending a minimal request to Anthropic.
 * Uses a short timeout since this is a quick check.
 * @param {string} apiKey - The key to validate.
 * @returns {Promise<{valid: boolean}>}
 */
async function validateApiKey(apiKey) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
    });
    clearTimeout(timeoutId);
    return { valid: response.ok };
  } catch {
    clearTimeout(timeoutId);
    return { valid: false };
  }
}

// --- Context menu ---

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "bathyal-analyze-selection",
    title: "Analyze with Bathyal Lens",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "bathyal-analyze-selection" && tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: "ANALYZE_SELECTION",
      text: info.selectionText,
    });
  }
});
