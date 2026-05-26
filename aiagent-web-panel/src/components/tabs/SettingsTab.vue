<template>
  <div class="settings-tab">
  <Card>
    <template #header>
      <div class="header-row">
        <h2>Основные параметры</h2>
      </div>
    </template>
    <div class="form-group">
      <div class="form-label">
        <label>TELEGRAM_TOKEN</label>
        <span class="hint">Токен из @BotFather</span>
      </div>
      <div class="token-input-wrapper">
        <input
          v-model="configCopy.token"
          :type="tokenVisible ? 'text' : 'password'"
          class="form-input"
          placeholder="123456789:AAH..."
        />
        <button class="token-toggle" @click="tokenVisible = !tokenVisible">
          {{ tokenVisible ? "🔒" : "👁️" }}
        </button>
      </div>
    </div>
    <div class="form-group">
      <div class="form-label">
        <label>PROJECT_PATH</label>
        <span class="hint">Путь к проекту</span>
      </div>
      <div class="project-path-row">
        <input v-model="projectPathDraft" type="text" class="form-input" placeholder="C:\path\to\project" @input="pathError = ''" @blur="checkProjectPath" />
        <Button @click="handleSaveProjectPath">💾 Сохранить путь</Button>
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
          <button class="btn-add" @click="addApiBase">+</button>
        </div>
        <div v-for="(api, index) in apiBasesCopy" :key="index" class="table-row">
          <input
            v-model="apiBasesCopy[index].url"
            type="text"
            class="form-input col-url"
            placeholder="http://192.168.1.101:8080/v1"
            @blur="syncApiBases"
          />
          <label class="col-connect">
            <input v-model="apiBasesCopy[index].connected" type="checkbox" @change="syncApiBases" />
          </label>
          <button class="btn-remove" @click="removeApiBase(index)">×</button>
        </div>
      </div>
    </div>
    <div class="form-group">
      <div class="form-label">
        <label>MODEL_NAME</label>
        <span class="hint">Выберите модель</span>
      </div>
      <div class="model-name-row">
        <select v-model="modelNameCopy" class="form-input">
          <option value="" disabled>Выберите модель</option>
          <option v-for="model in availableModels" :key="model.id" :value="model.id">
            {{ model.id }} ({{ model.source }})
          </option>
        </select>
        <Button
          class="btn-refresh-models"
          :disabled="loadingStates.models"
          @click="handleRefreshModels"
        >
          <span v-if="loadingStates.models" class="btn-loading" />
          <span v-else>🔄 Обновить список</span>
        </Button>
      </div>
      <p v-if="availableModels.length === 0" class="model-error">Модели недоступны. Проверь подключение к серверу.</p>
    </div>
  </Card>

  <Card>
    <template #header>
      <div class="header-row">
        <h2>Лимиты и производительность</h2>
      </div>
    </template>
    <div class="form-group">
      <div class="form-label">
        <label>MAX_FILE_CHARS</label>
        <span class="hint">Макс. символов файла</span>
      </div>
      <input
        v-model.number="configCopy.maxFileChars"
        type="number"
        class="form-input"
        min="500"
        max="20000"
        step="500"
      />
    </div>
    <div class="form-group">
      <div class="form-label">
        <label>MAX_HISTORY_PAIRS</label>
        <span class="hint">Пар сообщений</span>
      </div>
      <input v-model.number="configCopy.maxHistoryPairs" type="number" class="form-input" min="2" max="20" />
    </div>
    <div class="form-group">
      <div class="form-label">
        <label>MAX_SEARCH_RESULTS</label>
        <span class="hint">Результатов поиска</span>
      </div>
      <input v-model.number="configCopy.maxSearchResults" type="number" class="form-input" min="5" max="50" />
    </div>
    <div class="form-group">
      <div class="form-label">
        <label>MAX_FILES_IN_PROMPT</label>
        <span class="hint">Файлов в контексте</span>
      </div>
      <input v-model.number="configCopy.maxFilesInPrompt" type="number" class="form-input" min="1" max="10" />
    </div>
    <div class="form-group">
      <div class="form-label">
        <label>TIMEOUT (мс)</label>
        <span class="hint">Таймаут запроса</span>
      </div>
      <input
        v-model.number="configCopy.timeout"
        type="number"
        class="form-input"
        min="10000"
        max="3000000"
        step="10000"
      />
    </div>
    <div class="form-group">
      <div class="form-label">
        <label>MAX_TOKENS</label>
        <span class="hint">Контекст ответа</span>
      </div>
      <div class="form-number-wrapper">
        <Button style="border-radius: var(--radius-sm) 0 0 var(--radius-sm)" @click="adjustTokens(-4096)">
          −4K
        </Button>
        <input
          v-model.number="configCopy.maxTokens"
          type="number"
          class="form-input"
          min="256"
          max="65536"
          step="256"
          style="border-radius: 0; border-right: none; text-align: center"
        />
        <Button style="border-radius: 0 var(--radius-sm) var(--radius-sm) 0" @click="adjustTokens(4096)">
          +4K
        </Button>
      </div>
    </div>
    <div class="form-group">
      <div class="form-label">
        <label>TEMPERATURE</label>
        <span class="hint">Креативность (0-1)</span>
      </div>
      <input v-model.number="configCopy.temperature" type="range" min="0" max="1" step="0.05" class="range-input" />
      <div class="range-labels">
        <span>0</span>
        <span class="range-value">{{ (configCopy.temperature ?? 0.1).toFixed(2) }}</span>
        <span>1</span>
      </div>
    </div>
  </Card>

  <Card>
    <template #header>
      <div class="header-row">
        <h2>Потоковый вывод</h2>
      </div>
    </template>
    <div class="form-group">
      <label class="toggle-row">
        <div class="toggle-row-info">
          <span class="toggle-label-text">Потоковый вывод (SSE)</span>
          <span class="hint">Реального времени ответ модели</span>
        </div>
        <label class="toggle-switch">
          <input v-model="configCopy.stream" type="checkbox" />
          <span class="toggle-slider" />
        </label>
      </label>
    </div>
  </Card>

  <div class="settings-actions">
    <Button variant="primary" :disabled="loadingStates.save" style="flex: 1" @click="handleSave">
      <span v-if="loadingStates.save" class="btn-loading" />
      <span v-else>💾 Сохранить настройки</span>
    </Button>
    <Button :disabled="loadingStates.reset" @click="handleReset">
      <span v-if="loadingStates.reset" class="btn-loading" />
      <span v-else>↩️ Сброс</span>
    </Button>
  </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch } from "vue";
