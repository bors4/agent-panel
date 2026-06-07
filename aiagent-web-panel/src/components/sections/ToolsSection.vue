<template>
  <section class="settings-section">
    <header class="tools-header">
      <div class="tools-header__left">
        <h2 class="tools-header__title">Tools</h2>
        <span class="tools-header__count">{{ enabledCount }}/{{ toolsCount }}</span>
      </div>
      <AppTooltip>
        <template #trigger>
          <span class="tools-header__help">?</span>
        </template>
        <b>enabled</b> — toggle on/off<br />
        <b>permission</b>: ask / always / deny<br />
        <b>exclude_paths</b> — restricted paths
      </AppTooltip>
    </header>

    <div class="settings-section__body">
      <div class="tools-list">
        <ToolItem
          v-for="(tool, name) in tools"
          :key="name"
          :name="name"
          :tool="tool"
          :config="config"
          :is-expanded="!!toolSettingsExpanded[name]"
          @toggle-settings="toggleToolSettings"
          @toggle="toggleTool"
          @update-permission="updatePermission"
          @update-exclude-paths="updateExcludePaths"
        />
      </div>
    </div>
  </section>
</template>

<script setup>
import { onMounted } from "vue";
import AppTooltip from "../ui/AppTooltip.vue";
import ToolItem from "../tabs/tools/ToolItem.vue";
import { useToolsConfig } from "@/composables/useToolsConfig";

const {
  tools,
  config,
  toolSettingsExpanded,
  toolsCount,
  enabledCount,
  fetchTools,
  toggleTool,
  updatePermission,
  updateExcludePaths,
  toggleToolSettings,
  mergeLocalConfig,
} = useToolsConfig();

onMounted(async () => {
  await fetchTools();
  mergeLocalConfig();
});
</script>

<style scoped>
.settings-section {
  padding: 24px;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tools-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.tools-header__left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tools-header__title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: var(--text-1);
  letter-spacing: -0.01em;
}

.tools-header__count {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-3);
  padding: 2px 8px;
  background: var(--bg-2);
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
}

.tools-header__help {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--bg-2);
  border: 1px solid var(--border);
  color: var(--text-3);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: var(--t-fast);
}

.tools-header__help:hover {
  background: var(--accent-soft);
  color: var(--accent);
  border-color: var(--accent);
}

.settings-section__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.tools-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 900px;
}
</style>
