<template>
    <div :class="['status-badge', status]">
        <span class="status-dot"></span>
        <span>{{ text }}</span>
    </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
    status: { type: String, default: "stopped" },
});

const text = computed(() => {
    const map = {
        stopped: "Остановлен",
        running: "Работает",
        checking: "Проверка...",
        error: "Ошибка",
    };
    return map[props.status] || props.status;
});
</script>

<style scoped>
.status-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 14px;
    border-radius: 100px;
    font-size: 12px;
    font-weight: 600;
    transition: var(--transition);
}

.status-badge.stopped {
    background: var(--error-bg);
    color: var(--error);
    border: 1px solid rgba(239, 68, 68, 0.2);
}

.status-badge.running {
    background: var(--success-bg);
    color: var(--success);
    border: 1px solid rgba(16, 185, 129, 0.2);
}

.status-badge.checking {
    background: var(--warning-bg);
    color: var(--warning);
    border: 1px solid rgba(245, 158, 11, 0.2);
}

.status-badge.error {
    background: var(--error-bg);
    color: var(--error);
    border: 1px solid rgba(239, 68, 68, 0.3);
}

.status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: currentColor;
}

.status-badge.running .status-dot,
.status-badge.checking .status-dot {
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0%,
    100% {
        opacity: 1;
        transform: scale(1);
    }
    50% {
        opacity: 0.4;
        transform: scale(0.7);
    }
}
</style>
