# Bathyal Lens — Chrome Extension Full Spec

**"See beneath the surface."**

A Chrome extension that analyzes AI-generated answers in real-time, revealing who's being cited, who's invisible, and why.

---

## 1. Product Overview

### What It Does

When a user views an AI-generated answer on a supported platform, Bathyal Lens injects a floating analysis panel that breaks down the citation landscape of that answer — what sources were cited, what sources were likely used but not credited, and structural patterns that explain why certain content gets picked.

### Who It's For

- SEO professionals, content strategists, AEO/GEO practitioners
- Content directors at brands who want to understand their AI visibility
- Agency people who need to show clients what's happening in the AI layer
- Curious builders and marketers who want to see behind the curtain

### Supported Platforms (Launch)

| Platform | Detection Method | Priority |
|---|---|---|
| Google AI Overviews | DOM selector on SERP | P0 — ship with this |
| Perplexity (web) | DOM selector on answer page | P0 |
| ChatGPT (web) | DOM selector on response blocks | P1 |
| Gemini (web) | DOM selector | P2 |
| Bing Copilot | DOM selector | P2 |

Start with Google AI Overviews + Perplexity. These two alone cover the most important surfaces and give you a two-platform demo for LinkedIn content.

---

## 2. Architecture

**BYOK (Bring Your Own Key) — No backend required.**

The extension runs entirely client-side. The user provides their own Claude API key, which is stored locally in `chrome.storage.local` and used to call the Anthropic API directly from the service worker. Zero infrastructure. Zero hosting. Zero ops.

```
┌─────────────────────────────────────────────────┐
│                   BROWSER                        │
│                                                  │
│  ┌─────────────┐    ┌────────────────────────┐  │
│  │  Content     │    │   Overlay UI           │  │
│  │  Script      │───▶│   (Injected Panel)     │  │
│  │              │    │                        │  │
│  │  - Detects   │    │  - Citation breakdown  │  │
│  │    AI answer │    │  - Ghost sources       │  │
│  │  - Extracts  │    │  - Structural analysis │  │
│  │    text +    │    │  - Competitive view    │  │
│  │    citations │    │                        │  │
│  └──────┬───────┘    └────────────────────────┘  │
│         │                       ▲                 │
│         │                       │                 │
│  ┌──────▼───────────────────────┴──────────────┐ │
│  │          Service Worker (Background)         │ │
│  │                                              │ │
│  │  - Holds user's Claude API key              │ │
│  │  - Calls api.anthropic.com directly         │ │
│  │  - Caches results in chrome.storage.local   │ │
│  │  - Holds user config (tracked domains)      │ │
│  │  - Tracks usage / estimated cost            │ │
│  └──────────────────┬──────────────────────────┘ │
│                     │                             │
└─────────────────────┼─────────────────────────────┘
                      │  HTTPS direct
                      ▼
          api.anthropic.com/v1/messages
```

### Why No Backend?

- **Zero infrastructure** — Nothing to deploy, host, monitor, or pay for
- **Key security** — User's API key never touches a third-party server. Stored in sandboxed `chrome.storage.local`, sent only to Anthropic's API
- **Instant distribution** — Anyone with a Claude API key can use it immediately. No signup, no waitlist, no account creation
- **Open-sourceable** — No proprietary backend means the entire project can live on GitHub. Builds credibility, attracts contributors, creates a funnel
- **Cost transparency** — Users pay Anthropic directly for what they use. No markup, no surprise bills from you

### When to Add a Backend (Future)

If/when you want to:
- Distribute to non-technical users who don't have API keys
- Aggregate anonymized analytics across all users
- Push selector updates without extension updates
- Gate features behind a paid tier
- Collect the aggregate citation data that fuels LinkedIn content

That's a "good problem to have" moment — it means the extension has traction. Not a launch concern.

---

## 3. Extension Components

### 3.1 Manifest (manifest.json — Manifest V3)

