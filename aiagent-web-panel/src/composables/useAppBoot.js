/**
 * Composable для lifecycle-инициализации App.vue.
 * Загружает настройки из localStorage и backend, синхронизирует с сервером,
 * запускает авто-старт бота при необходимости.
 * @module composables/useAppBoot
 */

import { getConfig, updateConfig } from "@/api/client";

const LS_KEY = "agent-config";

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
  if (parsed.apiBases) apiBases.value = parsed.apiBases;
  if (parsed.modelName) modelName.value = parsed.modelName;
  if (parsed.serverUrl) serverUrl.value = parsed.serverUrl;
}

async function loadFromBackend({ localConfig, addLog }) {
  try {
    const backendConfig = await getConfig();
    if (backendConfig?.config?.projectPath) {
      localConfig.value.projectPath = backendConfig.config.projectPath;
      addLog(`Loaded projectPath from backend (.env): ${backendConfig.config.projectPath}`, "info");
      return true;
    }
  } catch (e) {
    addLog(`Failed to load backend config: ${e.message}`, "warning");
  }
  return false;
}

async function loadBackendToken({ localConfig, addLog }) {
  try {
    const backendConfig = await getConfig();
    if (backendConfig?.config?.token && !localConfig.value.token) {
      localConfig.value.token = backendConfig.config.token;
      addLog("Loaded Telegram token from backend", "info");
    }
  } catch (e) {
    addLog(`Failed to load backend config: ${e.message}`, "warning");
  }
}

async function syncToBackend(refs, addLog) {
  try {
    await updateConfig({
      projectPath: refs.localConfig.value.projectPath,
      serverUrl: refs.serverUrl.value,
      modelName: refs.modelName.value,
      systemPrompt: refs.systemPrompt.value,
      maxTokens: refs.localConfig.value.maxTokens,
      temperature: refs.localConfig.value.temperature,
      timeout: refs.localConfig.value.timeout,
      maxFileChars: refs.localConfig.value.maxFileChars,
      maxHistoryPairs: refs.localConfig.value.maxHistoryPairs,
      maxSearchResults: refs.localConfig.value.maxSearchResults,
      maxFilesInPrompt: refs.localConfig.value.maxFilesInPrompt,
      stream: refs.localConfig.value.stream,
      token: refs.localConfig.value.token || "",
    });
    addLog(`Synced config to backend (projectPath: ${refs.localConfig.value.projectPath})`, "info");
  } catch (e) {
    addLog(`Failed to sync config: ${e.message}`, "warning");
  }
}

async function maybeAutoStart({ localConfig, addLog, handleStart, refreshStatus }) {
  const autoStartEnabled = localConfig.value.autoStart;
  const hasToken = !!localConfig.value.token;
  const hasPath = !!localConfig.value.projectPath;
  addLog(`AUTO START check: enabled=${autoStartEnabled}, token=${hasToken}, projectPath=${hasPath}`, "system");
  if (autoStartEnabled && hasToken && hasPath) {
    addLog("AUTO START triggered — starting bot...", "system");
    await handleStart();
    await refreshStatus();
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
  if (saved) {
    try {
      applyLocalStorage(JSON.parse(saved), { ...refs, defaultConfig });
    } catch {}
  }

  let hasProjectPath = !!refs.localConfig.value.projectPath;
  if (!hasProjectPath) {
    hasProjectPath = await loadFromBackend({ localConfig: refs.localConfig, addLog });
  }
  await loadBackendToken({ localConfig: refs.localConfig, addLog });

  if (!refs.localConfig.value.projectPath) {
    warning("Путь к проекту не указан. Укажите его в разделе Параметры.");
  }

  await loadApiBases();

  if (hasProjectPath) {
    await syncToBackend(refs, addLog);
  }

  await maybeAutoStart({ localConfig: refs.localConfig, addLog, handleStart, refreshStatus });
}