import Card from "../ui/Card.vue";
import Button from "../ui/Button.vue";
import { configDefaults } from "@backend/lib/configDefaults.js";
import { checkPath } from "@/api/client";

const props = defineProps({
  config: { type: Object, default: () => ({}) },
  apiBases: { type: Array, default: () => [] },
  availableModels: { type: Array, default: () => [] },
  modelName: { type: String, default: "" },
  serverUrl: { type: String, default: "" },
});

const emit = defineEmits(["save", "reset", "models-updated", "save-path"]);

// Копии для редактирования
const configCopy = reactive({
  token: props.config.token || "",
  projectPath: props.config.projectPath || "C:\\",
  maxFileChars: props.config.maxFileChars ?? configDefaults.maxFileChars,
  maxHistoryPairs: props.config.maxHistoryPairs ?? configDefaults.maxHistoryPairs,
  maxSearchResults: props.config.maxSearchResults ?? configDefaults.maxSearchResults,
  maxFilesInPrompt: props.config.maxFilesInPrompt ?? configDefaults.maxFilesInPrompt,
  maxTokens: props.config.maxTokens ?? configDefaults.maxTokens,
  timeout: props.config.timeout ?? configDefaults.timeout,
  temperature: props.config.temperature ?? configDefaults.temperature,
  stream: props.config.stream ?? configDefaults.stream,
});
const apiBasesCopy = ref(JSON.parse(JSON.stringify(props.apiBases)));
const modelNameCopy = ref(props.modelName);
// Состояния
const tokenVisible = ref(false);
const pathError = ref("");
const projectPathDraft = ref(props.config.projectPath || "C:\\");
const loadingStates = ref({
  save: false,
  reset: false,
  models: false,
});

