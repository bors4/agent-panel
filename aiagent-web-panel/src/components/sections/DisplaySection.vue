<template>
  <section class="settings-section">
    <header class="settings-section__header">
      <h2 class="settings-section__title">Display</h2>
      <p class="settings-section__desc">UI feedback and notifications.</p>
    </header>

    <div class="settings-section__body">
      <div class="toggle-row">
        <div class="toggle-row__text">
          <span class="toggle-row__label">Show tokens</span>
          <span class="toggle-row__hint">Display token usage per message in chat</span>
        </div>
        <ToggleSwitch :model-value="!!config.showTokens" @update:model-value="(v) => update('showTokens', v)" />
      </div>
      <div class="toggle-row">
        <div class="toggle-row__text">
          <span class="toggle-row__label">Sound notifications</span>
          <span class="toggle-row__hint">Play a sound when the agent finishes</span>
        </div>
        <ToggleSwitch :model-value="!!config.soundEnabled" @update:model-value="(v) => update('soundEnabled', v)" />
      </div>

      <div v-if="config.soundEnabled" class="slider-row">
        <div class="slider-row__text">
          <span class="slider-row__label">Volume</span>
        </div>
        <div class="slider-row__control">
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            class="slider"
            :value="config.soundVolume"
            @input="update('soundVolume', parseInt($event.target.value))"
          />
          <span class="slider-row__val mono">{{ config.soundVolume }}%</span>
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
  margin-top: 8px;
}

.slider-row__text {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
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
