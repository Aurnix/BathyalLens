/**
 * Bathyal Lens — Content Script
 * Detects AI answers, extracts data, triggers analysis.
 * Platform modules (google.js, perplexity.js) and overlay modules
 * (overlay/styles.js, overlay/components.js, overlay/panel.js)
 * load before this file via manifest js array order.
 *
 * UI is rendered inside a closed Shadow DOM via window.BathyalOverlay.
 */

(function () {
  "use strict";

  const overlay = window.BathyalOverlay;

  // --- State ---
  let currentPlatform = null;
  let extractedData = null;
  let analysisResult = null;
  let isAnalyzing = false;
  let cachedConfig = null;
  let lastAnalyzedText = null;
  let lastUrl = location.href;
  let observer = null;
  let observerDebounceTimer = null;
  let badgeClickTimer = null;

  // --- Platform detection ---

  function getPlatform() {
    const host = location.hostname;
    const platforms = window.BathyalPlatforms || {};

    if (host.includes("google.com") && platforms.google) return platforms.google;
    if (host.includes("perplexity.ai") && platforms.perplexity) return platforms.perplexity;
    return null;
  }

  // --- Config ---

  async function loadConfig() {
    const data = await chrome.storage.local.get("config");
    cachedConfig = data.config || {};
    return cachedConfig;
  }

  /**
   * Checks if a domain matches any tracked competitor.
   * Uses exact match or proper subdomain boundary check (dot-separated).
   */
  function isCompetitorDomain(domain) {
    if (!domain || !cachedConfig?.competitors?.length) return false;
    const clean = domain.replace(/^www\./, "").toLowerCase();
    return cachedConfig.competitors.some(
      (c) => clean === c || (clean.endsWith("." + c) && clean.length === c.length + 1 + clean.indexOf("." + c))
    );
  }

  // --- Badge click (debounced to prevent rapid double-clicks) ---

  function onBadgeClick() {
    if (badgeClickTimer) return;
    badgeClickTimer = setTimeout(() => { badgeClickTimer = null; }, 300);

    if (isAnalyzing) return;
    if (analysisResult) {
      overlay.togglePanel();
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
    lastAnalyzedText = data.answer_text;
    overlay.setBadgeState("loading");
    overlay.showPanel("loading");

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

      // Attach metadata for the panel
      analysisResult._cached = message.cached || false;
      if (extractedData) {
        analysisResult._query = extractedData.query;
        analysisResult._platform = extractedData.platform;
      }

      // Badge state: green if own domain cited, red if competitor cited (and own not),
      // otherwise neutral success (analysis completed, no tracked domain concern)
      const ownCited = analysisResult.own_domain_status?.cited;
      const competitorCited = analysisResult.explicit_citations?.some((c) =>
        isCompetitorDomain(c.domain)
      );

      if (ownCited) {
        overlay.setBadgeState("success");
      } else if (competitorCited) {
        overlay.setBadgeState("danger");
      } else {
        // No tracked domain involvement — show success (analysis complete)
        overlay.setBadgeState("success");
      }

      overlay.showPanel("result", analysisResult, cachedConfig);
    }

    if (message.type === "ANALYZE_ERROR") {
      isAnalyzing = false;
      overlay.setBadgeState("detected");
      overlay.showPanel("error", message.error);
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

  // --- MutationObserver for AI answer detection ---

  async function startObserver() {
    currentPlatform = getPlatform();
    if (!currentPlatform) return;

    // Load config before anything else so isCompetitorDomain works on first check
    await loadConfig();

    overlay.createBadge(onBadgeClick);
    overlay.setBadgeState("idle");

    const debounceMs = currentPlatform.debounceMs || 500;

    // Initial scan
    checkForAIAnswer();

    observer = new MutationObserver(() => {
      clearTimeout(observerDebounceTimer);
      observerDebounceTimer = setTimeout(checkForAIAnswer, debounceMs);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Cleanup on page unload to prevent stale observers
    window.addEventListener("pagehide", cleanup, { once: true });
  }

  /** Disconnects observer and clears pending timers. */
  function cleanup() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    clearTimeout(observerDebounceTimer);
    observerDebounceTimer = null;
  }

  function resetState() {
    extractedData = null;
    analysisResult = null;
    isAnalyzing = false;
    lastAnalyzedText = null;
    overlay.setBadgeState("idle");
  }

  function checkNavigation() {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      resetState();
    }
  }

  async function checkForAIAnswer() {
    if (!currentPlatform) return;

    // Detect SPA navigation (URL changed)
    checkNavigation();

    const container = currentPlatform.detect();
    if (!container) return;

    extractedData = currentPlatform.extract(container);

    // Skip re-analysis if answer text hasn't changed
    if (extractedData.answer_text === lastAnalyzedText) return;

    overlay.setBadgeState("detected");

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
