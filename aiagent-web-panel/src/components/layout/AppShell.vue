<template>
  <a class="skip-link" href="#main-content">Skip to content</a>
  <div class="app-shell">
    <TopBar :status="status" :logs-active="logsOpen" :settings-active="settingsOpen" @action="handleTopAction" />

    <main id="main-content" class="app-shell__main">
      <div v-if="$slots.controls" class="app-shell__controls">
        <slot name="controls" />
      </div>

      <div class="app-shell__chat">
        <slot name="chat" />
      </div>

      <div class="app-shell__stats" :class="{ 'app-shell__stats--collapsed': statsCollapsed }">
        <slot name="stats" :collapsed="statsCollapsed" />
      </div>
    </main>

    <Teleport to="body">
      <slot name="settings-modal" />
      <slot name="logs-modal" />
    </Teleport>

    <slot name="toasts" />
  </div>
</template>

<script setup>
import TopBar from "./TopBar.vue";

defineProps({
  status: { type: String, default: "stopped" },
  statsCollapsed: { type: Boolean, default: false },
  logsOpen: { type: Boolean, default: false },
  settingsOpen: { type: Boolean, default: false },
});

const emit = defineEmits(["toggle-stats", "top-action"]);

function handleTopAction(id) {
  emit("top-action", id);
}
</script>

<style scoped>
.app-shell {
  height: 100vh;
  width: 100vw;
  display: grid;
  grid-template-rows: var(--topbar-h) 1fr;
  background: var(--gradient-bg);
  position: relative;
  overflow: hidden;
}

.app-shell__main {
  display: grid;
  grid-template-columns: 1fr var(--stats-w);
  grid-template-rows: auto 1fr;
  min-height: 0;
  overflow: hidden;
  transition: grid-template-columns var(--t-slow) var(--ease-out);
}

.app-shell__controls {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: var(--bg-1);
  border-bottom: 1px solid var(--border);
  min-height: 56px;
  flex-shrink: 0;
}

.app-shell__chat {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
}

.app-shell__stats {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--bg-1);
  display: flex;
  flex-direction: column;
  transition: var(--t);
}

.app-shell__stats--collapsed {
  grid-column: 2;
  background: var(--bg-1);
}

.app-shell:has(.app-shell__stats--collapsed) .app-shell__main {
  grid-template-columns: 1fr var(--stats-w-collapsed);
}

@media (max-width: 900px) {
  .app-shell__main {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr auto;
  }

  .app-shell__chat {
    border-right: none;
    border-bottom: 1px solid var(--border);
  }

  .app-shell:has(.app-shell__stats--collapsed) .app-shell__main {
    grid-template-rows: auto 1fr var(--stats-w-collapsed);
  }
}
</style>
