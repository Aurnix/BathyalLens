import { useState, useEffect } from "react";

const mockData = {
  query: "best crm software for small business",
  platform: "Google AI Overview",
  latency: 2.3,
  explicit_citations: [
    { domain: "hubspot.com", count: 3, prominence: "high", context: "Primary recommendation with detailed feature breakdown" },
    { domain: "salesforce.com", count: 2, prominence: "medium", context: "Referenced for enterprise comparison and pricing tiers" },
    { domain: "pcmag.com", count: 1, prominence: "medium", context: "Cited as third-party review source for ratings" },
    { domain: "g2.com", count: 1, prominence: "low", context: "Passing reference to user review aggregates" },
    { domain: "forbes.com", count: 1, prominence: "low", context: "Supplementary mention for market analysis" },
  ],
  ghost_sources: [
    { domain: "pipedrive.com", confidence: 0.82, evidence: "Pricing tier structure and feature comparison closely matches Pipedrive's published comparison page layout and specific data points" },
    { domain: "capterra.com", confidence: 0.65, evidence: "Review sentiment summary and satisfaction percentages closely mirror Capterra's aggregate rating methodology" },
  ],
  citation_dna: [
    { pattern: "specific_data_points", description: "4 of 7 cited sources contained specific numerical claims — pricing figures, user counts, and feature counts that the AI could extract as discrete facts", strength: "strong" },
    { pattern: "comparison_structure", description: "Top-cited source uses explicit vs/comparison format with structured tables, making it easy for the AI to synthesize head-to-head evaluations", strength: "strong" },
    { pattern: "freshness", description: "3 of 7 cited sources were updated within the last 30 days, suggesting recency is a significant selection factor", strength: "moderate" },
    { pattern: "authority_signals", description: "Average domain authority of cited sources is 78, indicating a strong preference for established, high-trust domains", strength: "moderate" },
  ],
  own_domain_status: {
    cited: false,
    ghost: false,
    recommendation: "Your domain was not detected as a source. This answer emphasizes specific pricing data and head-to-head feature comparisons — content formats your site should strengthen to improve citation probability."
  },
  stats: {
    total_citations: 8,
    unique_domains: 5,
    ghost_count: 2,
    answer_word_count: 247,
  }
};

const trackedCompetitors = ["hubspot.com", "zoho.com", "pipedrive.com"];
const ownDomain = "mycrm.io";

function getTrackedStatus(domain) {
  if (domain === ownDomain) return "own";
  if (trackedCompetitors.includes(domain)) return "competitor";
  return null;
}

function ProminenceBar({ prominence }) {
  const levels = { high: 3, medium: 2, low: 1 };
  const colors = { high: "#00e5c7", medium: "#00b4d8", low: "#6b7c93" };
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          width: 3, height: i <= levels[prominence] ? 10 + i * 2 : 8,
          borderRadius: 1,
          background: i <= levels[prominence] ? colors[prominence] : "#1e2a45",
          transition: "all 0.3s ease"
        }} />
      ))}
    </div>
  );
}

function ConfidenceBar({ confidence }) {
  const pct = confidence * 100;
  const color = confidence >= 0.8 ? "#a55eea" : confidence >= 0.65 ? "#8854d0" : "#6b7c93";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 80, height: 4, background: "#1e2a45", borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          width: `${pct}%`, height: "100%", background: color,
          borderRadius: 2, transition: "width 0.6s ease"
        }} />
      </div>
      <span style={{ fontFamily: "var(--f-mono)", fontSize: 11, color }}>{Math.round(pct)}%</span>
    </div>
  );
}

