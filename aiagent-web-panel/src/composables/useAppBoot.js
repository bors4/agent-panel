/**
 * Composable для lifecycle-инициализации App.vue.
 * Загружает настройки из localStorage и backend, синхронизирует с сервером,
 * запускает авто-старт бота при необходимости.
 * @module composables/useAppBoot
 */

import { getConfig, updateConfig } from "@/api/client";
import { readTheme, applyTheme } from "./useTheme.js";

const LS_KEY = "agent-config";

/**
 * Применить сохранённую тему ДО любых асинхронных операций, чтобы избежать
 * flash of wrong theme (FOUC) при перезагрузке страницы с сохранённой dark-темой.
 * Inline-скрипт в index.html уже ставит атрибут до парсинга CSS; этот вызов —
 * второй уровень защиты на случай, если inline-скрипт по какой-то причине не сработал.
 */
applyTheme(readTheme());

/**
 * Применить сохранённый JSON к реактивным refs.
 * @param {Object} parsed - распарсенный localStorage
 * @param {Object} targets
 * @param {import("vue").Ref<string>} targets.systemPrompt
 * @param {import("vue").Ref<Object>} targets.localConfig
 * @param {import("vue").Ref<Array>} targets.apiBases
 * @param {import("vue").Ref<string>} targets.modelName
 * @param {import("vue").Ref<string>} targets.serverUrl
 * @param {Object} targets.defaultConfig - базовые значения по умолчанию
 */
function applyLocalStorage(parsed, { systemPrompt, localConfig, apiBases, modelName, serverUrl, defaultConfig }) {
  if (parsed.systemPrompt) systemPrompt.value = parsed.systemPrompt;
  for (const key of Object.keys(defaultConfig)) {
    if (parsed[key] !== undefined) localConfig.value[key] = parsed[key];
  }
  if (typeof localConfig.value.temperature === "number" && localConfig.value.temperature > 1.0) {
    localConfig.value.temperature = 1.0;
  }
  if (parsed.apiBases) apiBases.value = parsed.apiBases;
  if (parsed.modelName) modelName.value = parsed.modelName;
  if (parsed.serverUrl) serverUrl.value = parsed.serverUrl;
}

async function loadFromBackend({ localConfig, modelName, serverUrl, apiBases, addLog, onlyIfMissing }) {
  try {
    const backendConfig = await getConfig();
    applyBackendConfig(backendConfig, { localConfig, modelName, serverUrl, apiBases, addLog, onlyIfMissing });
    return backendConfig;
  } catch (e) {
    addLog(`Failed to load backend config: ${e.message}`, "warning");
    return null;
  }
}

function applyBackendConfig(backendConfig, { localConfig, modelName, serverUrl, apiBases, addLog, onlyIfMissing }) {
  if (!backendConfig?.config) return false;
  let applied = false;
  const c = backendConfig.config;
  const shouldApply = (frontendValue) => !onlyIfMissing || !frontendValue;
  if (c.projectPath && shouldApply(localConfig.value.projectPath)) {
    localConfig.value.projectPath = c.projectPath;
    addLog(`Loaded projectPath from backend: ${c.projectPath}`, "info");
    applied = true;
  }
  if (c.token && shouldApply(localConfig.value.token)) {
    localConfig.value.token = c.token;
    addLog("Loaded Telegram token from backend", "info");
  }
  if (c.serverUrl && shouldApply(serverUrl.value)) {
    serverUrl.value = c.serverUrl;
    addLog(`Loaded serverUrl from backend: ${c.serverUrl}`, "info");
    applied = true;
  }
  // Always add backend serverUrl to apiBases for model discovery, even if the
  // frontend value was preserved from localStorage. This ensures loadApiBases()
  // can discover models from the configured server even when shouldApply is false.
  if (c.serverUrl && apiBases && Array.isArray(apiBases.value) && !apiBases.value.some((a) => a.url === c.serverUrl)) {
    apiBases.value.push({ url: c.serverUrl, connected: true });
  }
  if (c.modelName && shouldApply(modelName.value)) {
    modelName.value = c.modelName;
    addLog(`Loaded modelName from backend: ${c.modelName}`, "info");
    applied = true;
  }
  return applied;
}

/**
 * Условная синхронизация критичных полей с backend.
 * Синхронизирует ТОЛЬКО поля, где backend ещё не имеет значения, а frontend уже знает.
 * Это гарантирует, что localStorage-сохранённый токен дойдёт до backend (для /api/start),
 * но не перезапишет backend-конфигурацию, заданную извне (env var / другая сессия).
 * @param {Object} deps
 * @param {import("vue").Ref<Object>} deps.localConfig
 * @param {Function} deps.addLog
 * @param {Object|null} deps.backendConfig - результат GET /api/config (для проверки текущих значений backend)
 * @param {import("vue").Ref<string>} [deps.serverUrl] - URL AI сервера (синхронизируется если backend пустой)
 * @param {import("vue").Ref<string>} [deps.modelName] - Имя модели (синхронизируется если backend пустой)
 */
