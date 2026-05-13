<template>
    <Card>
        <template #header>
            <h2>📊 Статистика</h2>
            <button v-if="!loading" class="refresh-btn" @click="$emit('refresh')" title="Обновить">
                🔄
            </button>
        </template>
        <div v-if="loading" class="stats-grid">
            <div class="stat-item skeleton-item">
                <div class="stat-label-skeleton"></div>
                <div class="stat-value-skeleton"></div>
            </div>
            <div class="stat-item skeleton-item">
                <div class="stat-label-skeleton"></div>
                <div class="stat-value-skeleton"></div>
            </div>
            <div class="stat-item skeleton-item">
                <div class="stat-label-skeleton"></div>
                <div class="stat-value-skeleton"></div>
            </div>
            <div class="stat-item skeleton-item">
                <div class="stat-label-skeleton"></div>
                <div class="stat-value-skeleton"></div>
            </div>
        </div>
        <div v-else class="stats-content">
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-label">Uptime</div>
                    <div class="stat-value green">{{ formattedUptime }}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Запросов</div>
                    <div class="stat-value blue">{{ stats.requests || 0 }}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Инструментов</div>
                    <div class="stat-value yellow">{{ stats.tools || 0 }}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Ошибок</div>
                    <div class="stat-value red">{{ stats.errors || 0 }}</div>
                </div>
            </div>
            <div class="stats-visualization" v-if="totalRequests > 0">
                <div class="viz-label">Успешность</div>
                <div class="progress-bar">
                    <div class="progress-fill success" :style="{ width: successRate + '%' }"></div>
                    <div class="progress-fill error" :style="{ width: errorRate + '%' }"></div>
                </div>
                <div class="viz-stats">
                    <span class="viz-success">{{ successRate.toFixed(0) }}%</span>
                    <span class="viz-error">{{ errorRate.toFixed(0) }}%</span>
                </div>
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
    loading: { type: Boolean, default: false }
});

defineEmits(["refresh"]);

const formattedUptime = computed(() => {
    const seconds = typeof props.uptime === 'number' ? props.uptime : parseInt(props.uptime) || 0;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
});

const totalRequests = computed(() => {
    return (props.stats.requests || 0) + (props.stats.errors || 0);
});

const successRate = computed(() => {
    if (totalRequests.value === 0) return 100;
    return ((props.stats.requests || 0) / totalRequests.value) * 100;
});

const errorRate = computed(() => {
    if (totalRequests.value === 0) return 0;
    return ((props.stats.errors || 0) / totalRequests.value) * 100;
});
</script>

<style scoped>
.refresh-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 14px;
    padding: 4px;
    border-radius: var(--radius-sm);
    transition: var(--transition);
    color: var(--text-muted);
}

.refresh-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
    transform: rotate(180deg);
}

.stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
}

.stat-item {
    padding: 12px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    position: relative;
    overflow: hidden;
    transition: var(--transition);
    backdrop-filter: blur(10px);
}

.stat-item::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--gradient-accent);
    opacity: 0.6;
}

.stat-item:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-sm);
    border-color: var(--border-hover);
}

.stat-label {
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 5px;
    position: relative;
    z-index: 1;
}

.stat-value {
    font-size: 16px;
    font-weight: 700;
    font-family: "JetBrains Mono", monospace;
    position: relative;
    z-index: 1;
}

.stat-value.green {
    color: var(--success);
    text-shadow: 0 0 8px rgba(16, 185, 129, 0.3);
}
.stat-value.blue {
    color: var(--accent-primary);
    text-shadow: 0 0 8px rgba(99, 102, 241, 0.3);
}
.stat-value.yellow {
    color: var(--warning);
    text-shadow: 0 0 8px rgba(245, 158, 11, 0.3);
}
.stat-value.red {
    color: var(--error);
    text-shadow: 0 0 8px rgba(239, 68, 68, 0.3);
}

.stat-value.changing {
    animation: highlight 0.6s ease-out;
}

@keyframes highlight {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.1); opacity: 0.8; }
    100% { transform: scale(1); opacity: 1; }
}

.stat-item::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 2px;
    background: var(--gradient-accent);
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.3s ease;
}

.stat-item:hover::after {
    transform: scaleX(1);
}

/* Skeleton styles */
.skeleton-item {
    min-height: 60px;
    background: var(--bg-tertiary);
}

.stat-label-skeleton,
.stat-value-skeleton {
    background: linear-gradient(90deg, var(--bg-card) 25%, var(--bg-hover) 50%, var(--bg-card) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: var(--radius-sm);
}

.stat-label-skeleton {
    height: 10px;
    width: 40%;
    margin-bottom: 8px;
}

.stat-value-skeleton {
    height: 20px;
    width: 60%;
}

@keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}

/* Visualization */
.stats-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.stats-visualization {
    padding: 12px;
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
}

.viz-label {
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 8px;
}

.progress-bar {
    display: flex;
    height: 8px;
    border-radius: 4px;
    overflow: hidden;
    background: var(--bg-card);
}

.progress-fill {
    transition: width 0.5s ease;
}

.progress-fill.success {
    background: var(--success);
}

.progress-fill.error {
    background: var(--error);
}

.viz-stats {
    display: flex;
    justify-content: space-between;
    margin-top: 6px;
    font-size: 11px;
    font-weight: 600;
}

.viz-success {
    color: var(--success);
}

.viz-error {
    color: var(--error);
}
</style>