```json
{
  "manifest_version": 3,
  "name": "Bathyal Lens",
  "version": "0.1.0",
  "description": "See beneath the surface. Analyze AI-generated answers in real-time.",
  "permissions": [
    "storage",
    "activeTab"
  ],
  "host_permissions": [
    "https://api.anthropic.com/*",
    "https://www.google.com/*",
    "https://www.perplexity.ai/*",
    "https://chatgpt.com/*",
    "https://gemini.google.com/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": [
        "https://www.google.com/search*",
        "https://www.perplexity.ai/*",
        "https://chatgpt.com/*"
      ],
      "js": ["content.js"],
      "css": ["bathyal-overlay.css"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/bathyal-16.png",
      "48": "icons/bathyal-48.png",
      "128": "icons/bathyal-128.png"
    }
  },
  "icons": {
    "16": "icons/bathyal-16.png",
    "48": "icons/bathyal-48.png",
    "128": "icons/bathyal-128.png"
  }
}
```

**Key note:** `https://api.anthropic.com/*` in `host_permissions` is required for the service worker to make direct API calls to Anthropic. Service workers are not subject to page-level CORS restrictions, so this works cleanly.

### 3.2 Content Script (content.js)

**Responsibilities:**
1. Detect AI-generated answer blocks on the current page
2. Extract answer text + any visible citations/links
3. Inject the Bathyal Lens overlay trigger (small floating badge)
4. On activation (click or auto), send extracted data to service worker via `chrome.runtime.sendMessage`
5. Listen for analysis results from service worker and render the overlay panel

**Platform Detection Logic:**

```
GOOGLE AI OVERVIEWS:
- Primary selector: div[data-attrid="ai_overview"] 
  OR div.kp-wholepage containing AI-generated content
  OR the SGE container (selectors shift — need fallback chain)
- Fallback: Look for container with "AI Overview" heading text
- Extract: innerHTML of the answer block, all <a> href values 
  within it
- NOTE: Google changes these selectors frequently. Build a 
  selector chain that tries multiple known patterns and fails 
  gracefully. Store selectors in a config object at the top of 
  the platform module so they're easy to update in one place.

PERPLEXITY:
- Primary selector: The main answer container 
  (div with prose content below the query)
- Citations: Numbered reference links [1], [2] etc. 
  with href attributes pointing to source URLs
- Extract: Answer text + all citation URLs + citation 
  position in text

CHATGPT:
- Primary selector: Assistant message blocks 
  (div[data-message-author-role="assistant"])
- Citations: Inline links within the response, 
  "Sources" section if present
- Extract: Response text + any embedded URLs
```

**MutationObserver Pattern:**

AI answers often load asynchronously (streamed in, lazy-loaded). Don't just scan on page load — set up a MutationObserver to detect when AI answer content appears or changes.

```
Observer watches for:
- New child nodes matching AI answer selectors
- Content changes within existing AI answer containers
- Debounce: Wait 500ms after last mutation before triggering 
  extraction (streaming responses update rapidly)
- For ChatGPT specifically: wait 1000ms after last mutation 
  (streaming is slower and more granular)
```

**Message flow to service worker:**

```javascript
// Content script sends extracted data
chrome.runtime.sendMessage({
  type: "ANALYZE_REQUEST",
  payload: {
    platform: "google_ai_overview",
    query: "best crm software for small business",
    answer_text: "The full text of the AI answer...",
    visible_citations: [
      { url: "https://hubspot.com/...", anchor_text: "HubSpot" }
    ],
    page_url: window.location.href
  }
});

// Content script listens for results
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "ANALYZE_RESULT") {
    renderOverlayPanel(message.payload);
  }
  if (message.type === "ANALYZE_ERROR") {
    renderErrorState(message.error);
  }
});
```

### 3.3 Service Worker (background.js)

**Responsibilities:**
1. Receive extracted answer data from content script
2. Check cache — if this exact answer was already analyzed, return cached result
3. Load user config (API key, tracked domains, model preference) from `chrome.storage.local`
4. Validate API key exists (if not, send back an error prompting setup)
5. Call Anthropic API directly with the analysis prompt
6. Parse the JSON response
7. Cache the result (keyed by SHA-256 hash of answer text)
8. Track usage count and estimated cost for the day
9. Send results back to content script

