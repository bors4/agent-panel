<template>
  <Card variant="terminal">
    <template #terminal-label>LOG://RECORDER</template>
    <div class="logger">
      <!-- Controls -->
      <div class="logger__controls">
        <div class="logger__search">
          <span class="logger__prompt">&gt;</span>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="FILTER..."
            class="logger__input"
          />
          <button v-if="searchQuery" class="logger__clear" @click="searchQuery = ''">×</button>
        </div>
        <span class="logger__count">{{ filteredLogs.length }}/{{ logHistory.length }}</span>
        <Button variant="ghost" style="padding: 2px 8px; font-size: 0.55rem; min-height: 24px;" @click="clearLogs">
          CLEAR
        </Button>
      </div>

      <!-- Log output -->
      <div ref="logContainer" class="logger__output">
        <div v-if="filteredLogs.length === 0" class="logger__empty">
          {{ searchQuery ? '// NO MATCHES' : '// LOG BUFFER EMPTY' }}
          <span class="cursor-blink" />
        </div>
        <div v-for="(log, index) in filteredLogs" :key="index" class="logger__line">
          <span class="logger__time">{{ log.time }}</span>
          <span class="logger__msg" :class="`logger__msg--${log.type}`">{{ log.message }}</span>
        </div>
      </div>
    </div>
  </Card>
</template>

<script setup>
import { ref, computed, watch, nextTick } from "vue";
import Button from "../ui/Button.vue";
import Card from "../ui/Card.vue";

const props = defineProps({ logs: { type: Array, default: () => [] } });
const emit = defineEmits(["clear"]);

const logContainer = ref(null);
const logHistory = ref([]);
const searchQuery = ref("");

const filteredLogs = computed(() => {
  if (!searchQuery.value.trim()) return logHistory.value;
  const q = searchQuery.value.toLowerCase();
  return logHistory.value.filter(l => l.message.toLowerCase().includes(q) || l.time.toLowerCase().includes(q));
});

const clearLogs = () => {
  logHistory.value = [];
  searchQuery.value = "";
  emit("clear");
};

watch(
  () => props.logs,
  (newLogs) => {
    if (newLogs.length === 0) {
      logHistory.value = [];
      searchQuery.value = "";
      return;
    }
    newLogs.forEach((log) => {
      if (!logHistory.value.some((l) => l.time === log.time && l.message === log.message)) {
        logHistory.value.push(log);
      }
    });
    nextTick(() => {
      if (logContainer.value && !searchQuery.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight;
      }
    });
  },
  { deep: true }
);

defineExpose({ clear: () => { logHistory.value = []; } });
</script>

<style scoped>
.logger {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* ─── Controls bar ─── */
.logger__controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.logger__search {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  clip-path: polygon(0 2px, 2px 0, calc(100% - 2px) 0, 100% 2px, 100% calc(100% - 2px), calc(100% - 2px) 100%, 2px 100%, 0 calc(100% - 2px));
  padding: 3px 6px;
}

.logger__prompt {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.6rem;
  color: var(--accent);
  opacity: 0.6;
  flex-shrink: 0;
}

.logger__input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-family: "JetBrains Mono", monospace;
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  min-width: 60px;
}
.logger__input::placeholder {
  color: var(--text-tertiary);
  letter-spacing: 0.1em;
}

.logger__clear {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.8rem;
  padding: 0 2px;
  line-height: 1;
}
.logger__clear:hover { color: var(--text-primary); }

.logger__count {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.55rem;
  color: var(--text-muted);
  white-space: nowrap;
  flex-shrink: 0;
}

/* ─── Output ─── */
.logger__output {
  padding: 8px;
  max-height: 340px;
  overflow-y: auto;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  clip-path: polygon(0 3px, 3px 0, calc(100% - 3px) 0, 100% 3px, 100% calc(100% - 3px), calc(100% - 3px) 100%, 3px 100%, 0 calc(100% - 3px));
  font-family: "JetBrains Mono", monospace;
  font-size: 0.65rem;
  line-height: 1.6;
}

.logger__empty {
  color: var(--text-tertiary);
  text-align: center;
  padding: 24px;
  letter-spacing: 0.1em;
}

.logger__line {
  display: flex;
  gap: 10px;
  padding: 1px 0;
  animation: logFadeIn 0.15s ease;
}

@keyframes logFadeIn {
  from { opacity: 0; transform: translateY(2px); }
  to { opacity: 1; transform: translateY(0); }
}

.logger__time {
  color: var(--text-tertiary);
  white-space: nowrap;
  flex-shrink: 0;
  font-size: 0.6rem;
}

.logger__msg {
  word-break: break-all;
  font-size: 0.65rem;
}
.logger__msg--info    { color: var(--text-secondary); }
.logger__msg--success { color: var(--success); }
.logger__msg--warning { color: var(--warning); }
.logger__msg--error   { color: var(--error); }
.logger__msg--system  { color: var(--accent); }

/* Scrollbar inside output */
.logger__output::-webkit-scrollbar { width: 4px; }
.logger__output::-webkit-scrollbar-track { background: transparent; }
.logger__output::-webkit-scrollbar-thumb { background: var(--space-border); border-radius: 2px; }
.logger__output::-webkit-scrollbar-thumb:hover { background: var(--accent); }
</style>
