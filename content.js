/**
 * Bathyal Lens — Content Script
 * Detects AI answers, extracts data, injects badge + overlay panel.
 * Platform modules (google.js, perplexity.js) load before this file
 * and attach to window.BathyalPlatforms.
 */

(function () {
  "use strict";

  // --- State ---
  let currentPlatform = null;
  let extractedData = null;
  let analysisResult = null;
  let isAnalyzing = false;
  let panelVisible = false;
  let badgeEl = null;
  let panelEl = null;

  // --- Platform detection ---

  function getPlatform() {
    const host = location.hostname;
    const platforms = window.BathyalPlatforms || {};

    if (host.includes("google.com") && platforms.google) return platforms.google;
    if (host.includes("perplexity.ai") && platforms.perplexity) return platforms.perplexity;
    return null;
  }

  // --- Badge ---

  function createBadge() {
    if (badgeEl) return;

    badgeEl = document.createElement("div");
    badgeEl.id = "bathyal-lens-badge";
    badgeEl.title = "Bathyal Lens — Click to analyze";
    badgeEl.addEventListener("click", onBadgeClick);
    document.body.appendChild(badgeEl);
  }

  function setBadgeState(state) {
    if (!badgeEl) return;
    badgeEl.className = "";
    badgeEl.classList.add("bathyal-badge", `bathyal-badge--${state}`);
  }

  function onBadgeClick() {
    if (isAnalyzing) return;
    if (analysisResult) {
      togglePanel();
      return;
    }
    if (extractedData) {
      runAnalysis(extractedData);
    }
  }

  // --- Analysis ---

  function runAnalysis(data) {
    if (isAnalyzing) return;
    isAnalyzing = true;
    setBadgeState("loading");
    showPanel("loading");

    chrome.runtime.sendMessage({
      type: "ANALYZE_REQUEST",
      payload: data,
    });
  }

  // --- Message handling ---

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "ANALYZE_RESULT") {
      isAnalyzing = false;
      analysisResult = message.payload;

      // Determine badge state based on own domain status
      if (analysisResult.own_domain_status?.cited) {
        setBadgeState("success");
      } else if (
        analysisResult.explicit_citations?.some((c) =>
          isCompetitorDomain(c.domain)
        )
      ) {
        setBadgeState("danger");
      } else {
        setBadgeState("detected");
      }

      showPanel("result", analysisResult);
    }

    if (message.type === "ANALYZE_ERROR") {
      isAnalyzing = false;
      setBadgeState("detected");
      showPanel("error", message.error);
    }

    if (message.type === "ANALYZE_SELECTION") {
      // Right-click context menu: analyze selected text
      const data = {
        platform: "manual_selection",
        query: "",
        answer_text: message.text,
        visible_citations: [],
        page_url: window.location.href,
      };
      runAnalysis(data);
    }
  });

  let cachedConfig = null;
  function isCompetitorDomain(domain) {
    // Will be populated from config
    return false;
  }

  async function loadConfig() {
    return new Promise((resolve) => {
      chrome.storage.local.get("config", (data) => {
        cachedConfig = data.config || {};
        resolve(cachedConfig);
      });
    });
  }

  // --- Panel rendering ---

  function showPanel(state, data) {
    if (!panelEl) {
      panelEl = document.createElement("div");
      panelEl.id = "bathyal-lens-panel";
      document.body.appendChild(panelEl);
    }

    panelEl.style.display = "block";
    panelVisible = true;

    if (state === "loading") {
      panelEl.innerHTML = renderLoading();
    } else if (state === "error") {
      panelEl.innerHTML = renderError(data);
    } else if (state === "result") {
      panelEl.innerHTML = renderResult(data);
    }
  }

  function togglePanel() {
    if (!panelEl) return;
    if (panelVisible) {
      panelEl.style.display = "none";
      panelVisible = false;
    } else {
      panelEl.style.display = "block";
      panelVisible = true;
    }
  }

  function hidePanel() {
    if (panelEl) {
      panelEl.style.display = "none";
      panelVisible = false;
    }
  }

  // --- Render functions ---

  function renderLoading() {
    return `
      <div class="bathyal-panel-header">
        <span class="bathyal-panel-title">BATHYAL LENS</span>
        <div class="bathyal-panel-controls">
          <button class="bathyal-btn-minimize" onclick="document.getElementById('bathyal-lens-panel').style.display='none'">−</button>
        </div>
      </div>
      <div class="bathyal-panel-body" style="text-align:center; padding:40px 20px;">
        <div class="bathyal-sonar">
          <div class="bathyal-sonar-ring"></div>
          <div class="bathyal-sonar-ring" style="animation-delay:0.5s"></div>
          <div class="bathyal-sonar-ring" style="animation-delay:1.0s"></div>
          <div class="bathyal-sonar-dot"></div>
        </div>
        <div class="bathyal-loading-text">ANALYZING</div>
      </div>
    `;
  }

  function renderError(error) {
    return `
      <div class="bathyal-panel-header">
        <span class="bathyal-panel-title">BATHYAL LENS</span>
        <div class="bathyal-panel-controls">
          <button class="bathyal-btn-minimize" onclick="document.getElementById('bathyal-lens-panel').style.display='none'">×</button>
        </div>
      </div>
      <div class="bathyal-panel-body">
        <div class="bathyal-error">
          <div class="bathyal-error-icon">⚠</div>
          <div class="bathyal-error-text">${escapeHtml(error)}</div>
        </div>
      </div>
    `;
  }

  function renderResult(data) {
    const d = data;

    // Citation map
    const maxCount = Math.max(...(d.explicit_citations || []).map((c) => c.count), 1);
    const citationRows = (d.explicit_citations || [])
      .map((c) => {
        const pct = Math.round((c.count / maxCount) * 100);
        return `
        <div class="bathyal-citation-row">
          <span class="bathyal-citation-domain">${escapeHtml(c.domain)}</span>
          <div class="bathyal-citation-bar-bg">
            <div class="bathyal-citation-bar" style="width:${pct}%"></div>
          </div>
          <span class="bathyal-citation-count">${c.count}×</span>
          <span class="bathyal-citation-prominence bathyal-prominence-${c.prominence}">${c.prominence}</span>
        </div>`;
      })
      .join("");

    // Ghost sources
    const ghostRows = (d.ghost_sources || [])
      .map((g) => {
        const pct = Math.round(g.confidence * 100);
        return `
        <div class="bathyal-ghost-item">
          <div class="bathyal-ghost-header">
            <span class="bathyal-ghost-icon">◐</span>
            <span class="bathyal-ghost-domain">${escapeHtml(g.domain)}</span>
            <span class="bathyal-ghost-confidence">${pct}%</span>
          </div>
          <div class="bathyal-ghost-evidence">${escapeHtml(g.evidence)}</div>
          <div class="bathyal-confidence-bar-bg">
            <div class="bathyal-confidence-bar" style="width:${pct}%"></div>
          </div>
        </div>`;
      })
      .join("");

    // Citation DNA
    const dnaRows = (d.citation_dna || [])
      .map((dna) => {
        return `
        <div class="bathyal-dna-item">
          <div class="bathyal-dna-header">
            <span class="bathyal-dna-icon">✦</span>
            <span class="bathyal-dna-pattern">${escapeHtml(dna.pattern.replace(/_/g, " "))}</span>
            <span class="bathyal-dna-strength bathyal-strength-${dna.strength}">${dna.strength}</span>
          </div>
          <div class="bathyal-dna-desc">${escapeHtml(dna.description)}</div>
        </div>`;
      })
      .join("");

    // Own domain
    const own = d.own_domain_status || {};
    const ownStatus = own.cited ? "CITED" : own.ghost ? "GHOST" : "NOT CITED";
    const ownClass = own.cited ? "success" : "danger";

    // Stats
    const stats = d.stats || {};

    return `
      <div class="bathyal-panel-header">
        <span class="bathyal-panel-title">BATHYAL LENS</span>
        <div class="bathyal-panel-controls">
          <button class="bathyal-btn-minimize" onclick="document.getElementById('bathyal-lens-panel').style.display='none'">−</button>
          <button class="bathyal-btn-close" onclick="document.getElementById('bathyal-lens-panel').style.display='none'">×</button>
        </div>
      </div>

      <div class="bathyal-panel-body">
        ${own.recommendation !== null ? `
        <div class="bathyal-own-domain bathyal-own-${ownClass}">
          <span class="bathyal-own-dot bathyal-own-dot-${ownClass}"></span>
          <span class="bathyal-own-status">${ownStatus}</span>
        </div>` : ""}

        <div class="bathyal-section">
          <div class="bathyal-section-title">CITATION MAP <span class="bathyal-section-count">${stats.unique_domains || 0}</span></div>
          ${citationRows || '<div class="bathyal-empty">No citations found</div>'}
        </div>

        ${ghostRows ? `
        <div class="bathyal-section">
          <div class="bathyal-section-title">GHOST SOURCES <span class="bathyal-section-count bathyal-ghost-accent">${stats.ghost_count || 0}</span></div>
          <div class="bathyal-ghost-desc">Content from these domains likely informed this answer but received no explicit citation.</div>
          ${ghostRows}
        </div>` : ""}

        ${dnaRows ? `
        <div class="bathyal-section">
          <div class="bathyal-section-title">CITATION DNA <span class="bathyal-section-count bathyal-dna-accent">${(d.citation_dna || []).length}</span></div>
          ${dnaRows}
        </div>` : ""}

        ${own.recommendation ? `
        <div class="bathyal-section">
          <div class="bathyal-section-title">RECOMMENDATION</div>
          <div class="bathyal-recommendation">${escapeHtml(own.recommendation)}</div>
        </div>` : ""}

        <div class="bathyal-stats-bar">
          <span><strong>${stats.total_citations || 0}</strong> Sources</span>
          <span><strong>${stats.unique_domains || 0}</strong> Domains</span>
          <span class="bathyal-ghost-accent"><strong>${stats.ghost_count || 0}</strong> Ghosts</span>
          <span><strong>${stats.answer_word_count || 0}</strong> Words</span>
        </div>

        <div class="bathyal-debug-toggle">
          <button onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">Toggle Raw JSON</button>
          <pre class="bathyal-raw-json" style="display:none">${escapeHtml(JSON.stringify(data, null, 2))}</pre>
        </div>
      </div>
    `;
  }

  function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // --- MutationObserver for AI answer detection ---

  function startObserver() {
    currentPlatform = getPlatform();
    if (!currentPlatform) return;

    createBadge();
    setBadgeState("idle");

    let debounceTimer = null;
    const debounceMs = currentPlatform.debounceMs || 500;

    // Initial scan
    checkForAIAnswer();

    const observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(checkForAIAnswer, debounceMs);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  async function checkForAIAnswer() {
    if (!currentPlatform) return;

    const container = currentPlatform.detect();
    if (!container) return;

    extractedData = currentPlatform.extract(container);
    setBadgeState("detected");

    // Check activation mode
    const config = await loadConfig();
    if (config.activationMode === "auto") {
      runAnalysis(extractedData);
    }
  }

  // --- Init ---

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startObserver);
  } else {
    startObserver();
  }
})();
