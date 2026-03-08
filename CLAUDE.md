# BathyalLens — Build Context

## What This Is

A BYOK (Bring Your Own Key) Chrome extension that analyzes AI-generated answers in real-time, revealing citation patterns, ghost sources, and structural insights. No backend — runs entirely client-side using the user's own Claude API key.

Full spec: `docs/BathyalLens_Extension_Spec.md`
UI mockup (React reference): `docs/BathyalLensMockup.jsx`

## Build Plan — 4 Phases

| Phase | Focus | Status |
|-------|-------|--------|
| **Phase 1** | "It works" — end-to-end pipeline | **COMPLETE** |
| **Phase 2** | "It looks amazing" — Shadow DOM, deep-sea UI, animations | **COMPLETE** |
| **Phase 3** | "It's configurable" — full popup, caching polish, Perplexity tuning, copy/screenshot | **NEXT** |
| **Phase 4** | "It's public" — prompt tuning, edge cases, icons, README | NOT STARTED |

## What Phase 1 Built (COMPLETE)

All files in the repo root. No build system — plain vanilla JS loaded directly by Chrome.

### Architecture
- **Service worker** (`background.js`) — ES module. Handles Anthropic API calls, caching, usage tracking, message routing, context menu. Imports from `utils/`.
- **Content script** (`content.js`) — Orchestrates detection, extraction, badge injection, and overlay rendering. Platform modules load before it via manifest `js` array order.
- **Platform modules** (`platforms/google.js`, `platforms/perplexity.js`) — Attach to `window.BathyalPlatforms` namespace. Each exposes `detect()` and `extract()`.
- **Popup** (`popup/`) — Settings UI: API key with validation, domain tracking, competitor list, model selector, activation mode, usage display.
- **Utilities** (`utils/`) — `cache.js` (LRU, 2K entries, 24hr TTL), `hash.js` (SHA-256), `parse.js` (JSON fallback chain), `usage.js` (daily counter + cost).

### Message Protocol
Content script ↔ Service worker communication:
- `{ type: "ANALYZE_REQUEST", payload: { platform, query, answer_text, visible_citations, page_url } }`
- `{ type: "ANALYZE_RESULT", payload: <analysis JSON>, cached: bool }`
- `{ type: "ANALYZE_ERROR", error: <string> }`
- `{ type: "ANALYZE_SELECTION", text: <string> }` (context menu)
- `{ type: "VALIDATE_API_KEY", apiKey: <string> }` → `{ valid: bool }`
- `{ type: "GET_USAGE" }` → `{ date, count, estimatedCostUsd }`

### Analysis JSON Schema (returned by Claude, rendered by overlay)
```json
{
  "explicit_citations": [{ "domain", "count", "prominence", "context" }],
  "ghost_sources": [{ "domain", "confidence", "evidence" }],
  "citation_dna": [{ "pattern", "description", "strength" }],
  "own_domain_status": { "cited", "ghost", "recommendation" },
  "stats": { "total_citations", "unique_domains", "ghost_count", "answer_word_count" }
}
```

### Config Storage (`chrome.storage.local`)
- `"config"`: `{ apiKey, ownDomain, competitors[], model, activationMode }`
- `"cache"`: `{ [sha256_hash]: { result, timestamp, platform, query } }`
- `"usage"`: `{ date, count, estimatedCostUsd }`

