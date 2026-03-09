# Bathyal Lens

**See beneath the surface.**

A BYOK (Bring Your Own Key) Chrome extension that analyzes AI-generated answers in real-time, revealing citation patterns, ghost sources, and structural insights. No backend — runs entirely client-side using your own Claude API key.

## What It Does

When you view an AI-generated answer on Google or Perplexity, Bathyal Lens injects a floating analysis panel that breaks down the citation landscape:

- **Citation Map** — Which sources are explicitly cited, how often, and their prominence level
- **Ghost Sources** — Domains whose content likely informed the answer but received no credit
- **Citation DNA** — Structural patterns explaining why certain sources get selected
- **Own Domain Tracking** — See if your site is cited, ghosted, or absent — with actionable recommendations
- **Competitor Tracking** — Monitor which competitors are winning citations in AI answers

## Who It's For

- SEO professionals and content strategists
- AEO/GEO practitioners tracking AI visibility
- Content directors who need to understand their brand's AI presence
- Agency people showing clients what's happening in the AI layer
- Anyone curious about how AI answers select and cite sources

## Supported Platforms

| Platform | Status |
|----------|--------|
| Google AI Overviews | Supported |
| Perplexity (web) | Supported |

## Installation

1. Clone or download this repository
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked** and select the `BathyalLens` directory
5. Click the Bathyal Lens icon in your toolbar to open settings

## Setup

### API Key (Required)

Bathyal Lens uses your own Anthropic API key. Your key is stored locally and only sent to `api.anthropic.com`.

1. Get an API key from [console.anthropic.com](https://console.anthropic.com/)
2. Open the Bathyal Lens popup (click the extension icon)
3. Paste your key and click **Save API Key**

### Configuration (Optional)

- **Your Domain** — Track whether your site gets cited in AI answers
- **Tracked Competitors** — Add competitor domains to monitor their citation presence
- **Model** — Choose between Haiku 4.5 (~$0.006/query) and Sonnet 4.6 (~$0.018/query)
- **Activation** — "On-click" (analyze when you click the badge) or "Auto" (analyze every detected answer)

## Usage

1. Search on Google or browse Perplexity
2. When an AI-generated answer is detected, the Bathyal Lens badge appears (right side of screen)
3. Click the badge to trigger analysis (or enable Auto mode)
4. The analysis panel slides in with full citation breakdown
5. Use **Copy Report** to share the analysis or **Screenshot** mode for clean captures

### Context Menu

Right-click any selected text and choose **Analyze with Bathyal Lens** to analyze arbitrary text passages.

## Architecture

```
manifest.json           — MV3 manifest
background.js           — Service worker: API calls, caching, usage tracking
content.js              — Orchestrator: platform detection, analysis triggers
platforms/google.js     — Google AI Overview detection + extraction
platforms/perplexity.js — Perplexity answer detection + extraction
overlay/styles.js       — Full CSS injected into Shadow DOM
overlay/components.js   — DOM-based component renderers
overlay/panel.js        — Shadow DOM lifecycle manager
popup/                  — Settings UI
utils/                  — Cache, hashing, JSON parsing, usage tracking
```

### Key Design Decisions

- **No build system** — Plain vanilla JS, Chrome loads files directly
- **Closed Shadow DOM** — Extension UI is fully isolated from host page CSS
- **BYOK** — No backend, no signup, no data collection. Your key, your data
- **MV3 compliant** — Uses service worker, no remote code execution

## Privacy

- Your API key is stored in `chrome.storage.local` and never leaves your browser except to call `api.anthropic.com`
- No analytics, no telemetry, no data collection
- All analysis happens client-side via direct API calls to Anthropic
- The extension only activates on Google search and Perplexity pages

## Cost

You pay Anthropic directly for API usage. Estimated costs per analysis:

| Model | Cost/Query |
|-------|-----------|
| Haiku 4.5 | ~$0.006 |
| Sonnet 4.6 | ~$0.018 |

Daily usage and estimated cost are shown in the extension popup.

## Development

```bash
# Load the extension
# 1. Open chrome://extensions
# 2. Enable Developer mode
# 3. Click "Load unpacked" → select this directory

# After code changes, click the refresh button on the extension card
```

No build step, no dependencies, no npm install. Edit and reload.

## License

MIT