**Direct Anthropic API Call:**

```javascript
async function callClaude(prompt, config) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: config.model || "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [
        { role: "user", content: prompt }
      ]
    })
  });
  
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "API call failed");
  }
  
  const data = await response.json();
  return data.content[0].text;
}
```

**Note on `anthropic-dangerous-direct-browser-access` header:** Anthropic requires this header for direct browser-to-API calls to acknowledge the API key is in a client-side context. In a Chrome extension service worker, the key is sandboxed (not accessible to web pages), so this is acceptable for a BYOK tool. Document this clearly in the README so users understand the security model.

**Caching Strategy:**

```javascript
// Generate cache key from answer text
async function getCacheKey(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return "analysis_" + hashArray
    .map(b => b.toString(16).padStart(2, "0")).join("");
}

// Cache in chrome.storage.local
// TTL: 24 hours (AI answers change, stale analysis is misleading)
// Storage limit: chrome.storage.local allows 10MB
// Each cached analysis is ~2-4KB → ~2,500-5,000 entries before 
// hitting limits. Implement LRU eviction when exceeding 2,000.
```

**Usage Tracking:**

```javascript
// Stored in chrome.storage.local under "usage" key
{
  "date": "2026-03-08",
  "count": 12,
  "estimatedInputTokens": 24000,
  "estimatedOutputTokens": 9600,
  "estimatedCostUsd": 0.07
}

// Token estimation (rough, good enough for cost display):
// Input: ~2,000 tokens per analysis
// Output: ~800 tokens per analysis
// Haiku 4.5: $1/MTok input, $5/MTok output
//   → (2000/1M × $1) + (800/1M × $5) = ~$0.006/analysis
// Sonnet 4.5: $3/MTok input, $15/MTok output
//   → (2000/1M × $3) + (800/1M × $15) = ~$0.018/analysis

// Reset when date changes
```

### 3.4 Popup (popup.html / popup.js)

The popup is the settings/config interface accessed by clicking the extension icon.

**Popup Layout:**

```
┌──────────────────────────────────┐
│  🌊 BATHYAL LENS                 │
│  See beneath the surface         │
│──────────────────────────────────│
│                                  │
│  API KEY                         │
│  ┌────────────────────────────┐  │
│  │ sk-ant-•••••••••••••••4xf  │  │
│  └────────────────────────────┘  │
│  🔒 Stored locally. Only sent   │
│  to api.anthropic.com.           │
│                                  │
│  YOUR DOMAIN                     │
│  ┌────────────────────────────┐  │
│  │ example.com                │  │
│  └────────────────────────────┘  │
│                                  │
│  TRACKED COMPETITORS             │
│  ┌────────────────────────────┐  │
│  │ competitor1.com        [×] │  │
│  │ competitor2.com        [×] │  │
│  │ competitor3.com        [×] │  │
│  │ + Add competitor           │  │
│  └────────────────────────────┘  │
│                                  │
│  MODEL                           │
│  ◉ Haiku 4.5  (~$0.006/query)  │
│  ○ Sonnet 4.5 (~$0.018/query)  │
│                                  │
│  ACTIVATION                      │
│  ○ Auto (analyze every AI       │
│    answer automatically)         │
│  ◉ On-click (analyze when       │
│    I click the badge)            │
│                                  │
│  ─────────────────────────────   │
│  Today: 12 analyses              │
│  Est. cost: ~$0.07               │
│  ████████░░░░░░░░               │
│                                  │
│  [Clear Cache]  [Export Config]  │
│                                  │
│  bathyal.ai · v0.1.0            │
└──────────────────────────────────┘
```

**Popup Behavior:**

- API key field: masked by default, "Show" toggle to reveal
- First install: onboarding state — "Paste your Claude API key to get started. Get one at console.anthropic.com"
- API key validation on save (see Section 8)
- Domain fields: basic validation (strip protocol, trailing slashes, lowercase)
- Model selector: shows per-query cost estimate
- "Clear Cache" purges cached analyses from `chrome.storage.local`
- "Export Config" copies settings JSON to clipboard (for backup, sharing, debugging)

