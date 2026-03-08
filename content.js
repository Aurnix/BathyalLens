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

  function isCompetitorDomain(domain) {
    if (!cachedConfig?.competitors?.length) return false;
    const clean = domain.replace(/^www\./, "").toLowerCase();
    return cachedConfig.competitors.some(
      (c) => clean === c || clean.endsWith("." + c)
    );
  }

  // --- Badge click ---

  function onBadgeClick() {
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

      // Attach query/platform metadata for the panel's query bar
      if (extractedData) {
        analysisResult._query = extractedData.query;
        analysisResult._platform = extractedData.platform;
      }

      // Determine badge state based on own domain status
      if (analysisResult.own_domain_status?.cited) {
        overlay.setBadgeState("success");
      } else if (
        analysisResult.explicit_citations?.some((c) =>
          isCompetitorDomain(c.domain)
        )
      ) {
        overlay.setBadgeState("danger");
      } else {
        overlay.setBadgeState("detected");
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
