<template>
  <header class="topbar">
    <div class="topbar__left">
      <div class="topbar__brand">
        <div class="topbar__logo" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L13.5 7.5L19 9L13.5 10.5L12 16L10.5 10.5L5 9L10.5 7.5L12 2Z" fill="currentColor" />
            <circle cx="18" cy="18" r="2.5" fill="currentColor" opacity="0.7" />
            <circle cx="6" cy="17" r="1.8" fill="currentColor" opacity="0.5" />
          </svg>
        </div>
        <div class="topbar__title">
          <span class="topbar__name">AI Agent</span>
          <span class="topbar__sub">Control Panel</span>
        </div>
      </div>
      <StatusDot :status="status" class="topbar__status" />
    </div>

    <div class="topbar__right">
      <button
        v-for="action in actions"
        :key="action.id"
        class="topbar__btn"
        :class="{ 'topbar__btn--active': action.active, 'topbar__btn--has-badge': action.badge }"
        :title="action.title"
        :aria-label="action.title"
        @click="$emit('action', action.id)"
      >
        <component :is="action.icon" class="topbar__icon" />
        <span v-if="action.badge" class="topbar__badge">{{ action.badge }}</span>
      </button>
    </div>
  </header>
</template>

<script setup>
import { h } from "vue";
import StatusDot from "./StatusDot.vue";

const IconLogs = () =>
  h(
    "svg",
    {
      width: 16,
      height: 16,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    },
    [h("polyline", { points: "4 17 10 11 4 5" }), h("line", { x1: "12", y1: "19", x2: "20", y2: "19" })]
  );

const IconSettings = () =>
  h(
    "svg",
    {
      width: 16,
      height: 16,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    },
    [
      h("circle", { cx: 12, cy: 12, r: 3 }),
      h("path", {
        d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z",
      }),
    ]
  );

defineProps({
  status: { type: String, default: "stopped" },
  logsActive: { type: Boolean, default: false },
  settingsActive: { type: Boolean, default: false },
  pendingLogs: { type: Number, default: 0 },
});

defineEmits(["action"]);

const actions = [
  { id: "logs", title: "Logs (Ctrl+`)", icon: IconLogs, active: false, badge: 0 },
  { id: "settings", title: "Settings (Ctrl+,)", icon: IconSettings, active: false, badge: 0 },
];
</script>

<style scoped>
.topbar {
  height: var(--topbar-h);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: var(--bg-glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
  position: relative;
  z-index: var(--z-sticky);
}

.topbar__left,
.topbar__right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.topbar__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-right: 12px;
  margin-right: 4px;
  border-right: 1px solid var(--border);
  height: 28px;
}

.topbar__logo {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  background: var(--gradient-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
  box-shadow: var(--shadow-glow);
}

.topbar__title {
  display: flex;
  flex-direction: column;
  gap: 0;
  line-height: 1.1;
}

.topbar__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
  letter-spacing: -0.01em;
}

.topbar__sub {
  font-size: 10px;
  color: var(--text-3);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.topbar__status {
  margin-left: 4px;
}

.topbar__btn {
  position: relative;
  width: 34px;
  height: 34px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-2);
  transition:
    background var(--t),
    color var(--t);
}

.topbar__btn:hover {
  background: var(--bg-2);
  color: var(--text-1);
}

.topbar__btn--active {
  background: var(--accent-soft);
  color: var(--accent);
}

.topbar__btn--active:hover {
  background: var(--accent-soft-2);
}

.topbar__icon {
  width: 16px;
  height: 16px;
}

.topbar__badge {
  position: absolute;
  top: 4px;
  right: 4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: var(--radius-pill);
  background: var(--error);
  color: white;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

@media (max-width: 640px) {
  .topbar__sub {
    display: none;
  }
  .topbar__brand {
    border-right: none;
    padding-right: 0;
    margin-right: 0;
  }
}
</style>
