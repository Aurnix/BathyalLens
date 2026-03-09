/**
 * Bathyal Lens — Popup (Settings)
 * Manages API key, domain tracking, model/activation settings, usage display.
 */

const apiKeyInput = document.getElementById("apiKeyInput");
const toggleKeyBtn = document.getElementById("toggleKey");
const saveKeyBtn = document.getElementById("saveKey");
const keyStatus = document.getElementById("keyStatus");
const ownDomainInput = document.getElementById("ownDomainInput");
const addCompetitorInput = document.getElementById("addCompetitorInput");
const addCompetitorBtn = document.getElementById("addCompetitor");
const competitorsList = document.getElementById("competitorsList");
const clearCacheBtn = document.getElementById("clearCache");
const usageCount = document.getElementById("usageCount");
const usageCost = document.getElementById("usageCost");

const VALIDATION_TIMEOUT_MS = 15000;
const DOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

let config = {};
let domainSaveTimer = null;

// --- Load config on open ---

async function loadConfig() {
  const data = await chrome.storage.local.get("config");
  config = data.config || {};

  if (config.apiKey) {
    apiKeyInput.value = config.apiKey;
  }
  if (config.ownDomain) {
    ownDomainInput.value = config.ownDomain;
  }
  if (config.model) {
    const radio = [...document.querySelectorAll('input[name="model"]')].find(r => r.value === config.model);
    if (radio) radio.checked = true;
  }
  if (config.activationMode) {
    const radio = [...document.querySelectorAll('input[name="activation"]')].find(r => r.value === config.activationMode);
    if (radio) radio.checked = true;
  }

  renderCompetitors();
  loadUsage();
}

// --- Save config ---

async function saveConfig() {
  // Guard against running after popup is closed (e.g. from debounced timer)
  if (!document.body.isConnected) return;
  config.ownDomain = cleanDomain(ownDomainInput.value);
  config.model = document.querySelector('input[name="model"]:checked')?.value || config.model || "claude-haiku-4-5-20251001";
  config.activationMode = document.querySelector('input[name="activation"]:checked')?.value || config.activationMode || "on-click";
  await chrome.storage.local.set({ config });
}

// --- API key ---

toggleKeyBtn.addEventListener("click", () => {
  if (apiKeyInput.type === "password") {
    apiKeyInput.type = "text";
    toggleKeyBtn.textContent = "Hide";
  } else {
    apiKeyInput.type = "password";
    toggleKeyBtn.textContent = "Show";
  }
});

saveKeyBtn.addEventListener("click", async () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    showStatus("Please enter an API key.", "error");
    return;
  }

  showStatus("Validating...", "pending");
  saveKeyBtn.disabled = true;

  // Timeout guard — re-enable button if validation never responds
  const timeoutId = setTimeout(() => {
    saveKeyBtn.disabled = false;
    showStatus("Validation timed out. Check your network and retry.", "error");
  }, VALIDATION_TIMEOUT_MS);

  try {
    const result = await chrome.runtime.sendMessage({
      type: "VALIDATE_API_KEY",
      apiKey: key,
    });
    clearTimeout(timeoutId);

    if (result && result.valid) {
      config.apiKey = key;
      await saveConfig();
      showStatus("API key validated and saved.", "success");
      saveKeyBtn.textContent = "Saved";
      saveKeyBtn.classList.add("popup-btn--saved");
      setTimeout(() => {
        saveKeyBtn.textContent = "Save API Key";
        saveKeyBtn.classList.remove("popup-btn--saved");
      }, 1500);
    } else {
      showStatus("API key rejected. Check your key.", "error");
    }
  } catch (err) {
    clearTimeout(timeoutId);
    showStatus("Validation failed. Key not saved — check network and retry.", "error");
  }

  saveKeyBtn.disabled = false;
});

function showStatus(text, type) {
  keyStatus.textContent = text;
  keyStatus.className = `popup-status popup-status-${type}`;
}

// --- Domain helpers ---

/**
 * Strips protocol, www prefix, and trailing slashes from a domain string.
 * @param {string} val - Raw domain input.
 * @returns {string} Cleaned domain.
 */
function cleanDomain(val) {
  return val
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

/**
 * Validates that a cleaned domain string looks like a valid domain name.
 * @param {string} domain - The cleaned domain string.
 * @returns {boolean}
 */
function isValidDomain(domain) {
  return domain.length > 0 && DOMAIN_REGEX.test(domain);
}

// --- Competitors ---

function renderCompetitors() {
  const comps = config.competitors || [];
  competitorsList.textContent = "";

  for (const c of comps) {
    const item = document.createElement("div");
    item.className = "popup-competitor-item";

    const label = document.createElement("span");
    label.textContent = c;
    item.appendChild(label);

    const removeBtn = document.createElement("button");
    removeBtn.className = "popup-btn-remove";
    removeBtn.textContent = "\u00D7";
    removeBtn.setAttribute("aria-label", `Remove ${c}`);
    // Use domain value (not array index) for reliable removal
    removeBtn.addEventListener("click", () => {
      const idx = config.competitors.indexOf(c);
      if (idx !== -1) config.competitors.splice(idx, 1);
      saveConfig();
      renderCompetitors();
    });
    item.appendChild(removeBtn);

    competitorsList.appendChild(item);
  }
}

addCompetitorBtn.addEventListener("click", () => {
  const domain = cleanDomain(addCompetitorInput.value);
  if (!domain) return;

  if (!isValidDomain(domain)) {
    addCompetitorInput.value = "";
    return;
  }

  config.competitors = config.competitors || [];
  if (!config.competitors.includes(domain)) {
    config.competitors.push(domain);
    saveConfig();
    renderCompetitors();
  }
  addCompetitorInput.value = "";
});

addCompetitorInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addCompetitorBtn.click();
});

// --- Model + activation auto-save ---

document.querySelectorAll('input[name="model"], input[name="activation"]').forEach((radio) => {
  radio.addEventListener("change", saveConfig);
});

ownDomainInput.addEventListener("change", saveConfig);
// Debounce keystroke saves to avoid storage thrashing
ownDomainInput.addEventListener("input", () => {
  clearTimeout(domainSaveTimer);
  domainSaveTimer = setTimeout(saveConfig, 500);
});

// --- Usage ---

async function loadUsage() {
  try {
    const usage = await chrome.runtime.sendMessage({ type: "GET_USAGE" });
    if (usage) {
      usageCount.textContent = usage.count ?? 0;
      usageCost.textContent = `$${(usage.estimatedCostUsd ?? 0).toFixed(2)}`;
    }
  } catch (err) {
    console.warn("[BathyalLens] Failed to load usage:", err);
  }
}

// --- Clear cache ---

clearCacheBtn.addEventListener("click", async () => {
  await chrome.storage.local.remove("cache");
  clearCacheBtn.textContent = "Cache cleared!";
  setTimeout(() => {
    clearCacheBtn.textContent = "Clear Cache";
  }, 2000);
});

// --- Init ---

loadConfig();
