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
        idle: "Отключен",
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
    border-radius: var(--radius-md);
    font-size: 12px;
    font-weight: 600;
    transition: var(--transition);
    position: relative;
    overflow: hidden;
}

.status-badge::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: radial-gradient(circle at center, transparent 0%, rgba(255, 255, 255, 0.1) 100%);
    opacity: 0;
    transition: opacity 0.3s ease;
}

.status-badge:hover::before {
    opacity: 1;
}

.status-badge.stopped {
    background: var(--error-bg);
    color: var(--error);
    border: 1px solid var(--error-border);
    position: relative;
}

.status-badge.running {
    background: linear-gradient(135deg, var(--success-bg), var(--glass-bg));
    color: var(--success);
    border: 1px solid var(--success-border);
    position: relative;
}

.status-badge.running::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--success);
    animation: pulse 2s infinite;
}

.status-badge.checking {
    background: linear-gradient(135deg, var(--warning-bg), var(--glass-bg));
    color: var(--warning);
    border: 1px solid var(--warning-border);
    position: relative;
}

.status-badge.checking::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--warning);
    animation: shimmer 1.5s infinite;
}

.status-badge.error {
    background: linear-gradient(135deg, var(--error-bg), rgba(239, 68, 68, 0.05));
    color: var(--error);
    border: 1px solid var(--error-border);
    position: relative;
}

.status-badge.error::after {
    content: "⚠️";
    margin-left: 4px;
    animation: shake 0.5s ease-in-out infinite;
}

.status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: currentColor;
    transition: var(--transition);
    position: relative;
}

.status-badge.running .status-dot,
.status-badge.checking .status-dot {
    animation: pulse-dot 2s infinite;
    box-shadow: 0 0 8px currentColor;
}

.status-badge.idle {
    background: var(--bg-card);
    color: var(--text-muted);
    border: 1px solid var(--border);
    backdrop-filter: blur(5px);
}

@keyframes pulse-dot {
    0%,
    100% {
        opacity: 1;
        transform: scale(1);
        box-shadow: 0 0 8px currentColor;
    }
    50% {
        opacity: 0.4;
        transform: scale(0.7);
        box-shadow: none;
    }
}

@keyframes shake {
    0%, 100% {
        transform: translateX(0);
    }
    25% {
        transform: translateX(-1px);
    }
    75% {
        transform: translateX(1px);
    }
}
</style>
