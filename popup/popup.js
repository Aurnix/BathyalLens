/**
 * Bathyal Lens — Popup (Settings)
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

let config = {};

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
  config.ownDomain = cleanDomain(ownDomainInput.value);
  config.model = document.querySelector('input[name="model"]:checked')?.value || "claude-haiku-4-5-20251001";
  config.activationMode = document.querySelector('input[name="activation"]:checked')?.value || "on-click";
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

  try {
    const result = await chrome.runtime.sendMessage({
      type: "VALIDATE_API_KEY",
      apiKey: key,
    });

    if (result.valid) {
      config.apiKey = key;
      await saveConfig();
      showStatus("API key validated and saved.", "success");
    } else {
      showStatus("API key rejected. Check your key.", "error");
    }
  } catch (err) {
    showStatus("Validation failed. Key not saved — check network and retry.", "error");
  }

  saveKeyBtn.disabled = false;
});

function showStatus(text, type) {
  keyStatus.textContent = text;
  keyStatus.className = `popup-status popup-status-${type}`;
}

// --- Domain helpers ---

function cleanDomain(val) {
  return val
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

// --- Competitors ---

function renderCompetitors() {
  const comps = config.competitors || [];
  competitorsList.textContent = "";

  comps.forEach((c, i) => {
    const item = document.createElement("div");
    item.className = "popup-competitor-item";

    const label = document.createElement("span");
    label.textContent = c;
    item.appendChild(label);

    const removeBtn = document.createElement("button");
    removeBtn.className = "popup-btn-remove";
    removeBtn.textContent = "\u00D7";
    removeBtn.addEventListener("click", () => {
      config.competitors.splice(i, 1);
      saveConfig();
      renderCompetitors();
    });
    item.appendChild(removeBtn);

    competitorsList.appendChild(item);
  });
}

addCompetitorBtn.addEventListener("click", () => {
  const domain = cleanDomain(addCompetitorInput.value);
  if (!domain) return;

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

// --- Usage ---

async function loadUsage() {
  try {
    const usage = await chrome.runtime.sendMessage({ type: "GET_USAGE" });
    if (usage) {
      usageCount.textContent = usage.count || 0;
      usageCost.textContent = `$${(usage.estimatedCostUsd || 0).toFixed(2)}`;
    }
  } catch {}
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