---

## 4. The Overlay Panel UI

This is the star of the show. It needs to look great in screenshots and screen recordings.

### Design Direction

**Aesthetic: Deep-sea instrument panel.** Submarine sonar display meets modern data dashboard. Dark background (deep ocean navy/black), bioluminescent blue-green accents, warm amber for warnings. Subtle depth effects — layered translucency, soft glows, not cartoonish. Professional enough for VP-level LinkedIn audiences, distinctive enough to be instantly recognizable.

### Shadow DOM Isolation

**Critical:** Inject the overlay inside a Shadow DOM to prevent the host page's CSS from breaking your styles and your styles from leaking into the page. This ensures visual consistency across Google, Perplexity, ChatGPT, etc.

```javascript
// In content script:
const host = document.createElement("div");
host.id = "bathyal-lens-root";
document.body.appendChild(host);
const shadow = host.attachShadow({ mode: "closed" });
// All overlay HTML and CSS goes inside shadow
```

### Panel Layout

Floating panel anchored to the right side of the viewport. Slides in from the edge when activated. ~380px wide, height adapts to content, max 80vh with scroll.

```
┌────────────────────────────────────┐
│ 🌊 BATHYAL LENS          [−] [×]  │
│ ─────────────────────────────────  │
│                                    │
│ ┌────────────────────────────────┐ │
│ │       CITATION MAP             │ │
│ │                                │ │
│ │  ██ hubspot.com          3×   │ │
│ │  ██ salesforce.com       2×   │ │
│ │  ██ pcmag.com            1×   │ │
│ │  ██ g2.com               1×   │ │
│ │                                │ │
│ │  YOUR DOMAIN: not cited       │ │
│ │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─    │ │
│ │  COMPETITORS:                  │ │
│ │  ● hubspot.com — CITED (3×)   │ │
│ │  ○ zoho.com — NOT CITED       │ │
│ │  ◐ pipedrive.com — GHOST      │ │
│ └────────────────────────────────┘ │
│                                    │
│ ┌────────────────────────────────┐ │
│ │   ▸  GHOST SOURCES             │ │
│ │                                │ │
│ │  Content from these domains    │ │
│ │  likely informed this answer   │ │
│ │  but received no citation:     │ │
│ │                                │ │
│ │  ◐ pipedrive.com              │ │
│ │    "Pricing comparison data    │ │
│ │     matches Pipedrive's        │ │
│ │     published feature table"   │ │
│ │    Confidence: ████░ HIGH      │ │
│ │                                │ │
│ │  ◐ capterra.com               │ │
│ │    "Review sentiment summary   │ │
│ │     closely mirrors Capterra   │ │
│ │     aggregate scores"          │ │
│ │    Confidence: ███░░ MEDIUM    │ │
│ └────────────────────────────────┘ │
│                                    │
│ ┌────────────────────────────────┐ │
│ │   ▸  CITATION DNA              │ │
│ │                                │ │
│ │  Why these sources won:        │ │
│ │                                │ │
│ │  ✦ Direct data points (4/7    │ │
│ │    cited sources had specific  │ │
│ │    numerical claims)           │ │
│ │                                │ │
│ │  ✦ Comparison structure (top   │ │
│ │    cited source uses vs/       │ │
│ │    comparison format)          │ │
│ │                                │ │
│ │  ✦ Freshness (3/7 updated     │ │
│ │    within last 30 days)        │ │
│ └────────────────────────────────┘ │
│                                    │
│ ┌────────────────────────────────┐ │
│ │   ▸  RECOMMENDATION            │ │
│ │                                │ │
│ │  Your domain was not cited.    │ │
│ │  This answer emphasizes        │ │
│ │  specific pricing data and     │ │
│ │  head-to-head comparisons —    │ │
│ │  content types to strengthen.  │ │
│ └────────────────────────────────┘ │
│                                    │
│ ┌────────────────────────────────┐ │
│ │  Sources: 7 · Domains: 5      │ │
│ │  Ghosts: 2 · Words: 247       │ │
│ │  Platform: Google AI Overview  │ │
│ └────────────────────────────────┘ │
│                                    │
│  [📋 Copy Report] [📸 Screenshot] │
│                                    │
│  Analyzed in 2.3s  ·  bathyal.ai  │
└────────────────────────────────────┘
```

