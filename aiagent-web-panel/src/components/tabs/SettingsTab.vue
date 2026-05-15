<template>
    <Card>
        <template #header>
            <h2>Основные параметры</h2>
        </template>
        <div class="form-group">
            <div class="form-label">
                <label>TELEGRAM_TOKEN</label>
                <span class="hint">Токен из @BotFather</span>
            </div>
            <div class="token-input-wrapper">
                <input
                    :type="tokenVisible ? 'text' : 'password'"
                    v-model="configCopy.token"
                    class="form-input"
                    placeholder="123456789:AAH..."
                />
                <button
                    class="token-toggle"
                    @click="tokenVisible = !tokenVisible"
                >
                    {{ tokenVisible ? "🔒" : "👁️" }}
                </button>
            </div>
        </div>
        <div class="form-group">
            <div class="form-label">
                <label>PROJECT_PATH</label>
                <span class="hint">Путь к проекту</span>
            </div>
            <input
                v-model="configCopy.projectPath"
                type="text"
                class="form-input"
                placeholder="C:\path\to\project"
            />
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
                <div
                    v-for="(api, index) in apiBasesCopy"
                    :key="index"
                    class="table-row"
                >
                    <input
                        v-model="apiBasesCopy[index].url"
                        type="text"
                        class="form-input col-url"
                        placeholder="http://192.168.1.101:8080/v1"
                        @blur="syncApiBases"
                    />
                    <label class="col-connect">
                        <input
                            type="checkbox"
                            v-model="apiBasesCopy[index].connected"
                            @change="syncApiBases"
                        />
                    </label>
                    <button class="btn-remove" @click="removeApiBase(index)">
                        ×
                    </button>
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
                     <option
                         v-for="model in availableModels"
                         :key="model.id"
                         :value="model.id"
                     >
                         {{ model.id }} ({{ model.source }})
                     </option>
                 </select>
                 <Button
                     class="btn-refresh-models"
                     @click="handleRefreshModels"
                     :disabled="loadingStates.models"
                 >
                     <span v-if="loadingStates.models" class="btn-loading"></span>
                     <span v-else>🔄</span>
                 </Button>
             </div>
         </div>
    </Card>

    <Card>
        <template #header>
            <h2>Лимиты и производительность</h2>
        </template>
        <div class="form-row-3">
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
                <input
                    v-model.number="configCopy.maxHistoryPairs"
                    type="number"
                    class="form-input"
                    min="2"
                    max="20"
                />
            </div>
            <div class="form-group">
                <div class="form-label">
                    <label>MAX_SEARCH_RESULTS</label>
                    <span class="hint">Результатов поиска</span>
                </div>
                <input
                    v-model.number="configCopy.maxSearchResults"
                    type="number"
                    class="form-input"
                    min="5"
                    max="50"
                />
            </div>
        </div>
        <div class="form-row-3">
            <div class="form-group">
                <div class="form-label">
                    <label>MAX_FILES_IN_PROMPT</label>
                    <span class="hint">Файлов в контексте</span>
                </div>
                <input
                    v-model.number="configCopy.maxFilesInPrompt"
                    type="number"
                    class="form-input"
                    min="1"
                    max="10"
                />
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
                    max="300000"
                    step="10000"
                />
            </div>
            <div class="form-group">
                <div class="form-label">
                    <label>MAX_TOKENS</label>
                    <span class="hint">Контекст ответа</span>
                </div>
                <div class="form-number-wrapper">
                    <Button
                        @click="adjustTokens(-4096)"
                        style="
                            border-radius: var(--radius-sm) 0 0 var(--radius-sm);
                        "
                        >−4K</Button
                    >
                    <input
                        v-model.number="configCopy.maxTokens"
                        type="number"
                        class="form-input"
                        min="256"
                        max="65536"
                        step="256"
                        style="
                            border-radius: 0;
                            border-right: none;
                            text-align: center;
                        "
                    />
                    <Button
                        @click="adjustTokens(4096)"
                        style="
                            border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
                        "
                        >+4K</Button
                    >
                </div>
            </div>
        </div>
        <div class="form-group">
            <div class="form-label">
                <label>TEMPERATURE</label>
                <span class="hint">Креативность (0-1)</span>
            </div>
            <input
                v-model.number="configCopy.temperature"
                type="range"
                min="0"
                max="1"
                step="0.05"
                class="range-input"
            />
            <div class="range-labels">
                <span>0</span>
                <span class="range-value">{{
                    (configCopy.temperature ?? 0.1).toFixed(2)
                }}</span>
                <span>1</span>
            </div>
        </div>
