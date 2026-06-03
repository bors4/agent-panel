<template>
<div class="settings-tab">
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
          v-model="configCopy.token"
          :type="tokenVisible ? 'text' : 'password'"
          class="form-input"
          placeholder="123456789:AAH..."
        />
        <button class="token-toggle" @click="tokenVisible = !tokenVisible">
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
        <input v-model="projectPathDraft" type="text" class="form-input" placeholder="C:\path\to\project" @input="pathError = ''" @blur="checkProjectPath" />
        <Button variant="ghost" @click="browseDirectory">BROWSE</Button>
        <Button @click="handleSaveProjectPath">SAVE PATH</Button>
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
      <input
        v-model="modelFilter"
        type="text"
        class="form-input"
        placeholder="Фильтр моделей..."
        style="margin-bottom: 6px"
      />
      <div class="model-name-row">
        <select v-model="modelNameCopy" class="form-input">
          <option value="" disabled>Выберите модель</option>
          <option v-for="model in filteredModels" :key="model.id" :value="model.id">
            {{ model.id }} ({{ model.source }})
          </option>
        </select>
        <Button
          class="btn-refresh-models"
          :disabled="loadingStates.models"
          :loading="loadingStates.models"
          @click="handleRefreshModels"
        >
          REFRESH
        </Button>
      </div>
      <p v-if="availableModels.length === 0" class="model-error">Модели недоступны. Проверь подключение к серверу.</p>
    </div>
    <div class="form-group">
      <div class="form-label">
        <label>OPENROUTER_API_KEY</label>
        <span class="hint">Ключ API OpenRouter (опционально)</span>
      </div>
      <div class="token-input-wrapper">
        <input
          v-model="configCopy.openrouterApiKey"
          :type="orKeyVisible ? 'text' : 'password'"
          class="form-input"
          placeholder="sk-or-v1-..."
        />
        <button class="token-toggle" @click="orKeyVisible = !orKeyVisible">
          {{ orKeyVisible ? "HIDE" : "SHOW" }}
        </button>
      </div>
    </div>
    <div v-if="configCopy.openrouterApiKey" class="form-group">
      <div class="form-label">
        <label>OpenRouter модели</label>
        <span class="hint">Загрузить модели из OpenRouter</span>
      </div>
      <div class="openrouter-row">
        <Button
          class="btn-refresh-models"
          :disabled="loadingStates.openrouterModels"
          :loading="loadingStates.openrouterModels"
          @click="handleLoadOpenRouterModels"
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
        <input
          v-model="configCopy.asrServerUrl"
          type="text"
          class="form-input"
          placeholder="http://192.168.1.103:8081"
        />
        <Button
          :disabled="!configCopy.asrServerUrl || loadingStates.asrTest"
          :loading="loadingStates.asrTest"
          @click="testAsrServer"
        >
          TEST
        </Button>
      </div>
      <span v-if="asrStatus" :class="asrStatus.reachable ? 'token-ok' : 'token-missing'">
        {{ asrStatus.reachable ? '[CONNECTED]' : '[UNREACHABLE]' }}
      </span>
      <span class="hint">Для голосовых сообщений Telegram. Оставьте пустым для Web Speech API.</span>
    </div>
  </Card>

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
        <label>MAX_SEARCH_FILE_SIZE (bytes)</label>
        <span class="hint">Макс. размер файла для поиска</span>
      </div>
      <input
        v-model.number="configCopy.maxSearchFileSize"
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
        <h3 class="mono-label">CFG://BEHAVIOR</h3>
      </div>
    </template>
    <div class="form-group">
      <div class="form-label">
        <label>Потоковый вывод (SSE)</label>
        <span class="hint">Token-by-token вывод ответа</span>
      </div>
      <div class="toggle-control">
        <label class="toggle-switch">
          <input v-model="configCopy.stream" type="checkbox" />
          <span class="toggle-slider" />
        </label>
      </div>
    </div>
    <div class="form-group">
      <div class="form-label">
        <label>insertUserAfterTool</label>
        <span class="hint">В Jinja-шаблонах user после tool</span>
      </div>
      <div class="toggle-control">
        <label class="toggle-switch">
          <input v-model="configCopy.insertUserAfterTool" type="checkbox" />
          <span class="toggle-slider" />
        </label>
      </div>
    </div>
    <div class="form-group">
      <div class="form-label">
        <label>CHAT MODE</label>
        <span class="hint">Отключить проектный контекст</span>
      </div>
      <div class="toggle-control">
        <label class="toggle-switch">
          <input v-model="configCopy.chatMode" type="checkbox" />
          <span class="toggle-slider" />
        </label>
      </div>
    </div>
    <div class="form-group">
      <div class="form-label">
        <label>AUTO SAVE</label>
        <span class="hint">Автосохранение изменений</span>
      </div>
      <div class="toggle-control">
        <label class="toggle-switch">
          <input v-model="configCopy.autoSave" type="checkbox" />
          <span class="toggle-slider" />
        </label>
      </div>
    </div>
    <div class="form-group">
      <div class="form-label">
        <label>VERBOSE</label>
        <span class="hint">Детализация логов</span>
      </div>
      <div class="toggle-control">
        <label class="toggle-switch">
          <input v-model="configCopy.verbose" type="checkbox" />
          <span class="toggle-slider" />
        </label>
      </div>
    </div>
    <div class="form-group">
      <div class="form-label">
        <label>AUTO START</label>
        <span class="hint">Автозапуск бота при загрузке</span>
      </div>
      <div class="toggle-control">
        <label class="toggle-switch">
          <input v-model="configCopy.autoStart" type="checkbox" />
          <span class="toggle-slider" />
        </label>
      </div>
    </div>
  </Card>

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
          <input v-model="configCopy.showTokens" type="checkbox" />
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
          <input v-model="configCopy.soundEnabled" type="checkbox" />
          <span class="toggle-slider" />
        </label>
      </div>
    </div>
    <div v-if="configCopy.soundEnabled" class="form-group">
      <div class="form-label">
        <label>VOLUME</label>
        <span class="hint">{{ configCopy.soundVolume }}%</span>
      </div>
      <input v-model.number="configCopy.soundVolume" type="range" min="0" max="100" step="5" class="range-input" />
      <div class="range-labels">
        <span>0</span>
        <span class="range-value">{{ configCopy.soundVolume }}%</span>
        <span>100</span>
      </div>
    </div>
  </Card>

  <div class="settings-actions">
    <Button variant="primary" :disabled="loadingStates.save" @click="handleSave">
      SAVE ALL
    </Button>
    <Button variant="ghost" :disabled="loadingStates.reset" @click="handleReset">
      RESET
    </Button>
  </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, computed } from "vue";
