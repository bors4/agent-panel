<template>
  <div class="app-container">
    <Header :status="status" :active-tab="activeTab" @navigate="handleNavigate" />

    <aside class="sidebar">
      <ControlsCard
        :is-running="isRunning"
        :project-path="localConfig.projectPath"
        @start="handleStart"
        @stop="handleStop"
        @restart="handleRestart"
      />
      <StatsCard
        :uptime="stats.uptime"
        :stats="stats"
        :token-usage="tokenUsage"
        :perf-stats="perfStats"
        :max-tokens="modelContextLength"
        :show-tokens="quickSettings.showTokens"
        @refresh="refreshStatus"
      />
      <BotCheckCard :token="localConfig.token" />
    </aside>

    <main class="main-content">
      <div class="tabs" role="tablist" aria-label="Навигация по разделам">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="['tab', { active: activeTab === tab.id }]"
          role="tab"
          :aria-selected="activeTab === tab.id"
          :aria-controls="`panel-${tab.id}`"
          @click="activeTab = tab.id"
        >
          <span aria-hidden="true">{{ tab.icon }}</span>
          {{ tab.label }}
        </button>
      </div>

      <PromptTab
        v-if="activeTab === 'prompt'"
        id="panel-prompt"
        v-model="systemPrompt"
        role="tabpanel"
        aria-label="Редактор системного промпта"
        @save="savePrompt"
        @reset="resetPrompt"
        @format="formatPrompt"
        @copy="copyPrompt"
        @export="exportConfig"
        @import="importConfig"
      />

      <SettingsTab
        v-if="activeTab === 'settings'"
        :config="localConfig"
        :api-bases="apiBases"
        :available-models="availableModels"
        :model-name="modelName"
        @save="handleSettingsSave"
        @reset="resetSettings"
        @models-updated="updateModels"
        @save-path="handleSaveProjectPath"
      />

      <QuickSettingsTab v-if="activeTab === 'quick'" :settings="quickSettings" @save="handleQuickSettingsSave" />

      <ChatTab
        v-show="activeTab === 'chat'"
        ref="chatTabRef"
        :is-active="isRunning"
        :model-name="modelName"
        :server-url="serverUrl"
        :project-path="localConfig.projectPath"
        :system-prompt="systemPrompt"
        :verbose="quickSettings.verbose"
        :show-tokens="quickSettings.showTokens"
        :stream-enabled="localConfig.stream === true"
        @log="addLog"
        @token-usage="handleTokenUsage"
      />

      <LogsTab v-if="activeTab === 'logs'" :logs="logs" @clear="handleClearLogs" />

      <ToolsTab v-if="activeTab === 'tools'" />
    </main>

    <ToastContainer />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useAgent } from "@/composables/useAgent";
import { useToast } from "@/composables/useToast";
import { updateConfig, getConfig, getModels } from "@/api/client";

// Components
import Header from "@/components/layout/Header.vue";
import ControlsCard from "@/components/features/ControlsCard.vue";
import StatsCard from "@/components/features/StatsCard.vue";
import BotCheckCard from "@/components/features/BotCheckCard.vue";
import PromptTab from "@/components/tabs/PromptTab.vue";
import SettingsTab from "@/components/tabs/SettingsTab.vue";
import QuickSettingsTab from "@/components/tabs/QuickSettingsTab.vue";
import ChatTab from "@/components/tabs/ChatTab.vue";
import LogsTab from "@/components/tabs/LogsTab.vue";
import ToolsTab from "@/components/tabs/ToolsTab.vue";
import ToastContainer from "@/components/ui/ToastContainer.vue";
import { configDefaults } from "@backend/lib/configDefaults.js";

const defaultConfig = {
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
};

const localConfig = ref({ ...defaultConfig });

// Composables
const {
  status,
  isRunning,
  stats,
  logs,
  tokenUsage,
  perfStats,
  refreshStatus,
  startAgent,
  stopAgent,
  restartAgent,
  clearLogs,
} = useAgent();

const { success, error, warning } = useToast();

// State
const activeTab = ref("prompt");
const systemPrompt = ref("");
const quickSettings = ref({
  autoSave: true,
  verbose: false,
  autoStart: false,
  showTokens: true,
});