### Panel States

**No API Key:** Badge visible but clicking shows: "Add your Claude API key in settings to get started." with button that opens popup.

**Collapsed (default):** Small floating badge at right edge. Glows when AI answer detected on page. Badge color:
- 🟢 Teal glow = AI answer detected, ready to analyze
- 🟢 Green dot = your domain is cited (post-analysis)
- 🔴 Red dot = competitor cited, you're not
- ⚪ Dim/gray = no AI answer on this page

**Loading:** Panel slides in, sonar-ping animation (concentric circles expanding). Skeleton loaders per section. Target: 1.5–3 second analysis time.

**Expanded:** Full panel. "Citation Map" expanded by default. Other sections as collapsible accordions.

**Error States:**
- No API key → Setup prompt linking to popup
- Invalid key → "API key rejected. Check settings."
- Rate limited → "Rate limit hit. Wait a moment."
- Extraction failed → "Couldn't extract AI answer. Page structure may have changed."
- Parse error → "Unexpected response. Try Sonnet for more reliable parsing."

### Panel Interactions

- **Hover on cited domain:** Highlight corresponding text in AI answer on host page (best-effort)
- **Click domain name:** Open in new tab
- **Click ghost source:** Expand evidence explanation
- **Copy Report:** Clean text summary to clipboard (see Section 9)
- **Screenshot Mode:** Dark backdrop over page, expand all sections, add watermark
- **Minimize [−]:** Collapse back to badge
- **Close [×]:** Remove panel until next page load or manual trigger

---

## 5. The Analysis Prompt

Core of the product. Must return structured JSON reliably from Haiku 4.5.

```
SYSTEM:
You are Bathyal Lens, an AI citation analysis engine. You analyze 
AI-generated answers to identify explicit citations, implicit/ghost 
sources, and structural patterns that explain citation selection.

Respond ONLY with valid JSON. No markdown fences, no preamble, no 
explanation outside the JSON structure.

USER:
Analyze this AI-generated answer from {platform}.

QUERY: {query}

ANSWER TEXT:
{answer_text}

VISIBLE CITATIONS/LINKS FOUND IN THE ANSWER:
{JSON array of {url, anchor_text} objects, or "None found"}

TRACKED DOMAINS:
Own: {own_domain or "Not configured"}
Competitors: {competitor_domains array or "None configured"}

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
- Focus ghost detection on tracked domains first, include obvious 
  non-tracked ghosts if clearly identifiable
- citation_dna: 2-4 patterns max
- If no tracked domains configured, set own_domain_status fields 
  to null
- prominence: "high" = opening/primary recommendation, 
  "medium" = one of several, "low" = passing reference
- Do NOT fabricate ghost sources. If you cannot identify likely 
  uncredited sources with reasonable confidence, return an 
  empty array.
```

**Token estimates per call:**
- System prompt: ~250 tokens
- User prompt: ~1,500–2,500 tokens (varies with answer length)
- Output: ~500–1,000 tokens
- **Haiku 4.5: ~$0.006/analysis**
- **Sonnet 4.5: ~$0.018/analysis**

---

## 6. Platform-Specific Extraction Details

### Google AI Overviews

```javascript
// google.js — Selector config (update here when Google changes things)
const GOOGLE_SELECTORS = {
  aiOverview: [
    '[data-attrid*="ai_overview"]',
    '#m-x-content',
    '.wDYxhc:has(.LGOjhe)',
    // Heuristic fallback: look for "AI Overview" heading text
  ],
  queryParam: 'q',
  linkFilter: (href) => href && !href.includes('google.com')
};

// Extraction:
// - innerText of matched container
// - All <a> tags within: extract href + textContent
// - Filter: remove google.com internal links
// - Query: from URL params (?q=...)
```

