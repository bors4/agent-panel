<template>
  <AppModal :model-value="modelValue" size="full" title="Logs" @update:model-value="$emit('update:modelValue', $event)">
    <div class="logs-modal">
      <div class="logs-modal__toolbar">
        <div class="logs-modal__filters">
          <button
            v-for="f in filters"
            :key="f.id"
            class="logs-modal__filter"
            :class="{ 'logs-modal__filter--active': activeFilter === f.id }"
            @click="activeFilter = f.id"
          >
            {{ f.label }}
            <span v-if="f.count" class="logs-modal__filter-count">{{ f.count }}</span>
          </button>
        </div>
        <div class="logs-modal__actions">
          <button class="logs-modal__icon-btn" title="Copy all" @click="copyAll">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
          <button class="logs-modal__icon-btn logs-modal__icon-btn--danger" title="Clear" @click="$emit('clear')">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
            </svg>
          </button>
        </div>
      </div>
      <div ref="consoleEl" class="logs-modal__console">
        <div v-if="filteredLogs.length === 0" class="logs-modal__empty">No logs</div>
        <div v-for="(log, i) in filteredLogs" :key="i" class="log-line" :class="`log-line--${log.type || 'info'}`">
          <span class="log-line__ts">{{ formatTime(log.timestamp) }}</span>
          <span class="log-line__type">{{ log.type || "info" }}</span>
          <span class="log-line__msg">{{ log.message }}</span>
        </div>
      </div>
    </div>
  </AppModal>
</template>

<script setup>
import { ref, computed, watch, nextTick } from "vue";
import AppModal from "./AppModal.vue";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  logs: { type: Array, default: () => [] },
});

defineEmits(["update:modelValue", "clear"]);

const activeFilter = ref("all");
const consoleEl = ref(null);

const filters = computed(() => {
  const all = props.logs.length;
  const err = props.logs.filter((l) => l.type === "error").length;
  const warn = props.logs.filter((l) => l.type === "warning").length;
  const success = props.logs.filter((l) => l.type === "success").length;
  return [
    { id: "all", label: "All", count: all },
    { id: "error", label: "Errors", count: err },
    { id: "warning", label: "Warnings", count: warn },
    { id: "success", label: "Success", count: success },
  ];
});

const filteredLogs = computed(() => {
  if (activeFilter.value === "all") return props.logs;
  return props.logs.filter((l) => l.type === activeFilter.value);
});

function formatTime(ts) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-GB", { hour12: false }) + "." + String(d.getMilliseconds()).padStart(3, "0");
  } catch {
    return String(ts);
  }
}

async function copyAll() {
  try {
    const text = filteredLogs.value
      .map((l) => `${formatTime(l.timestamp)} [${l.type || "info"}] ${l.message}`)
      .join("\n");
    await navigator.clipboard.writeText(text);
  } catch (e) {
    console.error(e);
  }
}

watch(
  () => props.logs.length,
  async () => {
    if (!props.modelValue) return;
    await nextTick();
    if (consoleEl.value) {
      consoleEl.value.scrollTop = consoleEl.value.scrollHeight;
    }
  }
);
</script>

<style scoped>
.logs-modal {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  background: var(--bg-0);
}

.logs-modal__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-1);
  flex-shrink: 0;
  gap: 12px;
}

.logs-modal__filters {
  display: flex;
  gap: 2px;
}

.logs-modal__filter {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 500;
  color: var(--text-3);
  background: transparent;
  transition: var(--t-fast);
}

.logs-modal__filter:hover {
  color: var(--text-1);
  background: var(--bg-2);
}

.logs-modal__filter--active {
  background: var(--accent-soft);
  color: var(--accent);
}

.logs-modal__filter-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 16px;
  padding: 0 5px;
  border-radius: var(--radius-pill);
  background: var(--bg-3);
  font-size: 10px;
  font-weight: 600;
  color: var(--text-2);
}

.logs-modal__filter--active .logs-modal__filter-count {
  background: var(--accent);
  color: white;
}

.logs-modal__actions {
  display: flex;
  gap: 4px;
}

.logs-modal__icon-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  color: var(--text-3);
  background: var(--bg-2);
  border: 1px solid var(--border);
  transition: var(--t-fast);
}

.logs-modal__icon-btn:hover {
  background: var(--bg-3);
  color: var(--text-1);
  border-color: var(--border-strong);
}

.logs-modal__icon-btn--danger:hover {
  background: var(--error-soft);
  color: var(--error);
  border-color: var(--error-soft);
}

.logs-modal__console {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 16px;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.6;
  background: var(--bg-0);
}

.logs-modal__empty {
  color: var(--text-3);
  font-style: italic;
  text-align: center;
  padding: 40px;
}

.log-line {
  display: grid;
  grid-template-columns: 100px 70px 1fr;
  gap: 8px;
  padding: 2px 0;
  word-break: break-all;
}

.log-line__ts {
  color: var(--text-3);
  font-size: 11px;
}

.log-line__type {
  font-weight: 600;
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: 0.05em;
  align-self: center;
}

.log-line__msg {
  white-space: pre-wrap;
  color: var(--text-1);
}

.log-line--info .log-line__type {
  color: var(--accent);
}
.log-line--success .log-line__type {
  color: var(--success);
}
.log-line--warning .log-line__type {
  color: var(--warning);
}
.log-line--error .log-line__type {
  color: var(--error);
}
.log-line--system .log-line__type {
  color: var(--text-3);
}
</style>
