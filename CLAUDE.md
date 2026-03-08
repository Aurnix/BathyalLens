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

## Architecture

### File Map
```
manifest.json           — MV3 manifest, no build system
background.js           — Service worker (ES module). API calls, caching, usage, message routing, context menu.
content.js              — Orchestrator. Platform detection, analysis triggers, message handling. ~155 lines.
platforms/google.js     — window.BathyalPlatforms.google — detect() + extract()
platforms/perplexity.js — window.BathyalPlatforms.perplexity — detect() + extract()
overlay/styles.js       — window.BathyalOverlay.PANEL_CSS — full CSS as JS string (~820 lines)
overlay/components.js   — window.BathyalOverlay.render* — DOM-based component renderers
overlay/panel.js        — window.BathyalOverlay.showPanel/createBadge/etc — Shadow DOM lifecycle manager
popup/                  — Settings UI: API key, domain, competitors, model, activation mode, usage
utils/cache.js          — LRU cache (2K entries, 24hr TTL)
utils/hash.js           — SHA-256 hashing
utils/parse.js          — JSON fallback chain parser
utils/usage.js          — Daily counter + cost estimator
bathyal-overlay.css     — DEPRECATED (Phase 1 relic). No longer loaded. Styles live in Shadow DOM now.
```

### Content Script Load Order (manifest `js` array)
1. `platforms/google.js` → attaches to `window.BathyalPlatforms`
2. `platforms/perplexity.js` → attaches to `window.BathyalPlatforms`
3. `overlay/styles.js` → attaches `PANEL_CSS` to `window.BathyalOverlay`
4. `overlay/components.js` → attaches render functions to `window.BathyalOverlay`
5. `overlay/panel.js` → attaches Shadow DOM manager to `window.BathyalOverlay`
6. `content.js` → reads from both namespaces, orchestrates everything

All overlay files use IIFE + namespace pattern (not ES modules) because MV3 content scripts don't support `import`.

### Shadow DOM (Phase 2)
- **Closed shadow root** on `#bathyal-lens-root` — host page CSS cannot leak in, extension CSS cannot leak out.
- Host element: `position:fixed; pointer-events:none;` — badge and panel children set `pointer-events:auto`.
- All CSS injected via `<style>` inside shadow root from `overlay/styles.js`.
- Components built with `document.createElement` + `addEventListener` (no innerHTML, no inline handlers).

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

Content script also attaches `_query` and `_platform` to the result before passing to the overlay, so the panel can show the query bar.

### Config Storage (`chrome.storage.local`)
- `"config"`: `{ apiKey, ownDomain, competitors[], model, activationMode }`
- `"cache"`: `{ [sha256_hash]: { result, timestamp, platform, query } }`
- `"usage"`: `{ date, count, estimatedCostUsd }`

## What Phase 2 Built (COMPLETE)

Replaced Phase 1's basic DOM injection with full deep-sea aesthetic inside Shadow DOM.

### UI Components (all in `overlay/components.js`)
- **Badge** — SVG sonar icon, 5 states: `idle`, `detected`, `loading`, `success`, `danger`. Each has distinct border color + glow.
- **Loading panel** — Sonar-ping animation (3 staggered rings expanding from center dot).
- **Error panel** — Warning icon + error text.
- **Result panel** — Full analysis view:
  - Header with logo + minimize/close buttons
  - Query bar (platform label + quoted query)
  - Own domain status bar (green dot = cited, red dot = not cited)
  - **Citation Map** section (expanded by default) — horizontal bars, prominence pips, competitor highlighting (amber), clickable domains, tracked competitors summary
  - **Ghost Sources** section (collapsed) — purple-accented cards, confidence bars with percentages
  - **Citation DNA** section (collapsed) — blue-accented pattern cards, strength badges
  - **Recommendation** section (collapsed) — amber-accented card
  - Debug toggle (raw JSON)
  - Stats bar (sources, domains, ghosts, words)
  - Footer

### Animations
- Panel slide-in: 300ms ease from right (`bathyal-slide-in`)
- Panel slide-out: 250ms ease to right (`bathyal-slide-out`)
- Section content: fade + translateY (`bathyal-fade-slide-in`)
- Staggered reveal: 4 classes with 50ms–350ms delays
- Sonar rings: infinite 2s pulse with 0.5s offsets
- Bar growth: `bathyal-bar-grow` on citation/confidence bars
- Badge loading: subtle pulse animation

### Panel Interactions
- **Minimize** [−] — slide-out animation, panel hidden, badge remains
- **Close** [×] — panel removed from DOM entirely
- **Badge click** — if result exists: toggle panel; if detected: trigger analysis
- **Domain click** — opens domain in new tab
- **Section headers** — accordion toggle with arrow rotation
- **Debug toggle** — show/hide raw JSON

## What Phase 3 Should Do — "It's Configurable"

**Goal:** Full popup overhaul, caching polish, copy/screenshot from panel, Perplexity tuning.

### Phase 3 Tasks

1. **Popup overhaul** — Redesign `popup/` with the deep-sea aesthetic matching the overlay panel. Should include:
   - API key input with validation (existing `VALIDATE_API_KEY` message)
   - Own domain input
   - Competitors list (add/remove)
   - Model selector dropdown
   - Activation mode toggle (auto vs manual)
   - Usage display (daily count + estimated cost)
   - All styled with the `--bathyal-*` color palette

2. **Copy Report button** — Add to panel action bar. Generates formatted text summary of analysis (see `BathyalLensMockup.jsx` `handleCopy` for format). Copies to clipboard via `navigator.clipboard.writeText`.

3. **Screenshot mode button** — Add to panel action bar. Toggles a semi-transparent backdrop behind the panel for clean screenshots. The mockup shows this as a dimmed overlay behind the panel.

4. **Caching polish** — Verify cache hits display correctly (the `cached` flag in `ANALYZE_RESULT`). Consider showing a "cached" indicator in the panel footer or stats bar.

5. **Perplexity tuning** — Live test `platforms/perplexity.js` selectors against actual Perplexity pages. Adjust `detect()` and `extract()` as needed.

### Key Files to Modify in Phase 3
- `popup/popup.html`, `popup/popup.css`, `popup/popup.js` — Full redesign
- `overlay/components.js` — Add Copy Report + Screenshot buttons to result panel
- `overlay/styles.js` — Add styles for action bar buttons + screenshot backdrop
- `overlay/panel.js` — May need screenshot backdrop management
- `platforms/perplexity.js` — Selector tuning

### What NOT to Touch in Phase 3
- `background.js` — Service worker is stable
- `utils/` — Utility layer is stable
- `platforms/google.js` — Will be tuned in Phase 4
- Message protocol — Don't change the message format
- Shadow DOM architecture — Keep the closed shadow root pattern

## Development Notes

- **No build system.** Plain vanilla JS. Chrome loads files directly from the extension directory.
- **Manifest V3.** Service worker uses `"type": "module"` for ES imports.
- **Content scripts** share a single execution context. Platform + overlay modules use IIFE + namespace pattern.
- **Test by loading unpacked** in `chrome://extensions` (developer mode). After code changes, click the refresh button on the extension card.