### Perplexity

```javascript
const PERPLEXITY_SELECTORS = {
  answerContainer: [
    // Main prose answer block below search input
    // Perplexity's DOM is more stable than Google's
  ],
  citations: [
    // Numbered [1], [2] reference links with href
  ],
  sourcePanel: [
    // Sidebar/footer with full source list
  ]
};

// Extraction:
// - innerText of answer block
// - Map numbered citations to URLs from source panel
// - Query: from URL path or input field
```

### ChatGPT (P1)

```javascript
const CHATGPT_SELECTORS = {
  assistantMessage: '[data-message-author-role="assistant"]',
  userMessage: '[data-message-author-role="user"]',
  // Target most recent assistant message
};

// MutationObserver debounce: 1000ms (streaming is granular)
// Query: most recent user message text
```

### Selector Resilience

1. **Centralized config** per platform module — one object to update
2. **Fallback heuristics** — scan for large text blocks with multiple external links
3. **Manual trigger** — right-click context menu (see Section 14)
4. **Future: remote selector config** via backend endpoint (when you add one)

---

## 7. Caching & Storage

### chrome.storage.local Layout

```javascript
{
  // User config
  "config": {
    "apiKey": "sk-ant-...",
    "ownDomain": "mydomain.com",
    "competitors": ["comp1.com", "comp2.com"],
    "model": "claude-haiku-4-5-20251001",
    "activationMode": "on-click"  // "auto" | "on-click"
  },
  
  // Usage tracking (resets daily)
  "usage": {
    "date": "2026-03-08",
    "count": 12,
    "estimatedCostUsd": 0.07
  },
  
  // Analysis cache (LRU, max ~2000 entries)
  "cache": {
    "<sha256_hash>": {
      "result": { /* analysis JSON */ },
      "timestamp": 1709900000000,
      "platform": "google_ai_overview",
      "query": "best crm software"
    }
  }
}
```

**Limits:** 10MB total for `chrome.storage.local`. Each cached analysis ~2–4KB. Implement LRU eviction at 2,000 entries (drop oldest 500).

**API key security:** In Chrome extension sandboxed storage, the key is not accessible to web pages or other extensions. Reasonable security for BYOK. Document in README.

---

## 8. Error Handling

### API Key Validation

On first analysis (or key change), make a minimal test call:

```javascript
async function validateApiKey(apiKey) {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }]
      })
    });
    return response.ok;
  } catch {
    return false;
  }
}
```

### JSON Parse Safety

Haiku is reliable at JSON when prompted firmly, but always try/catch:

1. Try `JSON.parse(response)` directly
2. Strip markdown fences (```json ... ```) and retry
3. Extract first `{` to last `}` substring and retry
4. If still failing, retry the API call once
5. On second failure, show error: "Unexpected format. Try Sonnet."

### Network Errors

- Offline → "You appear to be offline."
- Timeout (15s) → "Analysis timed out. Try again."
- 401 → "API key invalid or expired."
- 429 → "Rate limited. Wait a moment."
- 500+ → "Anthropic API error. Try shortly."

---

## 9. LinkedIn Content Features

**These are core features, not nice-to-haves.** Every LinkedIn post uses one or both.

### Copy as Report

```
🌊 Bathyal Lens Analysis
Query: "best crm software for small business"  
Platform: Google AI Overview

CITED SOURCES:
• hubspot.com (3× — high prominence)
• salesforce.com (2× — medium)  
• pcmag.com (1× — medium)
• g2.com (1× — low)

GHOST SOURCES (used but uncredited):
• pipedrive.com (82% confidence) — pricing data matches
• capterra.com (65% confidence) — review sentiment matches

WHY THESE SOURCES WON:
→ Specific numerical data points
→ Comparison/vs structure  
→ Updated within 30 days

RECOMMENDATION:
Strengthen content with specific pricing data and head-to-head 
feature comparisons.

—
Analyzed by Bathyal Lens · bathyal.ai
```

