<template>
  <Card>
    <template #header>
      <h3 class="mono-label">TLM://TELEMETRY</h3>
      <button class="refresh-btn" title="REFRESH" :aria-label="'REFRESH'" @click="$emit('refresh')">↻</button>
    </template>
    <div v-if="loading" class="skeleton-grid">
      <div class="skeleton-block" />
      <div class="skeleton-block" />
      <div class="skeleton-block" />
      <div class="skeleton-block" />
    </div>
    <div v-else class="tlm">
      <div class="tlm__grid">
        <div class="tlm__item">
          <span class="tlm__label">UPTIME</span>
          <span class="tlm__value tlm__value--green">{{ formattedUptime }}</span>
        </div>
        <div class="tlm__item">
          <span class="tlm__label">REQUESTS</span>
          <span class="tlm__value tlm__value--cyan">{{ stats.requests || 0 }}</span>
        </div>
        <div class="tlm__item">
          <span class="tlm__label">TOOLS</span>
          <span class="tlm__value tlm__value--orange">{{ stats.tools || 0 }}</span>
        </div>
        <div class="tlm__item">
          <span class="tlm__label">ERRORS</span>
          <span class="tlm__value tlm__value--red">{{ stats.errors || 0 }}</span>
        </div>
      </div>

      <!-- Success Rate -->
      <div v-if="totalRequests > 0" class="tlm__section">
        <div class="tlm__section-label">SUCCESS RATE</div>
        <div class="tlm__bar">
          <div class="tlm__bar-fill tlm__bar-success" :style="{ width: successRate + '%' }" />
          <div class="tlm__bar-fill tlm__bar-error" :style="{ width: errorRate + '%' }" />
        </div>
        <div class="tlm__bar-stats">
          <span class="tlm__bar-green">{{ successRate.toFixed(0) }}%</span>
          <span class="tlm__bar-red">{{ errorRate.toFixed(0) }}%</span>
        </div>
      </div>

      <!-- Token Usage -->
      <div v-if="showTokens && tokenUsage" class="tlm__section">
        <div class="tlm__section-label">CONTEXT</div>
        <div class="tlm__donut-row">
          <svg viewBox="0 0 100 100" class="tlm__donut">
            <circle cx="50" cy="50" r="40" fill="none" stroke="var(--space-border)" stroke-width="8" />
            <circle
              cx="50" cy="50" r="40"
              fill="none"
              :stroke="contextPercent > 90 ? 'var(--error)' : contextPercent > 70 ? 'var(--warning)' : 'var(--accent)'"
              stroke-width="8"
              :stroke-dasharray="circumference"
              :stroke-dashoffset="circumference - (circumference * contextPercent) / 100"
              transform="rotate(-90 50 50)"
              class="tlm__donut-ring"
            />
            <text x="50" y="44" text-anchor="middle" class="tlm__donut-val">{{ formatNumber(tokenUsage.total) }}</text>
            <text x="50" y="57" text-anchor="middle" class="tlm__donut-max">/{{ formatNumber(maxTokens) }}</text>
          </svg>
          <div class="tlm__bars">
            <div class="tlm__bar-row">
              <span class="tlm__bar-label">PRMPT</span>
              <div class="tlm__bar-track"><div class="tlm__bar-fill tlm__bar-cyan" :style="{ width: barPercent(tokenUsage.prompt) + '%' }" /></div>
              <span class="tlm__bar-val">{{ formatNumber(tokenUsage.prompt) }}</span>
            </div>
            <div class="tlm__bar-row">
              <span class="tlm__bar-label">CMPLT</span>
              <div class="tlm__bar-track"><div class="tlm__bar-fill tlm__bar-purple" :style="{ width: barPercent(tokenUsage.completion) + '%' }" /></div>
              <span class="tlm__bar-val">{{ formatNumber(tokenUsage.completion) }}</span>
            </div>
            <div class="tlm__bar-row">
              <span class="tlm__bar-label">CACHE</span>
              <div class="tlm__bar-track"><div v-if="cachedDisplay > 0" class="tlm__bar-fill tlm__bar-muted" :style="{ width: barPercent(cachedDisplay) + '%' }" /><span v-else class="tlm__bar-na">—</span></div>
              <span class="tlm__bar-val">{{ cachedText }}</span>
            </div>
          </div>
        </div>
        <div class="tlm__donut-footer">
          <span>USED: {{ contextPercent.toFixed(1) }}%</span>
          <span>FREE: {{ formatNumber(Math.max(0, maxTokens - tokenUsage.total)) }}</span>
        </div>
      </div>

      <!-- Performance -->
      <div class="tlm__section">
        <div class="tlm__section-label">PERFORMANCE</div>
        <template v-if="perfStats && (perfStats.prompt_n > 0 || perfStats.predicted_n > 0)">
          <div class="tlm__perf-grid">
            <div class="tlm__perf-item">
              <span class="tlm__perf-label">PROMPT</span>
              <span class="tlm__perf-val">{{ perfStats.prompt_n }}t</span>
              <span class="tlm__perf-sub">{{ perfStats.prompt_per_second.toFixed(2) }} t/s</span>
            </div>
            <div class="tlm__perf-item">
              <span class="tlm__perf-label">GEN</span>
              <span class="tlm__perf-val">{{ perfStats.predicted_n }}t</span>
              <span class="tlm__perf-sub">{{ perfStats.predicted_per_second.toFixed(2) }} t/s</span>
            </div>
          </div>
          <ul class="tlm__perf-list">
            <li>TIME: {{ formatMs(perfStats.prompt_ms) }} + {{ formatMs(perfStats.predicted_ms) }}</li>
            <li>TOTAL: {{ perfStats.prompt_n + perfStats.predicted_n }} tokens</li>
            <li>CACHE: {{ perfStats.tokens_cached }} tokens</li>
            <li v-if="perfStats.draft_n > 0">SPEC: {{ perfStats.draft_n_accepted }}/{{ perfStats.draft_n }} ({{ (perfStats.draft_acceptance_rate * 100).toFixed(1) }}%)</li>
          </ul>
        </template>
        <div v-else class="tlm__empty">AWAITING DATA...</div>
      </div>
    </div>
  </Card>
