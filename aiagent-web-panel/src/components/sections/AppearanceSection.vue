<template>
  <section class="settings-section">
    <header class="settings-section__header">
      <h2 class="settings-section__title">Appearance</h2>
      <p class="settings-section__desc">
        Theme and visual preferences. Theme preference is stored locally and applied immediately.
      </p>
    </header>

    <div class="settings-section__body">
      <div class="theme-group">
        <span class="theme-group__label">Theme</span>
        <div class="theme-group__options">
          <button
            v-for="opt in options"
            :key="opt.id"
            class="theme-opt"
            :class="{ 'theme-opt--active': theme === opt.id }"
            @click="setTheme(opt.id)"
          >
            <div class="theme-opt__icon" v-html="opt.icon" />
            <div class="theme-opt__label">{{ opt.label }}</div>
            <div class="theme-opt__desc">{{ opt.desc }}</div>
          </button>
        </div>
      </div>

      <div class="info-block">
        <div class="info-block__title">About themes</div>
        <p class="info-block__text">
          <strong>Dark</strong> and <strong>Light</strong> are fixed. <strong>System</strong> follows your OS preference
          via <code>prefers-color-scheme</code>.
        </p>
        <p class="info-block__text">All UI surfaces, the agent chat, and modals adapt automatically.</p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { useTheme } from "@/composables/useTheme";

const { theme, setTheme } = useTheme();

const sunIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
const moonIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
const sysIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;

const options = [
  { id: "light", label: "Light", desc: "Bright interface", icon: sunIcon },
  { id: "dark", label: "Dark", desc: "Easy on the eyes", icon: moonIcon },
  { id: "system", label: "System", desc: "Follow OS", icon: sysIcon },
];
</script>

<style scoped>
.settings-section {
  padding: 24px;
  max-width: 720px;
}

.settings-section__header {
  margin-bottom: 24px;
}

.settings-section__title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 4px;
  color: var(--text-1);
  letter-spacing: -0.01em;
}

.settings-section__desc {
  font-size: 13px;
  color: var(--text-3);
  margin: 0;
  line-height: 1.5;
}

.theme-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.theme-group__label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-2);
}

.theme-group__options {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
}

.theme-opt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px 12px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  transition: var(--t-fast);
  text-align: center;
}

.theme-opt:hover {
  border-color: var(--border-strong);
  background: var(--bg-2);
}

.theme-opt--active {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.theme-opt--active .theme-opt__icon {
  color: var(--accent);
}

.theme-opt__icon {
  color: var(--text-2);
  margin-bottom: 4px;
}

.theme-opt__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}

.theme-opt--active .theme-opt__label {
  color: var(--accent);
}

.theme-opt__desc {
  font-size: 11px;
  color: var(--text-3);
}

.info-block {
  margin-top: 16px;
  padding: 14px 16px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  border-left: 3px solid var(--accent);
}

.info-block__title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-1);
  margin-bottom: 6px;
}

.info-block__text {
  font-size: 12px;
  color: var(--text-2);
  margin: 4px 0;
  line-height: 1.5;
}

.info-block__text code {
  font-family: var(--font-mono);
  font-size: 11px;
  background: var(--bg-2);
  padding: 1px 4px;
  border-radius: var(--radius-xs);
}

@media (max-width: 700px) {
  .theme-group__options {
    grid-template-columns: 1fr;
  }
}
</style>
