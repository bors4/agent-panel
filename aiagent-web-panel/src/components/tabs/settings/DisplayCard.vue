<!--
  Секция CFG://DISPLAY: тумблеры отображения + громкость.
  Двусторонний биндинг через v-model на config.
-->
<template>
  <Card>
    <template #header>
      <div class="header-row">
        <h3 class="mono-label">CFG://DISPLAY</h3>
      </div>
    </template>

    <div class="form-group">
      <div class="form-label">
        <label>SHOW TOKENS</label>
        <span class="hint">Показывать счётчик токенов</span>
      </div>
      <div class="toggle-control">
        <label class="toggle-switch">
          <input v-model="config.showTokens" type="checkbox" />
          <span class="toggle-slider" />
        </label>
      </div>
    </div>

    <div class="form-group">
      <div class="form-label">
        <label>SOUND</label>
        <span class="hint">Звуковые уведомления</span>
      </div>
      <div class="toggle-control">
        <label class="toggle-switch">
          <input v-model="config.soundEnabled" type="checkbox" />
          <span class="toggle-slider" />
        </label>
      </div>
    </div>

    <div v-if="config.soundEnabled" class="form-group">
      <div class="form-label">
        <label>VOLUME</label>
        <span class="hint">{{ config.soundVolume }}%</span>
      </div>
      <input
        v-model.number="config.soundVolume"
        type="range"
        min="0"
        max="100"
        step="5"
        class="range-input"
      />
      <div class="range-labels">
        <span>0</span>
        <span class="range-value">{{ config.soundVolume }}%</span>
        <span>100</span>
      </div>
    </div>
  </Card>
</template>

<script setup>
import Card from "../../ui/Card.vue";

defineProps({
  config: { type: Object, required: true },
});
</script>

<style scoped>
.mono-label {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.65rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-muted);
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.form-group {
  margin-bottom: 10px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.form-label label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.form-label .hint {
  font-size: 11px;
  color: var(--text-muted);
}

.toggle-control {
  display: flex;
  justify-content: flex-end;
  padding: 4px 0;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
  cursor: pointer;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  inset: 0;
  background: var(--bg-tertiary);
  border-radius: 22px;
  border: 1px solid var(--border);
  transition: var(--transition);
}

.toggle-slider::before {
  content: "";
  position: absolute;
  left: 3px;
  bottom: 3px;
  width: 14px;
  height: 14px;
  background: var(--text-muted);
  border-radius: 50%;
  transition: var(--transition);
}

.toggle-switch input:checked + .toggle-slider {
  background: var(--accent);
  border-color: var(--accent);
}

.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(18px);
  background: white;
}

.range-input {
  width: 100%;
  accent-color: var(--accent);
  background: var(--bg-card);
}

.range-labels {
  display: flex;
  justify-content: space-between;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.65rem;
  color: var(--text-muted);
  margin-top: 2px;
}

.range-value {
  color: var(--accent);
  font-weight: 600;
}
</style>