const apiBases = ref([
  { url: "http://192.168.1.101:8080/v1", connected: true },
  { url: "http://192.168.1.101:1234/v1", connected: false },
]);

const modelName = ref("gemma-4-E4B-it-Q4_K_M.gguf");
const serverUrl = ref("http://192.168.1.101:8080/v1");
const availableModels = ref([]);

const selectedModel = computed(() =>
  availableModels.value.find((m) => m.id === modelName.value) || null
);
const modelContextLength = computed(() =>
  selectedModel.value?.maxContextLength || localConfig.value.maxTokens || configDefaults.maxTokens
);

const addLog = (message, type = "info") => {
  logs.value.push({
    time: new Date().toLocaleTimeString(),
    message,
    type,
  });
  if (logs.value.length > 200) logs.value.shift();
};

const handleClearLogs = async () => {
  try {
    await clearLogs();
    success("Логи очищены");
  } catch {
    error("Не удалось очистить логи");
  }
};

const tabs = [
  { id: "prompt", label: "Системный промпт", icon: "📝" },
  { id: "settings", label: "Параметры", icon: "⚙️" },
  { id: "quick", label: "Быстрые настройки", icon: "🔘" },
  { id: "tools", label: "Инструменты", icon: "🔧" },
  { id: "chat", label: "Чат-тест", icon: "💬" },
  { id: "logs", label: "Логи", icon: "🖥️" },
];

// Initialize
const loadApiBases = async () => {
  for (const api of apiBases.value) {
    if (api.connected) {
      try {
        const data = await getModels(api.url);
        if (data.models) {
          const models = data.models || [];
          models.forEach((m) => {
            if (!availableModels.value.find((x) => x.id === m.id)) {
              availableModels.value.push({
                id: m.id,
                source: api.url,
                maxContextLength: m.max_context_length || null,
              });
            }
          });
          addLog(`Connected to ${api.url} - ${models.length} models`, "success");
        }
      } catch (e) {
        addLog(`Failed to connect ${api.url}: ${e.message}`, "error");
      }
    }
  }
  if (availableModels.value.length > 0) {
    const saved = availableModels.value.find((m) => m.id === modelName.value);
    if (saved) {
      serverUrl.value = saved.source;
    } else {
      modelName.value = availableModels.value[0].id;
      serverUrl.value = availableModels.value[0].source;
    }
  }
};

const updateModels = async () => {
  availableModels.value = [];
  await loadApiBases();
  success("Модели обновлены");
  addLog("Models refreshed", "success");
};

onMounted(async () => {
  await refreshStatus();

  addLog("App initialized", "system");

  // 1. Load localStorage saved preferences first
  const saved = localStorage.getItem("agent-config");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.systemPrompt) systemPrompt.value = parsed.systemPrompt;

      Object.keys(defaultConfig).forEach((key) => {
        if (parsed[key] !== undefined) {
          localConfig.value[key] = parsed[key];
        }
      });

      quickSettings.value = {
        autoSave: parsed.autoSave !== false,
        verbose: parsed.verbose === true,
        autoStart: parsed.autoStart === true,
        showTokens: parsed.showTokens !== false,
      };

      if (parsed.apiBases) apiBases.value = parsed.apiBases;
      if (parsed.modelName) modelName.value = parsed.modelName;
      if (parsed.serverUrl) serverUrl.value = parsed.serverUrl;
    } catch {}
  }

  // 2. If localStorage has projectPath, prepare to sync
  let hasProjectPath = !!localConfig.value.projectPath;
  if (!hasProjectPath) {
    // No saved projectPath — load from backend (.env)
    try {
      const backendConfig = await getConfig();
      if (backendConfig?.config?.projectPath) {
        localConfig.value.projectPath = backendConfig.config.projectPath;
        hasProjectPath = true;
        addLog(`Loaded projectPath from backend (.env): ${backendConfig.config.projectPath}`, "info");
      }
    } catch (e) {
      addLog(`Failed to load backend config: ${e.message}`, "warning");
    }
  }

  if (!localConfig.value.projectPath) {
    warning("Путь к проекту не указан. Укажите его в разделе Параметры.");
  }

  await loadApiBases();

  // 3. Sync all settings to backend (overrides .env defaults)
  if (hasProjectPath) {
    try {
      await updateConfig({
        projectPath: localConfig.value.projectPath,
        serverUrl: serverUrl.value,
        modelName: modelName.value,
        systemPrompt: systemPrompt.value,
        maxTokens: localConfig.value.maxTokens,
        temperature: localConfig.value.temperature,
        timeout: localConfig.value.timeout,
        maxFileChars: localConfig.value.maxFileChars,
        maxHistoryPairs: localConfig.value.maxHistoryPairs,
        maxSearchResults: localConfig.value.maxSearchResults,
        maxFilesInPrompt: localConfig.value.maxFilesInPrompt,
        stream: localConfig.value.stream,
      });
      addLog(`Synced config to backend (projectPath: ${localConfig.value.projectPath})`, "info");
    } catch (e) {
      addLog(`Failed to sync config: ${e.message}`, "warning");
    }
  }

  if (quickSettings.value.autoStart && localConfig.value.token && localConfig.value.projectPath) {
    await handleStart();
  }
});

