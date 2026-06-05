/**
 * Composable для формы настроек (SettingsTab).
 * Содержит reactive-копии редактируемых полей, debounced-автосохранение,
 * синхронизацию с пропсами (watch) и утилиты (validate path, adjust tokens).
 * @module composables/useSettingsForm
 */

import { reactive, ref, watch, computed } from "vue";
import { configDefaults } from "@backend/lib/configDefaults.js";
import { checkPath, browseFolder, testAsrConnection } from "@/api/client";

const MAX_TOKENS_MIN = 256;
const MAX_TOKENS_MAX = 65536;
const DEBOUNCE_SAVE_MS = 300;
const RESET_FLAG_MS = 500;
const IGNORE_WATCH_MS = 600;

const ROOT_DRIVE_REGEX = /^[a-zA-Z]:\\$/i;

export function useSettingsForm(props, emit) {
  const configCopy = reactive(buildConfigCopy(props.config));
  const apiBasesCopy = ref(deepClone(props.apiBases));
  const modelNameCopy = ref(props.modelName);
  const modelFilter = ref("");

  const tokenVisible = ref(false);
  const orKeyVisible = ref(false);
  const pathError = ref("");
  const configBackendHasToken = ref(!!props.config.hasToken);
  const projectPathDraft = ref(props.config.projectPath || "");

  const hasToken = computed(() => !!(configCopy.token || configBackendHasToken.value));

  const loadingStates = ref({
    save: false,
    reset: false,
    models: false,
    openrouterModels: false,
    asrTest: false,
  });

  const asrStatus = ref(null);

  const filteredModels = computed(() => {
    if (!modelFilter.value) return props.availableModels;
    const q = modelFilter.value.toLowerCase();
    return props.availableModels.filter(
      (m) => m.id.toLowerCase().includes(q) || (m.source || "").toLowerCase().includes(q)
    );
  });

  let saveTimer = null;
  let pendingSave = false;
  let isSaving = false;
  let ignoreNextWatch = false;

  function buildSavePayload() {
    const model = props.availableModels.find((m) => m.id === modelNameCopy.value);
    return {
      config: { ...configCopy },
      apiBases: deepClone(apiBasesCopy.value),
      modelName: modelNameCopy.value,
      serverUrl: model ? model.source : "",
    };
  }

  function debouncedSave() {
    if (pendingSave || isSaving) return;

    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        isSaving = true;
        pendingSave = true;
        emit("save", buildSavePayload());
      } catch (error) {
        console.error("Auto-save failed:", error);
      } finally {
        isSaving = false;
        setTimeout(() => {
          pendingSave = false;
        }, RESET_FLAG_MS);
      }
    }, DEBOUNCE_SAVE_MS);
  }

  function autoSave() {
    debouncedSave();
  }

  watch(
    () => props.config,
    (val) => {
      if (!val || pendingSave) return;
      if (ignoreNextWatch) {
        ignoreNextWatch = false;
        return;
      }

      ignoreNextWatch = true;
      Object.assign(configCopy, buildConfigCopy(val));
      projectPathDraft.value = val.projectPath || "";
      configBackendHasToken.value = !!val.hasToken;

      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        ignoreNextWatch = false;
      }, IGNORE_WATCH_MS);
    },
    { deep: true }
  );

  watch(
    () => props.modelName,
    (val) => {
      if (!pendingSave) modelNameCopy.value = val;
    }
  );

  watch(
    () => props.apiBases,
    (val) => {
      if (!pendingSave) apiBasesCopy.value = deepClone(val);
    },
    { deep: true }
  );

  watch(configCopy, autoSave, { deep: true });
  watch(modelNameCopy, autoSave);
  watch(apiBasesCopy, autoSave, { deep: true });

  watch(
    () => configCopy.projectPath,
    () => {
      pathError.value = "";
    }
  );

  async function checkProjectPath() {
    const p = projectPathDraft.value;
    if (!p) {
      pathError.value = "";
      return;
    }
    const isWin = typeof navigator !== "undefined" && navigator.userAgent.includes("Win");
    if (isWin && ROOT_DRIVE_REGEX.test(p)) {
      pathError.value = "";
      return;
    }
    try {
      const data = await checkPath(p);
      pathError.value = data.valid ? "" : "⚠️ Directory does not exist";
    } catch {
      pathError.value = "⚠️ Cannot validate path";
    }
  }

  async function handleSave() {
    if (isSaving) return;
    configCopy.projectPath = projectPathDraft.value;
    clearTimeout(saveTimer);
    pendingSave = true;
    await checkProjectPath();
    if (pathError.value) {
      setTimeout(() => {
        pendingSave = false;
      }, RESET_FLAG_MS);
      return;
    }

    loadingStates.value.save = true;
    try {
      emit("save", buildSavePayload());
    } catch (error) {
      console.error("Manual save failed:", error);
    } finally {
      setTimeout(() => {
        loadingStates.value.save = false;
        pendingSave = false;
      }, RESET_FLAG_MS);
    }
  }

  async function handleSaveProjectPath() {
    await checkProjectPath();
    if (pathError.value) return;
    configCopy.projectPath = projectPathDraft.value;
    emit("save-path", { projectPath: projectPathDraft.value });
  }

  function handleReset() {
    loadingStates.value.reset = true;
    emit("reset");
    setTimeout(() => {
      loadingStates.value.reset = false;
    }, RESET_FLAG_MS);
  }

  function handleRefreshModels() {
    loadingStates.value.models = true;
    try {
      emit("models-updated");
    } finally {
      setTimeout(() => {
        loadingStates.value.models = false;
      }, 1000);
    }
  }

  function handleLoadOpenRouterModels() {
    loadingStates.value.openrouterModels = true;
    try {
      emit("models-updated", "https://openrouter.ai/api/v1", configCopy.openrouterApiKey);
    } finally {
      setTimeout(() => {
        loadingStates.value.openrouterModels = false;
      }, 1000);
    }
  }

  function addApiBase() {
    apiBasesCopy.value.push({ url: "", connected: false });
    autoSave();
  }

  function removeApiBase(index) {
    apiBasesCopy.value.splice(index, 1);
    autoSave();
  }

  function syncApiBases() {
    autoSave();
    emit("models-updated");
  }

  function adjustTokens(delta) {
    configCopy.maxTokens = Math.max(MAX_TOKENS_MIN, Math.min(MAX_TOKENS_MAX, configCopy.maxTokens + delta));
  }

  async function browseDirectory() {
    try {
      const data = await browseFolder();
      if (data.path) {
        projectPathDraft.value = data.path;
        pathError.value = "";
      }
    } catch {
      pathError.value = "⚠️ Failed to open folder picker";
    }
  }

  async function testAsrServer() {
    loadingStates.value.asrTest = true;
    asrStatus.value = null;
    try {
      asrStatus.value = await testAsrConnection();
    } catch {
      asrStatus.value = { configured: true, reachable: false, url: configCopy.asrServerUrl };
    } finally {
      loadingStates.value.asrTest = false;
    }
  }

  return {
    configCopy,
    apiBasesCopy,
    modelNameCopy,
    modelFilter,
    tokenVisible,
    orKeyVisible,
    pathError,
    configBackendHasToken,
    projectPathDraft,
    hasToken,
    loadingStates,
    asrStatus,
    filteredModels,
    checkProjectPath,
    handleSave,
    handleSaveProjectPath,
    handleReset,
    handleRefreshModels,
    handleLoadOpenRouterModels,
    addApiBase,
    removeApiBase,
    syncApiBases,
    adjustTokens,
    browseDirectory,
    testAsrServer,
  };
}

