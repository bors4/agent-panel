/**
 * Composable для управления пользовательской конфигурацией приложения.
 * Хранит `localConfig` (reactive), дефолтные значения, операции сохранения
 * в localStorage и backend (POST /api/config), экспорт/импорт JSON.
 * @module composables/useAppConfig
 */

import { ref } from "vue";
import { configDefaults } from "@backend/lib/configDefaults.js";
import { browseFolder, testAsrConnection, updateConfig } from "@/api/client";

const LS_KEY = "agent-config";
const TOKEN_SANITIZE_REGEX = /[^\x00-\x7F]/g;

/**
 * Базовые значения для localConfig.
 * `token`, `projectPath`, `serverUrl` подставляются из пользовательского ввода.
 * Остальные — из configDefaults.js, чтобы избежать хардкода в UI.
 */
export const defaultConfig = {
  token: "",
  projectPath: configDefaults.projectPath,
  serverUrl: configDefaults.serverUrl,
  modelName: "",
  maxFileChars: configDefaults.maxFileChars,
  maxHistoryPairs: configDefaults.maxHistoryPairs,
  maxSearchResults: configDefaults.maxSearchResults,
  maxFilesInPrompt: configDefaults.maxFilesInPrompt,
  maxTokens: configDefaults.maxTokens,
  timeout: configDefaults.timeout,
  temperature: configDefaults.temperature,
  stream: configDefaults.stream,
  insertUserAfterTool: configDefaults.insertUserAfterTool,
  openrouterApiKey: "",
  autoSave: true,
  verbose: false,
  autoStart: false,
  showTokens: true,
  soundEnabled: true,
  soundVolume: 50,
};

/**
 * Composable для конфигурации приложения.
 * @param {Object} deps
 * @param {import("vue").Ref<string>} deps.systemPrompt - системный промпт (нужен для localStorage payload)
 * @param {import("vue").Ref<Array>} deps.apiBases - API базы (нужны для localStorage payload)
 * @param {import("vue").Ref<string>} deps.modelName - имя модели
 * @param {import("vue").Ref<string>} deps.serverUrl - URL сервера
 * @param {Function} deps.addLog - логгер ({message,type})=>void
 * @param {Function} deps.success - toast success
 * @param {Function} deps.error - toast error
 * @param {Function} deps.warning - toast warning
 */