async function syncToBackend({ localConfig, addLog, backendConfig, serverUrl, modelName }) {
  try {
    const cfg = backendConfig?.config || {};
    const payload = {};
    if (!cfg.telegramToken && localConfig.value.token) {
      payload.token = localConfig.value.token;
    }
    if (!cfg.projectPath && localConfig.value.projectPath) {
      payload.projectPath = localConfig.value.projectPath;
    }
    if (!cfg.openrouterApiKey && localConfig.value.openrouterApiKey) {
      payload.openrouterApiKey = localConfig.value.openrouterApiKey;
    }
    if (!cfg.serverUrl && serverUrl?.value) {
      payload.serverUrl = serverUrl.value;
    }
    if (!cfg.modelName && modelName?.value) {
      payload.modelName = modelName.value;
    }
    if (Object.keys(payload).length === 0) return;
    await updateConfig(payload);
    addLog(`Synced to backend: ${Object.keys(payload).join(", ")}`, "info");
  } catch (e) {
    addLog(`Failed to sync to backend: ${e.message}`, "warning");
  }
}

async function maybeAutoStart({ localConfig, addLog, handleStart, refreshStatus }) {
  const autoStartEnabled = localConfig.value.autoStart;
  const hasToken = !!localConfig.value.token;
  const hasPath = !!localConfig.value.projectPath;
  addLog(`AUTO START check: enabled=${autoStartEnabled}, token=${hasToken}, projectPath=${hasPath}`, "system");
  if (autoStartEnabled && hasToken && hasPath) {
    addLog("AUTO START triggered — starting bot...", "system");
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 1000));
        await handleStart();
        await refreshStatus();
        return;
      } catch (e) {
        addLog(`AUTO START attempt ${attempt + 1} failed: ${e.message}`, "warning");
      }
    }
    addLog("AUTO START failed after 3 attempts", "error");
  } else if (autoStartEnabled) {
    const missing = [];
    if (!hasToken) missing.push("token");
    if (!hasPath) missing.push("projectPath");
    addLog(`AUTO START skipped — missing: ${missing.join(", ")}`, "warning");
  }
}

/**
 * Запустить boot-инициализацию приложения.
 * @param {Object} deps
 * @param {Function} deps.refreshStatus - useAgent().refreshStatus
 * @param {Function} deps.handleStart - useAppActions().handleStart
 * @param {Function} deps.addLog - useAppActions().addLog
 * @param {Function} deps.warning - toast warning
 * @param {Object} deps.refs - { localConfig, systemPrompt, apiBases, modelName, serverUrl }
 * @param {Object} deps.defaultConfig - базовые значения по умолчанию
 * @param {Function} deps.loadApiBases - useAppModels().loadApiBases
 */
export async function bootApp({ refreshStatus, handleStart, addLog, warning, refs, defaultConfig, loadApiBases }) {
  await refreshStatus();
  addLog("App initialized", "system");

  const saved = localStorage.getItem(LS_KEY);
  let localStorageApplied = false;
  if (saved) {
    try {
      applyLocalStorage(JSON.parse(saved), { ...refs, defaultConfig });
      localStorageApplied = true;
    } catch (e) {
      addLog(`localStorage "${LS_KEY}" is corrupt — settings reset to defaults: ${e.message}`, "warning");
    }
  }

  // Always load from backend to fill in any missing fields (serverUrl, modelName, projectPath, token).
  // - localStorage is empty: apply ALL backend values (overwrite code defaults)
  // - localStorage has values: apply only MISSING backend values (preserve user's choices)
  const backendConfig = await loadFromBackend({ ...refs, addLog, onlyIfMissing: localStorageApplied });

  // Push critical user-input fields (token, projectPath, openrouterApiKey, serverUrl, modelName)
  // to backend ONLY when backend's value is empty. This handles the case where the backend
  // was restarted but localStorage still has the user's saved values.
  await syncToBackend({ localConfig: refs.localConfig, addLog, backendConfig, serverUrl: refs.serverUrl, modelName: refs.modelName });

  if (!refs.localConfig.value.projectPath) {
    warning("Путь к проекту не указан. Укажите его в разделе Параметры.");
  }

  await loadApiBases();

  await maybeAutoStart({ localConfig: refs.localConfig, addLog, handleStart, refreshStatus });

  // Retry backend config load if it failed initially (backend wasn't ready on first attempt).
  // After maybeAutoStart, the server should be reachable.
  if (!backendConfig) {
    addLog("Retrying backend config load...", "info");
    const retryConfig = await loadFromBackend({ ...refs, addLog, onlyIfMissing: localStorageApplied });
    if (retryConfig) {
      addLog("Backend config loaded on retry", "success");
      // Re-discover models with the now-populated apiBases
      await loadApiBases();
    }
  }
}