### Screenshot Mode

1. Expand all accordion sections
2. Add dark semi-opaque backdrop over host page
3. Add Bathyal wordmark + `bathyal.ai` watermark
4. User captures with OS screenshot tool (cmd+shift+4, Win+Shift+S)

### Screen Recording Friendly

- Panel slide-in: smooth CSS transition, 300ms ease-out
- Loading sonar: CSS-only animation, no jank
- Section reveals: staggered 100ms delays (looks great on video)
- All animations smooth at 30fps during screen capture

---

## 10. File Structure

```
bathyal-lens/
├── manifest.json
├── background.js                  # Service worker: API calls, cache,
│                                  # usage tracking, message routing
├── content.js                     # Content script: detection, extraction,
│                                  # overlay injection, message handling
├── platforms/
│   ├── google.js                  # Google AI Overview selectors + extraction
│   ├── perplexity.js              # Perplexity selectors + extraction
│   └── chatgpt.js                 # ChatGPT selectors + extraction
├── overlay/
│   ├── panel.js                   # Panel rendering + interactions
│   ├── panel.css                  # Panel styles (Shadow DOM scoped)
│   ├── components/
│   │   ├── citation-map.js        # Citation breakdown section
│   │   ├── ghost-sources.js       # Ghost source section
│   │   ├── citation-dna.js        # Structural patterns section
│   │   ├── recommendation.js      # Own domain recommendation
│   │   └── stats-bar.js           # Quick stats footer
│   ├── states/
│   │   ├── loading.js             # Sonar animation loading state
│   │   ├── error.js               # Error display states
│   │   └── no-key.js              # API key setup prompt
│   └── actions/
│       ├── copy-report.js         # Copy text report to clipboard
│       └── screenshot-mode.js     # Screenshot styling toggle
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── icons/
│   ├── bathyal-16.png
│   ├── bathyal-48.png
│   ├── bathyal-128.png
│   ├── bathyal-active-16.png      # Glowing variant for detected state
│   └── bathyal-active-48.png
├── utils/
│   ├── cache.js                   # Cache read/write/evict
│   ├── hash.js                    # SHA-256 for cache keys
│   ├── usage.js                   # Daily usage counter + cost estimate
│   └── parse.js                   # Robust JSON parsing with fallbacks
└── README.md                      # Setup, security model, contribution guide
```

---

## 11. Build Sequence

### Phase 1: "It works" (Days 1–2)

- [ ] Manifest + content script skeleton
- [ ] Google AI Overview detection (selector chain) + text extraction
- [ ] Service worker: receive message, call Claude Haiku directly, return response
- [ ] Hardcoded overlay: fixed-position div, dump raw JSON
- [ ] Popup: just API key input field, store in `chrome.storage.local`
- [ ] End-to-end working: Google → detect → extract → analyze → display

**Milestone:** Ugly but functional. Citation analysis appears on screen.

### Phase 2: "It looks amazing" (Days 2–4)

- [ ] Shadow DOM overlay container
- [ ] Panel CSS: deep-sea aesthetic, dark theme, bioluminescent accents
- [ ] Panel components: citation map, ghost sources, citation DNA, recommendation, stats
- [ ] Loading state with sonar-ping animation
- [ ] Staggered section reveal (CSS animation-delay)
- [ ] Collapsed badge with status-color dot
- [ ] Slide-in/slide-out transition

**Milestone:** Beautiful screen recordings for LinkedIn.

### Phase 3: "It's configurable" (Days 4–6)

- [ ] Full popup: API key, domain tracking, model selector, activation mode, usage display
- [ ] Caching layer (SHA-256 keyed, 24hr TTL, LRU eviction)
- [ ] Usage tracking + cost estimation
- [ ] API key validation on entry
- [ ] JSON parse fallbacks
- [ ] Network error states
- [ ] Add Perplexity platform module
- [ ] Copy-as-report button
- [ ] Screenshot mode button

**Milestone:** Installable and usable by someone else with their own key.