export function useAppConfig({ systemPrompt, apiBases, modelName, serverUrl, addLog, success, error, warning }) {
  const localConfig = ref({ ...defaultConfig });

  function buildLocalStoragePayload() {
    return {
      ...sanitizeConfigForPersist(localConfig.value),
      systemPrompt: systemPrompt.value,
      apiBases: apiBases.value,
      modelName: modelName.value,
      serverUrl: serverUrl.value,
    };
  }

  function buildBackendPayload() {
    const sanitized = sanitizeConfigForPersist(localConfig.value);
    return {
      modelName: modelName.value,
      serverUrl: serverUrl.value,
      projectPath: sanitized.projectPath,
      systemPrompt: systemPrompt.value,
      maxFileChars: sanitized.maxFileChars,
      maxHistoryPairs: sanitized.maxHistoryPairs,
      maxSearchResults: sanitized.maxSearchResults,
      maxFilesInPrompt: sanitized.maxFilesInPrompt,
      maxTokens: sanitized.maxTokens,
      timeout: sanitized.timeout,
      temperature: sanitized.temperature,
      stream: sanitized.stream,
      insertUserAfterTool: sanitized.insertUserAfterTool,
      openrouterApiKey: sanitized.openrouterApiKey,
      token: sanitized.token,
    };
  }

  /**
   * Удалить из токенов/ключей не-ASCII (em-dash и т.п.), которые ломают backend-аутентификацию.
   */
  function sanitizeConfigForPersist(cfg) {
    return {
      ...cfg,
      token: (cfg.token || "").trim().replace(TOKEN_SANITIZE_REGEX, ""),
      openrouterApiKey: (cfg.openrouterApiKey || "").trim().replace(TOKEN_SANITIZE_REGEX, ""),
    };
  }

  /**
   * Сохранить настройки в localStorage и отправить на backend.
   * @param {boolean|null} [showToast=null] - true=показать тост, false=нет, null=по autoSave
   */
  async function saveSettings(showToast = null) {
    let backendOk = true;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(buildLocalStoragePayload()));
    } catch (e) {
      if (e?.name === "QuotaExceededError" || /quota/i.test(e?.message || "")) {
        error("Локальное хранилище переполнено — очистите данные браузера");
      } else {
        error("Не удалось сохранить настройки локально: " + e.message);
      }
      return;
    }
    try {
      await updateConfig(buildBackendPayload());
      addLog(`Config updated: ${modelName.value}, projectPath=${localConfig.value.projectPath}`, "info");
    } catch (e) {
      backendOk = false;
      error(`Failed to update backend config: ${e.message}`);
    }
    const shouldShow = showToast !== null ? showToast : localConfig.value.autoSave;
    if (shouldShow && backendOk) success("Настройки сохранены");
  }

  /**
   * Сохранить системный промпт в localStorage (без отправки на backend).
   */
  function savePrompt() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(buildLocalStoragePayload()));
      if (localConfig.value.autoSave) success("Промпт сохранён");
      addLog("Prompt saved", "success");
    } catch (e) {
      error(e.message);
    }
  }

  function resetPrompt() {
    if (confirm("Сбросить промпт?")) {
      systemPrompt.value = "";
      warning("Промпт сброшен");
      addLog("Prompt reset", "warning");
    }
  }

  function resetSettings() {
    if (confirm("Сбросить настройки?")) {
      localConfig.value = { ...defaultConfig };
      systemPrompt.value = "";
      warning("Настройки сброшены");
      addLog("Settings reset", "warning");
    }
  }

  function exportConfig() {
    const hasSecrets = !!localConfig.value.token || !!localConfig.value.openrouterApiKey;
    if (hasSecrets) {
      const proceed = window.confirm(
        "В конфигурации есть Telegram-токен и/или OpenRouter-ключ.\n" +
          "Эти данные дают полный доступ к боту и аккаунту OpenRouter.\n\n" +
          "Экспортировать в JSON?"
      );
      if (!proceed) {
        addLog("Config export cancelled (secrets present)", "warning");
        return;
      }
    }
    const data = { ...localConfig.value, systemPrompt: systemPrompt.value };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agent-config-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    success("Конфигурация экспортирована");
    addLog("Config exported", "success");
  }

  function importConfig() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = (ev.target.result || "").trim();
        if (!text) {
          error("Файл пустой");
          addLog("Config import failed: empty file", "error");
          return;
        }
        try {
          const imported = JSON.parse(text);
          if (typeof imported !== "object" || imported === null || Array.isArray(imported)) {
            error("Ожидался JSON-объект");
            addLog("Config import failed: not an object", "error");
            return;
          }
          systemPrompt.value = imported.systemPrompt || "";
          localConfig.value = { ...defaultConfig, ...imported };
          success("Конфигурация импортирована");
          addLog("Config imported", "success");
        } catch {
          error("Ошибка JSON");
          addLog("Config import failed", "error");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function handleSettingsSave(data) {
    if (data?.config) {
      Object.assign(localConfig.value, data.config);
    }
    if (data?.apiBases) {
      apiBases.value = data.apiBases;
    }
    if (data?.modelName !== undefined) {
      modelName.value = data.modelName;
    }
    if (data?.serverUrl !== undefined) {
      serverUrl.value = data.serverUrl;
    }
    return saveSettings(true);
  }

  function handleSaveProjectPath(data) {
    if (data.projectPath) {
      localConfig.value.projectPath = data.projectPath;
    }
    return saveSettings();
  }

  /**
   * Открывает системный диалог выбора директории (через backend /api/browse-folder)
   * и записывает выбранный путь в localConfig.projectPath.
   * Бэкенд возвращает { path: "..." } при выборе, { path: null } при отмене,
   * { error: "..." } при ошибке. Поля `success` нет.
   */
  async function handleBrowse() {
    try {
      const data = await browseFolder();
      if (data?.path) {
        localConfig.value.projectPath = data.path;
        addLog(`Selected project path: ${data.path}`, "info");
        success("Путь выбран");
      } else if (data?.error) {
        warning(data.error);
        addLog(`Browse folder: ${data.error}`, "warning");
      }
    } catch (e) {
      error("Не удалось открыть диалог выбора папки: " + e.message);
      addLog(`Browse folder failed: ${e.message}`, "error");
    }
  }

  /**
   * Добавить новую запись в apiBases (с пустым URL).
   * @param {import("vue").Ref<Array>} apiBasesRef
   */
  function handleAddApiBase(apiBasesRef) {
    if (!apiBasesRef?.value) return;
    apiBasesRef.value.push({ url: "", connected: false });
  }

  /**
   * Удалить запись apiBases по индексу.
   * @param {import("vue").Ref<Array>} apiBasesRef
   * @param {number} idx
   */
  function handleRemoveApiBase(apiBasesRef, idx) {
    if (!apiBasesRef?.value || !Array.isArray(apiBasesRef.value)) return;
    if (idx < 0 || idx >= apiBasesRef.value.length) return;
    apiBasesRef.value.splice(idx, 1);
  }

  /**
   * Обновить список моделей из локальных API баз.
   * @param {Function} loadApiBases
   */
  async function handleRefreshModels(loadApiBases) {
    if (typeof loadApiBases !== "function") return;
    try {
      await loadApiBases();
      success("Модели обновлены");
    } catch (e) {
      error("Не удалось обновить модели: " + e.message);
    }
  }

  /**
   * Загрузить модели OpenRouter по сохранённому ключу.
   * @param {Function} updateModels
   * @param {string} openrouterApiKey
   */
  async function handleLoadOpenRouter(updateModels, openrouterApiKey) {
    if (typeof updateModels !== "function") return;
    if (!openrouterApiKey) {
      warning("Сначала укажите OpenRouter API ключ");
      return;
    }
    try {
      await updateModels("https://openrouter.ai/api/v1", openrouterApiKey);
    } catch (e) {
      error("Не удалось загрузить модели OpenRouter: " + e.message);
    }
  }

  /**
   * Проверить доступность ASR-сервера, обновить asrStatus ref.
   * @param {import("vue").Ref<Object|null>} asrStatusRef
   */
  async function handleTestAsr(asrStatusRef) {
    if (!asrStatusRef) return;
    try {
      const data = await testAsrConnection();
      asrStatusRef.value = {
        configured: !!data?.configured,
        reachable: !!data?.reachable,
        url: data?.url || "",
        status: data?.status,
      };
      if (data?.reachable) {
        success("ASR сервер доступен");
        addLog(`ASR reachable: ${data.url}`, "success");
      } else {
        warning("ASR сервер недоступен");
        addLog(`ASR unreachable: ${data?.url || "(not configured)"}`, "warning");
      }
    } catch (e) {
      asrStatusRef.value = { configured: false, reachable: false, url: "", error: e.message };
      error("Не удалось проверить ASR: " + e.message);
    }
  }

  return {
    localConfig,
    defaultConfig,
    saveSettings,
    savePrompt,
    resetPrompt,
    resetSettings,
    exportConfig,
    importConfig,
    handleSettingsSave,
    handleSaveProjectPath,
    handleBrowse,
    handleAddApiBase,
    handleRemoveApiBase,
    handleRefreshModels,
    handleLoadOpenRouter,
    handleTestAsr,
  };
}
