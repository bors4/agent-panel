<template>
    <header class="header">
        <div class="header-left">
            <div class="logo">🤖</div>
            <div class="header-title">
                <h1>AI Agent Control Panel</h1>
                <span>Управление Telegram-ботом и AI-агентом</span>
            </div>
        </div>
        <StatusBadge :status="status" />
    </header>
</template>

<script setup>
import StatusBadge from "./StatusBadge.vue";

defineProps({
    status: { type: String, default: "stopped" },
});
</script>

<style scoped>
.header {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    backdrop-filter: blur(10px);
}

.header-left {
    display: flex;
    align-items: center;
    gap: 14px;
}

.logo {
    width: 42px;
    height: 42px;
    background: linear-gradient(135deg, var(--accent), #8b5cf6);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
}

.header-title h1 {
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.02em;
}
.header-title span {
    font-size: 12px;
    color: var(--text-muted);
}
</style>
