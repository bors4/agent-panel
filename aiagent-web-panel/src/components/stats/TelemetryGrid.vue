<template>
  <div class="telemetry-grid">
    <div v-for="item in items" :key="item.label" class="telemetry-grid__cell">
      <span class="telemetry-grid__value tabular-nums" :style="item.valueStyle">
        {{ item.value }}
      </span>
      <span class="telemetry-grid__label">{{ item.label }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  uptime: { type: [String, Number], default: 0 },
  stats: { type: Object, default: () => ({}) },
});

function formatUptime(seconds) {
  const s = typeof seconds === "number" ? seconds : parseInt(seconds) || 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

const items = computed(() => [
  { label: "Uptime", value: formatUptime(props.uptime), valueStyle: "color: var(--success);" },
  { label: "Requests", value: props.stats.requests || 0, valueStyle: "color: var(--accent);" },
  { label: "Tools", value: props.stats.tools || 0, valueStyle: "color: var(--warning);" },
  { label: "Errors", value: props.stats.errors || 0, valueStyle: "color: var(--error);" },
]);
</script>

<style scoped>
.telemetry-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.telemetry-grid__cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  transition: var(--t);
}

.telemetry-grid__cell:hover {
  border-color: var(--border-strong);
}

.telemetry-grid__value {
  font-family: var(--font-mono);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.telemetry-grid__label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-3);
  font-weight: 500;
}

.tabular-nums {
  font-variant-numeric: tabular-nums;
}
</style>