### Phase 4: "It's public" (Days 6–8)

- [ ] Prompt tuning against test checklist (Section 12)
- [ ] Cross-browser testing
- [ ] Edge cases (no AI answer, empty citations, long answers, non-English)
- [ ] README with setup, security model, screenshots
- [ ] Icons
- [ ] GitHub repo + release
- [ ] First LinkedIn post

**Milestone:** Public launch.

---

## 12. Prompt-Tuning Checklist

Test the analysis prompt against all of these before calling it done:

- [ ] Clear, linked citations (easy — should nail it)
- [ ] Brand mentions without links (implicit citations)
- [ ] Paraphrased content, zero attribution (ghost detection)
- [ ] Zero citations (some AI Overviews cite nothing)
- [ ] Your tracked domain IS cited (happy path — surface prominently)
- [ ] Competitor cited, you're not (most emotional case — make unmissable)
- [ ] Niche topic with few authoritative sources
- [ ] Very short answer (1–2 sentences)
- [ ] Very long answer (500+ words)
- [ ] Answer with statistics/data (identify likely data source)
- [ ] Same domain cited multiple times
- [ ] Only one citation total
- [ ] Purely generative answer with no clear source (should NOT fabricate ghosts)
- [ ] Ghost confidence calibration (high confidence = almost certainly from source)

---

## 13. Branding & Visual Identity

### Color Palette

```css
:host {
  --bathyal-bg:          #0a0e1a;
  --bathyal-surface:     #131a2e;
  --bathyal-surface-2:   #1a2340;
  --bathyal-border:      #1e2a45;
  --bathyal-text:        #c8d6e5;
  --bathyal-text-dim:    #6b7c93;
  --bathyal-text-bright: #e8f0f8;
  --bathyal-accent:      #00e5c7;
  --bathyal-accent-alt:  #00b4d8;
  --bathyal-warning:     #f5a623;
  --bathyal-danger:      #ff4757;
  --bathyal-success:     #2ed573;
  --bathyal-ghost:       #a55eea;
  --bathyal-glow:        0 0 20px rgba(0, 229, 199, 0.15);
  --bathyal-radius:      8px;
  --bathyal-font:        'IBM Plex Mono', 'SF Mono', monospace;
  --bathyal-font-body:   'IBM Plex Sans', -apple-system, sans-serif;
}
```

**Font rationale:** Monospace for data/labels (instrument-panel feel). Clean sans for body text. IBM Plex is distinctive without being weird. Bundle font files in extension (don't rely on CDN — keeps it self-contained).

### Sonar Loading Animation

```css
.bathyal-sonar {
  position: relative;
  width: 60px;
  height: 60px;
  margin: 40px auto;
}
.bathyal-sonar::before,
.bathyal-sonar::after,
.bathyal-sonar .ring {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1px solid var(--bathyal-accent);
  opacity: 0;
  animation: sonar-ping 2s ease-out infinite;
}
.bathyal-sonar::after { animation-delay: 0.5s; }
.bathyal-sonar .ring  { animation-delay: 1.0s; }

@keyframes sonar-ping {
  0%   { transform: scale(0.3); opacity: 0.8; }
  100% { transform: scale(1.5); opacity: 0; }
}
```

### Icon States

- **Inactive:** Dim, monochrome
- **Active:** Glowing teal (swap via `chrome.action.setIcon` when AI answer detected)

---

## 14. Context Menu Integration (Quick Win)

Right-click fallback for manual analysis when auto-detection fails:

```javascript
// In background.js
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "bathyal-analyze-selection",
    title: "Analyze with Bathyal Lens",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "bathyal-analyze-selection") {
    chrome.tabs.sendMessage(tab.id, {
      type: "ANALYZE_SELECTION",
      text: info.selectionText
    });
  }
});
```

Add `"contextMenus"` to manifest permissions. This lets users select any text, right-click, analyze. Works on platforms without built-in detection. Ultimate fallback.

---

*Full spec. BYOK, no backend, ready for Claude Code. Go build it.*
