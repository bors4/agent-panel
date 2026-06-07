<template>
  <div class="last-req">
    <div class="last-req__total">
      <span class="last-req__value tabular-nums">{{ formatNumber(total) }}</span>
      <span class="last-req__unit">tokens</span>
    </div>
    <div v-if="total > 0" class="last-req__breakdown">
      <div class="last-req__bar-row">
        <span class="last-req__bar-label">Prompt</span>
        <div class="last-req__track">
          <div class="last-req__fill last-req__fill--cyan" :style="{ width: promptPct + '%' }" />
        </div>
        <span class="last-req__bar-val tabular-nums">{{ formatNumber(prompt) }}</span>
      </div>
      <div class="last-req__bar-row">
        <span class="last-req__bar-label">Compl.</span>
        <div class="last-req__track">
          <div class="last-req__fill last-req__fill--purple" :style="{ width: completionPct + '%' }" />
        </div>
        <span class="last-req__bar-val tabular-nums">{{ formatNumber(completion) }}</span>
      </div>
      <div v-if="cached > 0" class="last-req__bar-row">
        <span class="last-req__bar-label">Cache</span>
        <div class="last-req__track">
          <div class="last-req__fill last-req__fill--muted" :style="{ width: cachedPct + '%' }" />
        </div>
        <span class="last-req__bar-val tabular-nums">{{ formatNumber(cached) }}</span>
      </div>
    </div>
    <div v-else class="last-req__empty">No requests yet</div>
    <div v-if="timestamp" class="last-req__ts">
      <span class="last-req__ts-label">Last</span>
      <span class="last-req__ts-val">{{ timestamp }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  prompt: { type: Number, default: 0 },
  completion: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  cached: { type: Number, default: 0 },
  timestamp: { type: String, default: "" },
});

const promptPct = computed(() => (props.total > 0 ? (props.prompt / props.total) * 100 : 0));
const completionPct = computed(() => (props.total > 0 ? (props.completion / props.total) * 100 : 0));
const cachedPct = computed(() => (props.total > 0 ? (props.cached / props.total) * 100 : 0));

function formatNumber(n) {
  if (n === undefined || n === null) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}
</script>

<style scoped>
.last-req {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.last-req__total {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.last-req__value {
  font-family: var(--font-mono);
  font-size: 26px;
  font-weight: 700;
  color: var(--text-1);
  letter-spacing: -0.02em;
  line-height: 1;
}

.last-req__unit {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-3);
  font-weight: 500;
}

.last-req__breakdown {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.last-req__bar-row {
  display: grid;
  grid-template-columns: 50px 1fr 48px;
  align-items: center;
  gap: 8px;
}

.last-req__bar-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-3);
  font-weight: 500;
}

.last-req__track {
  height: 4px;
  background: var(--bg-3);
  border-radius: var(--radius-pill);
  overflow: hidden;
}

.last-req__fill {
  height: 100%;
  border-radius: var(--radius-pill);
  transition: width var(--t-slow) var(--ease-out);
}

.last-req__fill--cyan {
  background: var(--accent);
}

.last-req__fill--purple {
  background: #a78bfa;
}

.last-req__fill--muted {
  background: var(--text-3);
  opacity: 0.6;
}

.last-req__bar-val {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-2);
  text-align: right;
}

.last-req__empty {
  font-size: 12px;
  color: var(--text-3);
  font-style: italic;
  padding: 6px 0;
}

.last-req__ts {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 8px;
  border-top: 1px solid var(--border-subtle);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-3);
}

.last-req__ts-label {
  font-weight: 500;
}

.last-req__ts-val {
  font-family: var(--font-mono);
  color: var(--text-2);
}

.tabular-nums {
  font-variant-numeric: tabular-nums;
}
</style>