</Card>

     <div class="settings-actions">
         <Button
             variant="primary"
             @click="handleSave"
             :disabled="loadingStates.save"
             style="flex: 1"
         >
             <span v-if="loadingStates.save" class="btn-loading"></span>
             <span v-else>💾 Сохранить настройки</span>
         </Button>
         <Button @click="handleReset" :disabled="loadingStates.reset">
             <span v-if="loadingStates.reset" class="btn-loading"></span>
             <span v-else>↩️ Сброс</span>
         </Button>
     </div>
</template>

<script setup>
import { ref, reactive, watch } from "vue";
import Card from "../ui/Card.vue";
import Button from "../ui/Button.vue";

const props = defineProps({
    config: { type: Object, default: () => ({}) },
    apiBases: { type: Array, default: () => [] },
    availableModels: { type: Array, default: () => [] },
    modelName: { type: String, default: "" },
    serverUrl: { type: String, default: "" },
});

const emit = defineEmits(["save", "reset", "models-updated"]);

// Копии для редактирования
const configCopy = reactive({
    token: props.config.token || "",
    projectPath: props.config.projectPath || "C:\\",
    maxFileChars: props.config.maxFileChars || 2000,
    maxHistoryPairs: props.config.maxHistoryPairs || 5,
    maxSearchResults: props.config.maxSearchResults || 15,
    maxFilesInPrompt: props.config.maxFilesInPrompt || 2,
    maxTokens: props.config.maxTokens || 1024,
    timeout: props.config.timeout || 120000,
    temperature: props.config.temperature || 0.1,
});
const apiBasesCopy = ref(JSON.parse(JSON.stringify(props.apiBases)));
const modelNameCopy = ref(props.modelName);
const serverUrlCopy = ref(props.serverUrl);

// Состояния
const tokenVisible = ref(false);
const loadingStates = ref({
    save: false,
    reset: false,
    models: false,
});

let saveTimer = null;
let pendingSave = false;
let ignoreNextWatch = false;
const autoSave = () => {
    if (pendingSave) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        pendingSave = true;
        const model = props.availableModels.find(
            (m) => m.id === modelNameCopy.value,
        );
        emit("save", {
            config: { ...configCopy },
            apiBases: JSON.parse(JSON.stringify(apiBasesCopy.value)),
            modelName: modelNameCopy.value,
            serverUrl: model ? model.source : "",
        });
        setTimeout(() => {
            pendingSave = false;
        }, 1000);
    }, 300);
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
        configCopy.projectPath = val.projectPath || "C:\\";
        configCopy.maxFileChars = val.maxFileChars || 2000;
        configCopy.maxHistoryPairs = val.maxHistoryPairs || 5;
        configCopy.maxSearchResults = val.maxSearchResults || 15;
        configCopy.maxFilesInPrompt = val.maxFilesInPrompt || 2;
        configCopy.maxTokens = val.maxTokens || 1024;
        configCopy.timeout = val.timeout || 120000;
        configCopy.temperature = val.temperature ?? 0.1;
        setTimeout(() => {
            ignoreNextWatch = false;
        }, 600);
    },
    { deep: true },
);

