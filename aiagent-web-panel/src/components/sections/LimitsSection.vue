<template>
  <section class="settings-section">
    <header class="settings-section__header">
      <h2 class="settings-section__title">Limits</h2>
      <p class="settings-section__desc">Numerical limits for context, history, and search behavior.</p>
    </header>

    <div class="settings-section__body">
      <div class="limit-grid">
        <div class="limit">
          <label class="limit__label">maxTokens</label>
          <input
            type="number"
            min="256"
            max="200000"
            step="256"
            class="limit__input"
            :value="config.maxTokens"
            @input="update('maxTokens', parseInt($event.target.value) || 1024)"
          />
          <span class="limit__hint">Max tokens in context window</span>
        </div>
        <div class="limit">
          <label class="limit__label">maxHistoryPairs</label>
          <input
            type="number"
            min="0"
            max="50"
            class="limit__input"
            :value="config.maxHistoryPairs"
            @input="update('maxHistoryPairs', parseInt($event.target.value) || 0)"
          />
          <span class="limit__hint">User/assistant message pairs kept in history</span>
        </div>
        <div class="limit">
          <label class="limit__label">maxFileChars</label>
          <input
            type="number"
            min="500"
            step="100"
            class="limit__input"
            :value="config.maxFileChars"
            @input="update('maxFileChars', parseInt($event.target.value) || 2000)"
          />
          <span class="limit__hint">Max characters per file in prompt</span>
        </div>
        <div class="limit">
          <label class="limit__label">maxSearchResults</label>
          <input
            type="number"
            min="1"
            max="100"
            class="limit__input"
            :value="config.maxSearchResults"
            @input="update('maxSearchResults', parseInt($event.target.value) || 15)"
          />
          <span class="limit__hint">Max results per search</span>
        </div>
        <div class="limit">
          <label class="limit__label">maxFilesInPrompt</label>
          <input
            type="number"
            min="1"
            max="20"
            class="limit__input"
            :value="config.maxFilesInPrompt"
            @input="update('maxFilesInPrompt', parseInt($event.target.value) || 2)"
          />
          <span class="limit__hint">Max files included per request</span>
        </div>
        <div class="limit">
          <label class="limit__label">timeout (ms)</label>
          <input
            type="number"
            min="5000"
            step="1000"
            class="limit__input"
            :value="config.timeout"
            @input="update('timeout', parseInt($event.target.value) || 300000)"
          />
          <span class="limit__hint">HTTP timeout for AI server</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
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

.limit-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.limit {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.limit__label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-2);
}

.limit__input {
  padding: 8px 12px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-1);
  font-size: 13px;
  font-family: var(--font-mono);
  outline: none;
  transition: var(--t-fast);
}

.limit__input:focus {
  border-color: var(--accent);
  box-shadow: var(--accent-glow);
}

.limit__hint {
  font-size: 11px;
  color: var(--text-3);
}

@media (max-width: 700px) {
  .limit-grid {
    grid-template-columns: 1fr;
  }
}
</style>
