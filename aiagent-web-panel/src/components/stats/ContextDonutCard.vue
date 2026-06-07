<template>
  <div class="ctx">
    <div class="ctx__head">
      <svg viewBox="0 0 100 100" class="ctx__donut">
        <circle cx="50" cy="50" r="40" fill="none" stroke="var(--bg-3)" stroke-width="8" />
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          :stroke="ringColor"
          stroke-width="8"
          stroke-linecap="round"
          :stroke-dasharray="circumference"
          :stroke-dashoffset="dashOffset"
          transform="rotate(-90 50 50)"
          class="ctx__ring"
        />
        <text x="50" y="48" text-anchor="middle" class="ctx__pct tabular-nums">{{ Math.round(percent) }}%</text>
        <text x="50" y="62" text-anchor="middle" class="ctx__sub">context</text>
      </svg>
      <div class="ctx__meta">
        <div class="ctx__row">
          <span class="ctx__row-label">Used</span>
          <span class="ctx__row-val tabular-nums">{{ formatNumber(used) }}</span>
        </div>
        <div class="ctx__row">
          <span class="ctx__row-label">Max</span>
          <span class="ctx__row-val tabular-nums">{{ formatNumber(max) }}</span>
        </div>
        <div class="ctx__row">
          <span class="ctx__row-label">Free</span>
          <span class="ctx__row-val tabular-nums">{{ formatNumber(Math.max(0, max - used)) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  used: { type: Number, default: 0 },
  max: { type: Number, default: 0 },
});

const circumference = 2 * Math.PI * 40;

const percent = computed(() => {
  if (!props.max || props.max <= 0) return 0;
  return Math.min(100, (props.used / props.max) * 100);
});

const dashOffset = computed(() => circumference - (circumference * percent.value) / 100);

const ringColor = computed(() => {
  if (percent.value > 90) return "var(--error)";
  if (percent.value > 70) return "var(--warning)";
  return "var(--accent)";
});

function formatNumber(n) {
  if (n === undefined || n === null) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}
</script>

<style scoped>
.ctx {
  width: 100%;
}

.ctx__head {
  display: flex;
  align-items: center;
  gap: 16px;
}

.ctx__donut {
  width: 90px;
  height: 90px;
  flex-shrink: 0;
}

.ctx__ring {
  transition:
    stroke-dashoffset 0.6s var(--ease-out),
    stroke 0.3s var(--t);
}

.ctx__pct {
  font-size: 17px;
  font-weight: 700;
  fill: var(--text-1);
  font-family: var(--font-mono);
}

.ctx__sub {
  font-size: 7px;
  fill: var(--text-3);
  font-family: var(--font-sans);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.ctx__meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ctx__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.ctx__row-label {
  color: var(--text-3);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 500;
}

.ctx__row-val {
  font-family: var(--font-mono);
  font-weight: 500;
  color: var(--text-1);
}

.tabular-nums {
  font-variant-numeric: tabular-nums;
}
</style>