// Handlers
const handleStart = async () => {
  try {
    await startAgent();
    success("Агент запущен");
  } catch (e) {
    error(e.message);
  }
};

const handleStop = async () => {
  try {
    await stopAgent();
    warning("Агент остановлен");
  } catch (e) {
    error(e.message);
  }
};

const handleRestart = async () => {
  try {
    await restartAgent();
    success("Агент перезапущен");
  } catch (e) {
    error(e.message);
  }
};

const handleNavigate = (action) => {
  switch (action) {
    case "start":
      handleStart();
      break;
    case "stop":
      handleStop();
      break;
    case "restart":
      handleRestart();
      break;
    case "export":
      exportConfig();
      break;
    case "import":
      importConfig();
      break;
    case "format":
      formatPrompt();
      break;
    default:
      if (["prompt", "settings", "quick", "chat", "logs", "tools"].includes(action)) {
        activeTab.value = action;
      }
  }
};

const savePrompt = async () => {
  try {
    localStorage.setItem(
      "agent-config",
      JSON.stringify({
        ...localConfig.value,
        systemPrompt: systemPrompt.value,
        ...quickSettings.value,
        apiBases: apiBases.value,
        modelName: modelName.value,
        serverUrl: serverUrl.value,
      })
    );
    if (quickSettings.value.autoSave) success("Промпт сохранён");
    addLog("Prompt saved", "success");
  } catch (e) {
    error(e.message);
  }
};

const resetPrompt = () => {
  if (confirm("Сбросить промпт?")) {
    systemPrompt.value = "";
    warning("Промпт сброшен");
    addLog("Prompt reset", "warning");
  }
};

const formatPrompt = () => {
  systemPrompt.value = systemPrompt.value.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  success("Отформатировано");
  addLog("Prompt formatted", "info");
};

const copyPrompt = () => {
  navigator.clipboard.writeText(systemPrompt.value);
  success("Скопировано");
  addLog("Prompt copied to clipboard", "info");
};

