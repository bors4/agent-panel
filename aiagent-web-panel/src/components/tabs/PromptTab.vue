<template>
  <Card>
    <template #header>
      <div class="header-row">
        <h3 class="mono-label">PRM://EDITOR</h3>
        <div class="header-actions">
          <Button :disabled="loadingStates.reset" @click="handleReset"> RESET </Button>
          <Button :disabled="loadingStates.format" @click="handleFormat"> FORMAT </Button>
          <Button :disabled="loadingStates.copy" @click="handleCopy"> COPY </Button>
          <span class="header-sep" />
          <Button variant="primary" :disabled="loadingStates.save" @click="handleSave"> SAVE </Button>
          <Button :disabled="loadingStates.export" @click="handleExport"> EXPORT </Button>
          <Button :disabled="loadingStates.import" @click="handleImport"> IMPORT </Button>
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
  width: 100%;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.header-sep {
  width: 1px;
  height: 18px;
  background: var(--border);
  margin: 0 2px;
  flex-shrink: 0;
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
  padding: 7px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-bottom: none;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.6rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.column-header .char-count {
  font-size: 0.7rem;
  color: var(--text-muted);
  font-family: "JetBrains Mono", monospace;
  text-transform: none;
  letter-spacing: 0;
}

.form-textarea {
  width: 100%;
  flex: 1;
  resize: none;
  line-height: 1.6;
  font-size: 0.8rem;
  tab-size: 2;
  font-family: "JetBrains Mono", monospace;
  padding: 12px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text-primary);
  overflow-y: auto;
  clip-path: polygon(
    0 4px,
    4px 0,
    calc(100% - 4px) 0,
    100% 4px,
    100% calc(100% - 4px),
    calc(100% - 4px) 100%,
    4px 100%,
    0 calc(100% - 4px)
  );
}

.form-textarea:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--glow-accent-sm);
}

.preview-container {
  background: var(--bg-card);
  border: 1px solid var(--border);
  clip-path: polygon(
    0 4px,
    4px 0,
    calc(100% - 4px) 0,
    100% 4px,
    100% calc(100% - 4px),
    calc(100% - 4px) 100%,
    4px 100%,
    0 calc(100% - 4px)
  );
  display: flex;
  flex-direction: column;
  height: 600px;
  overflow-y: hidden;
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
  color: var(--accent);
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
  border-left: 2px solid var(--accent);
  padding-left: 10px;
  color: var(--text-muted);
  margin: 8px 0;
}

.error {
  color: var(--error);
  padding: 8px;
  background: var(--error-bg);
  font-size: 0.75rem;
}
</style>