### Known Phase 1 Limitations
- Overlay is basic DOM injection (no Shadow DOM) — host page CSS can leak in
- No SPA navigation handling (Google AJAX page transitions won't re-trigger detection — requires page refresh)
- Platform selectors are best-guess — need live testing against actual Google AI Overviews and Perplexity
- `isCompetitorDomain()` in content.js is a stub that always returns false — badge state logic for "competitor cited, you're not" won't fire yet

## What Phase 2 Should Do — "It Looks Amazing"

**Goal:** Replace the Phase 1 basic overlay with the full deep-sea aesthetic from the spec and mockup. This is the most visually critical phase — the panel needs to look great in screenshots and screen recordings for LinkedIn content.

### Phase 2 Tasks

1. **Shadow DOM container** — Replace direct DOM injection with a closed Shadow DOM root. All overlay HTML and CSS lives inside the shadow. This prevents host page CSS from breaking styles and vice versa.
   ```javascript
   const host = document.createElement("div");
   host.id = "bathyal-lens-root";
   document.body.appendChild(host);
   const shadow = host.attachShadow({ mode: "closed" });
   ```

2. **Panel CSS overhaul** — Implement the full deep-sea aesthetic from spec Section 13:
   - Color palette: `--bathyal-bg: #0a0e1a`, `--bathyal-accent: #00e5c7`, `--bathyal-ghost: #a55eea`, etc.
   - Fonts: IBM Plex Mono for data/labels, IBM Plex Sans for body text. Bundle font files in the extension (no CDN).
   - The current `bathyal-overlay.css` has most of the colors right already — but needs to be restructured to work inside Shadow DOM (`:host` selectors, CSS custom properties).

3. **Panel component structure** — Build the overlay as modular render functions (or small component files under `overlay/`). Reference `docs/BathyalLensMockup.jsx` for exact layout, spacing, and visual treatment:
   - Citation Map (bar chart with prominence indicators)
   - Ghost Sources (purple-accented cards with confidence bars)
   - Citation DNA (blue-accented pattern cards)
   - Recommendation (amber-accented)
   - Stats bar (footer)
   - Tracked Competitors summary (inside Citation Map section)

4. **Collapsible accordion sections** — Citation Map expanded by default, others collapsed. Click section header to toggle. Arrow rotates on expand.

5. **Loading state** — Sonar-ping animation (concentric circles). CSS from spec Section 13. Already partially in `bathyal-overlay.css` but needs to be polished.

6. **Staggered section reveal** — When results load, sections animate in with 100ms staggered delays. Smooth CSS transitions.

7. **Panel slide-in/slide-out** — 300ms ease-out transition from right edge. Already has basic `bathyal-slide-in` keyframe.

8. **Badge polish** — SVG sonar icon (already in mockup). Status-color glow states. Badge should update via `chrome.action.setIcon` for the toolbar icon too.

9. **Panel interactions:**
   - Minimize [−] collapses back to badge
   - Close [×] removes panel until next trigger
   - Click domain name opens in new tab

### Key Files to Modify in Phase 2
- `content.js` — Replace `showPanel()`/`renderResult()` functions with Shadow DOM-based rendering
- `bathyal-overlay.css` — Major overhaul for Shadow DOM + full aesthetic
- Possibly create `overlay/panel.js` and component files if the rendering logic gets complex enough to warrant extraction from content.js

### Reference Files
- `docs/BathyalLensMockup.jsx` — **THE visual reference.** Contains exact colors, spacing, component structure, SVG icons, animations. Translate this React code to vanilla JS + CSS inside Shadow DOM.
- `docs/BathyalLens_Extension_Spec.md` — Sections 4 (overlay panel UI), 9 (LinkedIn features), 13 (branding & visual identity)

### What NOT to Touch in Phase 2
- `background.js` — Service worker is complete for now
- `utils/` — Utility layer is stable
- `platforms/` — Detection modules are stable (will be tuned in Phase 4)
- `popup/` — Full popup overhaul is Phase 3
- Message protocol — Don't change the message format

## Development Notes

- **No build system.** Plain vanilla JS. Chrome loads files directly from the extension directory.
- **Manifest V3.** Service worker uses `"type": "module"` for ES imports.
- **Content scripts** share a single execution context. Platform modules attach to `window.BathyalPlatforms`, content.js reads from it.
- **Test by loading unpacked** in `chrome://extensions` (developer mode). After code changes, click the refresh button on the extension card.
- **Branch:** `claude/review-bathyallens-spec-2EYhs`
