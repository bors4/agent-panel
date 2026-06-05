<!--
  Секция CFG://CONFIG: токен, projectPath, API-bases, modelName, OpenRouter, ASR.
  Эмитит события для действий (browse, save-path, refresh, test-asr и т.д.),
  остальные поля — двусторонний биндинг через v-model на config.
-->
<template>
  <Card>
    <template #header>
      <div class="header-row">
        <h3 class="mono-label">CFG://CONFIG</h3>
      </div>
    </template>

    <div class="form-group">
      <div class="form-label">
        <label>TELEGRAM_TOKEN</label>
        <span class="hint">Токен из @BotFather</span>
      </div>
      <div class="token-input-wrapper">
        <input
          v-model="config.token"
          :type="tokenVisible ? 'text' : 'password'"
          class="form-input"
          placeholder="123456789:AAH..."
        />
        <button class="token-toggle" @click="$emit('update:tokenVisible', !tokenVisible)">
          {{ tokenVisible ? "HIDE" : "SHOW" }}
        </button>
      </div>
      <span v-if="hasToken" class="token-ok">[TOKEN SET]</span>
      <span v-else class="token-missing">[NO TOKEN]</span>
    </div>

    <div class="form-group">
      <div class="form-label">
        <label>PROJECT_PATH</label>
        <span class="hint">Путь к проекту</span>
      </div>
      <div class="project-path-row">
        <input
          :value="projectPathDraft"
          type="text"
          class="form-input"
          placeholder="C:\path\to\project"
          @input="onProjectPathInput"
          @blur="$emit('check-path')"
        />
        <Button variant="ghost" @click="$emit('browse')">BROWSE</Button>
        <Button @click="$emit('save-path')">SAVE PATH</Button>
      </div>
      <p v-if="pathError" class="path-error">{{ pathError }}</p>
    </div>

    <div class="form-group">
      <div class="form-label">
        <label>API-BASE</label>
        <span class="hint">Адреса AI серверов</span>
      </div>
      <div class="api-base-table">
        <div class="table-header">
          <span class="col-url">API-base</span>
          <span class="col-connect">Connect</span>
          <button class="btn-add" @click="$emit('add-api-base')">+</button>
        </div>
        <div v-for="(api, index) in apiBases" :key="index" class="table-row">
          <input
            v-model="apiBases[index].url"
            type="text"
            class="form-input col-url"
            placeholder="http://192.168.1.101:8080/v1"
            @blur="$emit('sync-api-bases')"
          />
          <label class="col-connect">
            <input v-model="apiBases[index].connected" type="checkbox" @change="$emit('sync-api-bases')" />
          </label>
          <button class="btn-remove" @click="$emit('remove-api-base', index)">×</button>
        </div>
      </div>
    </div>

    <div class="form-group">
      <div class="form-label">
        <label>MODEL_NAME</label>
        <span class="hint">Выберите модель</span>
      </div>
      <input
        :value="modelFilter"
        type="text"
        class="form-input"
        placeholder="Фильтр моделей..."
        style="margin-bottom: 6px"
        @input="onModelFilterInput"
      />
      <div class="model-name-row">
        <select :value="modelName" class="form-input" @change="onModelNameChange">
          <option value="" disabled>Выберите модель</option>
          <option v-for="model in filteredModels" :key="model.id" :value="model.id">
            {{ model.id }} ({{ model.source }})
          </option>
        </select>
        <Button
          class="btn-refresh-models"
          :disabled="loadingStates.models"
          :loading="loadingStates.models"
          @click="$emit('refresh-models')"
        >
          REFRESH
        </Button>
      </div>
      <p v-if="filteredModels.length === 0" class="model-error">Модели недоступны. Проверь подключение к серверу.</p>
    </div>

    <div class="form-group">
      <div class="form-label">
        <label>OPENROUTER_API_KEY</label>
        <span class="hint">Ключ API OpenRouter (опционально)</span>
      </div>
      <div class="token-input-wrapper">
        <input
          v-model="config.openrouterApiKey"
          :type="orKeyVisible ? 'text' : 'password'"
          class="form-input"
          placeholder="sk-or-v1-..."
        />
        <button class="token-toggle" @click="$emit('update:orKeyVisible', !orKeyVisible)">
          {{ orKeyVisible ? "HIDE" : "SHOW" }}
        </button>
      </div>
    </div>

    <div v-if="config.openrouterApiKey" class="form-group">
      <div class="form-label">
        <label>OpenRouter модели</label>
        <span class="hint">Загрузить модели из OpenRouter</span>
      </div>
      <div class="openrouter-row">
        <Button
          class="btn-refresh-models"
          :disabled="loadingStates.openrouterModels"
          :loading="loadingStates.openrouterModels"
          @click="$emit('load-openrouter')"
        >
          LOAD OPENROUTER
        </Button>
      </div>
    </div>

    <div class="form-group">
      <div class="form-label">
        <label>ASR_SERVER_URL</label>
        <span class="hint">URL ASR сервера (whisper.cpp / faster-whisper)</span>
      </div>
      <div class="asr-row">
        <input v-model="config.asrServerUrl" type="text" class="form-input" placeholder="http://192.168.1.103:8081" />
        <Button
          :disabled="!config.asrServerUrl || loadingStates.asrTest"
          :loading="loadingStates.asrTest"
          @click="$emit('test-asr')"
        >
          TEST
        </Button>
      </div>
      <span v-if="asrStatus" :class="asrStatus.reachable ? 'token-ok' : 'token-missing'">
        {{ asrStatus.reachable ? "[CONNECTED]" : "[UNREACHABLE]" }}
      </span>
      <span class="hint">Для голосовых сообщений Telegram. Оставьте пустым для Web Speech API.</span>
    </div>
  </Card>
