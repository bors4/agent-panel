<template>
    <div class="console-container">
        <div class="console-header">
            <div class="dots">
                <div class="dot red"></div>
                <div class="dot yellow"></div>
                <div class="dot green"></div>
            </div>
            <span class="title">agent-logs</span>
            <div class="header-actions">
                <div class="search-box">
                    <input
                        v-model="searchQuery"
                        type="text"
                        placeholder="Поиск..."
                        class="search-input"
                    />
                    <button v-if="searchQuery" class="clear-search" @click="searchQuery = ''">
                        ×
                    </button>
                </div>
                <span class="log-count">{{ filteredLogs.length }} / {{ logHistory.length }} строк</span>
                <Button @click="clearLogs" style="padding: 5px 10px; font-size: 10px">
                    🗑️
                </Button>
            </div>
        </div>
        <div class="console-log" ref="logContainer">
            <div v-if="filteredLogs.length === 0" class="no-logs">
                <span v-if="searchQuery">Ничего не найдено</span>
                <span v-else>Логи пусты</span>
            </div>
            <div
                v-for="(log, index) in filteredLogs"
                :key="index"
                class="log-line"
            >
                <span class="log-time">[{{ log.time }}]</span>
                <span :class="['log-text', log.type]">{{ log.message }}</span>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from "vue";
import Button from "../ui/Button.vue";

const props = defineProps({
    logs: { type: Array, default: () => [] },
});

const emit = defineEmits(["clear"]);
const logContainer = ref(null);
const logHistory = ref([]);
const searchQuery = ref("");

const filteredLogs = computed(() => {
    if (!searchQuery.value.trim()) {
        return logHistory.value;
    }
    const query = searchQuery.value.toLowerCase();
    return logHistory.value.filter(log => 
        log.message.toLowerCase().includes(query) ||
        log.time.toLowerCase().includes(query)
    );
});

const clearLogs = () => {
    logHistory.value = [];
    searchQuery.value = "";
    emit("clear");
};

watch(
    () => props.logs,
    (newLogs) => {
        newLogs.forEach((log) => {
            if (
                !logHistory.value.some(
                    (l) => l.time === log.time && l.message === log.message,
                )
            ) {
                logHistory.value.push(log);
            }
        });

        nextTick(() => {
            if (logContainer.value && !searchQuery.value) {
                logContainer.value.scrollTop = logContainer.value.scrollHeight;
            }
        });
    },
    { deep: true },
);

defineExpose({
    clear: () => {
        logHistory.value = [];
    },
});
</script>

<style scoped>
.console-container {
    background: #000;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    overflow: hidden;
}

.console-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 9px 12px;
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border);
    gap: 8px;
    flex-wrap: wrap;
}

.dots {
    display: flex;
    gap: 5px;
}
.dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
}
.dot.red { background: #ef4444; }
.dot.yellow { background: #f59e0b; }
.dot.green { background: #10b981; }

.title {
    font-size: 11px;
    color: var(--text-muted);
    font-family: "JetBrains Mono", monospace;
}

.header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
}

.search-box {
    position: relative;
    display: flex;
    align-items: center;
}

.search-input {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 4px 20px 4px 8px;
    font-size: 10px;
    color: var(--text-primary);
    width: 120px;
    transition: var(--transition);
    font-family: inherit;
}

.search-input:focus {
    outline: none;
    border-color: var(--accent-primary);
    width: 180px;
}

.search-input::placeholder {
    color: var(--text-muted);
}

.clear-search {
    position: absolute;
    right: 4px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 14px;
    padding: 2px;
    line-height: 1;
}

.clear-search:hover {
    color: var(--text-primary);
}

.log-count {
    font-size: 10px;
    color: var(--text-muted);
    white-space: nowrap;
}

.console-log {
    padding: 12px;
    max-height: 360px;
    overflow-y: auto;
    font-family: "JetBrains Mono", monospace;
    font-size: 11px;
    line-height: 1.5;
}

.no-logs {
    color: var(--text-muted);
    text-align: center;
    padding: 20px;
    font-style: italic;
}

.log-line {
    display: flex;
    gap: 8px;
    padding: 1.5px 0;
    animation: fadeIn 0.15s ease;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(3px); }
    to { opacity: 1; transform: translateY(0); }
}

.log-time {
    color: var(--text-muted);
    white-space: nowrap;
    flex-shrink: 0;
    font-size: 10px;
}

.log-text {
    word-break: break-all;
}
.log-text.info { color: var(--text-secondary); }
.log-text.success { color: var(--success); }
.log-text.warning { color: var(--warning); }
.log-text.error { color: var(--error); }
.log-text.system { color: var(--accent-primary); }
</style>
