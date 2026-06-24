<template>
  <section class="settings-section">
    <header class="settings-section__header">
      <h2 class="settings-section__title">Parameters</h2>
      <p class="settings-section__desc">
        Telegram bot token, project path, API endpoints, model selection, and ASR (voice transcription).
      </p>
    </header>

    <div class="settings-section__body">
      <div class="field">
        <label class="field__label">
          TELEGRAM_TOKEN
          <span class="field__hint">From @BotFather</span>
        </label>
        <div class="field__row">
          <input
            :value="config.token"
            :type="tokenVisible ? 'text' : 'password'"
            class="field__input"
            placeholder="123456789:AAH..."
            @input="update('token', $event.target.value)"
          />
          <button class="field__btn" @click="tokenVisible = !tokenVisible">
            {{ tokenVisible ? "Hide" : "Show" }}
          </button>
          <button
            class="field__btn field__btn--test"
            :class="{ 'field__btn--loading': tgChecking }"
            :disabled="!hasToken || tgChecking"
            :title="hasToken ? 'Test connection to Telegram' : 'Enter token first'"
            data-test="telegram-test-btn"
            @click="onTestTelegram"
          >
            <svg
              v-if="!tgChecking"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <svg
              v-else
              class="field__spinner"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M21 12a9 9 0 11-6.219-8.56" />
            </svg>
            <span class="field__btn-label">{{ tgChecking ? "Checking…" : "Test" }}</span>
          </button>
        </div>
        <div class="telegram-status" :class="`telegram-status--${tgCheckState}`" data-test="telegram-status">
          <span v-if="tgCheckState === 'success' && tgBotInfo" class="field__status field__status--ok">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Connected as
            <a
              v-if="tgBotInfo.username"
              :href="`https://t.me/${tgBotInfo.username}`"
              target="_blank"
              rel="noopener noreferrer"
              class="telegram-status__link"
              >@{{ tgBotInfo.username }}</a
            >
            <span v-else class="mono">{{ tgBotInfo.first_name }}</span>
          </span>
          <span v-else-if="tgCheckState === 'error'" class="field__status field__status--err">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            {{ tgErrorMessage || "Unreachable" }}
          </span>
          <span v-else-if="tgCheckState === 'loading'" class="field__status field__status--loading">Checking…</span>
          <span v-else-if="hasToken" class="field__status field__status--muted">Not tested</span>
          <span v-else class="field__status field__status--warn">No token</span>
        </div>
      </div>

      <div class="field">
        <label class="field__label">
          PROJECT_PATH
          <span class="field__hint">Working directory for the agent</span>
        </label>
        <div class="field__row">
          <input
            :value="config.projectPath"
            type="text"
            class="field__input"
            placeholder="C:\path\to\project"
            @input="update('projectPath', $event.target.value)"
          />
          <button class="field__btn" @click="$emit('browse')">Browse</button>
        </div>
      </div>

      <div class="field">
        <label class="field__label">
          API-BASE
          <span class="field__hint">AI server endpoints</span>
        </label>
        <div class="api-table">
          <div class="api-table__head">
            <span>URL</span>
            <span>Active</span>
            <span></span>
          </div>
          <div v-for="(api, i) in apiBases" :key="i" class="api-table__row">
            <input
              v-model="apiBases[i].url"
              type="text"
              class="field__input"
              placeholder="http://192.168.1.101:8080/v1"
            />
            <label class="api-table__check">
              <input v-model="apiBases[i].connected" type="checkbox" />
            </label>
            <button class="api-table__remove" title="Remove" @click="$emit('remove-api-base', i)">×</button>
          </div>
          <button class="api-table__add" @click="$emit('add-api-base')">+ Add endpoint</button>
        </div>
      </div>

      <div class="field">
        <label class="field__label">
          MODEL_NAME
          <span class="field__hint">Select from the server's loaded models</span>
        </label>
        <div class="field__row">
          <select :value="modelName" class="field__input" @change="updateModelName($event.target.value)">
            <option value="" disabled>Select a model…</option>
            <option v-for="m in filteredModels" :key="m.id" :value="m.id">{{ m.id }} ({{ m.source }})</option>
          </select>
          <button class="field__btn" @click="$emit('refresh-models')">Refresh</button>
        </div>
        <div class="field__row" style="margin-top: 6px">
          <input
            v-model="modelFilter"
            type="text"
            class="field__input"
            placeholder="Filter models by id or source…"
          />
        </div>
        <p v-if="availableModels.length === 0" class="field__error">
          No models available. Check connection to the server.
        </p>
        <p v-else-if="modelContextLength" class="field__hint">
          Context: {{ modelContextLength.toLocaleString() }} tokens
        </p>
      </div>

      <div class="field">
        <label class="field__label">
          OPENROUTER_API_KEY
          <span class="field__hint">Optional — for OpenRouter models</span>
        </label>
        <div class="field__row">
          <input
            :value="config.openrouterApiKey"
            :type="orKeyVisible ? 'text' : 'password'"
            class="field__input"
            placeholder="sk-or-v1-..."
            @input="update('openrouterApiKey', $event.target.value)"
          />
          <button class="field__btn" @click="orKeyVisible = !orKeyVisible">
            {{ orKeyVisible ? "Hide" : "Show" }}
          </button>
        </div>
        <button v-if="config.openrouterApiKey" class="field__btn-link" @click="$emit('load-openrouter')">
          Load OpenRouter models
        </button>
      </div>

      <div class="field">
        <label class="field__label">
          ASR_SERVER_URL
          <span class="field__hint">Remote whisper.cpp endpoint for voice</span>
        </label>
        <div class="field__row">
          <input
            :value="config.asrServerUrl"
            type="text"
            class="field__input"
            placeholder="http://192.168.1.103:8081 (empty = Web Speech API)"
            @input="update('asrServerUrl', $event.target.value)"
          />
          <button class="field__btn" :disabled="!config.asrServerUrl" @click="$emit('test-asr')">Test</button>
        </div>
        <span v-if="asrStatus" :class="asrStatus.reachable ? 'field__status--ok' : 'field__status--err'">
          {{ asrStatus.reachable ? "Connected" : "Unreachable" }}
        </span>
      </div>

      <div class="field">
        <label class="field__label">
          ASR_LANGUAGE
          <span class="field__hint">ISO 639-1 (ru, en, de…)</span>
        </label>
        <input
          :value="config.asrLanguage"
          type="text"
          class="field__input"
          maxlength="5"
          placeholder="ru"
          @input="update('asrLanguage', $event.target.value)"
        />
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed } from "vue";
import { useTelegramCheck } from "@/composables/useTelegramCheck";

