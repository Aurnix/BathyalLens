/**
 * Perplexity answer detection and extraction.
 * Attaches to window.BathyalPlatforms.perplexity for content script access.
 *
 * NOTE: Perplexity frequently changes its DOM structure.
 * These selectors should be re-verified against live pages during Phase 4.
 * Last verified: Phase 3 (partial — not live-tested).
 */

(function () {
  window.BathyalPlatforms = window.BathyalPlatforms || {};

  /** Minimum character count to consider a container as a real answer. */
  const MIN_ANSWER_LENGTH = 100;

  const ANSWER_SELECTORS = [
    ".prose",
    '[class*="prose"]',
    '[class*="markdown"]',
    // Fallback: answer area within main content (tightened to avoid nav/sidebar)
    // TODO(Phase 4): Verify these selectors against live Perplexity pages
    'main div[dir="auto"]',
  ];

  const CITATION_SELECTORS = [
    'a[href][data-index]',
    '.citation a[href]',
    'a[href].source',
  ];

  /**
   * Detects the answer container on a Perplexity page.
   * @returns {Element|null} The answer container, or null if not found.
   */
  function detect() {
    for (const sel of ANSWER_SELECTORS) {
      try {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          if (el.innerText.trim().length > MIN_ANSWER_LENGTH) return el;
        }
      } catch (e) {
        console.warn("[BathyalLens] Perplexity selector failed:", sel, e);
      }
    }
    return null;
  }

  /**
   * Extracts citation links from the answer container.
   * Deduplicates by domain + pathname across both citation selectors and inline links.
   * @param {Element} container - The answer DOM element.
   * @returns {Array<{url: string, anchor_text: string}>}
   */
  function extractCitations(container) {
    const citations = [];
    const seen = new Set();

    // Helper to process a single link element
    function processLink(a) {
      const href = a.href;
      if (!href || href.includes("perplexity.ai")) return;

      try {
        const url = new URL(href);
        const domain = url.hostname.replace(/^www\./, "");
        const key = domain + url.pathname;
        if (seen.has(key)) return;
        seen.add(key);

        citations.push({
          url: href,
          anchor_text: a.textContent.trim() || domain,
        });
      } catch (e) {
        console.warn("[BathyalLens] Skipping unparseable URL:", href, e);
      }
    }

    // Try citation-specific selectors first
    for (const sel of CITATION_SELECTORS) {
      try {
        container.querySelectorAll(sel).forEach(processLink);
      } catch (e) {
        console.warn("[BathyalLens] Citation selector failed:", sel, e);
      }
    }

    // Also grab any remaining inline links
    container.querySelectorAll("a[href]").forEach(processLink);

    return citations;
  }

  /**
   * Extracts answer text, citations, and query from a detected container.
   * @param {Element} container - The answer DOM element.
   * @returns {Object} The extraction payload.
   */
  function extract(container) {
    const answerText = container.innerText.trim();
    const citations = extractCitations(container);

    // Query: try URL path, then search input
    let query = "";
    const pathMatch = window.location.pathname.match(/\/search\/(.+)/);
    if (pathMatch) {
      try {
        query = decodeURIComponent(pathMatch[1].replace(/\+/g, " "));
      } catch {
        // Malformed percent-encoding — use raw path segment
        query = pathMatch[1].replace(/\+/g, " ");
      }
    }
    if (!query) {
      // Look for search input within main content area to avoid matching sidebar inputs
      const input = document.querySelector('main textarea, main input[type="text"]');
      if (input) query = input.value || "";
    }

    return {
      platform: "perplexity",
      query,
      answer_text: answerText,
      visible_citations: citations,
      page_url: window.location.href,
    };
  }

  window.BathyalPlatforms.perplexity = {
    detect,
    extract,
    debounceMs: 500,
    hostname: "www.perplexity.ai",
  };
})();
