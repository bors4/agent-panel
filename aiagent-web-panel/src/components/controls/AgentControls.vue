<template>
  <div class="controls">
    <button
      class="controls__btn controls__btn--primary"
      :disabled="isRunning || !hasPath"
      :title="!hasPath ? 'Set projectPath in Settings' : 'Start agent'"
      @click="$emit('start')"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
      <span>Start</span>
    </button>
    <button
      class="controls__btn controls__btn--danger"
      :disabled="!isRunning || !hasPath"
      title="Stop agent"
      @click="$emit('stop')"
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <rect x="6" y="6" width="12" height="12" rx="1" />
      </svg>
      <span>Stop</span>
    </button>
    <button class="controls__btn" :disabled="!isRunning || !hasPath" title="Restart agent" @click="$emit('restart')">
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="23 4 23 10 17 10" />
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
      </svg>
      <span>Restart</span>
    </button>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  isRunning: { type: Boolean, default: false },
  projectPath: { type: String, default: "" },
});

defineEmits(["start", "stop", "restart"]);

const hasPath = computed(() => !!props.projectPath && props.projectPath.trim().length > 0);
</script>

<style scoped>
.controls {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.controls__btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  color: var(--text-2);
  font-size: 12px;
  font-weight: 500;
  transition: var(--t-fast);
  white-space: nowrap;
}

.controls__btn span {
  letter-spacing: 0.01em;
}

.controls__btn:hover:not(:disabled) {
  background: var(--bg-3);
  color: var(--text-1);
}

.controls__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.controls__btn--primary {
  background: var(--accent);
  color: white;
}

.controls__btn--primary:hover:not(:disabled) {
  background: var(--accent-hover);
  color: white;
}

.controls__btn--danger:hover:not(:disabled) {
  background: var(--error-soft);
  color: var(--error);
}
</style>
