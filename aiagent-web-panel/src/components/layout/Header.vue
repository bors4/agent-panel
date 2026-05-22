<!--
  Шапка приложения с логотипом, статусом и навигацией.
-->
<template>
  <header class="header">
    <div class="header-left">
      <div class="logo">🤖</div>
      <div class="header-title">
        <h1>AI Agent Control Panel</h1>
        <span>Управление Telegram-ботом и AI-агентом</span>
      </div>
    </div>
    <div class="header-right">
      <StatusBadge :status="status" />
      <GlobalSearch :active-tab="activeTab" @navigate="$emit('navigate', $event)" />
      <ThemeToggle />
    </div>
  </header>
</template>

<script setup>
import StatusBadge from "./StatusBadge.vue";
import ThemeToggle from "../ui/ThemeToggle.vue";
import GlobalSearch from "../ui/GlobalSearch.vue";

defineProps({
  status: { type: String, default: "stopped" },
  activeTab: { type: String, default: "prompt" },
});

defineEmits(["navigate"]);
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
  position: relative;
  z-index: 50;
}

.header::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--gradient-accent);
  opacity: 0.8;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
  position: relative;
  z-index: 1;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
}

.logo {
  width: 42px;
  height: 42px;
  background: var(--gradient-accent);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  position: relative;
  overflow: hidden;
}

.logo::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: all 0.6s ease-out;
}

.logo:hover::after {
  width: 100%;
  height: 100%;
}

.header-title h1 {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.02em;
  background: var(--gradient-accent);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 2px;
}

.header-title span {
  font-size: 12px;
  color: var(--text-muted);
}
</style>
