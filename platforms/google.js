/**
 * Google AI Overview detection and extraction.
 * Attaches to window.BathyalPlatforms.google for content script access.
 */

(function () {
  window.BathyalPlatforms = window.BathyalPlatforms || {};

  const SELECTORS = [
    '[data-attrid*="ai_overview"]',
    '#m-x-content',
    '.wDYxhc:has(.LGOjhe)',
  ];

  function detect() {
    // Try each selector in order
    for (const sel of SELECTORS) {
      try {
        const el = document.querySelector(sel);
        if (el && el.innerText.trim().length > 20) return el;
      } catch {}
    }

    // Heading-text fallback: look for element containing "AI Overview"
    const headings = document.querySelectorAll("h2, h3, div[role='heading'], span");
    for (const h of headings) {
      if (h.textContent.trim() === "AI Overview") {
        // Return the parent container that holds the actual answer content
        const container = h.closest("div[data-attrid]") || h.parentElement?.parentElement;
        if (container && container.innerText.trim().length > 20) return container;
      }
    }

    return null;
  }

  function extract(container) {
    const answerText = container.innerText.trim();

    // Extract all links, filtering out Google internal links
    const links = Array.from(container.querySelectorAll("a[href]"));
    const citations = [];
    const seen = new Set();

    for (const a of links) {
      const href = a.href;
      if (!href || href.includes("google.com") || href.startsWith("javascript:")) continue;

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
      } catch {}
    }

    // Query from URL params
    const query = new URL(window.location.href).searchParams.get("q") || "";

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