import Card from "../ui/Card.vue";
import Button from "../ui/Button.vue";
import { configDefaults } from "@backend/lib/configDefaults.js";
import { checkPath, browseFolder, testAsrConnection } from "@/api/client";

/**
 * @typedef {Object} SettingsTabProps
 * @property {Object} config - Текущая конфигурация (token, projectPath, maxTokens, и т.д.)
 * @property {Array} apiBases - Список API-баз [{ url, connected }]
 * @property {Array} availableModels - Доступные модели [{ id, source, maxContextLength }]
 * @property {string} modelName - Выбранная модель
 * @property {string} serverUrl - URL текущего сервера
 */

/** @type {SettingsTabProps} */
const props = defineProps({
  config: { type: Object, default: () => ({}) },
  apiBases: { type: Array, default: () => [] },
  availableModels: { type: Array, default: () => [] },
  modelName: { type: String, default: "" },
  serverUrl: { type: String, default: "" },
});

/**
 * События компонента SettingsTab:
 * @event save - Сохранить настройки. Payload: { config, apiBases, modelName, serverUrl }
 * @event reset - Сбросить настройки
 * @event models-updated - Обновить список моделей. Payload: (openrouterUrl?, openrouterApiKey?)
 * @event save-path - Сохранить путь проекта. Payload: { projectPath }
 */
const emit = defineEmits(["save", "reset", "models-updated", "save-path"]);

// Копии для редактирования
const configCopy = reactive({
  token: props.config.token || "",
  projectPath: props.config.projectPath || "C:\\",
  maxFileChars: props.config.maxFileChars ?? configDefaults.maxFileChars,
  maxHistoryPairs: props.config.maxHistoryPairs ?? configDefaults.maxHistoryPairs,
  maxSearchResults: props.config.maxSearchResults ?? configDefaults.maxSearchResults,
  maxSearchFileSize: props.config.maxSearchFileSize ?? configDefaults.maxSearchFileSize,
  maxFilesInPrompt: props.config.maxFilesInPrompt ?? configDefaults.maxFilesInPrompt,
  maxTokens: props.config.maxTokens ?? configDefaults.maxTokens,
  timeout: props.config.timeout ?? configDefaults.timeout,
  temperature: props.config.temperature ?? configDefaults.temperature,
  stream: props.config.stream ?? configDefaults.stream,
  insertUserAfterTool: props.config.insertUserAfterTool ?? configDefaults.insertUserAfterTool,
  chatMode: props.config.chatMode ?? configDefaults.chatMode,
  openrouterApiKey: props.config.openrouterApiKey || "",
  autoSave: props.config.autoSave !== false,
  verbose: props.config.verbose === true,
  autoStart: props.config.autoStart === true,
  showTokens: props.config.showTokens !== false,
  soundEnabled: props.config.soundEnabled !== false,
  soundVolume: props.config.soundVolume ?? 50,
  asrServerUrl: props.config.asrServerUrl || "",
});
const apiBasesCopy = ref(JSON.parse(JSON.stringify(props.apiBases)));
const modelNameCopy = ref(props.modelName);
const modelFilter = ref("");