</template>

<script setup>
import { computed } from "vue";
import Card from "../ui/Card.vue";

const props = defineProps({
  uptime: { type: [String, Number], default: 0 },
  stats: { type: Object, default: () => ({}) },
  loading: { type: Boolean, default: false },
  tokenUsage: { type: Object, default: null },
  perfStats: { type: Object, default: null },
  maxTokens: { type: Number, default: 8192 },
  showTokens: { type: Boolean, default: true },
});

defineEmits(["refresh"]);

const circumference = 2 * Math.PI * 40;

const formattedUptime = computed(() => {
  const seconds = typeof props.uptime === "number" ? props.uptime : parseInt(props.uptime) || 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
});

const totalRequests = computed(() => (props.stats.requests || 0) + (props.stats.errors || 0));
const successRate = computed(() => totalRequests.value === 0 ? 100 : ((props.stats.requests || 0) / totalRequests.value) * 100);
const errorRate = computed(() => totalRequests.value === 0 ? 0 : ((props.stats.errors || 0) / totalRequests.value) * 100);
const contextPercent = computed(() => (!props.tokenUsage || props.maxTokens <= 0) ? 0 : Math.min(100, (props.tokenUsage.total / props.maxTokens) * 100));

const cachedDisplay = computed(() => props.tokenUsage?.tokensCached ?? props.tokenUsage?.cached ?? 0);
const hasAnyCache = computed(() => props.tokenUsage?.tokensCached !== undefined || props.tokenUsage?.cached !== undefined);
const cachedText = computed(() => hasAnyCache.value ? formatNumber(cachedDisplay.value) : "N/A");

function barPercent(value) {
  if (!value || props.maxTokens <= 0) return 0;
  return Math.min(100, (value / props.maxTokens) * 100);
}
function formatNumber(n) {
  if (n === undefined || n === null) return "0";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}
function formatMs(ms) {
  if (!ms) return "0ms";
  if (ms < 1000) return ms + "ms";
  return (ms / 1000).toFixed(1) + "s";
}
</script>

<style scoped>
.mono-label {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.65rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-muted);
}

.refresh-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-family: "JetBrains Mono", monospace;
  font-size: 0.7rem;
  cursor: pointer;
  padding: 2px 8px;
  clip-path: polygon(0 2px, 2px 0, calc(100% - 2px) 0, 100% 2px, 100% calc(100% - 2px), calc(100% - 2px) 100%, 2px 100%, 0 calc(100% - 2px));
  transition: var(--transition);
}
.refresh-btn:hover {
  color: var(--accent);
  border-color: var(--accent);
}

/* ═══════════════════════════════════
   TELEMETRY
   ═══════════════════════════════════ */