const props = defineProps({
  config: { type: Object, required: true },
  apiBases: { type: Array, required: true },
  modelName: { type: String, required: true },
  availableModels: { type: Array, default: () => [] },
  modelContextLength: { type: Number, default: 0 },
  asrStatus: { type: Object, default: null },
});

const emit = defineEmits([
  "update:config",
  "update:api-bases",
  "update:model-name",
  "browse",
  "add-api-base",
  "remove-api-base",
  "refresh-models",
  "load-openrouter",
  "test-asr",
]);

const tokenVisible = ref(false);
const orKeyVisible = ref(false);
const modelFilter = ref("");

const filteredModels = computed(() => {
  const q = modelFilter.value.toLowerCase().trim();
  if (!q) return props.availableModels;
  return props.availableModels.filter((m) => m.id.toLowerCase().includes(q) || (m.source || "").toLowerCase().includes(q));
});

const hasToken = computed(() => !!props.config.token && props.config.token.trim().length > 0);

const { checking: tgChecking, checkState: tgCheckState, botInfo: tgBotInfo, errorMessage: tgErrorMessage, checkBot: tgCheckBot } =
  useTelegramCheck();

function onTestTelegram() {
  tgCheckBot(props.config.token);
}

function update(key, value) {
  emit("update:config", { ...props.config, [key]: value });
}

