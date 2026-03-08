/**
 * Bathyal Lens — Panel Manager
 * Creates and manages the Shadow DOM container for the overlay.
 * Content script delegates all UI to this module.
 * Loaded as content script — attaches to window.BathyalOverlay.
 * Depends on styles.js and components.js being loaded first.
 */

(function () {
  const O = window.BathyalOverlay;

  let shadowRoot = null;
  let hostEl = null;
  let badgeEl = null;
  let panelEl = null;
  let panelVisible = false;

  // --- Shadow DOM Setup ---

  function ensureShadowRoot() {
    if (shadowRoot) return shadowRoot;

    hostEl = document.createElement("div");
    hostEl.id = "bathyal-lens-root";
    // Prevent host page styles from affecting our container
    hostEl.style.cssText = "all:initial; position:fixed; top:0; left:0; width:0; height:0; z-index:2147483646; pointer-events:none;";
    document.body.appendChild(hostEl);

    shadowRoot = hostEl.attachShadow({ mode: "closed" });

    // Inject styles
    const style = document.createElement("style");
    style.textContent = O.PANEL_CSS;
    shadowRoot.appendChild(style);

    return shadowRoot;
  }

  // --- Badge ---

  function createBadge(onClick) {
    const root = ensureShadowRoot();
    if (badgeEl) return;

    badgeEl = O.renderBadge("idle", onClick);
    // Badge needs pointer-events
    badgeEl.style.pointerEvents = "auto";
    root.appendChild(badgeEl);
  }

  function setBadgeState(state) {
    if (!badgeEl) return;
    O.updateBadgeState(badgeEl, state);
  }

  // --- Panel ---

  function onMinimize() {
    hidePanel();
  }

  function onClose() {
    removePanel();
  }

  function showPanel(state, data, config) {
    const root = ensureShadowRoot();

    // Remove existing panel
    if (panelEl) {
      panelEl.remove();
      panelEl = null;
    }

    if (state === "loading") {
      panelEl = O.renderLoading(onMinimize, onClose);
    } else if (state === "error") {
      panelEl = O.renderError(data, onMinimize, onClose);
    } else if (state === "result") {
      panelEl = O.renderResult(data, config, onMinimize, onClose);
    }

    if (panelEl) {
      panelEl.style.pointerEvents = "auto";
      root.appendChild(panelEl);
      panelVisible = true;
    }
  }

  function hidePanel() {
    if (!panelEl) return;

    // Slide-out animation
    panelEl.classList.add("bathyal-panel--closing");
    panelEl.addEventListener("animationend", () => {
      if (panelEl) {
        panelEl.style.display = "none";
        panelEl.classList.remove("bathyal-panel--closing");
      }
      panelVisible = false;
    }, { once: true });
  }

  function removePanel() {
    if (panelEl) {
      panelEl.remove();
      panelEl = null;
    }
    panelVisible = false;
  }

  function togglePanel() {
    if (!panelEl) return;

    if (panelVisible) {
      hidePanel();
    } else {
      panelEl.style.display = "";
      panelEl.classList.remove("bathyal-panel--closing");
      // Re-trigger slide-in
      panelEl.style.animation = "none";
      panelEl.offsetHeight; // force reflow
      panelEl.style.animation = "";
      panelVisible = true;
    }
  }

  function isPanelVisible() {
    return panelVisible;
  }

  // --- Attach to namespace ---
  O.createBadge = createBadge;
  O.setBadgeState = setBadgeState;
  O.showPanel = showPanel;
  O.hidePanel = hidePanel;
  O.removePanel = removePanel;
  O.togglePanel = togglePanel;
  O.isPanelVisible = isPanelVisible;
})();
