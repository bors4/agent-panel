<!--
  App — корневой компонент. Содержит layout (grid 280px sidebar + main) и
  монтирует 5 вкладок (Prompt / Settings / Tools / Chat / Logs) и общие
  виджеты. Вся логика вынесена в composables.
-->
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
        :show-tokens="localConfig.showTokens"
        @refresh="refreshStatus"
      />
      <BotCheckCard :token="localConfig.token" />
    </aside>

    <main class="main-content">
      <TabBar v-model:active-tab="activeTab" :tabs="tabs" />

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
        id="panel-settings"
        role="tabpanel"
        aria-labelledby="tab-settings"
        :config="localConfig"
        :api-bases="apiBases"
        :available-models="availableModels"
        :model-name="modelName"
        @save="handleSettingsSave"
        @reset="resetSettings"
        @models-updated="updateModels"
        @save-path="handleSaveProjectPath"
      />

      <ChatTab
        v-show="activeTab === 'chat'"
        id="panel-chat"
        ref="chatTabRef"
        role="tabpanel"
        aria-labelledby="tab-chat"
        :is-active="isRunning"
        :model-name="modelName"
        :server-url="serverUrl"
        :project-path="localConfig.projectPath"
        :system-prompt="systemPrompt"
        :verbose="localConfig.verbose"
        :show-tokens="localConfig.showTokens"
        :sound-enabled="localConfig.soundEnabled"
        :sound-volume="localConfig.soundVolume"
        :stream-enabled="localConfig.stream === true"
        @log="addLog"
        @token-usage="handleTokenUsage"
      />

      <LogsTab
        v-if="activeTab === 'logs'"
        id="panel-logs"
        role="tabpanel"
        aria-labelledby="tab-logs"
        :logs="logs"
        @clear="handleClearLogs"
      />

      <ToolsTab v-if="activeTab === 'tools'" id="panel-tools" role="tabpanel" aria-labelledby="tab-tools" />
    </main>

    <ToastContainer />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useAgent } from "@/composables/useAgent";
import { useToast } from "@/composables/useToast";
import { useAppConfig, defaultConfig } from "@/composables/useAppConfig";
import { useAppModels } from "@/composables/useAppModels";
import { useAppActions } from "@/composables/useAppActions";
import { bootApp } from "@/composables/useAppBoot";

import Header from "@/components/layout/Header.vue";
import TabBar from "@/components/layout/TabBar.vue";
import ControlsCard from "@/components/features/ControlsCard.vue";
import StatsCard from "@/components/features/StatsCard.vue";
import BotCheckCard from "@/components/features/BotCheckCard.vue";
import PromptTab from "@/components/tabs/PromptTab.vue";
import SettingsTab from "@/components/tabs/SettingsTab.vue";
import ChatTab from "@/components/tabs/ChatTab.vue";
import LogsTab from "@/components/tabs/LogsTab.vue";
import ToolsTab from "@/components/tabs/ToolsTab.vue";
import ToastContainer from "@/components/ui/ToastContainer.vue";

const { status, isRunning, stats, logs, tokenUsage, perfStats, refreshStatus } = useAgent();
const { success, error, warning } = useToast();

const activeTab = ref("prompt");
const systemPrompt = ref("");

const {
  addLog,
  handleStart,
  handleStop,
  handleRestart,
  handleClearLogs,
  handleTokenUsage,
  formatPrompt: formatPromptRaw,
  copyPrompt: copyPromptRaw,
} = useAppActions();
function formatPrompt() {
  formatPromptRaw(systemPrompt);
}
function copyPrompt() {
  copyPromptRaw(systemPrompt);
}

const models = useAppModels({
  addLog,
  success,
  error,
  maxTokensFallback: computed(() => localConfig.value?.maxTokens),
});
const { apiBases, modelName, serverUrl, availableModels, modelContextLength, loadApiBases, updateModels } = models;

const {
  localConfig,
  savePrompt,
  resetPrompt,
  resetSettings,
  exportConfig,
  importConfig,
  handleSettingsSave,
  handleSaveProjectPath,
} = useAppConfig({ systemPrompt, apiBases, modelName, serverUrl, addLog, success, error, warning });

const chatTabRef = ref(null);

const tabs = [
  { id: "prompt", label: "Системный промпт", symbol: ">" },
  { id: "settings", label: "Параметры", symbol: "#" },
  { id: "tools", label: "Инструменты", symbol: "~" },
  { id: "chat", label: "Чат с агентом", symbol: "@" },
  { id: "logs", label: "Логи", symbol: "!" },
];

function handleNavigate(action) {
  switch (action) {
    case "start":
      return handleStart();
    case "stop":
      return handleStop();
    case "restart":
      return handleRestart();
    case "export":
      return exportConfig();
    case "import":
      return importConfig();
    case "format":
      return formatPrompt();
    default:
      if (["prompt", "settings", "chat", "logs", "tools"].includes(action)) {
        activeTab.value = action;
      }
  }
}

onMounted(async () => {
  try {
    await bootApp({
      refreshStatus,
      handleStart,
      addLog,
      warning,
      loadApiBases,
      defaultConfig,
      refs: {
        localConfig,
        systemPrompt,
        apiBases,
        modelName,
        serverUrl,
      },
    });
  } catch (e) {
    error("Ошибка инициализации приложения: " + e.message);
    addLog("bootApp failed: " + e.message, "error");
  }
});
</script>

<style>
@import "@/styles/main.css";

/* ═══════════════════════════════════════════════
   APP LAYOUT — Space Flight Mission Control v2.0
   ═══════════════════════════════════════════════ */

.app-container {
  position: relative;
  padding: 16px 20px 20px;
  display: grid;
  grid-template-columns: 280px 1fr;
  grid-template-rows: auto 1fr;
  gap: 16px;
  min-height: 100vh;
  background: var(--bg-primary);
  z-index: 1;
}

/* ═══════════════════════════════════════════════
   SIDEBAR (Left Panel — Telemetry & Controls)
   ═══════════════════════════════════════════════ */

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 14px;
  position: relative;
  overflow-y: auto;
  overflow-x: hidden;
  max-height: calc(100vh - 90px);
  scrollbar-width: thin;
}

.sidebar::before {
  content: "";
  position: absolute;
  top: 0;
  right: -1px;
  width: 1px;
  height: 100%;
  background: linear-gradient(180deg, transparent, var(--accent), transparent);
  opacity: 0.15;
}

/* ═══════════════════════════════════════════════
   MAIN CONTENT (Right Panel)
   ═══════════════════════════════════════════════ */

.main-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
}

/* ═══════════════════════════════════════════════
   RESPONSIVE
   ═══════════════════════════════════════════════ */

@media (max-width: 1024px) {
  .app-container {
    grid-template-columns: 1fr;
    padding: 14px;
  }
  .sidebar {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    max-height: none;
  }
  .sidebar::before {
    display: none;
  }
}

@media (max-width: 640px) {
  .app-container {
    padding: 10px;
    gap: 10px;
  }
  .sidebar {
    grid-template-columns: 1fr;
    gap: 10px;
  }
}
</style>
