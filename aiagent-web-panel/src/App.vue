<!--
  App — корневой компонент. Тонкий wrapper вокруг <AppShell>: собирает стейт
  из composables, пробрасывает его в slot'ы (chat / stats / controls / modals)
  и монтирует глобальные виджеты (toasts). Вся логика вынесена в composables.
-->
<template>
  <AppShell
    :status="status"
    :stats-collapsed="statsCollapsed"
    :logs-open="logsOpen"
    :settings-open="settingsOpen"
    @top-action="handleTopAction"
  >
    <template #controls>
      <div class="control-strip">
        <div class="control-strip__spacer" />
        <AgentControls
          :is-running="isRunning"
          :project-path="localConfig.projectPath"
          @start="handleStart"
          @stop="handleStop"
          @restart="handleRestart"
        />
      </div>
    </template>

    <template #chat>
      <ChatPanel
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
        @warning="warning"
      />
    </template>

    <template #stats>
      <StatsPanel
        :stats="stats"
        :uptime="stats.uptime || 0"
        :token-usage="tokenUsage"
        :perf-stats="perfStats"
        :max-tokens="modelContextLength"
        :last-request-tokens="lastRequestTokens"
        :last-request-timestamp="lastRequestTimestamp"
        :collapsed="statsCollapsed"
        @collapse="toggleStats"
        @expand="toggleStats"
      />
    </template>

    <template #settings-modal>
      <SettingsModal
        v-model="settingsOpen"
        :config="localConfig"
        :api-bases="apiBases"
        :model-name="modelName"
        :available-models="availableModels"
        :model-context-length="modelContextLength"
        :system-prompt="systemPrompt"
        :asr-status="asrStatus"
        @update:config="onConfigUpdate"
        @update:api-bases="(v) => (apiBases = v)"
        @update:model-name="(v) => setModel(v)"
        @update:system-prompt="(v) => (systemPrompt = v)"
        @save="handleSettingsSave"
        @reset="resetSettings"
        @format="onFormatPrompt"
        @browse="onBrowse"
        @add-api-base="onAddApiBase"
        @remove-api-base="onRemoveApiBase"
        @refresh-models="onRefreshModels"
        @load-openrouter="onLoadOpenRouter"
        @test-asr="onTestAsr"
      />
    </template>

    <template #logs-modal>
      <LogsModal v-model="logsOpen" :logs="logs" @clear="handleClearLogs" />
    </template>

    <template #toasts>
      <ToastContainer />
    </template>
  </AppShell>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useAgent } from "@/composables/useAgent";
import { useToast } from "@/composables/useToast";
import { useAppConfig, defaultConfig } from "@/composables/useAppConfig";
import { useAppModels } from "@/composables/useAppModels";
import { useAppActions } from "@/composables/useAppActions";
import { useAppLayout } from "@/composables/useAppLayout";
import { useTheme } from "@/composables/useTheme";
import { useSettingsModal } from "@/composables/useSettingsModal";
import { useLogsModal } from "@/composables/useLogsModal";
import { bootApp } from "@/composables/useAppBoot";

import AppShell from "@/components/layout/AppShell.vue";
import StatsPanel from "@/components/stats/StatsPanel.vue";
import ChatPanel from "@/components/chat/ChatPanel.vue";
import SettingsModal from "@/components/modals/SettingsModal.vue";
import LogsModal from "@/components/modals/LogsModal.vue";
import AgentControls from "@/components/controls/AgentControls.vue";
import ToastContainer from "@/components/ui/ToastContainer.vue";

const { status, isRunning, stats, logs, tokenUsage, lastRequestTokens, perfStats, refreshStatus } = useAgent();
const { success, error, warning } = useToast();

const { addLog, handleStart, handleStop, handleRestart, handleClearLogs, handleTokenUsage, formatPrompt } = useAppActions();
const { statsCollapsed, toggleStats } = useAppLayout();
useTheme();
const { isOpen: settingsOpen, open: openSettings, close: closeSettings } = useSettingsModal();
const { isOpen: logsOpen, open: openLogs, close: closeLogs } = useLogsModal();

const lastRequestTimestamp = computed(() => lastRequestTokens.value?.timestamp || "");

const systemPrompt = ref("");

const models = useAppModels({
  addLog,
  success,
  error,
  maxTokensFallback: computed(() => localConfig.value?.maxTokens),
});
const { apiBases, modelName, serverUrl, availableModels, modelContextLength, loadApiBases, updateModels, setModel } = models;

const {
  localConfig,
  resetSettings,
  handleSettingsSave,
  handleBrowse,
  handleAddApiBase,
  handleRemoveApiBase,
  handleRefreshModels,
  handleLoadOpenRouter,
  handleTestAsr,
} = useAppConfig({
  systemPrompt,
  apiBases,
  modelName,
  serverUrl,
  addLog,
  success,
  error,
  warning,
});

const asrStatus = ref(null);

function onConfigUpdate(partial) {
  Object.assign(localConfig.value, partial);
}

function onFormatPrompt() {
  if (typeof formatPrompt === "function") formatPrompt(systemPrompt);
}

function onBrowse() {
  handleBrowse();
}

function onAddApiBase() {
  handleAddApiBase(apiBases);
}

function onRemoveApiBase(idx) {
  handleRemoveApiBase(apiBases, idx);
}

function onRefreshModels() {
  handleRefreshModels(loadApiBases);
}

function onLoadOpenRouter() {
  handleLoadOpenRouter(updateModels, localConfig.value.openrouterApiKey);
}

function onTestAsr() {
  handleTestAsr(asrStatus);
}

function handleTopAction(actionId) {
  if (actionId === "logs") {
    if (logsOpen.value) closeLogs();
    else openLogs();
  } else if (actionId === "settings") {
    if (settingsOpen.value) closeSettings();
    else openSettings();
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

.control-strip {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-width: 0;
}

.control-strip__spacer {
  flex: 1 1 auto;
  min-width: 8px;
}

@media (max-width: 720px) {
  .control-strip {
    flex-wrap: wrap;
  }
}
</style>
