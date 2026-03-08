/**
 * Bathyal Lens — Overlay Components
 * Vanilla JS render functions that return DOM elements.
 * Used inside Shadow DOM — no global ID lookups.
 * Loaded as content script — attaches to window.BathyalOverlay.
 */

(function () {
  window.BathyalOverlay = window.BathyalOverlay || {};

  // --- Helpers ---

function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") node.className = v;
      else if (k.startsWith("on")) node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
      else node.setAttribute(k, v);
    }
  }
  for (const child of children) {
    if (child == null) continue;
    if (typeof child === "string") node.appendChild(document.createTextNode(child));
    else if (Array.isArray(child)) child.forEach(c => c && node.appendChild(c));
    else node.appendChild(child);
  }
  return node;
}

function safeStr(str) {
  if (!str) return "";
  return String(str);
}

function truncate(str, len) {
  if (!str) return "";
  return str.length > len ? str.slice(0, len) + "..." : str;
}

function buildReport(data) {
  const citations = (data.explicit_citations || [])
    .map(c => `\u2022 ${c.domain} (${c.count}\u00D7 \u2014 ${c.prominence} prominence)`)
    .join("\n");

  const ghosts = (data.ghost_sources || [])
    .map(g => `\u2022 ${g.domain} (${Math.round(g.confidence * 100)}% confidence) \u2014 ${truncate(g.evidence, 60)}`)
    .join("\n");

  const dna = (data.citation_dna || [])
    .map(d => `\u2192 ${truncate(d.description, 60)}`)
    .join("\n");

  return `\uD83C\uDF0A Bathyal Lens Analysis
Query: \u201C${data._query || ""}\u201D
Platform: ${data._platform || "unknown"}

CITED SOURCES:
${citations || "(none)"}

GHOST SOURCES (used but uncredited):
${ghosts || "(none)"}

WHY THESE SOURCES WON:
${dna || "(none)"}

\u2014
Analyzed by Bathyal Lens \u00B7 bathyal.ai`;
}

// --- SVG Icons ---

function sonarSvg(size, color) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");

  const c1 = document.createElementNS(ns, "circle");
  c1.setAttribute("cx", "12"); c1.setAttribute("cy", "12"); c1.setAttribute("r", "3");
  c1.setAttribute("fill", color); c1.setAttribute("opacity", "0.8");

  const c2 = document.createElementNS(ns, "circle");
  c2.setAttribute("cx", "12"); c2.setAttribute("cy", "12"); c2.setAttribute("r", "7");
  c2.setAttribute("stroke", color); c2.setAttribute("stroke-width", "1");
  c2.setAttribute("fill", "none"); c2.setAttribute("opacity", "0.4");

  const c3 = document.createElementNS(ns, "circle");
  c3.setAttribute("cx", "12"); c3.setAttribute("cy", "12"); c3.setAttribute("r", "11");
  c3.setAttribute("stroke", color); c3.setAttribute("stroke-width", "0.5");
  c3.setAttribute("fill", "none"); c3.setAttribute("opacity", "0.2");

  svg.append(c1, c2, c3);
  return svg;
}

// --- Badge ---

function renderBadge(state, onClick) {
  const badge = el("button", { class: `bathyal-badge bathyal-badge--${state}`, title: "Bathyal Lens" },
    sonarSvg(20, "currentColor")
  );
  badge.addEventListener("click", onClick);
  return badge;
}

function updateBadgeState(badge, state) {
  badge.className = `bathyal-badge bathyal-badge--${state}`;
}

// --- Panel Header ---

function renderHeader(onMinimize, onClose) {
  return el("div", { class: "bathyal-header" },
    el("div", { class: "bathyal-header-left" },
      el("span", { class: "bathyal-header-logo" }, sonarSvg(18, "#00e5c7")),
      el("span", { class: "bathyal-header-title" }, "BATHYAL LENS")
    ),
    el("div", { class: "bathyal-header-controls" },
      el("button", { class: "bathyal-btn-ctrl", title: "Minimize", onClick: onMinimize }, "\u2212"),
      el("button", { class: "bathyal-btn-ctrl", title: "Close", onClick: onClose }, "\u2715")
    )
  );
}

// --- Loading ---