function updateModelName(value) {
  emit("update:model-name", value);
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
  gap: 20px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field__label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-2);
}

.field__hint {
  font-size: 11px;
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  color: var(--text-3);
}

.field__row {
  display: flex;
  gap: 6px;
}

.field__input {
  flex: 1;
  min-width: 0;
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

.field__input::placeholder {
  color: var(--text-3);
}

.field__input:focus {
  border-color: var(--accent);
  box-shadow: var(--accent-glow);
}

select.field__input {
  font-family: var(--font-sans);
}

.field__btn {
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  background: var(--bg-2);
  border: 1px solid var(--border);
  color: var(--text-2);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: var(--t-fast);
  white-space: nowrap;
  flex-shrink: 0;
}

.field__btn:hover:not(:disabled) {
  background: var(--bg-3);
  color: var(--text-1);
  border-color: var(--border-strong);
}

.field__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.field__btn-link {
  align-self: flex-start;
  font-size: 11px;
  color: var(--accent);
  font-weight: 500;
  padding: 4px 0;
}

.field__btn-link:hover {
  text-decoration: underline;
}

.field__status {
  font-size: 11px;
  font-family: var(--font-mono);
}

.field__status--ok {
  color: var(--success);
}
.field__status--warn {
  color: var(--text-3);
}
.field__status--err {
  color: var(--error);
}

.field__error {
  font-size: 11px;
  color: var(--error);
  font-family: var(--font-mono);
  margin: 4px 0 0;
}

.field__btn--test {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--accent);
  border-color: var(--accent-soft);
  background: var(--accent-soft);
}

.field__btn--test:hover:not(:disabled) {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.field__btn--loading {
  cursor: progress;
  color: var(--accent);
  background: var(--accent-soft);
  border-color: var(--accent-soft);
}

.field__btn-label {
  font-size: 11px;
}

.field__spinner {
  animation: tg-spin 0.9s linear infinite;
}

@keyframes tg-spin {
  to {
    transform: rotate(360deg);
  }
}

.telegram-status {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
  min-height: 16px;
  flex-wrap: wrap;
}

.telegram-status .field__status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.field__status--muted {
  color: var(--text-3);
  font-style: italic;
}

.field__status--loading {
  color: var(--accent);
}

.telegram-status__link {
  color: var(--accent);
  text-decoration: none;
  font-weight: 500;
}

.telegram-status__link:hover {
  text-decoration: underline;
}

.api-table {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--bg-1);
}

.api-table__head {
  display: grid;
  grid-template-columns: 1fr 60px 36px;
  gap: 8px;
  padding: 6px 12px;
  background: var(--bg-2);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-3);
  font-weight: 600;
  border-bottom: 1px solid var(--border);
}

.api-table__row {
  display: grid;
  grid-template-columns: 1fr 60px 36px;
  gap: 8px;
  padding: 6px 8px;
  align-items: center;
  border-bottom: 1px solid var(--border-subtle);
}

.api-table__row:last-of-type {
  border-bottom: none;
}

.api-table__row .field__input {
  background: var(--bg-1);
  border: 1px solid transparent;
}

.api-table__row .field__input:hover {
  border-color: var(--border);
}

.api-table__check {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.api-table__check input {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--accent);
}

.api-table__remove {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-xs);
  background: var(--bg-2);
  color: var(--text-3);
  font-size: 14px;
  transition: var(--t-fast);
}

.api-table__remove:hover {
  background: var(--error-soft);
  color: var(--error);
}

.api-table__add {
  padding: 6px 12px;
  font-size: 11px;
  color: var(--accent);
  background: transparent;
  border-top: 1px solid var(--border-subtle);
  text-align: left;
  font-weight: 500;
  transition: var(--t-fast);
}

.api-table__add:hover {
  background: var(--accent-soft);
}
</style>
