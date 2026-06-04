<template>
  <Card variant="terminal">
    <template #terminal-label>LOG://RECORDER</template>
    <div class="logger">
      <!-- Controls -->
      <div class="logger__controls">
        <div class="logger__search">
          <span class="logger__prompt">&gt;</span>
          <input v-model="searchQuery" type="text" placeholder="FILTER..." class="logger__input" />
          <button v-if="searchQuery" class="logger__clear" @click="searchQuery = ''">×</button>
        </div>
        <span class="logger__count">{{ filteredLogs.length }}/{{ logHistory.length }}</span>
        <Button
          variant="ghost"
          style="padding: 2px 8px; font-size: 0.55rem; min-height: 24px"
          @click="showConfirm = true"
        >
          CLEAR
        </Button>
      </div>

      <!-- Confirm Dialog -->
      <Transition name="confirm-fade">
        <div v-if="showConfirm" class="confirm-overlay" @click.self="showConfirm = false">
          <div class="confirm-dialog">
            <p>Clear all logs? Log history will be permanently deleted.</p>
            <div class="confirm-actions">
              <button class="confirm-btn cancel" @click="showConfirm = false">CANCEL</button>
              <button class="confirm-btn confirm" @click="confirmClearLogs">CLEAR</button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Log output -->
      <div ref="logContainer" class="logger__output">
        <div v-if="filteredLogs.length === 0" class="logger__empty">
          {{ searchQuery ? "// NO MATCHES" : "// LOG BUFFER EMPTY" }}
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
const showConfirm = ref(false);

const filteredLogs = computed(() => {
  if (!searchQuery.value.trim()) return logHistory.value;
  const q = searchQuery.value.toLowerCase();
  return logHistory.value.filter((l) => l.message.toLowerCase().includes(q) || l.time.toLowerCase().includes(q));
});

const confirmClearLogs = () => {
  logHistory.value = [];
  searchQuery.value = "";
  showConfirm.value = false;
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
  { deep: true, immediate: true }
);

defineExpose({
  clear: () => {
    logHistory.value = [];
  },
});
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
  clip-path: polygon(
    0 2px,
    2px 0,
    calc(100% - 2px) 0,
    100% 2px,
    100% calc(100% - 2px),
    calc(100% - 2px) 100%,
    2px 100%,
    0 calc(100% - 2px)
  );
  padding: 3px 6px;
}

.logger__prompt {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.75rem;
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
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  min-width: 60px;
}
.logger__input::placeholder {
  color: var(--text-muted);
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
.logger__clear:hover {
  color: var(--text-primary);
}

.logger__count {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.65rem;
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
  clip-path: polygon(
    0 3px,
    3px 0,
    calc(100% - 3px) 0,
    100% 3px,
    100% calc(100% - 3px),
    calc(100% - 3px) 100%,
    3px 100%,
    0 calc(100% - 3px)
  );
  font-family: "JetBrains Mono", monospace;
  font-size: 0.65rem;
  line-height: 1.6;
}

.logger__empty {
  color: var(--text-muted);
  text-align: center;
  padding: 24px;
  letter-spacing: 0.1em;
  font-size: 0.75rem;
}

.logger__line {
  display: flex;
  gap: 10px;
  padding: 1px 0;
  animation: logFadeIn 0.15s ease;
}

@keyframes logFadeIn {
  from {
    opacity: 0;
    transform: translateY(2px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.logger__time {
  color: var(--text-muted);
  white-space: nowrap;
  flex-shrink: 0;
  font-size: 0.7rem;
}

.logger__msg {
  word-break: break-all;
  font-size: 0.75rem;
}
.logger__msg--info {
  color: var(--text-secondary);
}
.logger__msg--success {
  color: var(--success);
}
.logger__msg--warning {
  color: var(--warning);
}
.logger__msg--error {
  color: var(--error);
}
.logger__msg--system {
  color: var(--accent);
}

/* Scrollbar inside output */
.logger__output::-webkit-scrollbar {
  width: 4px;
}
.logger__output::-webkit-scrollbar-track {
  background: transparent;
}
.logger__output::-webkit-scrollbar-thumb {
  background: var(--space-border);
  border-radius: 2px;
}
.logger__output::-webkit-scrollbar-thumb:hover {
  background: var(--accent);
}

/* ─── Confirm dialog ─── */
.confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s ease;
}

.confirm-dialog {
  background: var(--bg-card);
  border: 1px solid var(--border);
  padding: 24px;
  max-width: 360px;
  width: 90%;
  box-shadow: var(--shadow-lg);
  animation: dialogIn 0.2s ease;
}

.confirm-dialog p {
  color: var(--text-primary);
  margin-bottom: 20px;
  font-size: 14px;
  line-height: 1.5;
  font-family: "JetBrains Mono", monospace;
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.confirm-btn {
  padding: 8px 18px;
  border: 1px solid var(--border);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: var(--transition);
  font-family: "JetBrains Mono", monospace;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.confirm-btn.cancel {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.confirm-btn.cancel:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.confirm-btn.confirm {
  background: var(--error);
  color: white;
  border-color: var(--error);
}

.confirm-btn.confirm:hover {
  background: #dc2626;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes dialogIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.confirm-fade-enter-active,
.confirm-fade-leave-active {
  transition: opacity 0.2s ease;
}
.confirm-fade-enter-active .confirm-dialog,
.confirm-fade-leave-active .confirm-dialog {
  transition: transform 0.2s ease;
}
.confirm-fade-enter-from,
.confirm-fade-leave-to {
  opacity: 0;
}
.confirm-fade-enter-from .confirm-dialog {
  transform: scale(0.95) translateY(-8px);
}
.confirm-fade-leave-to .confirm-dialog {
  transform: scale(0.95) translateY(-8px);
}
</style>
