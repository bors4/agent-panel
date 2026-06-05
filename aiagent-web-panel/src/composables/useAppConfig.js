/**
 * Composable для управления пользовательской конфигурацией приложения.
 * Хранит `localConfig` (reactive), дефолтные значения, операции сохранения
 * в localStorage и backend (POST /api/config), экспорт/импорт JSON.
 * @module composables/useAppConfig
 */

import { ref } from "vue";
import { configDefaults } from "@backend/lib/configDefaults.js";
import { updateConfig } from "@/api/client";

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
        try {
          const imported = JSON.parse(ev.target.result);
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
    if (data.config) {
      Object.assign(localConfig.value, data.config);
    }
    if (data.apiBases) {
      apiBases.value = data.apiBases;
    }
    if (data.modelName !== undefined) {
      modelName.value = data.modelName;
    }
    if (data.serverUrl !== undefined) {
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
  };
}