function SonarLoader() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "60px 0", gap: 24
    }}>
      <div style={{ position: "relative", width: 64, height: 64 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            border: "1px solid #00e5c7", opacity: 0,
            animation: `sonarPing 2s ease-out infinite ${i * 0.5}s`
          }} />
        ))}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: 8, height: 8, borderRadius: "50%",
          background: "#00e5c7", boxShadow: "0 0 12px rgba(0,229,199,0.6)"
        }} />
      </div>
      <span style={{
        fontFamily: "var(--f-mono)", fontSize: 12,
        color: "#6b7c93", letterSpacing: 2, textTransform: "uppercase"
      }}>analyzing</span>
      <style>{`
        @keyframes sonarPing {
          0% { transform: scale(0.3); opacity: 0.7; }
          100% { transform: scale(1.8); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function Section({ title, defaultOpen = false, count, accentColor, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      background: "#131a2e", borderRadius: 8, overflow: "hidden",
      border: "1px solid #1e2a45"
    }}>
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", display: "flex", alignItems: "center", gap: 8,
        padding: "12px 16px", background: "none", border: "none",
        cursor: "pointer", color: "#c8d6e5", textAlign: "left"
      }}>
        <span style={{
          fontFamily: "var(--f-mono)", fontSize: 10, color: accentColor || "#00e5c7",
          transition: "transform 0.2s", transform: open ? "rotate(90deg)" : "rotate(0deg)",
          display: "inline-block"
        }}>▶</span>
        <span style={{
          fontFamily: "var(--f-mono)", fontSize: 11, letterSpacing: 1.5,
          textTransform: "uppercase", color: "#6b7c93", flex: 1
        }}>{title}</span>
        {count !== undefined && (
          <span style={{
            fontFamily: "var(--f-mono)", fontSize: 10,
            background: accentColor ? `${accentColor}20` : "#00e5c720",
            color: accentColor || "#00e5c7",
            padding: "2px 8px", borderRadius: 10
          }}>{count}</span>
        )}
      </button>
      {open && (
        <div style={{ padding: "0 16px 16px", animation: "fadeSlideIn 0.25s ease" }}>
          {children}
        </div>
      )}
    </div>
  );
}

function Badge({ state, onClick }) {
  const colors = {
    detected: { bg: "#00e5c720", border: "#00e5c7", glow: "0 0 20px rgba(0,229,199,0.2)" },
    danger: { bg: "#ff475720", border: "#ff4757", glow: "0 0 20px rgba(255,71,87,0.2)" },
    success: { bg: "#2ed57320", border: "#2ed573", glow: "0 0 20px rgba(46,213,115,0.2)" },
    idle: { bg: "#1e2a45", border: "#2a3555", glow: "none" },
  };
  const c = colors[state] || colors.idle;
  return (
    <button onClick={onClick} style={{
      position: "fixed", right: 16, top: "50%", transform: "translateY(-50%)",
      width: 44, height: 44, borderRadius: "50%", border: `2px solid ${c.border}`,
      background: c.bg, boxShadow: c.glow, cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
      transition: "all 0.3s ease", zIndex: 999999
    }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="3" fill={c.border} opacity="0.8" />
        <circle cx="12" cy="12" r="7" stroke={c.border} strokeWidth="1" opacity="0.4" />
        <circle cx="12" cy="12" r="11" stroke={c.border} strokeWidth="0.5" opacity="0.2" />
      </svg>
    </button>
  );
}

export default function BathyalLens() {
  const [view, setView] = useState("badge");
  const [screenshotMode, setScreenshotMode] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (view === "loading") {
      const t = setTimeout(() => setView("panel"), 2500);
      return () => clearTimeout(t);
    }
  }, [view]);

  const handleCopy = () => {
    const report = `🌊 Bathyal Lens Analysis
Query: "${mockData.query}"
Platform: ${mockData.platform}

CITED SOURCES:
${mockData.explicit_citations.map(c => `• ${c.domain} (${c.count}× — ${c.prominence} prominence)`).join("\n")}

GHOST SOURCES (used but uncredited):
${mockData.ghost_sources.map(g => `• ${g.domain} (${Math.round(g.confidence * 100)}% confidence) — ${g.evidence.slice(0, 60)}...`).join("\n")}

WHY THESE SOURCES WON:
${mockData.citation_dna.map(d => `→ ${d.description.slice(0, 60)}...`).join("\n")}

—
Analyzed by Bathyal Lens · bathyal.ai`;
    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const d = mockData;

  return (
    <div style={{
      minHeight: "100vh", background: "#080b14",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "-apple-system, sans-serif", padding: 20,
      position: "relative"
    }}>
      <style>{`
        :root {
          --f-mono: 'SF Mono', 'Fira Code', 'JetBrains Mono', 'Cascadia Code', monospace;
          --f-body: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes panelSlideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes stagger1 { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e2a45; border-radius: 2px; }
      `}</style>

      {/* Simulated page behind */}
      {screenshotMode && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(8,11,20,0.92)",
          zIndex: 999997, backdropFilter: "blur(4px)"
        }} />
      )}

      {/* Controls */}
      <div style={{
        position: "fixed", top: 20, left: 20, zIndex: 999999,
        display: "flex", gap: 8, flexWrap: "wrap"
      }}>
        {["badge", "loading", "panel"].map(v => (
          <button key={v} onClick={() => { setView(v); setScreenshotMode(false); }} style={{
            padding: "8px 16px", borderRadius: 6,
            background: view === v ? "#00e5c7" : "#131a2e",
            color: view === v ? "#0a0e1a" : "#6b7c93",
            border: `1px solid ${view === v ? "#00e5c7" : "#1e2a45"}`,
            fontFamily: "var(--f-mono)", fontSize: 11,
            cursor: "pointer", textTransform: "uppercase", letterSpacing: 1
          }}>{v}</button>
        ))}
      </div>

      {/* Fake SERP background */}
      {!screenshotMode && (
        <div style={{
          position: "absolute", top: 80, left: 40, right: 420, bottom: 40,
          opacity: 0.15, color: "#c8d6e5", fontFamily: "var(--f-body)"
        }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:20 }}>
              <div style={{ width:28,height:28,borderRadius:14,background:"#1e2a45" }}/>
              <div style={{ width:120,height:8,borderRadius:4,background:"#1e2a45" }}/>
              <div style={{ flex:1 }}/>
              <div style={{ width:200,height:32,borderRadius:20,background:"#1e2a45" }}/>
            </div>
          </div>
          <div style={{ background:"#0d1220", borderRadius:12, padding:24, marginBottom:16, border:"1px solid #1a2240" }}>
            <div style={{ width:80,height:8,borderRadius:4,background:"#1e2a45",marginBottom:16 }}/>
            {[1,2,3,4,5,6].map(i => (
              <div key={i} style={{ width:`${90 - i*8}%`,height:6,borderRadius:3,background:"#1e2a45",marginBottom:10 }}/>
            ))}
            <div style={{ display:"flex",gap:8,marginTop:16 }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ width:80,height:24,borderRadius:12,background:"#1e2a45" }}/>
              ))}
            </div>
          </div>
          {[1,2,3].map(i => (
            <div key={i} style={{ marginBottom:16 }}>
              <div style={{ width:`${60+i*5}%`,height:7,borderRadius:3,background:"#1e2a45",marginBottom:6 }}/>
              <div style={{ width:`${80-i*3}%`,height:5,borderRadius:3,background:"#1a2240",marginBottom:4 }}/>
              <div style={{ width:`${70+i*2}%`,height:5,borderRadius:3,background:"#1a2240" }}/>
            </div>
          ))}
        </div>
      )}

      {/* Badge */}
      {view === "badge" && (
        <Badge state="detected" onClick={() => setView("loading")} />
      )}

      {/* Loading */}
      {view === "loading" && (
        <div style={{
          position: "fixed", right: 16, top: "50%", transform: "translateY(-50%)",
          width: 380, background: "#0a0e1a", borderRadius: 12,
          border: "1px solid #1e2a45", boxShadow: "0 0 40px rgba(0,0,0,0.5)",
          zIndex: 999998, animation: "panelSlideIn 0.3s ease"
        }}>
          <div style={{
            padding: "16px 20px", borderBottom: "1px solid #1e2a45",
            display: "flex", alignItems: "center", justifyContent: "space-between"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="3" fill="#00e5c7" />
                <circle cx="12" cy="12" r="7" stroke="#00e5c7" strokeWidth="1" opacity="0.4" />
                <circle cx="12" cy="12" r="11" stroke="#00e5c7" strokeWidth="0.5" opacity="0.2" />
              </svg>
              <span style={{
                fontFamily: "var(--f-mono)", fontSize: 13, fontWeight: 600,
                color: "#e8f0f8", letterSpacing: 1
              }}>BATHYAL LENS</span>
            </div>
          </div>
          <SonarLoader />
        </div>
      )}

      {/* Full Panel */}
      {view === "panel" && (
        <div style={{
          position: "fixed", right: 16, top: 16, bottom: 16,
          width: 384, background: "#0a0e1a", borderRadius: 12,
          border: "1px solid #1e2a45",
          boxShadow: "0 0 60px rgba(0,0,0,0.6), 0 0 20px rgba(0,229,199,0.04)",
          zIndex: 999998, animation: "panelSlideIn 0.3s ease",
          display: "flex", flexDirection: "column", overflow: "hidden"
        }}>
          {/* Header */}
          <div style={{
            padding: "14px 20px", borderBottom: "1px solid #1e2a45",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexShrink: 0
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="3" fill="#00e5c7" />
                <circle cx="12" cy="12" r="7" stroke="#00e5c7" strokeWidth="1" opacity="0.4" />
                <circle cx="12" cy="12" r="11" stroke="#00e5c7" strokeWidth="0.5" opacity="0.2" />
              </svg>
              <span style={{
                fontFamily: "var(--f-mono)", fontSize: 13, fontWeight: 600,
                color: "#e8f0f8", letterSpacing: 1
              }}>BATHYAL LENS</span>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={() => setView("badge")} style={{
                width: 28, height: 28, borderRadius: 6, border: "1px solid #1e2a45",
                background: "none", color: "#6b7c93", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14
              }}>−</button>
              <button onClick={() => setView("badge")} style={{
                width: 28, height: 28, borderRadius: 6, border: "1px solid #1e2a45",
                background: "none", color: "#6b7c93", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12
              }}>✕</button>
            </div>
          </div>

          {/* Query bar */}
          <div style={{
            padding: "10px 20px", borderBottom: "1px solid #1e2a45",
            flexShrink: 0
          }}>
            <div style={{
              fontFamily: "var(--f-mono)", fontSize: 10, color: "#6b7c93",
              textTransform: "uppercase", letterSpacing: 1, marginBottom: 4
            }}>{d.platform}</div>
            <div style={{
              fontFamily: "var(--f-body)", fontSize: 13, color: "#c8d6e5"
            }}>"{d.query}"</div>
          </div>

          {/* Your domain status bar */}
          <div style={{
            padding: "10px 20px", borderBottom: "1px solid #1e2a45",
            background: d.own_domain_status.cited ? "#2ed57308" : "#ff475708",
            flexShrink: 0
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%",
                background: d.own_domain_status.cited ? "#2ed573" : "#ff4757",
                boxShadow: d.own_domain_status.cited 
                  ? "0 0 8px rgba(46,213,115,0.5)" 
                  : "0 0 8px rgba(255,71,87,0.4)"
              }} />
              <span style={{
                fontFamily: "var(--f-mono)", fontSize: 12, fontWeight: 600,
                color: d.own_domain_status.cited ? "#2ed573" : "#ff4757"
              }}>
                {ownDomain}
              </span>
              <span style={{
                fontFamily: "var(--f-mono)", fontSize: 11,
                color: d.own_domain_status.cited ? "#2ed573" : "#ff4757",
                opacity: 0.7
              }}>
                — {d.own_domain_status.cited ? "CITED" : "NOT CITED"}
              </span>
            </div>
          </div>

          {/* Scrollable content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>

            {/* Citation Map */}
            <div style={{ animation: "stagger1 0.4s ease both", animationDelay: "0.1s" }}>
              <Section title="Citation Map" defaultOpen={true} count={d.stats.unique_domains} accentColor="#00e5c7">
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {d.explicit_citations.map((c, i) => {
                    const tracked = getTrackedStatus(c.domain);
                    const barColor = tracked === "competitor" ? "#f5a623" : "#00e5c7";
                    const maxCount = Math.max(...d.explicit_citations.map(x => x.count));
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 120, fontFamily: "var(--f-mono)", fontSize: 11,
                          color: tracked === "competitor" ? "#f5a623" : "#c8d6e5",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          flexShrink: 0
                        }}>
                          {c.domain}
                        </div>
                        <div style={{ flex: 1, height: 6, background: "#1e2a45", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{
                            width: `${(c.count / maxCount) * 100}%`,
                            height: "100%", background: barColor, borderRadius: 3,
                            transition: "width 0.6s ease",
                            boxShadow: `0 0 8px ${barColor}40`
                          }} />
                        </div>
                        <span style={{
                          fontFamily: "var(--f-mono)", fontSize: 11,
                          color: "#6b7c93", width: 24, textAlign: "right", flexShrink: 0
                        }}>{c.count}×</span>
                        <ProminenceBar prominence={c.prominence} />
                      </div>
                    );
                  })}
                </div>

                {/* Tracked domains summary */}
                <div style={{
                  marginTop: 14, paddingTop: 12,
                  borderTop: "1px dashed #1e2a45"
                }}>
                  <div style={{
                    fontFamily: "var(--f-mono)", fontSize: 10, color: "#6b7c93",
                    textTransform: "uppercase", letterSpacing: 1, marginBottom: 8
                  }}>Tracked Competitors</div>
                  {trackedCompetitors.map((comp, i) => {
                    const cited = d.explicit_citations.find(c => c.domain === comp);
                    const ghost = d.ghost_sources.find(g => g.domain === comp);
                    const status = cited ? "cited" : ghost ? "ghost" : "absent";
                    const statusConfig = {
                      cited: { icon: "●", color: "#f5a623", label: `CITED (${cited?.count}×)` },
                      ghost: { icon: "◐", color: "#a55eea", label: "GHOST SOURCE" },
                      absent: { icon: "○", color: "#6b7c93", label: "NOT CITED" },
                    };
                    const s = statusConfig[status];
                    return (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "4px 0"
                      }}>
                        <span style={{ color: s.color, fontSize: 10, width: 12 }}>{s.icon}</span>
                        <span style={{
                          fontFamily: "var(--f-mono)", fontSize: 11, color: "#c8d6e5", flex: 1
                        }}>{comp}</span>
                        <span style={{
                          fontFamily: "var(--f-mono)", fontSize: 10, color: s.color
                        }}>{s.label}</span>
                      </div>
                    );
                  })}
                </div>
              </Section>
            </div>

            {/* Ghost Sources */}
            <div style={{ animation: "stagger1 0.4s ease both", animationDelay: "0.2s" }}>
              <Section title="Ghost Sources" count={d.ghost_sources.length} accentColor="#a55eea">
                <div style={{
                  fontFamily: "var(--f-body)", fontSize: 11, color: "#6b7c93",
                  marginBottom: 12, lineHeight: 1.5
                }}>
                  Content from these domains likely informed this answer but received no explicit citation.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {d.ghost_sources.map((g, i) => (
                    <div key={i} style={{
                      padding: 12, borderRadius: 6,
                      background: "#a55eea08", border: "1px solid #a55eea20"
                    }}>
                      <div style={{
                        display: "flex", alignItems: "center", gap: 8, marginBottom: 8
                      }}>
                        <span style={{ color: "#a55eea", fontSize: 12 }}>◐</span>
                        <span style={{
                          fontFamily: "var(--f-mono)", fontSize: 12, color: "#a55eea", fontWeight: 600
                        }}>{g.domain}</span>
                      </div>
                      <div style={{
                        fontFamily: "var(--f-body)", fontSize: 11, color: "#8892a4",
                        lineHeight: 1.5, marginBottom: 8
                      }}>
                        {g.evidence}
                      </div>
                      <ConfidenceBar confidence={g.confidence} />
                    </div>
                  ))}
                </div>
              </Section>
            </div>

            {/* Citation DNA */}
            <div style={{ animation: "stagger1 0.4s ease both", animationDelay: "0.3s" }}>
              <Section title="Citation DNA" count={d.citation_dna.length} accentColor="#00b4d8">
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {d.citation_dna.map((dna, i) => (
                    <div key={i} style={{
                      padding: "10px 12px", borderRadius: 6,
                      background: "#00b4d808", border: "1px solid #00b4d815"
                    }}>
                      <div style={{
                        display: "flex", alignItems: "center", gap: 8, marginBottom: 6
                      }}>
                        <span style={{ color: "#00b4d8", fontSize: 11 }}>✦</span>
                        <span style={{
                          fontFamily: "var(--f-mono)", fontSize: 10, color: "#00b4d8",
                          textTransform: "uppercase", letterSpacing: 0.5
                        }}>
                          {dna.pattern.replace(/_/g, " ")}
                        </span>
                        <span style={{
                          fontFamily: "var(--f-mono)", fontSize: 9,
                          padding: "1px 6px", borderRadius: 4,
                          background: dna.strength === "strong" ? "#00b4d820" : "#6b7c9320",
                          color: dna.strength === "strong" ? "#00b4d8" : "#6b7c93"
                        }}>
                          {dna.strength}
                        </span>
                      </div>
                      <div style={{
                        fontFamily: "var(--f-body)", fontSize: 11, color: "#8892a4",
                        lineHeight: 1.5
                      }}>
                        {dna.description}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            </div>

            {/* Recommendation */}
            <div style={{ animation: "stagger1 0.4s ease both", animationDelay: "0.4s" }}>
              <Section title="Recommendation" accentColor="#f5a623">
                <div style={{
                  padding: 12, borderRadius: 6,
                  background: "#f5a62308", border: "1px solid #f5a62320"
                }}>
                  <div style={{
                    fontFamily: "var(--f-body)", fontSize: 12, color: "#c8d6e5",
                    lineHeight: 1.6
                  }}>
                    {d.own_domain_status.recommendation}
                  </div>
                </div>
              </Section>
            </div>
          </div>

          {/* Stats bar */}
          <div style={{
            padding: "10px 20px", borderTop: "1px solid #1e2a45",
            display: "flex", gap: 12, flexShrink: 0, flexWrap: "wrap"
          }}>
            {[
              { label: "Sources", value: d.stats.total_citations },
              { label: "Domains", value: d.stats.unique_domains },
              { label: "Ghosts", value: d.stats.ghost_count, color: "#a55eea" },
              { label: "Words", value: d.stats.answer_word_count },
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{
                  fontFamily: "var(--f-mono)", fontSize: 13, fontWeight: 700,
                  color: s.color || "#e8f0f8"
                }}>{s.value}</span>
                <span style={{
                  fontFamily: "var(--f-mono)", fontSize: 9, color: "#6b7c93",
                  textTransform: "uppercase", letterSpacing: 0.5
                }}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* Action bar */}
          <div style={{
            padding: "10px 16px", borderTop: "1px solid #1e2a45",
            display: "flex", gap: 8, flexShrink: 0
          }}>
            <button onClick={handleCopy} style={{
              flex: 1, padding: "8px 12px", borderRadius: 6,
              background: copied ? "#2ed57315" : "#131a2e",
              border: `1px solid ${copied ? "#2ed573" : "#1e2a45"}`,
              color: copied ? "#2ed573" : "#c8d6e5",
              fontFamily: "var(--f-mono)", fontSize: 11, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              transition: "all 0.2s ease"
            }}>
              {copied ? "✓ Copied" : "📋 Copy Report"}
            </button>
            <button onClick={() => setScreenshotMode(!screenshotMode)} style={{
              flex: 1, padding: "8px 12px", borderRadius: 6,
              background: screenshotMode ? "#00e5c715" : "#131a2e",
              border: `1px solid ${screenshotMode ? "#00e5c7" : "#1e2a45"}`,
              color: screenshotMode ? "#00e5c7" : "#c8d6e5",
              fontFamily: "var(--f-mono)", fontSize: 11, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              transition: "all 0.2s ease"
            }}>
              📸 {screenshotMode ? "Exit" : "Screenshot"}
            </button>
          </div>

          {/* Footer */}
          <div style={{
            padding: "8px 20px", borderTop: "1px solid #1e2a45",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            flexShrink: 0
          }}>
            <span style={{
              fontFamily: "var(--f-mono)", fontSize: 10, color: "#4a5568"
            }}>Analyzed in {d.latency}s</span>
            <span style={{
              fontFamily: "var(--f-mono)", fontSize: 10, color: "#4a5568"
            }}>bathyal.ai</span>
          </div>
        </div>
      )}
    </div>
  );
}
