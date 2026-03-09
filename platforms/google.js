/**
 * Google AI Overview detection and extraction.
 * Attaches to window.BathyalPlatforms.google for content script access.
 *
 * NOTE: Google frequently changes AI Overview DOM structure.
 * These selectors should be re-verified against live pages during Phase 4.
 * Last verified: Phase 1 (initial build).
 */

(function () {
  window.BathyalPlatforms = window.BathyalPlatforms || {};

  /** Minimum character count to consider a container as a real AI answer (not just a label). */
  const MIN_ANSWER_LENGTH = 100;

  const SELECTORS = [
    '[data-attrid*="ai_overview"]',
    '#m-x-content',
    '.wDYxhc:has(.LGOjhe)',
  ];

  /**
   * Detects the AI Overview container on a Google search results page.
   * @returns {Element|null} The container element, or null if not found.
   */
  function detect() {
    for (const sel of SELECTORS) {
      try {
        const el = document.querySelector(sel);
        if (el && el.innerText.trim().length > MIN_ANSWER_LENGTH) return el;
      } catch (e) {
        console.warn("[BathyalLens] Google selector failed:", sel, e);
      }
    }

    // Heading-text fallback: look for element containing "AI Overview"
    const headings = document.querySelectorAll("h2, h3, div[role='heading']");
    for (const h of headings) {
      if (h.textContent.trim() === "AI Overview") {
        const container = h.closest("div[data-attrid]") || h.parentElement?.parentElement;
        if (container && container.innerText.trim().length > MIN_ANSWER_LENGTH) return container;
      }
    }

    return null;
  }

  /**
   * Extracts answer text and citations from a detected AI Overview container.
   * Handles Google redirect URLs (google.com/url?q=...) and filters internal links.
   * @param {Element} container - The AI Overview DOM element.
   * @returns {Object} The extraction payload.
   */
  function extract(container) {
    const answerText = container.innerText.trim();

    const links = Array.from(container.querySelectorAll("a[href]"));
    const citations = [];
    const seen = new Set();

    for (const a of links) {
      let href = a.href;
      if (!href || href.startsWith("javascript:")) continue;

      // Unwrap Google redirect URLs: /url?q=<actual_url>
      try {
        const parsed = new URL(href);
        if (parsed.hostname.includes("google.com") && parsed.pathname === "/url") {
          const target = parsed.searchParams.get("q");
          if (target) href = target;
          else continue;
        } else if (parsed.hostname.includes("google.com")) {
          continue;
        }
      } catch (e) {
        console.warn("[BathyalLens] Skipping malformed href:", href, e);
        continue;
      }

      try {
        const url = new URL(href);
        const domain = url.hostname.replace(/^www\./, "");
        const key = domain + url.pathname;
        if (seen.has(key)) continue;
        seen.add(key);

        citations.push({
          url: href,
          anchor_text: a.textContent.trim() || domain,
        });
      } catch (e) {
        console.warn("[BathyalLens] Skipping unparseable URL:", href, e);
      }
    }

    let query = "";
    try {
      query = new URL(window.location.href).searchParams.get("q") || "";
    } catch {
      // Malformed page URL — leave query empty
    }

    return {
      platform: "google_ai_overview",
      query,
      answer_text: answerText,
      visible_citations: citations,
      page_url: window.location.href,
    };
  }

  window.BathyalPlatforms.google = {
    detect,
    extract,
    debounceMs: 500,
    hostname: "www.google.com",
  };
})();