watch(
    () => props.modelName,
    (val) => {
        if (!pendingSave) modelNameCopy.value = val;
    },
);
watch(
    () => props.apiBases,
    (val) => {
        if (!pendingSave) apiBasesCopy.value = JSON.parse(JSON.stringify(val));
    },
    { deep: true },
);

watch(configCopy, autoSave, { deep: true });
watch(modelNameCopy, autoSave);
watch(apiBasesCopy, autoSave, { deep: true });

// Обработчики с loading states
const handleSave = () => {
    loadingStates.value.save = true;
    const model = props.availableModels.find(
        (m) => m.id === modelNameCopy.value,
    );
    emit("save", {
        config: {
            ...configCopy,
            token: configCopy.token.trim().replace(/[^\x00-\x7F]/g, ""),
        },
        apiBases: JSON.parse(JSON.stringify(apiBasesCopy.value)),
        modelName: modelNameCopy.value,
        serverUrl: model ? model.source : "",
    });
    setTimeout(() => {
        loadingStates.value.save = false;
    }, 500);
};

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
    configCopy.maxTokens = Math.max(
        256,
        Math.min(65536, configCopy.maxTokens + delta),
    );
};
</script>

<style scoped>
.api-base-table {
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    overflow: hidden;
}
.table-header {
    display: flex;
    align-items: center;
    padding: 8px 10px;
    background: var(--bg-card);
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    gap: 8px;
    backdrop-filter: blur(10px);
}
.table-row {
    display: flex;
    align-items: center;
    padding: 6px 10px;
    gap: 8px;
    border-top: 1px solid var(--border);
}
.col-url {
    flex: 1;
}
.col-connect {
    width: 60px;
    text-align: center;
}
.btn-add,
.btn-remove {
    width: 28px;
    height: 28px;
    border: 1px solid var(--border);
    background: var(--bg-card);
    color: var(--text-secondary);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: var(--transition);
    backdrop-filter: blur(10px);
}
.btn-add:hover,
.btn-remove:hover {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
}
.form-group {
     margin-bottom: 14px;
 }
 .form-group:last-child {
     margin-bottom: 0;
 }
 .model-name-row {
     display: flex;
     align-items: center;
     gap: 8px;
 }
 .model-name-row .form-input {
     flex: 1;
 }
 .btn-refresh-models {
     flex-shrink: 0;
     width: 36px;
     height: 36px;
     padding: 0;
     display: flex;
     align-items: center;
     justify-content: center;
     border-radius: var(--radius-sm);
 }
.form-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
}
.form-label label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
}
.form-label .hint {
    font-size: 10px;
    color: var(--text-muted);
}
.form-input {
    width: 100%;
    padding: 10px 12px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-size: 12px;
    font-family: "JetBrains Mono", monospace;
    transition: var(--transition);
    backdrop-filter: blur(10px);
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
    gap: 12px;
}
.form-row-3 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 12px;
}
.form-number-wrapper {
    display: flex;
    align-items: center;
}
.token-input-wrapper {
    position: relative;
}
.token-input-wrapper .form-input {
    padding-right: 36px;
}
.token-toggle {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: var(--bg-card);
    border: 1px solid var(--border);
    color: var(--text-muted);
    cursor: pointer;
    padding: 3px;
    font-size: 14px;
    border-radius: var(--radius-sm);
    transition: var(--transition);
    backdrop-filter: blur(10px);
}
.range-input {
    width: 100%;
    accent-color: var(--accent-primary);
    background: var(--bg-card);
    backdrop-filter: blur(10px);
}
.range-labels {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: var(--text-muted);
    margin-top: 3px;
}
.range-value {
    color: var(--accent-primary);
    font-weight: 600;
}

/* Кнопки действий */
.settings-actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
    padding: 12px 16px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    backdrop-filter: blur(10px);
}

/* Loading spinner для кнопок */
.btn-loading {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid transparent;
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(360deg);
    }
}
</style>
