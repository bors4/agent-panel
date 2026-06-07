<template>
  <section class="settings-section">
    <header class="settings-section__header">
      <h2 class="settings-section__title">System Prompt</h2>
      <p class="settings-section__desc">
        Instructions sent to the model before every request. Markdown supported, preview on the right.
      </p>
    </header>

    <div class="settings-section__body">
      <div class="settings-section__editor">
        <div class="settings-section__toolbar">
          <span class="settings-section__count">{{ charCount }} chars</span>
          <div class="settings-section__toolbar-actions">
            <button class="settings-section__btn" @click="$emit('save')">Save</button>
            <button class="settings-section__btn" @click="$emit('format')">Format</button>
            <button class="settings-section__btn" @click="$emit('reset')">Reset</button>
          </div>
        </div>
        <textarea
          :value="systemPrompt"
          class="settings-section__textarea"
          spellcheck="false"
          placeholder="Enter system prompt…"
          @input="$emit('update:system-prompt', $event.target.value)"
        />
      </div>
      <div class="settings-section__preview">
        <div class="settings-section__preview-header">Preview</div>
        <div class="settings-section__preview-body" v-html="compiled" />
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { marked } from "marked";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.css";

const props = defineProps({
  systemPrompt: { type: String, required: true },
});

defineEmits(["update:system-prompt", "save", "reset", "format"]);

const charCount = computed(() => (props.systemPrompt || "").length);

marked.setOptions({ gfm: true, breaks: true, pedantic: false, sanitize: false, smartLists: true });

const compiled = ref("");

function compile() {
  const text = props.systemPrompt || "";
  if (!text.trim()) {
    compiled.value = '<p class="muted">Preview will appear here…</p>';
    return;
  }
  try {
    const html = marked.parse(text);
    const highlighted = html.replace(/<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/g, (m, code) => {
      try {
        const lm = m.match(/class="language-(\w+)"/);
        const lang = lm ? lm[1] : "plaintext";
        return `<pre><code class="hljs">${hljs.highlight(code, { language: lang }).value}</code></pre>`;
      } catch {
        return `<pre><code class="hljs">${code}</code></pre>`;
      }
    });
    compiled.value = highlighted;
  } catch (e) {
    compiled.value = `<p class="error">Parse error: ${e.message}</p>`;
  }
}

watch(() => props.systemPrompt, compile, { immediate: true });
</script>

<style scoped>
.settings-section {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 24px;
  gap: 16px;
}

.settings-section__header {
  flex-shrink: 0;
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
  max-width: 600px;
  line-height: 1.5;
}

.settings-section__body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  flex: 1;
  min-height: 0;
}

.settings-section__editor,
.settings-section__preview {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.settings-section__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: var(--bg-2);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.settings-section__count {
  font-size: 11px;
  color: var(--text-3);
  font-family: var(--font-mono);
}

.settings-section__toolbar-actions {
  display: flex;
  gap: 4px;
}

.settings-section__btn {
  padding: 3px 10px;
  border-radius: var(--radius-xs);
  font-size: 11px;
  font-weight: 500;
  color: var(--text-2);
  background: transparent;
  border: 1px solid var(--border);
  transition: var(--t-fast);
}

.settings-section__btn:hover {
  background: var(--bg-3);
  color: var(--text-1);
}

.settings-section__textarea {
  flex: 1;
  width: 100%;
  padding: 14px;
  background: transparent;
  border: none;
  color: var(--text-1);
  font-family: var(--font-mono);
  font-size: 12.5px;
  line-height: 1.6;
  resize: none;
  outline: none;
  tab-size: 2;
}

.settings-section__preview-header {
  padding: 6px 12px;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-3);
  font-weight: 600;
  background: var(--bg-2);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.settings-section__preview-body {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-1);
}

.settings-section__preview-body :deep(h1),
.settings-section__preview-body :deep(h2),
.settings-section__preview-body :deep(h3) {
  color: var(--accent);
  margin: 14px 0 8px;
}

.settings-section__preview-body :deep(code) {
  background: var(--bg-2);
  padding: 1px 5px;
  border-radius: var(--radius-xs);
  font-family: var(--font-mono);
  font-size: 12px;
}

.settings-section__preview-body :deep(pre) {
  background: var(--bg-2);
  padding: 10px;
  border-radius: var(--radius-sm);
  overflow-x: auto;
  margin: 8px 0;
}

.settings-section__preview-body :deep(pre code) {
  background: transparent;
  padding: 0;
  font-size: 12px;
}

.settings-section__preview-body :deep(.muted) {
  color: var(--text-3);
  font-style: italic;
}

@media (max-width: 900px) {
  .settings-section__body {
    grid-template-columns: 1fr;
  }
}
</style>