// Debounce and save state management
let saveTimer = null;
let pendingSave = false;
let isSaving = false;
let ignoreNextWatch = false;

const debouncedSave = async () => {
  if (pendingSave || isSaving) return;
  
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      isSaving = true;
      pendingSave = true;
      
      const model = props.availableModels.find((m) => m.id === modelNameCopy.value);
      emit("save", {
        config: { ...configCopy },
        apiBases: JSON.parse(JSON.stringify(apiBasesCopy.value)),
        modelName: modelNameCopy.value,
        serverUrl: model ? model.source : "",
      });
    } catch (error) {
      console.error("Auto-save failed:", error);
    } finally {
      isSaving = false;
      setTimeout(() => {
        pendingSave = false;
      }, 500);
    }
  }, 300);
};

const autoSave = () => {
  debouncedSave();
};

watch(
  () => props.config,
  (val) => {
    if (!val || pendingSave) return;
    if (ignoreNextWatch) {
      ignoreNextWatch = false;
      return;
    }
    
    ignoreNextWatch = true;
    configCopy.token = val.token || "";
    projectPathDraft.value = val.projectPath || "C:\\";
    configCopy.projectPath = val.projectPath || "C:\\";
    configCopy.maxFileChars = val.maxFileChars ?? configDefaults.maxFileChars;
    configCopy.maxHistoryPairs = val.maxHistoryPairs ?? configDefaults.maxHistoryPairs;
    configCopy.maxSearchResults = val.maxSearchResults ?? configDefaults.maxSearchResults;
    configCopy.maxFilesInPrompt = val.maxFilesInPrompt ?? configDefaults.maxFilesInPrompt;
    configCopy.maxTokens = val.maxTokens ?? configDefaults.maxTokens;
    configCopy.timeout = val.timeout ?? configDefaults.timeout;
    configCopy.temperature = val.temperature ?? configDefaults.temperature;
    configCopy.stream = val.stream ?? configDefaults.stream;
    
    // Use setTimeout to reset ignoreNextWatch after debounce period
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      ignoreNextWatch = false;
    }, 600);
  },
  { deep: true }
);

watch(
  () => props.modelName,
  (val) => {
    if (!pendingSave) modelNameCopy.value = val;
  }
);
watch(
  () => props.apiBases,
  (val) => {
    if (!pendingSave) apiBasesCopy.value = JSON.parse(JSON.stringify(val));
  },
  { deep: true }
);

watch(configCopy, autoSave, { deep: true });
watch(modelNameCopy, autoSave);
watch(apiBasesCopy, autoSave, { deep: true });

watch(() => configCopy.projectPath, () => {
  pathError.value = "";
});

// Обработчики с loading states
async function checkProjectPath() {
  const p = projectPathDraft.value;
  if (!p) { pathError.value = ""; return; }
  const isWin = navigator.platform?.includes("Win");
  const rootDriveMatch = isWin && /^[a-zA-Z]:\\$/i.test(p);
  if (rootDriveMatch) { pathError.value = ""; return; }
  try {
    const data = await checkPath(p);
    pathError.value = data.valid ? "" : "⚠️ Directory does not exist";
  } catch {
    pathError.value = "⚠️ Cannot validate path";
  }
}

