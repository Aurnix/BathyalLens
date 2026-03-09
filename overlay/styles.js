/**
 * Bathyal Lens — Shadow DOM Stylesheet
 * Full deep-sea aesthetic. Injected into closed Shadow DOM root.
 * Loaded as content script — attaches to window.BathyalOverlay.
 */

(function () {
  window.BathyalOverlay = window.BathyalOverlay || {};

  window.BathyalOverlay.PANEL_CSS = `
/* --- Reset & Fonts --- */

:host {
  all: initial;
  font-family: 'SF Mono', 'Fira Code', 'JetBrains Mono', 'Cascadia Code', monospace;
  font-size: 12px;
  color: #c8d6e5;
  line-height: 1.4;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

button {
  font-family: inherit;
  cursor: pointer;
}

/* --- CSS Variables --- */

:host {
  --bathyal-bg: #0a0e1a;
  --bathyal-surface: #131a2e;
  --bathyal-border: #1e2a45;
  --bathyal-text: #c8d6e5;
  --bathyal-text-bright: #e8f0f8;
  --bathyal-text-dim: #6b7c93;
  --bathyal-text-muted: #4a5568;
  --bathyal-accent: #00e5c7;
  --bathyal-blue: #00b4d8;
  --bathyal-ghost: #a55eea;
  --bathyal-ghost-dim: #8854d0;
  --bathyal-amber: #f5a623;
  --bathyal-success: #2ed573;
  --bathyal-danger: #ff4757;
  --f-mono: 'SF Mono', 'Fira Code', 'JetBrains Mono', 'Cascadia Code', monospace;
  --f-body: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* --- Animations --- */

@keyframes bathyal-slide-in {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes bathyal-slide-out {
  from { opacity: 1; transform: translateX(0); }
  to { opacity: 0; transform: translateX(20px); }
}

@keyframes bathyal-sonar-ping {
  0% { transform: scale(0.3); opacity: 0.7; }
  100% { transform: scale(1.8); opacity: 0; }
}

@keyframes bathyal-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

@keyframes bathyal-fade-slide-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes bathyal-bar-grow {
  from { width: 0; }
}

/* --- Badge --- */

.bathyal-badge {
  position: fixed;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 2px solid var(--bathyal-border);
  background: var(--bathyal-surface);
  cursor: pointer;
  z-index: 2147483646;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  box-shadow: none;
  padding: 0;
}

.bathyal-badge svg {
  display: block;
}

.bathyal-badge--idle {
  border-color: #2a3555;
  background: var(--bathyal-surface);
}
.bathyal-badge--idle svg circle { stroke: var(--bathyal-text-dim); fill: var(--bathyal-text-dim); }

.bathyal-badge--detected {
  border-color: var(--bathyal-accent);
  background: rgba(0, 229, 199, 0.1);
  box-shadow: 0 0 20px rgba(0, 229, 199, 0.2);
}
.bathyal-badge--detected svg circle { stroke: var(--bathyal-accent); fill: var(--bathyal-accent); }

.bathyal-badge--loading {
  border-color: var(--bathyal-blue);
  background: rgba(0, 180, 216, 0.1);
  animation: bathyal-pulse 1.5s ease-in-out infinite;
}
.bathyal-badge--loading svg circle { stroke: var(--bathyal-blue); fill: var(--bathyal-blue); }

.bathyal-badge--success {
  border-color: var(--bathyal-success);
  background: rgba(46, 213, 115, 0.1);
  box-shadow: 0 0 20px rgba(46, 213, 115, 0.2);
}
.bathyal-badge--success svg circle { stroke: var(--bathyal-success); fill: var(--bathyal-success); }

.bathyal-badge--danger {
  border-color: var(--bathyal-danger);
  background: rgba(255, 71, 87, 0.1);
  box-shadow: 0 0 20px rgba(255, 71, 87, 0.2);
}
.bathyal-badge--danger svg circle { stroke: var(--bathyal-danger); fill: var(--bathyal-danger); }

/* --- Panel --- */

.bathyal-panel {
  position: fixed;
  right: 16px;
  top: 16px;
  bottom: 16px;
  width: 384px;
  background: var(--bathyal-bg);
  border: 1px solid var(--bathyal-border);
  border-radius: 12px;
  box-shadow: 0 0 60px rgba(0, 0, 0, 0.6), 0 0 20px rgba(0, 229, 199, 0.04);
  z-index: 2147483647;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: bathyal-slide-in 0.3s ease;
}

.bathyal-panel--closing {
  animation: bathyal-slide-out 0.25s ease forwards;
}

/* --- Panel Header --- */

.bathyal-header {
  padding: 14px 20px;
  border-bottom: 1px solid var(--bathyal-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.bathyal-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.bathyal-header-logo svg {
  display: block;
}

.bathyal-header-title {
  font-family: var(--f-mono);
  font-size: 13px;
  font-weight: 600;
  color: var(--bathyal-text-bright);
  letter-spacing: 1px;
}

.bathyal-header-controls {
  display: flex;
  gap: 4px;
}

.bathyal-btn-ctrl {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid var(--bathyal-border);
  background: none;
  color: var(--bathyal-text-dim);
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.bathyal-btn-ctrl:hover {
  background: var(--bathyal-surface);
  color: var(--bathyal-text);
}

/* --- Query Bar --- */

.bathyal-query-bar {
  padding: 10px 20px;
  border-bottom: 1px solid var(--bathyal-border);
  flex-shrink: 0;
}

.bathyal-query-platform {
  font-family: var(--f-mono);
  font-size: 10px;
  color: var(--bathyal-text-dim);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 4px;
}

.bathyal-query-text {
  font-family: var(--f-body);
  font-size: 13px;
  color: var(--bathyal-text);
}

/* --- Own Domain Status Bar --- */

.bathyal-domain-bar {
  padding: 10px 20px;
  border-bottom: 1px solid var(--bathyal-border);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.bathyal-domain-bar--cited {
  background: rgba(46, 213, 115, 0.03);
}

.bathyal-domain-bar--not-cited {
  background: rgba(255, 71, 87, 0.03);
}

.bathyal-domain-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.bathyal-domain-dot--cited {
  background: var(--bathyal-success);
  box-shadow: 0 0 8px rgba(46, 213, 115, 0.5);
}

.bathyal-domain-dot--not-cited {
  background: var(--bathyal-danger);
  box-shadow: 0 0 8px rgba(255, 71, 87, 0.4);
}

.bathyal-domain-name {
  font-family: var(--f-mono);
  font-size: 12px;
  font-weight: 600;
}

.bathyal-domain-status-text {
  font-family: var(--f-mono);
  font-size: 11px;
  opacity: 0.7;
}

.bathyal-domain-bar--cited .bathyal-domain-name,
.bathyal-domain-bar--cited .bathyal-domain-status-text {
  color: var(--bathyal-success);
}

.bathyal-domain-bar--not-cited .bathyal-domain-name,
.bathyal-domain-bar--not-cited .bathyal-domain-status-text {
  color: var(--bathyal-danger);
}

/* --- Scrollable Body --- */

.bathyal-body {
  flex: 1;
  min-height: 0; /* Allow flex child to shrink below content height so overflow scrolls */
  overflow-y: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bathyal-body::-webkit-scrollbar {
  width: 4px;
}
.bathyal-body::-webkit-scrollbar-track {
  background: transparent;
}
.bathyal-body::-webkit-scrollbar-thumb {
  background: var(--bathyal-border);
  border-radius: 2px;
}

/* --- Accordion Section --- */

.bathyal-section {
  background: var(--bathyal-surface);
  border-radius: 8px;
  border: 1px solid var(--bathyal-border);
  overflow: hidden;
  flex-shrink: 0; /* Prevent flex compression — sections must keep full height so body scrolls */
}

.bathyal-section-header {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: none;
  border: none;
  color: var(--bathyal-text);
  text-align: left;
}

.bathyal-section-header:hover {
  background: rgba(255, 255, 255, 0.02);
}

.bathyal-section-arrow {
  font-size: 10px;
  transition: transform 0.2s ease;
  display: inline-block;
  flex-shrink: 0;
  width: 12px;
}

.bathyal-section-arrow--open {
  transform: rotate(90deg);
}

.bathyal-section-title {
  font-family: var(--f-mono);
  font-size: 11px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: var(--bathyal-text-dim);
  flex: 1;
}

.bathyal-section-count {
  font-family: var(--f-mono);
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
}

.bathyal-section-content {
  padding: 0 16px 16px;
  animation: bathyal-fade-slide-in 0.25s ease;
}

/* --- Staggered reveal --- */

.bathyal-stagger-1 { animation: bathyal-fade-slide-in 0.4s ease both; animation-delay: 0.05s; }
.bathyal-stagger-2 { animation: bathyal-fade-slide-in 0.4s ease both; animation-delay: 0.15s; }
.bathyal-stagger-3 { animation: bathyal-fade-slide-in 0.4s ease both; animation-delay: 0.25s; }
.bathyal-stagger-4 { animation: bathyal-fade-slide-in 0.4s ease both; animation-delay: 0.35s; }

/* --- Citation Map --- */

.bathyal-cite-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 3px 0;
}

.bathyal-cite-domain {
  width: 120px;
  font-family: var(--f-mono);
  font-size: 11px;
  color: var(--bathyal-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 0;
  cursor: pointer;
  transition: color 0.15s;
}

.bathyal-cite-domain:hover {
  color: var(--bathyal-accent);
}

.bathyal-cite-domain--competitor {
  color: var(--bathyal-amber);
}

.bathyal-cite-domain--competitor:hover {
  color: #f7b74d;
}

.bathyal-cite-bar-bg {
  flex: 1;
  height: 6px;
  background: var(--bathyal-border);
  border-radius: 3px;
  overflow: hidden;
}

.bathyal-cite-bar {
  height: 100%;
  border-radius: 3px;
  transition: width 0.6s ease;
  animation: bathyal-bar-grow 0.6s ease;
}

.bathyal-cite-bar--default {
  background: var(--bathyal-accent);
  box-shadow: 0 0 8px rgba(0, 229, 199, 0.25);
}

.bathyal-cite-bar--competitor {
  background: var(--bathyal-amber);
  box-shadow: 0 0 8px rgba(245, 166, 35, 0.25);
}

.bathyal-cite-count {
  font-family: var(--f-mono);
  font-size: 11px;
  color: var(--bathyal-text-dim);
  width: 24px;
  text-align: right;
  flex-shrink: 0;
}

/* --- Prominence bar --- */

.bathyal-prominence {
  display: flex;
  gap: 2px;
  align-items: center;
}

.bathyal-prominence-pip {
  width: 3px;
  border-radius: 1px;
  transition: all 0.3s ease;
}

/* --- Tracked Competitors --- */

.bathyal-tracked {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed var(--bathyal-border);
}

.bathyal-tracked-title {
  font-family: var(--f-mono);
  font-size: 10px;
  color: var(--bathyal-text-dim);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;
}

.bathyal-tracked-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.bathyal-tracked-icon {
  font-size: 10px;
  width: 12px;
  text-align: center;
  flex-shrink: 0;
}

.bathyal-tracked-domain {
  font-family: var(--f-mono);
  font-size: 11px;
  color: var(--bathyal-text);
  flex: 1;
}

.bathyal-tracked-label {
  font-family: var(--f-mono);
  font-size: 10px;
}

/* --- Ghost Sources --- */

.bathyal-ghost-desc {
  font-family: var(--f-body);
  font-size: 11px;
  color: var(--bathyal-text-dim);
  margin-bottom: 12px;
  line-height: 1.5;
}

.bathyal-ghost-card {
  padding: 12px;
  border-radius: 6px;
  background: rgba(165, 94, 234, 0.03);
  border: 1px solid rgba(165, 94, 234, 0.12);
  margin-bottom: 10px;
}

.bathyal-ghost-card:last-child {
  margin-bottom: 0;
}

.bathyal-ghost-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.bathyal-ghost-icon {
  color: var(--bathyal-ghost);
  font-size: 12px;
}

.bathyal-ghost-domain {
  font-family: var(--f-mono);
  font-size: 12px;
  color: var(--bathyal-ghost);
  font-weight: 600;
  flex: 1;
}

.bathyal-ghost-evidence {
  font-family: var(--f-body);
  font-size: 11px;
  color: #8892a4;
  line-height: 1.5;
  margin-bottom: 8px;
}

.bathyal-confidence-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bathyal-confidence-bar-bg {
  width: 80px;
  height: 4px;
  background: var(--bathyal-border);
  border-radius: 2px;
  overflow: hidden;
}

.bathyal-confidence-bar {
  height: 100%;
  border-radius: 2px;
  transition: width 0.6s ease;
  animation: bathyal-bar-grow 0.6s ease;
}

.bathyal-confidence-pct {
  font-family: var(--f-mono);
  font-size: 11px;
}

/* --- Citation DNA --- */

.bathyal-dna-card {
  padding: 10px 12px;
  border-radius: 6px;
  background: rgba(0, 180, 216, 0.03);
  border: 1px solid rgba(0, 180, 216, 0.08);
  margin-bottom: 10px;
}

.bathyal-dna-card:last-child {
  margin-bottom: 0;
}

.bathyal-dna-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.bathyal-dna-icon {
  color: var(--bathyal-blue);
  font-size: 11px;
}

.bathyal-dna-pattern {
  font-family: var(--f-mono);
  font-size: 10px;
  color: var(--bathyal-blue);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex: 1;
}

.bathyal-dna-strength {
  font-family: var(--f-mono);
  font-size: 9px;
  padding: 1px 6px;
  border-radius: 4px;
}

.bathyal-dna-strength--strong {
  background: rgba(0, 180, 216, 0.12);
  color: var(--bathyal-blue);
}

.bathyal-dna-strength--moderate {
  background: rgba(107, 124, 147, 0.12);
  color: var(--bathyal-text-dim);
}

.bathyal-dna-desc {
  font-family: var(--f-body);
  font-size: 11px;
  color: #8892a4;
  line-height: 1.5;
}

/* --- Recommendation --- */

.bathyal-rec-card {
  padding: 12px;
  border-radius: 6px;
  background: rgba(245, 166, 35, 0.03);
  border: 1px solid rgba(245, 166, 35, 0.12);
}

.bathyal-rec-text {
  font-family: var(--f-body);
  font-size: 12px;
  color: var(--bathyal-text);
  line-height: 1.6;
}

/* --- Stats Bar --- */

.bathyal-stats {
  padding: 10px 20px;
  border-top: 1px solid var(--bathyal-border);
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.bathyal-stat {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.bathyal-stat-value {
  font-family: var(--f-mono);
  font-size: 13px;
  font-weight: 700;
  color: var(--bathyal-text-bright);
}

.bathyal-stat-value--ghost {
  color: var(--bathyal-ghost);
}

.bathyal-stat-label {
  font-family: var(--f-mono);
  font-size: 9px;
  color: var(--bathyal-text-dim);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* --- Footer --- */

.bathyal-footer {
  padding: 8px 20px;
  border-top: 1px solid var(--bathyal-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.bathyal-footer-text {
  font-family: var(--f-mono);
  font-size: 10px;
  color: var(--bathyal-text-muted);
}

/* --- Loading State --- */

.bathyal-loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  gap: 24px;
}

.bathyal-sonar {
  position: relative;
  width: 64px;
  height: 64px;
}

.bathyal-sonar-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1px solid var(--bathyal-accent);
  opacity: 0;
  animation: bathyal-sonar-ping 2s ease-out infinite;
  will-change: transform, opacity;
}

.bathyal-sonar-dot {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--bathyal-accent);
  box-shadow: 0 0 12px rgba(0, 229, 199, 0.6);
}

.bathyal-loader-text {
  font-family: var(--f-mono);
  font-size: 12px;
  color: var(--bathyal-text-dim);
  letter-spacing: 2px;
  text-transform: uppercase;
}

/* --- Error State --- */

.bathyal-error {
  text-align: center;
  padding: 40px 20px;
}

.bathyal-error-icon {
  font-size: 24px;
  margin-bottom: 12px;
  color: var(--bathyal-amber);
}

.bathyal-error-text {
  font-family: var(--f-body);
  font-size: 12px;
  color: var(--bathyal-text);
  line-height: 1.6;
}

/* --- Debug Toggle --- */

.bathyal-debug button {
  width: 100%;
  background: var(--bathyal-surface);
  border: 1px solid var(--bathyal-border);
  color: var(--bathyal-text-dim);
  padding: 6px 12px;
  border-radius: 6px;
  font-family: var(--f-mono);
  font-size: 10px;
  cursor: pointer;
  transition: color 0.15s;
}

.bathyal-debug button:hover {
  color: var(--bathyal-text);
}

.bathyal-debug pre {
  background: #080b14;
  border: 1px solid var(--bathyal-border);
  border-radius: 6px;
  padding: 12px;
  font-family: var(--f-mono);
  font-size: 10px;
  color: var(--bathyal-text-dim);
  max-height: 300px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin-top: 8px;
  display: none;
}

.bathyal-debug pre.bathyal-debug--open {
  display: block;
}

/* --- Action Bar --- */

.bathyal-action-bar {
  display: flex;
  gap: 8px;
  padding: 8px 16px;
  flex-shrink: 0;
}

.bathyal-action-btn {
  flex: 1;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--bathyal-surface);
  border: 1px solid var(--bathyal-border);
  color: var(--bathyal-text);
  font-family: var(--f-mono);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.bathyal-action-btn:hover {
  border-color: var(--bathyal-accent);
  color: var(--bathyal-accent);
}

.bathyal-action-btn--active {
  background: rgba(0, 229, 199, 0.08);
  border-color: var(--bathyal-accent);
  color: var(--bathyal-accent);
}

.bathyal-action-btn--copied {
  background: rgba(46, 213, 115, 0.08);
  border-color: var(--bathyal-success);
  color: var(--bathyal-success);
}

/* --- Screenshot Backdrop --- */

.bathyal-screenshot-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2147483645;
  background: rgba(8, 11, 20, 0.92);
  backdrop-filter: blur(4px);
}

/* --- Cached Indicator --- */

.bathyal-stat-value--cached {
  color: var(--bathyal-blue);
}
`;
})();