function renderLoading(onMinimize, onClose) {
  const panel = el("div", { class: "bathyal-panel" },
    renderHeader(onMinimize, onClose),
    el("div", { class: "bathyal-loader" },
      el("div", { class: "bathyal-sonar" },
        el("div", { class: "bathyal-sonar-ring" }),
        el("div", { class: "bathyal-sonar-ring", style: { animationDelay: "0.5s" } }),
        el("div", { class: "bathyal-sonar-ring", style: { animationDelay: "1.0s" } }),
        el("div", { class: "bathyal-sonar-dot" })
      ),
      el("span", { class: "bathyal-loader-text" }, "ANALYZING")
    )
  );
  return panel;
}

// --- Error ---

function renderError(error, onMinimize, onClose) {
  const panel = el("div", { class: "bathyal-panel" },
    renderHeader(onMinimize, onClose),
    el("div", { class: "bathyal-error" },
      el("div", { class: "bathyal-error-icon" }, "\u26A0"),
      el("div", { class: "bathyal-error-text" }, safeStr(error))
    )
  );
  return panel;
}

// --- Accordion Section ---

function renderSection({ title, accentColor, count, defaultOpen, staggerClass }, contentFn) {
  const accent = accentColor || "#00e5c7";
  const section = el("div", { class: `bathyal-section ${staggerClass || ""}` });

  const arrow = el("span", {
    class: `bathyal-section-arrow${defaultOpen ? " bathyal-section-arrow--open" : ""}`,
    style: { color: accent }
  }, "\u25B6");

  const countBadge = count !== undefined
    ? el("span", {
        class: "bathyal-section-count",
        style: { background: `${accent}20`, color: accent }
      }, String(count))
    : null;

  const contentEl = el("div", { class: "bathyal-section-content" });
  if (!defaultOpen) contentEl.style.display = "none";

  const header = el("button", { class: "bathyal-section-header" },
    arrow,
    el("span", { class: "bathyal-section-title" }, title),
    countBadge
  );

  header.addEventListener("click", () => {
    const isOpen = contentEl.style.display !== "none";
    contentEl.style.display = isOpen ? "none" : "";
    arrow.className = `bathyal-section-arrow${isOpen ? "" : " bathyal-section-arrow--open"}`;
  });

  // Build content via callback
  contentFn(contentEl);

  section.append(header, contentEl);
  return section;
}

// --- Prominence Bar ---

function renderProminence(prominence) {
  const levels = { high: 3, medium: 2, low: 1 };
  const colors = { high: "#00e5c7", medium: "#00b4d8", low: "#6b7c93" };
  const level = levels[prominence] || 1;
  const color = colors[prominence] || "#6b7c93";

  const bar = el("div", { class: "bathyal-prominence" });
  for (let i = 1; i <= 3; i++) {
    bar.appendChild(el("div", {
      class: "bathyal-prominence-pip",
      style: {
        height: `${i <= level ? 10 + i * 2 : 8}px`,
        background: i <= level ? color : "#1e2a45"
      }
    }));
  }
  return bar;
}

// --- Confidence Bar ---

function renderConfidence(confidence) {
  const pct = Math.round(confidence * 100);
  const color = confidence >= 0.8 ? "#a55eea" : confidence >= 0.65 ? "#8854d0" : "#6b7c93";

  return el("div", { class: "bathyal-confidence-row" },
    el("div", { class: "bathyal-confidence-bar-bg" },
      el("div", {
        class: "bathyal-confidence-bar",
        style: { width: `${pct}%`, background: color }
      })
    ),
    el("span", {
      class: "bathyal-confidence-pct",
      style: { color }
    }, `${pct}%`)
  );
}

// --- Full Result Panel ---

