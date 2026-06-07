<template>
  <div class="perf">
    <div v-if="hasData" class="perf__grid">
      <div class="perf__cell">
        <span class="perf__cell-label">Prompt</span>
        <span class="perf__cell-val tabular-nums">{{ perfStats.prompt_n }}<small>t</small></span>
        <span class="perf__cell-sub tabular-nums">{{ perfStats.prompt_per_second.toFixed(1) }} t/s</span>
      </div>
      <div class="perf__cell">
        <span class="perf__cell-label">Gen</span>
        <span class="perf__cell-val tabular-nums">{{ perfStats.predicted_n }}<small>t</small></span>
        <span class="perf__cell-sub tabular-nums">{{ perfStats.predicted_per_second.toFixed(1) }} t/s</span>
      </div>
    </div>
    <div v-else class="perf__empty">Awaiting first request</div>
    <ul v-if="hasData" class="perf__list">
      <li>
        <span class="perf__list-label">Time</span>
        <span class="perf__list-val tabular-nums"
          >{{ formatMs(perfStats.prompt_ms) }} + {{ formatMs(perfStats.predicted_ms) }}</span
        >
      </li>
      <li v-if="perfStats.tokens_cached > 0">
        <span class="perf__list-label">Cache</span>
        <span class="perf__list-val tabular-nums">{{ perfStats.tokens_cached }} tokens</span>
      </li>
      <li v-if="perfStats.draft_n > 0">
        <span class="perf__list-label">Speculative</span>
        <span class="perf__list-val tabular-nums">
          {{ perfStats.draft_n_accepted }}/{{ perfStats.draft_n }} ({{
            (perfStats.draft_acceptance_rate * 100).toFixed(0)
          }}%)
        </span>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  perfStats: { type: Object, default: () => ({}) },
});

const hasData = computed(() => props.perfStats && (props.perfStats.prompt_n > 0 || props.perfStats.predicted_n > 0));

function formatMs(ms) {
  if (!ms) return "0ms";
  if (ms < 1000) return ms + "ms";
  return (ms / 1000).toFixed(2) + "s";
}
</script>

<style scoped>
.perf {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.perf__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.perf__cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.perf__cell-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-3);
  font-weight: 500;
}

.perf__cell-val {
  font-family: var(--font-mono);
  font-size: 18px;
  font-weight: 600;
  color: var(--text-1);
  line-height: 1.1;
}

.perf__cell-val small {
  font-size: 11px;
  color: var(--text-3);
  font-weight: 500;
  margin-left: 1px;
}

.perf__cell-sub {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-2);
}

.perf__list {
  list-style: none;
  margin: 0;
  padding: 8px 10px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.perf__list li {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
}

.perf__list-label {
  color: var(--text-3);
  font-weight: 500;
}

.perf__list-val {
  font-family: var(--font-mono);
  color: var(--text-1);
}

.perf__empty {
  font-size: 12px;
  color: var(--text-3);
  font-style: italic;
  text-align: center;
  padding: 12px 0;
}

.tabular-nums {
  font-variant-numeric: tabular-nums;
}
</style>
