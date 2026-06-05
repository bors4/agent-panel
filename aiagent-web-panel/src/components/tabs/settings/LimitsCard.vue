<!--
  Секция CFG://LIMITS: numeric-параметры контекста (chars, history, search, tokens, temperature).
  Двусторонний биндинг через v-model на config.
-->
<template>
  <Card>
    <template #header>
      <div class="header-row">
        <h3 class="mono-label">CFG://LIMITS</h3>
      </div>
    </template>

    <div class="form-group">
      <div class="form-label">
        <label>MAX_FILE_CHARS</label>
        <span class="hint">Макс. символов файла</span>
      </div>
      <input v-model.number="config.maxFileChars" type="number" class="form-input" min="500" max="20000" step="500" />
    </div>

    <div class="form-group">
      <div class="form-label">
        <label>MAX_HISTORY_PAIRS</label>
        <span class="hint">Пар сообщений</span>
      </div>
      <input v-model.number="config.maxHistoryPairs" type="number" class="form-input" min="2" max="20" />
    </div>

    <div class="form-group">
      <div class="form-label">
        <label>MAX_SEARCH_RESULTS</label>
        <span class="hint">Результатов поиска</span>
      </div>
      <input v-model.number="config.maxSearchResults" type="number" class="form-input" min="5" max="50" />
    </div>

    <div class="form-group">
      <div class="form-label">
        <label>MAX_SEARCH_FILE_SIZE (bytes)</label>
        <span class="hint">Макс. размер файла для поиска</span>
      </div>
      <input
        v-model.number="config.maxSearchFileSize"
        type="number"
        class="form-input"
        min="65536"
        max="10485760"
        step="65536"
      />
    </div>

    <div class="form-group">
      <div class="form-label">
        <label>MAX_FILES_IN_PROMPT</label>
        <span class="hint">Файлов в контексте</span>
      </div>
      <input v-model.number="config.maxFilesInPrompt" type="number" class="form-input" min="1" max="10" />
    </div>

    <div class="form-group">
      <div class="form-label">
        <label>TIMEOUT (мс)</label>
        <span class="hint">Таймаут запроса</span>
      </div>
      <input v-model.number="config.timeout" type="number" class="form-input" min="10000" max="3000000" step="10000" />
    </div>

    <div class="form-group">
      <div class="form-label">
        <label>MAX_TOKENS</label>
        <span class="hint">Контекст ответа</span>
      </div>
      <div class="form-number-wrapper">
        <Button style="border-radius: var(--radius-sm) 0 0 var(--radius-sm)" @click="$emit('adjust-tokens', -4096)">
          −4K
        </Button>
        <input
          v-model.number="config.maxTokens"
          type="number"
          class="form-input"
          min="256"
          max="65536"
          step="256"
          style="border-radius: 0; border-right: none; text-align: center"
        />
        <Button style="border-radius: 0 var(--radius-sm) var(--radius-sm) 0" @click="$emit('adjust-tokens', 4096)">
          +4K
        </Button>
      </div>
    </div>

    <div class="form-group">
      <div class="form-label">
        <label>TEMPERATURE</label>
        <span class="hint">Креативность (0-1)</span>
      </div>
      <input v-model.number="config.temperature" type="range" min="0" max="1" step="0.05" class="range-input" />
      <div class="range-labels">
        <span>0</span>
        <span class="range-value">{{ (config.temperature ?? 0.1).toFixed(2) }}</span>
        <span>1</span>
      </div>
    </div>
  </Card>
</template>

<script setup>
import Card from "../../ui/Card.vue";
import Button from "../../ui/Button.vue";

defineProps({
  config: { type: Object, required: true },
});

defineEmits(["adjust-tokens"]);
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

.form-input {
  width: 100%;
  padding: 6px 10px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  clip-path: polygon(
    0 2px,
    2px 0,
    calc(100% - 2px) 0,
    100% 2px,
    100% calc(100% - 3px),
    calc(100% - 2px) 100%,
    2px 100%,
    0 calc(100% - 2px)
  );
  color: var(--text-primary);
  font-size: 0.75rem;
  font-family: "JetBrains Mono", monospace;
  transition: var(--transition);
}

.form-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--glow-accent-sm);
}

.form-input::placeholder {
  color: var(--text-muted);
}

.form-number-wrapper {
  display: flex;
  align-items: center;
}

.form-number-wrapper :deep(.btn) {
  clip-path: none !important;
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