function renderResult(data, config, onMinimize, onClose) {
  const d = data;
  const ownDomain = config?.ownDomain || null;
  const competitors = config?.competitors || [];
  const stats = d.stats || {};
  const own = d.own_domain_status || {};

  function isCompetitor(domain) {
    if (!competitors.length) return false;
    const clean = domain.replace(/^www\./, "").toLowerCase();
    return competitors.some(c => clean === c || clean.endsWith("." + c));
  }

  const panel = el("div", { class: "bathyal-panel" });

  // Header
  panel.appendChild(renderHeader(onMinimize, onClose));

  // Query bar
  if (d._query) {
    panel.appendChild(el("div", { class: "bathyal-query-bar" },
      el("div", { class: "bathyal-query-platform" }, d._platform || "Analysis"),
      el("div", { class: "bathyal-query-text" }, `\u201C${safeStr(d._query)}\u201D`)
    ));
  }

  // Own domain status
  if (ownDomain && own.recommendation !== null && own.recommendation !== undefined) {
    const cited = own.cited;
    const statusClass = cited ? "cited" : "not-cited";
    panel.appendChild(el("div", { class: `bathyal-domain-bar bathyal-domain-bar--${statusClass}` },
      el("div", { class: `bathyal-domain-dot bathyal-domain-dot--${statusClass}` }),
      el("span", { class: "bathyal-domain-name" }, ownDomain),
      el("span", { class: "bathyal-domain-status-text" },
        `\u2014 ${cited ? "CITED" : own.ghost ? "GHOST" : "NOT CITED"}`)
    ));
  }

  // Scrollable body
  const body = el("div", { class: "bathyal-body" });

  // Citation Map
  const citations = d.explicit_citations || [];
  if (citations.length > 0) {
    const maxCount = Math.max(...citations.map(c => c.count), 1);
    body.appendChild(renderSection({
      title: "Citation Map",
      accentColor: "#00e5c7",
      count: stats.unique_domains || citations.length,
      defaultOpen: true,
      staggerClass: "bathyal-stagger-1"
    }, (content) => {
      const rows = el("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } });
      for (const c of citations) {
        const comp = isCompetitor(c.domain);
        const pct = Math.round((c.count / maxCount) * 100);
        const domainEl = el("span", {
          class: `bathyal-cite-domain${comp ? " bathyal-cite-domain--competitor" : ""}`
        }, safeStr(c.domain));
        domainEl.addEventListener("click", () => {
          const domain = c.domain.replace(/^https?:\/\//, "");
          try {
            const url = new URL(`https://${domain}`);
            window.open(url.href, "_blank");
          } catch {}
        });

        rows.appendChild(el("div", { class: "bathyal-cite-row" },
          domainEl,
          el("div", { class: "bathyal-cite-bar-bg" },
            el("div", {
              class: `bathyal-cite-bar bathyal-cite-bar--${comp ? "competitor" : "default"}`,
              style: { width: `${pct}%` }
            })
          ),
          el("span", { class: "bathyal-cite-count" }, `${c.count}\u00D7`),
          renderProminence(c.prominence)
        ));
      }
      content.appendChild(rows);

      // Tracked competitors summary
      if (competitors.length > 0) {
        const tracked = el("div", { class: "bathyal-tracked" });
        tracked.appendChild(el("div", { class: "bathyal-tracked-title" }, "Tracked Competitors"));
        for (const comp of competitors) {
          const cited = citations.find(c => c.domain === comp);
          const ghost = (d.ghost_sources || []).find(g => g.domain === comp);
          let icon, color, label;
          if (cited) {
            icon = "\u25CF"; color = "#f5a623"; label = `CITED (${cited.count}\u00D7)`;
          } else if (ghost) {
            icon = "\u25D0"; color = "#a55eea"; label = "GHOST SOURCE";
          } else {
            icon = "\u25CB"; color = "#6b7c93"; label = "NOT CITED";
          }
          tracked.appendChild(el("div", { class: "bathyal-tracked-row" },
            el("span", { class: "bathyal-tracked-icon", style: { color } }, icon),
            el("span", { class: "bathyal-tracked-domain" }, comp),
            el("span", { class: "bathyal-tracked-label", style: { color } }, label)
          ));
        }
        content.appendChild(tracked);
      }
    }));
  }

  // Ghost Sources
  const ghosts = d.ghost_sources || [];
  if (ghosts.length > 0) {
    body.appendChild(renderSection({
      title: "Ghost Sources",
      accentColor: "#a55eea",
      count: ghosts.length,
      defaultOpen: false,
      staggerClass: "bathyal-stagger-2"
    }, (content) => {
      content.appendChild(el("div", { class: "bathyal-ghost-desc" },
        "Content from these domains likely informed this answer but received no explicit citation."
      ));
      for (const g of ghosts) {
        content.appendChild(el("div", { class: "bathyal-ghost-card" },
          el("div", { class: "bathyal-ghost-header" },
            el("span", { class: "bathyal-ghost-icon" }, "\u25D0"),
            el("span", { class: "bathyal-ghost-domain" }, safeStr(g.domain))
          ),
          el("div", { class: "bathyal-ghost-evidence" }, safeStr(g.evidence)),
          renderConfidence(g.confidence)
        ));
      }
    }));
  }

  // Citation DNA
  const dna = d.citation_dna || [];
  if (dna.length > 0) {
    body.appendChild(renderSection({
      title: "Citation DNA",
      accentColor: "#00b4d8",
      count: dna.length,
      defaultOpen: false,
      staggerClass: "bathyal-stagger-3"
    }, (content) => {
      for (const item of dna) {
        content.appendChild(el("div", { class: "bathyal-dna-card" },
          el("div", { class: "bathyal-dna-header" },
            el("span", { class: "bathyal-dna-icon" }, "\u2726"),
            el("span", { class: "bathyal-dna-pattern" }, safeStr(item.pattern.replace(/_/g, " "))),
            el("span", {
              class: `bathyal-dna-strength bathyal-dna-strength--${item.strength}`
            }, item.strength)
          ),
          el("div", { class: "bathyal-dna-desc" }, safeStr(item.description))
        ));
      }
    }));
  }

  // Recommendation
  if (own.recommendation) {
    body.appendChild(renderSection({
      title: "Recommendation",
      accentColor: "#f5a623",
      defaultOpen: false,
      staggerClass: "bathyal-stagger-4"
    }, (content) => {
      content.appendChild(el("div", { class: "bathyal-rec-card" },
        el("div", { class: "bathyal-rec-text" }, safeStr(own.recommendation))
      ));
    }));
  }

  // Debug raw JSON
  const debugWrap = el("div", { class: "bathyal-debug" });
  const debugPre = el("pre", null, JSON.stringify(data, null, 2));
  const debugBtn = el("button", null, "Toggle Raw JSON");
  debugBtn.addEventListener("click", () => {
    debugPre.classList.toggle("bathyal-debug--open");
  });
  debugWrap.append(debugBtn, debugPre);
  body.appendChild(debugWrap);

  panel.appendChild(body);

  // Action bar
  const actionBar = el("div", { class: "bathyal-action-bar" });

  const copyBtn = el("button", { class: "bathyal-action-btn" }, "Copy Report");
  copyBtn.addEventListener("click", () => {
    const report = buildReport(d);
    navigator.clipboard.writeText(report).then(() => {
      copyBtn.textContent = "\u2713 Copied";
      copyBtn.classList.add("bathyal-action-btn--copied");
      setTimeout(() => {
        copyBtn.textContent = "Copy Report";
        copyBtn.classList.remove("bathyal-action-btn--copied");
      }, 2000);
    });
  });
  actionBar.appendChild(copyBtn);

  const ssBtn = el("button", { class: "bathyal-action-btn" }, "Screenshot");
  ssBtn.addEventListener("click", () => {
    const O = window.BathyalOverlay;
    const active = O.toggleScreenshot();
    ssBtn.textContent = active ? "Exit Screenshot" : "Screenshot";
    ssBtn.classList.toggle("bathyal-action-btn--active", active);
  });
  actionBar.appendChild(ssBtn);

  panel.appendChild(actionBar);

  // Stats bar
  const statsBar = el("div", { class: "bathyal-stats" },
    el("div", { class: "bathyal-stat" },
      el("span", { class: "bathyal-stat-value" }, String(stats.total_citations || 0)),
      el("span", { class: "bathyal-stat-label" }, "Sources")
    ),
    el("div", { class: "bathyal-stat" },
      el("span", { class: "bathyal-stat-value" }, String(stats.unique_domains || 0)),
      el("span", { class: "bathyal-stat-label" }, "Domains")
    ),
    el("div", { class: "bathyal-stat" },
      el("span", { class: "bathyal-stat-value bathyal-stat-value--ghost" }, String(stats.ghost_count || 0)),
      el("span", { class: "bathyal-stat-label" }, "Ghosts")
    ),
    el("div", { class: "bathyal-stat" },
      el("span", { class: "bathyal-stat-value" }, String(stats.answer_word_count || 0)),
      el("span", { class: "bathyal-stat-label" }, "Words")
    )
  );

  if (d._cached) {
    statsBar.appendChild(el("div", { class: "bathyal-stat" },
      el("span", { class: "bathyal-stat-value bathyal-stat-value--cached" }, "\u21BB"),
      el("span", { class: "bathyal-stat-label" }, "Cached")
    ));
  }

  panel.appendChild(statsBar);

  // Footer
  panel.appendChild(el("div", { class: "bathyal-footer" },
    el("span", { class: "bathyal-footer-text" }, "bathyal.ai"),
    el("span", { class: "bathyal-footer-text" }, "v0.1.0")
  ));

  return panel;
}

  // --- Attach to namespace ---
  window.BathyalOverlay.renderBadge = renderBadge;
  window.BathyalOverlay.updateBadgeState = updateBadgeState;
  window.BathyalOverlay.renderLoading = renderLoading;
  window.BathyalOverlay.renderError = renderError;
  window.BathyalOverlay.renderResult = renderResult;
})();
