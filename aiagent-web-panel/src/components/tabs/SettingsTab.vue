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
          v-model="localConfig.token"
          class="form-input" 
          placeholder="123456789:AAH..." 
        />
        <button class="token-toggle" @click="tokenVisible = !tokenVisible">
          {{ tokenVisible ? '🔒' : '👁️' }}
        </button>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <div class="form-label">
          <label>PROJECT_PATH</label>
          <span class="hint">Путь к проекту</span>
        </div>
        <input 
          v-model="localConfig.projectPath"
          type="text" 
          class="form-input" 
          placeholder="E:\Git\test_project" 
        />
      </div>
      <div class="form-group">
        <div class="form-label">
          <label>SERVER_URL</label>
          <span class="hint">llama.cpp / Ollama</span>
        </div>
        <input 
          v-model="localConfig.serverUrl"
          type="text" 
          class="form-input" 
          placeholder="http://192.168.1.103:8080/v1" 
        />
      </div>
    </div>
    <div class="form-group">
      <div class="form-label">
        <label>MODEL_NAME</label>
        <span class="hint">Имя модели</span>
      </div>
      <input 
        v-model="localConfig.modelName"
        type="text" 
        class="form-input" 
        placeholder="qwen2.5-coder-7b-instruct" 
      />
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
          v-model.number="localConfig.maxFileChars"
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
          v-model.number="localConfig.maxHistoryPairs"
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
          v-model.number="localConfig.maxSearchResults"
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
          v-model.number="localConfig.maxFilesInPrompt"
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
          v-model.number="localConfig.timeout"
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
          <Button @click="adjustTokens(-4096)" style="border-radius: var(--radius-sm) 0 0 var(--radius-sm);">−4K</Button>
          <input 
            v-model.number="localConfig.maxTokens"
            type="number" 
            class="form-input" 
            min="256" 
            max="65536" 
            step="256"
            style="border-radius: 0; border-right: none; text-align: center;"
          />
          <Button @click="adjustTokens(4096)" style="border-radius: 0 var(--radius-sm) var(--radius-sm) 0;">+4K</Button>
        </div>
      </div>
    </div>
    <div class="form-group">
      <div class="form-label">
        <label>TEMPERATURE</label>
        <span class="hint">Креативность (0-1)</span>
      </div>
      <input 
        v-model.number="localConfig.temperature"
        type="range" 
        min="0" 
        max="1" 
        step="0.05" 
        class="range-input"
      />
      <div class="range-labels">
        <span>0</span>
        <span class="range-value">{{ (localConfig.temperature ?? 0.1).toFixed(2) }}</span>
        <span>1</span>
      </div>
    </div>
    <div style="margin-top: 16px; display: flex; gap: 8px">
      <Button variant="primary" @click="$emit('save')" style="flex: 1">
        💾 Сохранить все настройки
      </Button>
      <Button @click="$emit('reset')">↩️ Сброс</Button>
    </div>
  </Card>
</template>

<script setup>
import { ref, watch } from 'vue'
import Card from '../ui/Card.vue'
import Button from '../ui/Button.vue'

const props = defineProps({
  config: { type: Object, required: true }
})

const emit = defineEmits(['update:config', 'save', 'reset'])

const tokenVisible = ref(false)

// 🔥 ДЕФОЛТНЫЕ ЗНАЧЕНИЯ — только известные поля
const defaultConfig = {
  token: '',
  projectPath: '',
  serverUrl: '',
  modelName: 'qwen2.5-coder-7b-instruct',
  maxFileChars: 2000,
  maxHistoryPairs: 5,
  maxSearchResults: 15,
  maxFilesInPrompt: 2,
  maxTokens: 1024,
  timeout: 120000,
  temperature: 0.1,
}

// 🔥 ИНИЦИАЛИЗАЦИЯ: локальная копия с дефолтами
const localConfig = ref({ ...defaultConfig, ...props.config })

// 🔥 Синхронизация ТОЛЬКО "сверху вниз" (от родителя к ребёнку)
// Обновляем только известные поля, чтобы избежать цикла
watch(() => props.config, (newVal) => {
  if (!newVal) return
  Object.keys(defaultConfig).forEach(key => {
    if (key in newVal) {
      localConfig.value[key] = newVal[key]
    }
  })
}, { deep: true })

// 🔥 Эмитим изменения ТОЛЬКО при реальном изменении пользователем
// { flush: 'post' } — эмит после рендера, чтобы избежать рекурсии
watch(localConfig, (newVal, oldVal) => {
  // Пропускаем инициализацию и синхронизацию от родителя
  if (JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
    emit('update:config', { ...newVal })
  }
}, { deep: true, flush: 'post' })

const adjustTokens = (delta) => {
  localConfig.value.maxTokens = Math.max(256, Math.min(65536, localConfig.value.maxTokens + delta))
}
</script>

<style scoped>
/* ... стили без изменений ... */
.form-group {
    margin-bottom: 14px;
}
.form-group:last-child {
    margin-bottom: 0;
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
    background: var(--bg-primary);
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
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 3px;
    font-size: 14px;
}
.range-input {
    width: 100%;
    accent-color: var(--accent);
}
.range-labels {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: var(--text-muted);
    margin-top: 3px;
}
.range-value {
    color: var(--accent);
    font-weight: 600;
}
</style>
