<template>
    <div class="console-container">
        <div class="console-header">
            <div class="dots">
                <div class="dot red"></div>
                <div class="dot yellow"></div>
                <div class="dot green"></div>
            </div>
            <span class="title">agent-logs</span>
            <div style="display: flex; gap: 6px; align-items: center">
                <span class="log-count">{{ logHistory.length }} строк</span>
                <Button
                    @click="$emit('clear')"
                    style="padding: 5px 10px; font-size: 10px"
                    >🗑️</Button
                >
            </div>
        </div>
        <div class="console-log" ref="logContainer">
            <div
                v-for="(log, index) in logHistory"
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
import { ref, watch, nextTick } from "vue";
import Button from "../ui/Button.vue";

const props = defineProps({
    logs: { type: Array, default: () => [] },
});

const emit = defineEmits(["clear"]);
const logContainer = ref(null);
const logHistory = ref([]);

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
            if (logContainer.value) {
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
.dot.red {
    background: #ef4444;
}
.dot.yellow {
    background: #f59e0b;
}
.dot.green {
    background: #10b981;
}

.title {
    font-size: 11px;
    color: var(--text-muted);
    font-family: "JetBrains Mono", monospace;
}

.log-count {
    font-size: 10px;
    color: var(--text-muted);
}

.console-log {
    padding: 12px;
    max-height: 360px;
    overflow-y: auto;
    font-family: "JetBrains Mono", monospace;
    font-size: 11px;
    line-height: 1.5;
}

.log-line {
    display: flex;
    gap: 8px;
    padding: 1.5px 0;
    animation: fadeIn 0.15s ease;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(3px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
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
.log-text.info {
    color: var(--text-secondary);
}
.log-text.success {
    color: var(--success);
}
.log-text.warning {
    color: var(--warning);
}
.log-text.error {
    color: var(--error);
}
.log-text.system {
    color: var(--accent);
}
</style>
