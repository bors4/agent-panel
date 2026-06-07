<template>
  <section class="settings-section">
    <header class="settings-section__header">
      <h2 class="settings-section__title">Behavior</h2>
      <p class="settings-section__desc">Agent loop and inference behavior.</p>
    </header>

    <div class="settings-section__body">
      <div class="toggle-row">
        <div class="toggle-row__text">
          <span class="toggle-row__label">Streaming</span>
          <span class="toggle-row__hint">Stream tokens as they arrive (SSE)</span>
        </div>
        <ToggleSwitch :model-value="!!config.stream" @update:model-value="(v) => update('stream', v)" />
      </div>
      <div class="toggle-row">
        <div class="toggle-row__text">
          <span class="toggle-row__label">Insert user after tool</span>
          <span class="toggle-row__hint">Workaround for qwen jinja issue</span>
        </div>
        <ToggleSwitch
          :model-value="!!config.insertUserAfterTool"
          @update:model-value="(v) => update('insertUserAfterTool', v)"
        />
      </div>
      <div class="toggle-row">
        <div class="toggle-row__text">
          <span class="toggle-row__label">Verbose</span>
          <span class="toggle-row__hint">Show tool calls and reasoning in chat</span>
        </div>
        <ToggleSwitch :model-value="!!config.verbose" @update:model-value="(v) => update('verbose', v)" />
      </div>
      <div class="toggle-row">
        <div class="toggle-row__text">
          <span class="toggle-row__label">Auto-start</span>
          <span class="toggle-row__hint">Start agent automatically when the app boots</span>
        </div>
        <ToggleSwitch :model-value="!!config.autoStart" @update:model-value="(v) => update('autoStart', v)" />
      </div>
      <div class="toggle-row">
        <div class="toggle-row__text">
          <span class="toggle-row__label">Auto-save</span>
          <span class="toggle-row__hint">Show toast on auto-save</span>
        </div>
        <ToggleSwitch :model-value="!!config.autoSave" @update:model-value="(v) => update('autoSave', v)" />
      </div>

      <div class="slider-row">
        <div class="slider-row__text">
          <span class="slider-row__label">Temperature</span>
          <span class="slider-row__hint">0 = deterministic, 1.0 = balanced</span>
        </div>
        <div class="slider-row__control">
          <input
            type="range"
            min="0"
            max="1.0"
            step="0.05"
            class="slider"
            :value="config.temperature"
            @input="update('temperature', parseFloat($event.target.value))"
          />
          <span class="slider-row__val mono">{{ config.temperature.toFixed(2) }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import ToggleSwitch from "../ui/ToggleSwitch.vue";

const props = defineProps({
  config: { type: Object, required: true },
});

const emit = defineEmits(["update:config"]);

function update(key, value) {
  emit("update:config", { ...props.config, [key]: value });
}
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

.settings-section__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  gap: 12px;
}

.toggle-row__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.toggle-row__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-1);
}

.toggle-row__hint {
  font-size: 11px;
  color: var(--text-3);
}

.slider-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  margin-top: 12px;
}

.slider-row__text {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.slider-row__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-1);
}

.slider-row__hint {
  font-size: 11px;
  color: var(--text-3);
}

.slider-row__control {
  display: flex;
  align-items: center;
  gap: 12px;
}

.slider {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--bg-3);
  border-radius: var(--radius-pill);
  outline: none;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  background: var(--accent);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 0 0 4px var(--accent-soft);
}

.slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: var(--accent);
  border-radius: 50%;
  cursor: pointer;
  border: none;
  box-shadow: 0 0 0 4px var(--accent-soft);
}

.slider-row__val {
  min-width: 40px;
  text-align: right;
  font-size: 12px;
  color: var(--text-1);
  font-weight: 500;
}

.mono {
  font-family: var(--font-mono);
}
</style>