.tlm {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.tlm__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.tlm__item {
  background: rgba(0, 0, 0, 0.15);
  border: 1px solid var(--border);
  clip-path: polygon(0 3px, 3px 0, calc(100% - 3px) 0, 100% 3px, 100% calc(100% - 3px), calc(100% - 3px) 100%, 3px 100%, 0 calc(100% - 3px));
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.tlm__label {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.55rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-muted);
}

.tlm__value {
  font-family: "JetBrains Mono", monospace;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1;
}

.tlm__value--green { color: var(--success); text-shadow: 0 0 8px rgba(16,185,129,0.3); }
.tlm__value--cyan { color: var(--accent); text-shadow: 0 0 8px var(--accent-glow); }
.tlm__value--orange { color: var(--accent-secondary); text-shadow: 0 0 8px var(--accent-secondary-glow); }
.tlm__value--red { color: var(--error); text-shadow: 0 0 8px rgba(239,68,68,0.3); }

/* Sections */
.tlm__section {
  padding: 10px;
  background: rgba(0, 0, 0, 0.15);
  border: 1px solid var(--border);
  clip-path: polygon(0 3px, 3px 0, calc(100% - 3px) 0, 100% 3px, 100% calc(100% - 3px), calc(100% - 3px) 100%, 3px 100%, 0 calc(100% - 3px));
}

.tlm__section-label {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.55rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-muted);
  margin-bottom: 8px;
}

/* Progress Bar */
.tlm__bar {
  display: flex;
  height: 6px;
  background: var(--bg-primary);
  overflow: hidden;
}
.tlm__bar-fill { transition: width 0.5s ease; }
.tlm__bar-success { background: var(--success); }
.tlm__bar-error { background: var(--error); }

.tlm__bar-stats {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.6rem;
}
.tlm__bar-green { color: var(--success); }
.tlm__bar-red { color: var(--error); }

/* Donut */
.tlm__donut-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.tlm__donut { width: 90px; height: 90px; flex-shrink: 0; }
.tlm__donut-ring { transition: stroke-dashoffset 0.6s ease, stroke 0.3s ease; }
.tlm__donut-val { font-size: 13px; font-weight: 700; fill: var(--text-primary); font-family: "JetBrains Mono", monospace; }
.tlm__donut-max { font-size: 7px; fill: var(--text-muted); font-family: "JetBrains Mono", monospace; }

.tlm__bars { width: 100%; display: flex; flex-direction: column; gap: 6px; }

.tlm__bar-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.tlm__bar-label {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.55rem;
  color: var(--text-muted);
  min-width: 40px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.tlm__bar-track { flex: 1; height: 5px; background: var(--bg-primary); overflow: hidden; }
.tlm__bar-fill { height: 100%; transition: width 0.5s ease; }
.tlm__bar-cyan { background: var(--accent); }
.tlm__bar-purple { background: var(--accent-tertiary); }
.tlm__bar-muted { background: var(--text-muted); opacity: 0.5; }
.tlm__bar-na { font-size: 0.55rem; color: var(--text-tertiary); }
.tlm__bar-val { font-family: "JetBrains Mono", monospace; font-size: 0.6rem; color: var(--text-secondary); min-width: 30px; text-align: right; }

.tlm__donut-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid var(--border);
  font-family: "JetBrains Mono", monospace;
  font-size: 0.55rem;
  color: var(--text-muted);
}

/* Performance */
.tlm__perf-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-bottom: 8px;
}
.tlm__perf-item {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  clip-path: polygon(0 2px, 2px 0, calc(100% - 2px) 0, 100% 2px, 100% calc(100% - 2px), calc(100% - 2px) 100%, 2px 100%, 0 calc(100% - 2px));
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.tlm__perf-label { font-family: "JetBrains Mono", monospace; font-size: 0.5rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.1em; }
.tlm__perf-val { font-family: "JetBrains Mono", monospace; font-size: 0.8rem; font-weight: 600; color: var(--accent); }
.tlm__perf-sub { font-family: "JetBrains Mono", monospace; font-size: 0.55rem; color: var(--text-tertiary); }

.tlm__perf-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.tlm__perf-list li {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.55rem;
  color: var(--text-muted);
}

.tlm__empty {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.6rem;
  color: var(--text-tertiary);
  text-align: center;
  padding: 10px 0;
  letter-spacing: 0.1em;
}

/* Skeleton */
.skeleton-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.skeleton-block {
  height: 50px;
  background: rgba(0,0,0,0.2);
  border: 1px solid var(--border);
  clip-path: polygon(0 3px, 3px 0, calc(100% - 3px) 0, 100% 3px, 100% calc(100% - 3px), calc(100% - 3px) 100%, 3px 100%, 0 calc(100% - 3px));
  position: relative;
  overflow: hidden;
}
.skeleton-block::after {
  content: "";
  position: absolute;
  top: 0; left: -100%;
  width: 100%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(0,212,255,0.06), transparent);
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
</style>
