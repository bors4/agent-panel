<!--
  Header — Mission Control Panel
  Верхняя панель управления с брендингом, статусом, поиском и настройками.
-->
<template>
  <header class="header">
    <div class="header__left">
      <div class="header__logo" aria-label="Mission Control">
        <span class="header__logo-icon">🚀</span>
      </div>
      <div class="header__brand">
        <h1 class="header__title">AI Agent Control Panel</h1>
        <span class="header__subtitle">{{ subtitle }}</span>
      </div>
      <span class="header__ship-designation" aria-hidden="true">NCC-AGNT</span>
    </div>

    <div class="header__right">
      <StatusBadge :status="status" />
      <GlobalSearch :active-tab="activeTab" @navigate="$emit('navigate', $event)" />
      <ThemeToggle />
    </div>

    <!-- Декоративный орбитальный элемент -->
    <div class="header__orbit" aria-hidden="true" />
  </header>
</template>

<script setup>
import { computed } from "vue";
import StatusBadge from "./StatusBadge.vue";
import ThemeToggle from "../ui/ThemeToggle.vue";
import GlobalSearch from "../ui/GlobalSearch.vue";

const props = defineProps({
  status: { type: String, default: "stopped" },
  activeTab: { type: String, default: "prompt" },
});

defineEmits(["navigate"]);

const subtitle = computed(() => {
  const labels = {
    running: "SYS://ONLINE · GALAXY LINK ESTABLISHED · TELEMETRY ACTIVE",
    stopped: "SYS://STANDBY · STARSHIP DOCKED · AWAITING COMMAND",
    error: "SYS://ALERT · NAVIGATION MALFUNCTION · SHIELDS UP",
    checking: "SYS://DIAGNOSTICS · SCANNING SECTOR · INITIALIZING",
    idle: "SYS://IDLE · DRIFTING IN ORBIT · MONITORING",
  };
  return labels[props.status] || "SYS://MISSION CONTROL";
});
</script>

<style scoped>
.header {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  min-height: 56px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  clip-path: polygon(
    0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%,
    6px 100%, 0 calc(100% - 6px)
  );
  position: relative;
  z-index: 50;
}

/* Верхняя акцентная линия */
.header::before {
  content: "";
  position: absolute;
  top: -1px;
  left: 6px;
  right: 6px;
  height: 2px;
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent-glow), 0 0 20px var(--accent-glow);
  opacity: 0.8;
}

.header__left {
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
  z-index: 1;
}

.header__right {
  display: flex;
  align-items: center;
  gap: 10px;
  position: relative;
  z-index: 1;
}

/* ─── Логотип ─── */
.header__logo {
  width: 36px;
  height: 36px;
  background: var(--glass-bg);
  border: 1px solid rgba(42, 127, 255, 0.25);
  clip-path: polygon(
    0 3px, 3px 0,
    calc(100% - 3px) 0, 100% 3px,
    100% calc(100% - 3px), calc(100% - 3px) 100%,
    3px 100%, 0 calc(100% - 3px)
  );
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.125rem;
  flex-shrink: 0;
  transition: var(--transition);
}

.header__logo:hover {
  border-color: var(--accent);
  box-shadow: var(--glow-accent-sm);
}

/* ─── Бренд ─── */
.header__brand {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.header__title {
  font-family: "Orbitron", "Space Grotesk", monospace;
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-primary);
  line-height: 1.2;
}

.header__subtitle {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--text-muted);
}

/* ─── Корабельное обозначение ─── */
.header__ship-designation {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.5rem;
  color: var(--text-muted);
  letter-spacing: 0.25em;
  opacity: 0.4;
  margin-left: 4px;
  align-self: flex-end;
  padding-bottom: 1px;
}

/* ─── Орбитальный декоративный элемент ─── */
.header__orbit {
  position: absolute;
  right: 25%;
  top: 50%;
  width: 120px;
  height: 120px;
  border: 1px solid rgba(42, 127, 255, 0.05);
  border-radius: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  z-index: 0;
}

.header__orbit::before {
  content: "";
  position: absolute;
  top: -4px;
  left: 50%;
  width: 6px;
  height: 6px;
  background: var(--accent);
  border-radius: 50%;
  opacity: 0.15;
  animation: orbitSpin 12s linear infinite;
}

.header__orbit::after {
  content: "";
  position: absolute;
  top: 50%;
  left: -4px;
  width: 4px;
  height: 4px;
  background: var(--accent-tertiary);
  border-radius: 50%;
  opacity: 0.1;
  animation: orbitSpin 8s linear infinite reverse;
}

@keyframes orbitSpin {
  from { transform: rotate(0deg) translateX(60px); }
  to { transform: rotate(360deg) translateX(60px); }
}

/* ─── Responsive ─── */
@media (max-width: 768px) {
  .header {
    padding: 8px 14px;
    flex-wrap: wrap;
    gap: 8px;
  }
  .header__title {
    font-size: 0.75rem;
  }
  .header__subtitle {
    display: none;
  }
  .header__orbit {
    display: none;
  }
}
</style>
