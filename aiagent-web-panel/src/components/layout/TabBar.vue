<!--
  TabBar — горизонтальная навигация по вкладкам основного контента.
  Управляется через v-model:activeTab.
-->
<template>
  <div class="tabs" role="tablist" aria-label="Навигация по разделам">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      :class="['tab', { active: activeTab === tab.id }]"
      role="tab"
      :aria-selected="activeTab === tab.id"
      :aria-controls="`panel-${tab.id}`"
      @click="$emit('update:activeTab', tab.id)"
    >
      <span class="tab__indicator" aria-hidden="true">{{ tab.symbol }}</span>
      {{ tab.label }}
    </button>
  </div>
</template>

<script setup>
defineProps({
  tabs: { type: Array, required: true },
  activeTab: { type: String, required: true },
});

defineEmits(["update:activeTab"]);
</script>

<style scoped>
.tabs {
  display: flex;
  gap: 2px;
  padding: 3px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  clip-path: polygon(
    0 4px,
    4px 0,
    calc(100% - 4px) 0,
    100% 4px,
    100% calc(100% - 4px),
    calc(100% - 4px) 100%,
    4px 100%,
    0 calc(100% - 4px)
  );
  flex-wrap: wrap;
  position: relative;
}

.tabs::after {
  content: "";
  position: absolute;
  bottom: -1px;
  left: 4px;
  right: 4px;
  height: 1px;
  background: var(--accent);
  opacity: 0.2;
}

.tab {
  padding: 7px 14px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-family: "JetBrains Mono", monospace;
  font-size: 0.65rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  clip-path: polygon(
    0 2px,
    2px 0,
    calc(100% - 2px) 0,
    100% 2px,
    100% calc(100% - 2px),
    calc(100% - 2px) 100%,
    2px 100%,
    0 calc(100% - 2px)
  );
}

.tab:hover:not(.active) {
  color: var(--text-secondary);
  background: rgba(42, 127, 255, 0.05);
}

.tab.active {
  background: rgba(42, 127, 255, 0.1);
  color: var(--accent);
  border: 1px solid rgba(42, 127, 255, 0.2);
  box-shadow: 0 0 6px rgba(42, 127, 255, 0.06);
}

.tab__indicator {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.7rem;
  font-weight: 700;
  opacity: 0.5;
  transition: opacity 0.2s ease;
}

.tab.active .tab__indicator {
  opacity: 1;
  color: var(--accent);
}

@media (max-width: 640px) {
  .tabs {
    overflow-x: auto;
    flex-wrap: nowrap;
    -webkit-overflow-scrolling: touch;
  }
  .tab {
    padding: 6px 10px;
    font-size: 0.6rem;
    flex-shrink: 0;
  }
}
</style>
