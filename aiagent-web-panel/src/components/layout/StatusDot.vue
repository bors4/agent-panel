<template>
  <div class="status-dot" :class="`status-dot--${status}`" :title="label">
    <span class="status-dot__circle" />
    <span v-if="showLabel" class="status-dot__label">{{ label }}</span>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  status: { type: String, default: "stopped" },
  showLabel: { type: Boolean, default: true },
});

const label = computed(() => {
  const map = {
    running: "Online",
    stopped: "Offline",
    idle: "Idle",
    error: "Error",
    checking: "Checking",
  };
  return map[props.status] || props.status;
});
</script>

<style scoped>
.status-dot {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px 5px 10px;
  border-radius: var(--radius-pill);
  background: var(--bg-2);
  border: 1px solid var(--border);
  font-size: 12px;
  font-weight: 500;
  user-select: none;
}

.status-dot__circle {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--text-3);
  box-shadow: 0 0 0 0 transparent;
  transition:
    background var(--t),
    box-shadow var(--t);
}

.status-dot__label {
  color: var(--text-2);
  letter-spacing: 0.01em;
}

.status-dot--running .status-dot__circle {
  background: var(--success);
  box-shadow: 0 0 0 3px var(--success-soft);
  animation: pulse-dot 2s ease-in-out infinite;
}

.status-dot--running .status-dot__label {
  color: var(--success);
}

.status-dot--error .status-dot__circle {
  background: var(--error);
  box-shadow: 0 0 0 3px var(--error-soft);
  animation: pulse-dot 1s ease-in-out infinite;
}

.status-dot--error .status-dot__label {
  color: var(--error);
}

.status-dot--checking .status-dot__circle {
  background: var(--warning);
  box-shadow: 0 0 0 3px var(--warning-soft);
  animation: pulse-dot 0.8s ease-in-out infinite;
}

.status-dot--checking .status-dot__label {
  color: var(--warning);
}

.status-dot--idle .status-dot__circle {
  background: var(--text-3);
}

.status-dot--stopped .status-dot__circle {
  background: var(--error);
  opacity: 0.7;
}

.status-dot--stopped .status-dot__label {
  color: var(--text-3);
}
</style>