const exportConfig = () => {
  const data = { ...localConfig.value, systemPrompt: systemPrompt.value };
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `agent-config-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  success("Конфигурация экспортирована");
  addLog("Config exported", "success");
};

const importConfig = () => {
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
        localConfig.value = { ...imported };
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
};

const handleSettingsSave = (data) => {
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
  saveSettings();
};

const handleSaveProjectPath = (data) => {
  if (data.projectPath) {
    localConfig.value.projectPath = data.projectPath;
  }
  saveSettings();
};

const resetSettings = () => {
  if (confirm("Сбросить настройки?")) {
    localConfig.value = {};
    systemPrompt.value = "";
    warning("Настройки сброшены");
    addLog("Settings reset", "warning");
  }
};

const saveSettings = async () => {
  try {
    localStorage.setItem(
      "agent-config",
      JSON.stringify({
        ...localConfig.value,
        systemPrompt: systemPrompt.value,
        ...quickSettings.value,
        apiBases: apiBases.value,
        modelName: modelName.value,
        serverUrl: serverUrl.value,
      })
    );
    const payload = {
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
    };
    try {
      await updateConfig(payload);
      addLog(`Config updated: ${modelName.value}, projectPath=${localConfig.value.projectPath}`, "info");
    } catch (e) {
      error(`Failed to update backend config: ${e.message}`);
    }
    if (quickSettings.value.autoSave) success("Настройки сохранены");
  } catch (e) {
    error(e.message);
  }
};

const saveQuickSettings = (newSettings) => {
  if (newSettings) {
    quickSettings.value = newSettings;
  }
  localStorage.setItem(
    "agent-config",
    JSON.stringify({
      ...localConfig.value,
      systemPrompt: systemPrompt.value,
      ...quickSettings.value,
      apiBases: apiBases.value,
      modelName: modelName.value,
      serverUrl: serverUrl.value,
    })
  );
  if (quickSettings.value.autoSave) success("Сохранено");
};

const handleQuickSettingsSave = (newSettings) => {
  quickSettings.value = newSettings;
  saveQuickSettings(newSettings);
};

const handleTokenUsage = (usage) => {
  if (!usage) return;
  tokenUsage.value.prompt += usage.prompt_tokens || 0;
  tokenUsage.value.completion += usage.completion_tokens || 0;
  tokenUsage.value.total += usage.total_tokens || 0;
  if (usage.prompt_tokens_details?.cached_tokens !== undefined) {
    tokenUsage.value.cached += usage.prompt_tokens_details.cached_tokens;
  }
};

const chatTabRef = ref(null);
</script>

<style>
@import "@/styles/main.css";

.app-container {
  position: relative;
  padding: 24px;
  display: grid;
  grid-template-columns: 300px 1fr;
  grid-template-rows: auto 1fr;
  gap: 20px;
  min-height: 100vh;
  background: var(--gradient-bg);
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
  overflow-y: auto;
  overflow-x: hidden;
  max-height: 100%;
  scrollbar-width: thin;
}

.sidebar::before {
  content: "";
  position: absolute;
  top: 0;
  right: -1px;
  width: 1px;
  height: 100%;
  background: var(--gradient-accent);
  opacity: 0.2;
}

.sidebar-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  transition: var(--transition);
  backdrop-filter: blur(10px);
}

.sidebar-card:hover {
  border-color: var(--border-hover);
  transform: translateX(2px);
}

.main-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tabs {
  display: flex;
  gap: 3px;
  padding: 3px;
  background: var(--bg-card);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  flex-wrap: wrap;
  backdrop-filter: blur(10px);
  position: relative;
}

.tabs::before {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--gradient-accent);
  opacity: 0.3;
}

.tab {
  padding: 9px 16px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: var(--transition);
  font-family: inherit;
  white-space: nowrap;
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
}

.tab::before {
  content: "";
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 2px;
  background: var(--accent-primary);
  border-radius: 2px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0;
}

.tab:hover:not(.active) {
  color: var(--text-secondary);
  background: var(--bg-hover);
}

.tab:hover:not(.active)::before {
  width: 30%;
  opacity: 0.5;
}

.tab.active {
  background: var(--gradient-accent);
  color: white;
  box-shadow: 0 2px 12px var(--accent-glow);
  position: relative;
  overflow: hidden;
}

.tab.active::before {
  content: "";
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 60%;
  height: 2px;
  background: var(--text-primary);
  border-radius: 2px;
  opacity: 1;
}

.tab.active::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.1) 50%, transparent 70%);
  animation: shimmer 2s infinite;
}

.tab-icon {
  font-size: 14px;
}

.tab-badge {
  background: var(--error);
  color: white;
  font-size: 9px;
  padding: 2px 5px;
  border-radius: 10px;
  min-width: 16px;
  text-align: center;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

@media (max-width: 1024px) {
  .app-container {
    grid-template-columns: 1fr;
    padding: 16px;
  }
  .sidebar {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  .sidebar::before {
    display: none;
  }
}

@media (max-width: 640px) {
  .sidebar {
    grid-template-columns: 1fr;
  }
  .header {
    flex-direction: column;
    gap: 10px;
    text-align: center;
  }
  .header-left {
    flex-direction: column;
  }
  .tabs {
    overflow-x: auto;
    flex-wrap: nowrap;
    -webkit-overflow-scrolling: touch;
  }
  .tab {
    padding: 8px 12px;
    font-size: 11px;
  }
}

.btn-loading {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
