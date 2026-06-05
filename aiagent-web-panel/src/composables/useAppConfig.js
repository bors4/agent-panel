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
      ...localConfig.value,
      systemPrompt: systemPrompt.value,
      apiBases: apiBases.value,
      modelName: modelName.value,
      serverUrl: serverUrl.value,
    };
  }

  function buildBackendPayload() {
    return {
      modelName: modelName.value,
      serverUrl: serverUrl.value,
      projectPath: localConfig.value.projectPath,
      systemPrompt: systemPrompt.value,
      maxFileChars: localConfig.value.maxFileChars,
      maxHistoryPairs: localConfig.value.maxHistoryPairs,
      maxSearchResults: localConfig.value.maxSearchResults,
      maxFilesInPrompt: localConfig.value.maxFilesInPrompt,
      maxTokens: localConfig.value.maxTokens,
      timeout: localConfig.value.timeout,
      temperature: localConfig.value.temperature,
      stream: localConfig.value.stream,
      insertUserAfterTool: localConfig.value.insertUserAfterTool,
      openrouterApiKey: localConfig.value.openrouterApiKey || "",
      token: localConfig.value.token || "",
    };
  }

  /**
   * Сохранить настройки в localStorage и отправить на backend.
   * @param {boolean|null} [showToast=null] - true=показать тост, false=нет, null=по autoSave
   */
  async function saveSettings(showToast = null) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(buildLocalStoragePayload()));
    } catch (e) {
      error(e.message);
      return;
    }
    try {
      await updateConfig(buildBackendPayload());
      addLog(`Config updated: ${modelName.value}, projectPath=${localConfig.value.projectPath}`, "info");
    } catch (e) {
      error(`Failed to update backend config: ${e.message}`);
    }
    const shouldShow = showToast !== null ? showToast : localConfig.value.autoSave;
    if (shouldShow) success("Настройки сохранены");
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
    if (data.modelName) {
      modelName.value = data.modelName;
    }
    if (data.serverUrl) {
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
