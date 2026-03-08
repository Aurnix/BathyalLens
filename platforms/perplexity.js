/**
 * Perplexity answer detection and extraction.
 * Attaches to window.BathyalPlatforms.perplexity for content script access.
 */

(function () {
  window.BathyalPlatforms = window.BathyalPlatforms || {};

  const ANSWER_SELECTORS = [
    // Main prose answer container — Perplexity renders markdown in a prose div
    ".prose",
    '[class*="prose"]',
    // Fallback: the main answer area below the query
    'div[dir="auto"]',
  ];

  const CITATION_SELECTORS = [
    // Numbered citation links [1], [2], etc.
    'a[href][data-index]',
    '.citation a[href]',
    // Source panel links
    'a[href].source',
  ];

  function detect() {
    for (const sel of ANSWER_SELECTORS) {
      try {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          // Must have substantial text content to be the answer
          if (el.innerText.trim().length > 50) return el;
        }
      } catch {}
    }
    return null;
  }

  function extractCitations(container) {
    const citations = [];
    const seen = new Set();

    // Try citation selectors
    for (const sel of CITATION_SELECTORS) {
      try {
        const links = document.querySelectorAll(sel);
        for (const a of links) {
          const href = a.href;
          if (!href || href.includes("perplexity.ai")) continue;

          try {
            const url = new URL(href);
            const domain = url.hostname.replace(/^www\./, "");
            if (seen.has(domain + url.pathname)) continue;
            seen.add(domain + url.pathname);

            citations.push({
              url: href,
              anchor_text: a.textContent.trim() || domain,
            });
          } catch {}
        }
      } catch {}
    }

    // Also grab inline links from the answer container
    const inlineLinks = container.querySelectorAll("a[href]");
    for (const a of inlineLinks) {
      const href = a.href;
      if (!href || href.includes("perplexity.ai")) continue;

      try {
        const url = new URL(href);
        const domain = url.hostname.replace(/^www\./, "");
        if (seen.has(domain + url.pathname)) continue;
        seen.add(domain + url.pathname);

        citations.push({
          url: href,
          anchor_text: a.textContent.trim() || domain,
        });
      } catch {}
    }

    return citations;
  }

  function extract(container) {
    const answerText = container.innerText.trim();
    const citations = extractCitations(container);

    // Query: try URL path, then search input
    let query = "";
    const pathMatch = window.location.pathname.match(/\/search\/(.+)/);
    if (pathMatch) {
      query = decodeURIComponent(pathMatch[1].replace(/\+/g, " "));
    }
    if (!query) {
      const input = document.querySelector('textarea, input[type="text"]');
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