/**
 * Отфильтрованные модели по тексту в modelFilter.
 * Фильтрация по id модели или source (URL сервера), регистронезависимая.
 * @type {import('vue').ComputedRef<Array>}
 */
const filteredModels = computed(() => {
  if (!modelFilter.value) return props.availableModels;
  const q = modelFilter.value.toLowerCase();
  return props.availableModels.filter(
    (m) => m.id.toLowerCase().includes(q) || (m.source || "").toLowerCase().includes(q)
  );
});
// Состояния
const tokenVisible = ref(false);
const orKeyVisible = ref(false);
const pathError = ref("");
const hasToken = computed(() => !!(configCopy.token || configBackendHasToken.value));
const configBackendHasToken = ref(false);
const projectPathDraft = ref(props.config.projectPath || "");
const loadingStates = ref({
  save: false,
  reset: false,
  models: false,
  openrouterModels: false,
  asrTest: false,
});
const asrStatus = ref(null);

// Debounce and save state management
let saveTimer = null;
let pendingSave = false;
let isSaving = false;
let ignoreNextWatch = false;

/**
 * Сохранение с debounce (300 мс). Предотвращает множественные одновременные сохранения.
 * Использует флаги pendingSave / isSaving для защиты от гонок.
 */
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

/**
 * Автосохранение при изменении полей. Вызывает debouncedSave.
 */
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
    projectPathDraft.value = val.projectPath || "";
    configBackendHasToken.value = !!val.hasToken;
    configCopy.maxFileChars = val.maxFileChars ?? configDefaults.maxFileChars;
    configCopy.maxHistoryPairs = val.maxHistoryPairs ?? configDefaults.maxHistoryPairs;
    configCopy.maxSearchResults = val.maxSearchResults ?? configDefaults.maxSearchResults;
    configCopy.maxSearchFileSize = val.maxSearchFileSize ?? configDefaults.maxSearchFileSize;
    configCopy.maxFilesInPrompt = val.maxFilesInPrompt ?? configDefaults.maxFilesInPrompt;
    configCopy.maxTokens = val.maxTokens ?? configDefaults.maxTokens;
    configCopy.timeout = val.timeout ?? configDefaults.timeout;
    configCopy.temperature = val.temperature ?? configDefaults.temperature;
    configCopy.stream = val.stream ?? configDefaults.stream;
    configCopy.insertUserAfterTool = val.insertUserAfterTool ?? configDefaults.insertUserAfterTool;
    configCopy.chatMode = val.chatMode ?? configDefaults.chatMode;
    configCopy.openrouterApiKey = val.openrouterApiKey || "";
    configCopy.autoSave = val.autoSave !== false;
    configCopy.verbose = val.verbose === true;
    configCopy.autoStart = val.autoStart === true;
    configCopy.showTokens = val.showTokens !== false;
    configCopy.soundEnabled = val.soundEnabled !== false;
    configCopy.soundVolume = val.soundVolume ?? 50;
    configCopy.asrServerUrl = val.asrServerUrl || "";

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

/**
 * Открыть системное окно выбора директории через backend.
 * Backend вызывает нативный OS диалог (PowerShell/Zenity) и возвращает полный путь.
 */
const browseDirectory = async () => {
  try {
    const data = await browseFolder();
    if (data.path) {
      projectPathDraft.value = data.path;
      pathError.value = "";
    }
  } catch {
    pathError.value = "⚠️ Failed to open folder picker";
  }
};

/**
 * Проверить существование директории через API /api/validate-path.
 * Устанавливает pathError при ошибке.
 */
async function checkProjectPath() {
  const p = projectPathDraft.value;
  if (!p) { pathError.value = ""; return; }
  const isWin = navigator.userAgent.includes("Win");
  const rootDriveMatch = isWin && /^[a-zA-Z]:\\$/i.test(p);
  if (rootDriveMatch) { pathError.value = ""; return; }
  try {
    const data = await checkPath(p);
    pathError.value = data.valid ? "" : "⚠️ Directory does not exist";
  } catch {
    pathError.value = "⚠️ Cannot validate path";
  }
}