function buildConfigCopy(config) {
  return {
    token: config.token || "",
    projectPath: config.projectPath || "C:\\",
    maxFileChars: config.maxFileChars ?? configDefaults.maxFileChars,
    maxHistoryPairs: config.maxHistoryPairs ?? configDefaults.maxHistoryPairs,
    maxSearchResults: config.maxSearchResults ?? configDefaults.maxSearchResults,
    maxSearchFileSize: config.maxSearchFileSize ?? configDefaults.maxSearchFileSize,
    maxFilesInPrompt: config.maxFilesInPrompt ?? configDefaults.maxFilesInPrompt,
    maxTokens: config.maxTokens ?? configDefaults.maxTokens,
    timeout: config.timeout ?? configDefaults.timeout,
    temperature: config.temperature ?? configDefaults.temperature,
    stream: config.stream ?? configDefaults.stream,
    insertUserAfterTool: config.insertUserAfterTool ?? configDefaults.insertUserAfterTool,
    chatMode: config.chatMode ?? configDefaults.chatMode,
    openrouterApiKey: config.openrouterApiKey || "",
    autoSave: config.autoSave !== false,
    verbose: config.verbose === true,
    autoStart: config.autoStart === true,
    showTokens: config.showTokens !== false,
    soundEnabled: config.soundEnabled !== false,
    soundVolume: config.soundVolume ?? 50,
    asrServerUrl: config.asrServerUrl || "",
  };
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}