const handleSave = async () => {
  if (isSaving) return;
  configCopy.projectPath = projectPathDraft.value;
  await checkProjectPath();
  if (pathError.value) return;
  
  loadingStates.value.save = true;
  try {
    const model = props.availableModels.find((m) => m.id === modelNameCopy.value);
    emit("save", {
      config: {
        ...configCopy,
        token: configCopy.token.trim().replace(/[^\x00-\x7F]/g, ""),
      },
      apiBases: JSON.parse(JSON.stringify(apiBasesCopy.value)),
      modelName: modelNameCopy.value,
      serverUrl: model ? model.source : "",
    });
  } catch (error) {
    console.error("Manual save failed:", error);
  } finally {
    setTimeout(() => {
      loadingStates.value.save = false;
    }, 500);
  }
};

async function handleSaveProjectPath() {
  await checkProjectPath();
  if (pathError.value) return;
  configCopy.projectPath = projectPathDraft.value;
  emit("save-path", { projectPath: projectPathDraft.value });
}

const handleReset = () => {
  loadingStates.value.reset = true;
  emit("reset");
  setTimeout(() => {
    loadingStates.value.reset = false;
  }, 500);
};

const handleRefreshModels = async () => {
  loadingStates.value.models = true;
  try {
    emit("models-updated");
  } finally {
    setTimeout(() => {
      loadingStates.value.models = false;
    }, 1000);
  }
};

const addApiBase = () => {
  apiBasesCopy.value.push({ url: "", connected: false });
  autoSave();
};

const removeApiBase = (index) => {
  apiBasesCopy.value.splice(index, 1);
  autoSave();
};

const syncApiBases = () => {
  autoSave();
  emit("models-updated");
};

const adjustTokens = (delta) => {
  configCopy.maxTokens = Math.max(256, Math.min(65536, configCopy.maxTokens + delta));
};
</script>

<style scoped>
.settings-tab {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.header-row h2 {
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--text-tertiary);
  text-transform: uppercase;
  font-weight: 500;
  background: none;
  background-clip: unset;
  -webkit-background-clip: unset;
  -webkit-text-fill-color: unset;
}

.api-base-table {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.table-header {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  background: var(--bg-card);
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
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
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
}
.btn-add:hover,
.btn-remove:hover {
  background: var(--accent-primary);
  color: white;
  border-color: var(--accent-primary);
}
.form-group {
  margin-bottom: 10px;
}
.form-group:last-child {
  margin-bottom: 0;
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
.form-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.form-label label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.form-label .hint {
  font-size: 10px;
  color: var(--text-muted);
}
.form-input {
  width: 100%;
  padding: 6px 10px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 12px;
  font-family: "JetBrains Mono", monospace;
  transition: var(--transition);
}
.form-input:focus {
  outline: none;
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px var(--accent-glow);
}
.form-input::placeholder {
  color: var(--text-muted);
}
select.form-input {
  cursor: pointer;
}
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.form-number-wrapper {
  display: flex;
  align-items: center;
}
.token-input-wrapper {
  position: relative;
}
.token-input-wrapper .form-input {
  padding-right: 32px;
}
.token-toggle {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  font-size: 12px;
  border-radius: var(--radius-sm);
  transition: var(--transition);
}
.range-input {
  width: 100%;
  accent-color: var(--accent-primary);
  background: var(--bg-card);
}
.range-labels {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  color: var(--text-muted);
  margin-top: 2px;
}
.range-value {
  color: var(--accent-primary);
  font-weight: 600;
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  cursor: pointer;
}

.toggle-row-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.toggle-label-text {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
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
  background: var(--accent-primary);
  border-color: var(--accent-primary);
}

.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(18px);
  background: white;
}

.settings-actions {
  display: flex;
  gap: 8px;
  padding: 10px 14px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  grid-column: 1 / -1;
}

.btn-loading {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.model-error {
  color: #e74c3c;
  font-size: 11px;
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
  color: #e74c3c;
  font-size: 12px;
  margin-top: 4px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
