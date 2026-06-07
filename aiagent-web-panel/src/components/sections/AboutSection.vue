<template>
  <section class="settings-section">
    <header class="settings-section__header">
      <h2 class="settings-section__title">About</h2>
      <p class="settings-section__desc">
        AI Agent Control Panel — a self-hosted mission control for your local LLM agent.
      </p>
    </header>

    <div class="settings-section__body">
      <div class="info-card">
        <div class="info-card__row">
          <span class="info-card__label">Version</span>
          <span class="info-card__val mono">2.0.0</span>
        </div>
        <div class="info-card__row">
          <span class="info-card__label">Node</span>
          <span class="info-card__val mono">{{ nodeVersion }}</span>
        </div>
        <div class="info-card__row">
          <span class="info-card__label">Frontend</span>
          <span class="info-card__val mono">Vue 3 · Vite</span>
        </div>
        <div class="info-card__row">
          <span class="info-card__label">Backend</span>
          <span class="info-card__val mono">Express · GrammY</span>
        </div>
      </div>

      <div class="info-card">
        <div class="info-card__title">Features</div>
        <ul class="info-list">
          <li>Telegram bot with tool-calling agent loop</li>
          <li>Voice input via Web Speech API or remote whisper.cpp</li>
          <li>OpenRouter and self-hosted llama.cpp support</li>
          <li>Per-account permissions and file path restrictions</li>
          <li>Real-time telemetry via WebSocket</li>
        </ul>
      </div>

      <div class="info-card">
        <div class="info-card__title">Hotkeys</div>
        <div class="hotkey-list">
          <div class="hotkey">
            <span class="hotkey__action">Open settings</span>
            <span class="hotkey__keys"> <kbd>Ctrl</kbd><kbd>,</kbd> </span>
          </div>
          <div class="hotkey">
            <span class="hotkey__action">Open logs</span>
            <span class="hotkey__keys"> <kbd>Ctrl</kbd><kbd>`</kbd> </span>
          </div>
          <div class="hotkey">
            <span class="hotkey__action">Send message</span>
            <span class="hotkey__keys">
              <kbd>Enter</kbd>
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from "vue";

const nodeVersion = ref("—");

onMounted(() => {
  try {
    const ua = navigator.userAgent.match(/Chrome\/(\d+)/);
    nodeVersion.value = ua ? `Chrome ${ua[1]}` : navigator.platform || "Browser";
  } catch {
    /* ignore */
  }
});
</script>

<style scoped>
.settings-section {
  padding: 24px;
  max-width: 640px;
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

.settings-section__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-card {
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 16px;
}

.info-card__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 12px;
}

.info-card__row + .info-card__row {
  border-top: 1px solid var(--border-subtle);
}

.info-card__label {
  color: var(--text-3);
  font-weight: 500;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.info-card__val {
  color: var(--text-1);
  font-weight: 500;
}

.info-card__title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.info-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-list li {
  font-size: 12px;
  color: var(--text-2);
  padding-left: 14px;
  position: relative;
  line-height: 1.5;
}

.info-list li::before {
  content: "•";
  position: absolute;
  left: 4px;
  color: var(--accent);
}

.hotkey-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.hotkey {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.hotkey__action {
  color: var(--text-2);
}

.hotkey__keys {
  display: inline-flex;
  gap: 3px;
}

kbd {
  display: inline-block;
  padding: 2px 6px;
  font-family: var(--font-mono);
  font-size: 10px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-bottom-width: 2px;
  border-radius: var(--radius-xs);
  color: var(--text-1);
  font-weight: 500;
}

.mono {
  font-family: var(--font-mono);
}
</style>
