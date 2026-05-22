<template>
  <Card>
    <template #header>
      <h2>Системный промпт агента</h2>
      <span style="font-size: 11px; color: var(--text-muted)"> {{ charCount }} символов </span>
    </template>
    <div class="prompt-editor">
      <div class="editor-toolbar">
        <span>Markdown / Plain text</span>
        <div class="editor-actions">
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
        </div>
      </div>
      <div class="editor-container">
        <textarea
          v-model="localPrompt"
          class="form-textarea"
          spellcheck="false"
          placeholder="Введите системный промпт..."
          @input="handleInput"
        />
        <div class="preview-container">
          <div class="preview-header">
            <span>Preview</span>
            <Button style="font-size: 10px; padding: 4px 8px" @click="togglePreview">
              {{ previewVisible ? "Hide" : "Show" }}
            </Button>
          </div>
          <div v-if="previewVisible" class="preview-content" v-html="compiledMarkdown" />
        </div>
      </div>
    </div>
    <div style="margin-top: 12px; display: flex; gap: 8px">
      <Button variant="primary" :disabled="loadingStates.save" style="flex: 1" @click="handleSave">
        <span v-if="loadingStates.save" class="btn-loading" />
        <span v-else>💾 Сохранить промпт</span>
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
const previewVisible = ref(false);
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

const togglePreview = () => {
  previewVisible.value = !previewVisible.value;
};

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
.prompt-editor {
  display: flex;
  flex-direction: column;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-bottom: none;
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  backdrop-filter: blur(10px);
}

.editor-actions {
  display: flex;
  gap: 5px;
}

.editor-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-textarea {
  width: 100%;
  min-height: 320px;
  resize: vertical;
  line-height: 1.7;
  font-size: 11.5px;
  tab-size: 2;
  font-family: "JetBrains Mono", monospace;
  padding: 14px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 0 0 var(--radius-sm) var(--radius-sm);
  color: var(--text-primary);
  overflow-y: auto;
  backdrop-filter: blur(10px);
}

.preview-container {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  backdrop-filter: blur(10px);
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border);
  font-size: 11px;
  color: var(--text-muted);
}

.preview-content {
  padding: 14px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-primary);
  overflow-y: auto;
}

.preview-content h1,
.preview-content h2,
.preview-content h3,
.preview-content h4,
.preview-content h5,
.preview-content h6 {
  color: var(--accent-primary);
  margin-top: 16px;
  margin-bottom: 8px;
}

.preview-content p {
  margin-bottom: 12px;
}

.preview-content code {
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
}

.preview-content pre {
  background: var(--bg-tertiary);
  padding: 12px;
  border-radius: var(--radius-sm);
  overflow-x: auto;
  margin: 12px 0;
}

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

.preview-content pre code {
  background: transparent;
  padding: 0;
  font-size: 12px;
}

.preview-content ul,
.preview-content ol {
  margin: 12px 0;
  padding-left: 20px;
}

.preview-content li {
  margin-bottom: 6px;
}

.preview-content blockquote {
  border-left: 4px solid var(--accent-primary);
  padding-left: 12px;
  color: var(--text-muted);
  margin: 12px 0;
}

.error {
  color: var(--error);
  padding: 8px;
  background: var(--error-bg);
  border-radius: var(--radius-sm);
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
