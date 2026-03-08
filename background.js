/**
 * Bathyal Lens — Service Worker (background.js)
 * Handles: API calls to Anthropic, caching, usage tracking, message routing, context menu.
 */

import { getCacheKey } from "./utils/hash.js";
import { parseAnalysisJSON } from "./utils/parse.js";
import { cacheGet, cacheSet } from "./utils/cache.js";
import { trackUsage } from "./utils/usage.js";

// --- Config helpers ---

async function getConfig() {
  const data = await chrome.storage.local.get("config");
  return data.config || {};
}

// --- Analysis prompt builder ---

function buildPrompt(payload, config) {
  const citationsStr =
    payload.visible_citations.length > 0
      ? JSON.stringify(payload.visible_citations, null, 2)
      : "None found";

  const ownDomain = config.ownDomain || "Not configured";
  const competitors =
    config.competitors && config.competitors.length > 0
      ? JSON.stringify(config.competitors)
      : "None configured";

  return {
    system: `You are Bathyal Lens, an AI citation analysis engine. You analyze AI-generated answers to identify explicit citations, implicit/ghost sources, and structural patterns that explain citation selection.

Respond ONLY with valid JSON. No markdown fences, no preamble, no explanation outside the JSON structure.`,

    user: `Analyze this AI-generated answer from ${payload.platform}.

QUERY: ${payload.query}

ANSWER TEXT:
${payload.answer_text}

VISIBLE CITATIONS/LINKS FOUND IN THE ANSWER:
${citationsStr}

TRACKED DOMAINS:
Own: ${ownDomain}
Competitors: ${competitors}

Return this exact JSON structure:
{
  "explicit_citations": [
    {
      "domain": "example.com",
      "count": <times cited>,
      "prominence": "high" | "medium" | "low",
      "context": "<how source is used in answer>"
    }
  ],
  "ghost_sources": [
    {
      "domain": "example.com",
      "confidence": <0.6 to 1.0>,
      "evidence": "<why this source likely informed the answer>"
    }
  ],
  "citation_dna": [
    {
      "pattern": "<short_identifier>",
      "description": "<why cited sources were selected>",
      "strength": "strong" | "moderate"
    }
  ],
  "own_domain_status": {
    "cited": <boolean>,
    "ghost": <boolean>,
    "recommendation": "<1-2 sentence actionable suggestion>"
  },
  "stats": {
    "total_citations": <number>,
    "unique_domains": <number>,
    "ghost_count": <number>,
    "answer_word_count": <number>
  }
}

Rules:
- Only include ghost_sources with confidence >= 0.6
- Focus ghost detection on tracked domains first, include obvious non-tracked ghosts if clearly identifiable
- citation_dna: 2-4 patterns max
- If no tracked domains configured, set own_domain_status fields to null
- prominence: "high" = opening/primary recommendation, "medium" = one of several, "low" = passing reference
- Do NOT fabricate ghost sources. If you cannot identify likely uncredited sources with reasonable confidence, return an empty array.`,
  };
}

// --- Anthropic API caller ---

async function callClaude(prompt, config) {
  const model = config.model || "claude-haiku-4-5-20251001";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
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
  return data.content[0].text;
}

// --- Main analysis handler ---

async function handleAnalyzeRequest(payload, sender) {
  const config = await getConfig();

  if (!config.apiKey) {
    return {
      type: "ANALYZE_ERROR",
      error: "No API key configured. Click the Bathyal Lens icon to add your Claude API key.",
    };
  }

  try {
    // Check cache
    const cacheKey = await getCacheKey(payload.answer_text);
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return { type: "ANALYZE_RESULT", payload: cached, cached: true };
    }

    // Build prompt and call API
    const prompt = buildPrompt(payload, config);
    let responseText = await callClaude(prompt, config);
    let result = parseAnalysisJSON(responseText);

    // Retry once on parse failure
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

    // Cache and track
    await cacheSet(cacheKey, result, payload.platform, payload.query);
    const model = config.model || "claude-haiku-4-5-20251001";
    await trackUsage(model);

    return { type: "ANALYZE_RESULT", payload: result, cached: false };
  } catch (err) {
    if (!navigator.onLine) {
      return { type: "ANALYZE_ERROR", error: "You appear to be offline." };
    }
    return { type: "ANALYZE_ERROR", error: err.message || "Analysis failed." };
  }
}

// --- Message listener ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ANALYZE_REQUEST") {
    handleAnalyzeRequest(message.payload, sender).then((response) => {
      // Send result back to the content script tab
      if (sender.tab?.id) {
        chrome.tabs.sendMessage(sender.tab.id, response);
      }
    });
    // Return false — we'll use chrome.tabs.sendMessage to reply
    return false;
  }

  if (message.type === "VALIDATE_API_KEY") {
    validateApiKey(message.apiKey).then(sendResponse);
    return true; // Keep channel open for async response
  }

  if (message.type === "GET_USAGE") {
    import("./utils/usage.js").then(({ getUsage }) => {
      getUsage().then(sendResponse);
    });
    return true;
  }
});

// --- API key validation ---

async function validateApiKey(apiKey) {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
    });
    return { valid: response.ok };
  } catch {
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