</template>

<script setup>
import Card from "../../ui/Card.vue";
import Button from "../../ui/Button.vue";

defineProps({
  config: { type: Object, required: true },
  apiBases: { type: Array, required: true },
  modelName: { type: String, required: true },
  modelFilter: { type: String, required: true },
  filteredModels: { type: Array, required: true },
  projectPathDraft: { type: String, required: true },
  pathError: { type: String, required: true },
  tokenVisible: { type: Boolean, required: true },
  orKeyVisible: { type: Boolean, required: true },
  hasToken: { type: Boolean, required: true },
  loadingStates: { type: Object, required: true },
  asrStatus: { type: Object, default: null },
});

const emit = defineEmits([
  "browse",
  "save-path",
  "check-path",
  "add-api-base",
  "remove-api-base",
  "sync-api-bases",
  "refresh-models",
  "load-openrouter",
  "test-asr",
  "update:tokenVisible",
  "update:orKeyVisible",
  "update:pathError",
  "update:projectPathDraft",
  "update:modelFilter",
  "update:modelName",
]);

function onProjectPathInput(event) {
  emit("update:projectPathDraft", event.target.value);
  emit("update:pathError", "");
}

function onModelFilterInput(event) {
  emit("update:modelFilter", event.target.value);
}

function onModelNameChange(event) {
  emit("update:modelName", event.target.value);
}
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

.api-base-table {
  border: 1px solid var(--border);
  clip-path: polygon(
    0 3px,
    3px 0,
    calc(100% - 3px) 0,
    100% 3px,
    100% calc(100% - 3px),
    calc(100% - 3px) 100%,
    3px 100%,
    0 calc(100% - 3px)
  );
  overflow: hidden;
}

.table-header {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  background: var(--bg-card);
  font-family: "JetBrains Mono", monospace;
  font-size: 0.65rem;
  font-weight: 500;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  gap: 6px;
}

.table-row {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  gap: 6px;
  border-top: 1px solid var(--border);
}

.col-url {
  flex: 1;
}

.col-connect {
  width: 50px;
  text-align: center;
}

.btn-add,
.btn-remove {
  width: 24px;
  height: 24px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text-secondary);
  clip-path: polygon(
    0 2px,
    2px 0,
    calc(100% - 2px) 0,
    100% 2px,
    100% calc(100% - 2px),
    calc(100% - 2px) 100%,
    2px 100%,
    0 calc(100% - 2px)
  );
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
}

.btn-add:hover,
.btn-remove:hover {
  background: var(--accent);
  color: var(--space-black);
  border-color: var(--accent);
}

.model-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.model-name-row .form-input {
  flex: 1;
}

.btn-refresh-models {
  flex-shrink: 0;
}

.openrouter-row {
  display: flex;
  justify-content: flex-end;
}

.asr-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.asr-row .form-input {
  flex: 1;
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
    100% calc(100% - 2px),
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

select.form-input {
  cursor: pointer;
}

.token-input-wrapper {
  position: relative;
}

.token-input-wrapper .form-input {
  padding-right: 32px;
}

.token-toggle {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px 6px;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.55rem;
  letter-spacing: 0.05em;
  clip-path: polygon(
    0 2px,
    2px 0,
    calc(100% - 2px) 0,
    100% 2px,
    100% calc(100% - 2px),
    calc(100% - 2px) 100%,
    2px 100%,
    0 calc(100% - 2px)
  );
  transition: var(--transition);
}

.model-error {
  color: var(--error);
  font-family: "JetBrains Mono", monospace;
  font-size: 0.7rem;
  margin-top: 6px;
}

.project-path-row {
  display: flex;
  gap: 6px;
  align-items: stretch;
}

.project-path-row .form-input {
  flex: 1;
}

.path-error {
  color: var(--error);
  font-family: "JetBrains Mono", monospace;
  font-size: 0.7rem;
  margin-top: 4px;
}

.token-ok {
  color: var(--success);
  font-family: "JetBrains Mono", monospace;
  font-size: 0.7rem;
  margin-top: 4px;
  display: block;
}

.token-missing {
  color: var(--text-muted);
  font-family: "JetBrains Mono", monospace;
  font-size: 0.7rem;
  margin-top: 4px;
  display: block;
}
</style>
