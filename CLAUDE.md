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
| **Phase 3** | "It's configurable" — full popup, caching polish, Perplexity tuning, copy/screenshot | **COMPLETE** |
| **Phase 4** | "It's public" — prompt tuning, edge cases, icons, README | **COMPLETE** |

## Architecture

### File Map
```
manifest.json           — MV3 manifest, no build system
background.js           — Service worker (ES module). API calls, caching, usage, message routing, context menu.
content.js              — Orchestrator. Platform detection, analysis triggers, message handling. ~155 lines.
platforms/google.js     — window.BathyalPlatforms.google — detect() + extract()
platforms/perplexity.js — window.BathyalPlatforms.perplexity — detect() + extract()
overlay/styles.js       — window.BathyalOverlay.PANEL_CSS — full CSS as JS string (~875 lines, includes action bar + screenshot backdrop)
overlay/components.js   — window.BathyalOverlay.render* — DOM-based component renderers + buildReport() + action bar
overlay/panel.js        — window.BathyalOverlay.showPanel/createBadge/toggleScreenshot/etc — Shadow DOM lifecycle manager
popup/                  — Settings UI: deep-sea aesthetic, card layout, pill selectors, usage stats
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

## What Phase 3 Built (COMPLETE)

Full popup redesign + panel action bar + caching indicator + Perplexity selector tuning.

### Popup Overhaul
- **popup.css** — Full restyle with `--bathyal-*` CSS variables (matching overlay). Card-based sections with colored left-accent borders (cyan=key, blue=domain, amber=competitors). Pill-style radio selectors with `:has(input:checked)` highlighting. Input focus glows. Staggered `bathyal-fade-in` animation on cards. Stats-row usage display.
- **popup.html** — Sonar SVG icon in header. Each settings group wrapped in `.popup-card` with `.popup-card-label`. Horizontal pill radio groups for model + activation. Usage shown as centered stat blocks (count + cost). Version in footer: `v0.1.0 · bathyal.ai`.
- **popup.js** — Added `input` event listener on `ownDomainInput` (saves on each keystroke, not just blur). Save button shows "Saved" with green `.popup-btn--saved` class for 1.5s after successful validation.

### Action Bar (in result panel)
- Two-button bar between scrollable body and stats bar: **Copy Report** + **Screenshot**
- **Copy Report** — `buildReport(data)` helper generates formatted text:
  - Header: 🌊 Bathyal Lens Analysis + query + platform
  - CITED SOURCES: domain (count× — prominence)
  - GHOST SOURCES: domain (confidence%) — evidence (60 chars)
  - WHY THESE SOURCES WON: → description (60 chars)
  - Footer: Analyzed by Bathyal Lens · bathyal.ai
  - Button shows "✓ Copied" with green highlight for 2s via `.bathyal-action-btn--copied`
- **Screenshot** — Toggles `toggleScreenshot()` in `panel.js`. Creates `.bathyal-screenshot-backdrop` (fixed, `rgba(8,11,20,0.92)`, `backdrop-filter: blur(4px)`) inserted before panel in shadow root. Backdrop auto-removed when panel is closed/removed. Button shows "Exit Screenshot" with cyan `.bathyal-action-btn--active` when active.

### Cached Indicator
- `content.js` now passes `message.cached` as `analysisResult._cached` to the overlay
- `renderResult()` checks `d._cached` and appends "↻ Cached" stat (blue `--bathyal-blue`) to stats bar

### Perplexity Selector Tuning
- Tightened `div[dir="auto"]` to `main div[dir="auto"]` (avoids matching nav/sidebar elements)
- Added `[class*="markdown"]` selector for Perplexity's markdown output containers
- Note: selectors still need live verification against actual Perplexity pages

## What Phase 4 Built (COMPLETE)

Public release readiness: prompt tuning, edge-case hardening, icons, README, manifest polish.

### Prompt Tuning
- Rewrote system prompt with explicit JSON-only instruction (no fences, no prose)
- Added concrete examples in the schema to guide Claude's output format
- Tightened ghost source rules: must show textual evidence, confidence >= 0.6
- Added explicit_citations rule: domain field must be bare domain, not full URL
- Required all arrays present even if empty, all numbers must be numbers
- Added `PROMPT_VERSION` constant (bumped to 2) — stale cache auto-invalidated

### Edge-Case Hardening
- **Answer truncation**: `MAX_ANSWER_CHARS = 12000` — long answers truncated with note to Claude
- **Empty payload validation**: Rejects answers < 20 chars before API call
- **Selection validation**: Context menu ignores selections < 20 chars
- **Result normalization**: `normalizeResult()` ensures all fields exist with safe types/defaults after parse
  - Coerces `count` to number, clamps `confidence` to 0–1, validates enum values
  - Filters ghost sources below 0.6 confidence
  - Caps citation_dna at 4 entries
  - Guarantees `stats` object with numeric defaults

### Extension Icons
- Generated programmatic sonar-themed icons at 16×16, 32×32, 48×48, 128×128
- Deep navy background with concentric teal rings matching the badge SVG aesthetic
- Added 32×32 size (previously missing)

### Manifest Polish
- Version bumped to `1.0.0`
- Expanded description for Chrome Web Store
- Added 32×32 icon reference
- Version updated in popup footer and overlay footer

### README
- Full user-facing documentation: what it does, who it's for, installation, BYOK setup
- Architecture overview, privacy statement, cost table
- Development instructions (no build step)

## Development Notes

- **No build system.** Plain vanilla JS. Chrome loads files directly from the extension directory.
- **Manifest V3.** Service worker uses `"type": "module"` for ES imports.
- **Content scripts** share a single execution context. Platform + overlay modules use IIFE + namespace pattern.
- **Test by loading unpacked** in `chrome://extensions` (developer mode). After code changes, click the refresh button on the extension card.