/**
 * Сохранить настройки вручную (кнопка "Сохранить настройки").
 * Перед сохранением проверяет путь проекта.
 * Эмитит событие "save" с полной конфигурацией.
 */
const handleSave = async () => {
  if (isSaving) return;
  configCopy.projectPath = projectPathDraft.value;
  await checkProjectPath();
  if (pathError.value) return;

  pendingSave = true;
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

/**
 * Сохранить путь к проекту (кнопка "Сохранить путь").
 * Проверяет существование директории перед сохранением.
 * Эмитит событие "save-path" с { projectPath }.
 */
async function handleSaveProjectPath() {
  await checkProjectPath();
  if (pathError.value) return;
  configCopy.projectPath = projectPathDraft.value;
  emit("save-path", { projectPath: projectPathDraft.value });
}

/**
 * Сбросить настройки (кнопка "Сброс"). Эмитит событие "reset".
 */
const handleReset = () => {
  loadingStates.value.reset = true;
  emit("reset");
  setTimeout(() => {
    loadingStates.value.reset = false;
  }, 500);
};

/**
 * Обновить список моделей (кнопка "Обновить список").
 * Эмитит событие "models-updated" без параметров — для локальных API баз.
 */
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

/**
 * Загрузить модели из OpenRouter (кнопка "Загрузить модели OpenRouter").
 * Эмитит событие "models-updated" с URL OpenRouter и API-ключом.
 */
const handleLoadOpenRouterModels = async () => {
  loadingStates.value.openrouterModels = true;
  try {
    emit("models-updated", "https://openrouter.ai/api/v1", configCopy.openrouterApiKey);
  } finally {
    setTimeout(() => {
      loadingStates.value.openrouterModels = false;
    }, 1000);
  }
};

/**
 * Проверить соединение с ASR сервером.
 */
const testAsrServer = async () => {
  loadingStates.value.asrTest = true;
  asrStatus.value = null;
  try {
    asrStatus.value = await testAsrConnection();
  } catch {
    asrStatus.value = { configured: true, reachable: false, url: configCopy.asrServerUrl };
  } finally {
    loadingStates.value.asrTest = false;
  }
};

/**
 * Добавить новую пустую API-базу в список.
 */
const addApiBase = () => {
  apiBasesCopy.value.push({ url: "", connected: false });
  autoSave();
};

/**
 * Удалить API-базу по индексу.
 * @param {number} index - Индекс элемента в apiBasesCopy
 */
const removeApiBase = (index) => {
  apiBasesCopy.value.splice(index, 1);
  autoSave();
};

/**
 * Синхронизировать API-базы: автосохранение + обновление моделей.
 */
const syncApiBases = () => {
  autoSave();
  emit("models-updated");
};

/**
 * Скорректировать maxTokens на указанную дельту (с ограничением 256–65536).
 * @param {number} delta - Изменение (положительное или отрицательное, кратно 4096 в UI)
 */
const adjustTokens = (delta) => {
  configCopy.maxTokens = Math.max(256, Math.min(65536, configCopy.maxTokens + delta));
};
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

.settings-tab {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 14px;
  align-items: start;
}

@media (max-width: 1200px) {
  .settings-tab {
    grid-template-columns: 1fr 1fr;
  }
  .settings-actions {
    grid-column: 2;
  }
}

@media (max-width: 700px) {
  .settings-tab {
    grid-template-columns: 1fr;
  }
  .settings-actions {
    grid-column: 1;
  }
}

.api-base-table {
  border: 1px solid var(--border);
  clip-path: polygon(0 3px, 3px 0, calc(100% - 3px) 0, 100% 3px, 100% calc(100% - 3px), calc(100% - 3px) 100%, 3px 100%, 0 calc(100% - 3px));
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
  clip-path: polygon(0 2px, 2px 0, calc(100% - 2px) 0, 100% 2px, 100% calc(100% - 2px), calc(100% - 2px) 100%, 2px 100%, 0 calc(100% - 2px));
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
  clip-path: polygon(0 2px, 2px 0, calc(100% - 2px) 0, 100% 2px, 100% calc(100% - 2px), calc(100% - 2px) 100%, 2px 100%, 0 calc(100% - 2px));
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
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.form-number-wrapper {
  display: flex;
  align-items: center;
}
.form-number-wrapper :deep(.btn) {
  clip-path: none !important;
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
  clip-path: polygon(0 2px, 2px 0, calc(100% - 2px) 0, 100% 2px, 100% calc(100% - 2px), calc(100% - 2px) 100%, 2px 100%, 0 calc(100% - 2px));
  transition: var(--transition);
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

.settings-actions {
  display: flex;
  gap: 12px;
  padding: 8px 0;
  justify-content: center;
  grid-column: 4;
  align-self: end;
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
