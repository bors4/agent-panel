<template>
    <Card>
        <template #header>
            <h2>📊 Статистика</h2>
        </template>
        <div class="stats-grid">
            <div class="stat-item">
                <div class="stat-label">Uptime</div>
                <div class="stat-value green">{{ uptime }}</div>
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
    </Card>
</template>

<script setup>
import Card from "../ui/Card.vue";

defineProps({
    uptime: { type: String, default: "--:--:--" },
    stats: { type: Object, default: () => ({}) },
});
</script>

<style scoped>
.stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
}

.stat-item {
    padding: 12px;
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
}

.stat-label {
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 5px;
}

.stat-value {
    font-size: 16px;
    font-weight: 700;
    font-family: "JetBrains Mono", monospace;
}

.stat-value.green {
    color: var(--success);
}
.stat-value.blue {
    color: var(--accent);
}
.stat-value.yellow {
    color: var(--warning);
}
.stat-value.red {
    color: var(--error);
}
</style>
