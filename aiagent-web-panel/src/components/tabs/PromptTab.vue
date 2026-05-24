<template>
  <Card>
    <template #header>
      <div class="header-row">
        <h2>Системный промпт агента</h2>
        <div class="header-actions">
          <Button :disabled="loadingStates.reset" @click="handleReset">
            <span v-if="loadingStates.reset" class="btn-loading" />
            <span v-else>↩️ Сброс</span>
          </Button>
          <Button :disabled="loadingStates.format" @click="handleFormat">
            <span v-if="loadingStates.format" class="btn-loading" />
            <span v-else>✨ Формат</span>
          </Button>
          <Button :disabled="loadingStates.copy" @click="handleCopy">
            <span v-if="loadingStates.copy" class="btn-loading" />
            <span v-else>📋 Копировать</span>
          </Button>
          <span class="action-separator" />
          <Button variant="primary" :disabled="loadingStates.save" @click="handleSave">
            <span v-if="loadingStates.save" class="btn-loading" />
            <span v-else>💾 Сохранить</span>
          </Button>
          <Button :disabled="loadingStates.export" @click="handleExport">
            <span v-if="loadingStates.export" class="btn-loading" />
            <span v-else>📤 Экспорт</span>
          </Button>
          <Button :disabled="loadingStates.import" @click="handleImport">
            <span v-if="loadingStates.import" class="btn-loading" />
            <span v-else>📥 Импорт</span>
          </Button>
        </div>
      </div>
    </template>
    <div class="prompt-editor">
      <div class="editor-container">
        <div class="editor-column">
          <div class="column-header">
            <span>Markdown / Plain text</span>
            <span class="char-count">{{ charCount }} символов</span>
          </div>
          <textarea
            v-model="localPrompt"
            class="form-textarea"
            spellcheck="false"
            placeholder="Введите системный промпт..."
            @input="handleInput"
          />
        </div>
        <div class="preview-container">
          <div class="column-header">Preview</div>
          <div class="preview-content" v-html="compiledMarkdown" />
        </div>
      </div>
    </div>
  </Card>
</template>

<script setup>
import { ref, watch, onMounted } from "vue";
import { marked } from "marked";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.css";
import Card from "../ui/Card.vue";
import Button from "../ui/Button.vue";

const props = defineProps({
  modelValue: { type: String, default: "" },
});

const emit = defineEmits(["update:modelValue", "save", "reset", "format", "copy", "export", "import"]);

const localPrompt = ref(props.modelValue);
const charCount = ref(props.modelValue.length);
const compiledMarkdown = ref("");
const loadingStates = ref({
  reset: false,
  format: false,
  copy: false,
  save: false,
  export: false,
  import: false,
});

// Настройка marked
marked.setOptions({
  gfm: true,
  breaks: true,
  pedantic: false,
  sanitize: false,
  smartLists: true,
  smartypants: false,
  xhtml: false,
});

watch(
  () => props.modelValue,
  (val) => {
    localPrompt.value = val;
    charCount.value = val.length;
    compileMarkdown();
  }
);

const handleInput = () => {
  charCount.value = localPrompt.value.length;
  emit("update:modelValue", localPrompt.value);
  compileMarkdown();
};

const emitWithLoading = async (eventName, callback) => {
  loadingStates.value[eventName] = true;
  try {
    await callback();
  } finally {
    loadingStates.value[eventName] = false;
  }
};

const handleReset = () => {
  emitWithLoading("reset", () => {
    emit("reset");
  });
};

const handleFormat = () => {
  emitWithLoading("format", () => {
    emit("format");
  });
};

const handleCopy = () => {
  emitWithLoading("copy", async () => {
    try {
      await navigator.clipboard.writeText(localPrompt.value);
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  });
};

const handleSave = () => {
  emitWithLoading("save", () => {
    emit("save");
  });
};

const handleExport = () => {
  emitWithLoading("export", () => {
    emit("export");
  });
};

const handleImport = () => {
  emitWithLoading("import", () => {
    emit("import");
  });
};

const compileMarkdown = () => {
  if (localPrompt.value.trim()) {
    try {
      const html = marked.parse(localPrompt.value);
      // Применяем highlight.js к коду
      const highlightedHtml = html.replace(/<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/g, (match, code) => {
        try {
          // Пытаемся определить язык из класса
          const languageMatch = match.match(/class="language-(\w+)"/);
          const language = languageMatch ? languageMatch[1] : "plaintext";
          const highlighted = hljs.highlight(code, { language }).value;
          return `<pre><code class="hljs">${highlighted}</code></pre>`;
        } catch (_e) {
          return `<pre><code class="hljs">${code}</code></pre>`;
        }
      });
      compiledMarkdown.value = highlightedHtml;
    } catch (e) {
      compiledMarkdown.value = `<p class="error">Ошибка парсинга: ${e.message}</p>`;
    }
  } else {
    compiledMarkdown.value = "<p>Предпросмотр Markdown будет отображаться здесь...</p>";
  }
};

onMounted(() => {
  compileMarkdown();
});
</script>

<style scoped>
.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.header-actions button {
  font-size: 12px;
  padding: 6px 12px;
}

.action-separator {
  width: 1px;
  height: 20px;
  background: var(--border);
  margin: 0 2px;
}

.prompt-editor {
  display: flex;
  flex-direction: column;
}

.editor-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.editor-column {
  display: flex;
  flex-direction: column;
  height: 600px;
  overflow-y: hidden;
}

.column-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-bottom: none;
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  font-size: 12px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.column-header .char-count {
  font-size: 10px;
  color: var(--text-tertiary);
  font-family: "JetBrains Mono", monospace;
  text-transform: none;
  letter-spacing: 0;
}

.form-textarea {
  width: 100%;
  flex: 1;
  resize: none;
  line-height: 1.6;
  font-size: 13px;
  tab-size: 2;
  font-family: "JetBrains Mono", monospace;
  padding: 12px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 0 0 var(--radius-sm) var(--radius-sm);
  color: var(--text-primary);
  overflow-y: auto;
}

.form-textarea:focus {
  outline: none;
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px var(--accent-glow);
}

.preview-container {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  height: 600px;
  overflow-y: hidden;
}

.preview-container .column-header {
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
}

.preview-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-primary);
}

.preview-content h1,
.preview-content h2,
.preview-content h3,
.preview-content h4,
.preview-content h5,
.preview-content h6 {
  color: var(--accent-primary);
  margin-top: 12px;
  margin-bottom: 6px;
}

.preview-content p {
  margin-bottom: 8px;
}

.preview-content code {
  background: var(--bg-tertiary);
  padding: 1px 4px;
  border-radius: 3px;
  font-family: "JetBrains Mono", monospace;
  font-size: 12px;
}

.preview-content pre {
  background: var(--bg-tertiary);
  padding: 10px;
  border-radius: var(--radius-sm);
  overflow-x: auto;
  margin: 8px 0;
}

.preview-content pre code {
  background: transparent;
  padding: 0;
  font-size: 12px;
}

.preview-content ul,
.preview-content ol {
  margin: 8px 0;
  padding-left: 18px;
}

.preview-content li {
  margin-bottom: 4px;
}

.preview-content blockquote {
  border-left: 3px solid var(--accent-primary);
  padding-left: 10px;
  color: var(--text-muted);
  margin: 8px 0;
}

.error {
  color: var(--error);
  padding: 8px;
  background: var(--error-bg);
  border-radius: var(--radius-sm);
  font-size: 12px;
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

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
