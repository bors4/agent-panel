<template>
  <aside class="stats-panel" :class="{ 'stats-panel--collapsed': collapsed }">
    <div v-if="!collapsed" class="stats-panel__inner">
      <div class="stats-panel__header">
        <h3 class="stats-panel__title">Telemetry</h3>
        <button class="stats-panel__collapse" title="Collapse panel" @click="$emit('collapse')">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      <div class="stats-panel__body">
        <CollapsibleSection
          title="Last Request"
          :collapsed="sectionsCollapsed.lastRequest"
          :collapsible="true"
          @toggle="toggleSection('lastRequest')"
        >
          <LastRequestCard
            :prompt="lastRequestTokens.prompt || 0"
            :completion="lastRequestTokens.completion || 0"
            :total="lastRequestTokens.total || 0"
            :cached="lastRequestTokens.cached || 0"
            :timestamp="lastRequestTimestamp"
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="Telemetry"
          :collapsed="sectionsCollapsed.telemetry"
          :collapsible="true"
          @toggle="toggleSection('telemetry')"
        >
          <TelemetryGrid :stats="stats" :uptime="uptime" />
        </CollapsibleSection>

        <CollapsibleSection
          title="Context"
          :collapsed="sectionsCollapsed.context"
          :collapsible="true"
          @toggle="toggleSection('context')"
        >
          <ContextDonutCard :used="contextUsed" :max="maxTokens" />
        </CollapsibleSection>

        <CollapsibleSection
          title="Performance"
          :collapsed="sectionsCollapsed.performance"
          :collapsible="true"
          @toggle="toggleSection('performance')"
        >
          <PerformanceCard :perf-stats="perfStats" />
        </CollapsibleSection>
      </div>
    </div>

    <div v-else class="stats-panel__rail">
      <button class="stats-panel__expand" title="Expand panel" @click="$emit('expand')">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <div class="stats-panel__rail-stats">
        <div class="stats-panel__rail-item">
          <span class="stats-panel__rail-val tabular-nums">{{ stats.requests || 0 }}</span>
          <span class="stats-panel__rail-label">req</span>
        </div>
        <div class="stats-panel__rail-item">
          <span class="stats-panel__rail-val tabular-nums">{{ stats.errors || 0 }}</span>
          <span class="stats-panel__rail-label">err</span>
        </div>
        <div class="stats-panel__rail-item">
          <span class="stats-panel__rail-val tabular-nums">{{ Math.round(contextPercent) }}%</span>
          <span class="stats-panel__rail-label">ctx</span>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { reactive, computed } from "vue";
import CollapsibleSection from "./CollapsibleSection.vue";
import TelemetryGrid from "./TelemetryGrid.vue";
import LastRequestCard from "./LastRequestCard.vue";
import ContextDonutCard from "./ContextDonutCard.vue";
import PerformanceCard from "./PerformanceCard.vue";

const props = defineProps({
  stats: { type: Object, default: () => ({}) },
  uptime: { type: [String, Number], default: 0 },
  tokenUsage: { type: Object, default: () => ({}) },
  perfStats: { type: Object, default: () => ({}) },
  maxTokens: { type: Number, default: 0 },
  lastRequestTokens: { type: Object, default: () => ({}) },
  lastRequestTimestamp: { type: String, default: "" },
  collapsed: { type: Boolean, default: false },
});

defineEmits(["collapse", "expand"]);

const sectionsCollapsed = reactive({
  lastRequest: false,
  telemetry: false,
  context: false,
  performance: false,
});

function toggleSection(key) {
  sectionsCollapsed[key] = !sectionsCollapsed[key];
}

const contextUsed = computed(() => props.tokenUsage?.total || 0);
const contextPercent = computed(() => {
  if (!props.maxTokens || props.maxTokens <= 0) return 0;
  return Math.min(100, (contextUsed.value / props.maxTokens) * 100);
});
</script>

<style scoped>
.stats-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-1);
}

.stats-panel--collapsed {
  background: var(--bg-1);
}

.stats-panel__inner {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.stats-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.stats-panel__title {
  font-size: 12px;
  font-weight: 600;
  margin: 0;
  color: var(--text-1);
  letter-spacing: -0.01em;
}

.stats-panel__collapse {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  color: var(--text-3);
  transition: var(--t-fast);
}

.stats-panel__collapse:hover {
  background: var(--bg-2);
  color: var(--text-1);
}

.stats-panel__body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.stats-panel__rail {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0;
  gap: 16px;
}

.stats-panel__expand {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  color: var(--text-2);
  transition: var(--t-fast);
}

.stats-panel__expand:hover {
  background: var(--bg-2);
  color: var(--text-1);
}

.stats-panel__rail-stats {
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
  padding-top: 8px;
}

.stats-panel__rail-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.stats-panel__rail-val {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
  line-height: 1.1;
}

.stats-panel__rail-label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-3);
  font-weight: 500;
}

.tabular-nums {
  font-variant-numeric: tabular-nums;
}
</style>
