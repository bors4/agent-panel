<!--
  Collapsible tool result block. Зелёный ✅ или красный ❌ + label + (опц.) output.
-->
<template>
  <div class="tool-result-block" :class="{ collapsed: !msg.expanded }">
    <div class="tool-result-header" @click="msg.expanded = !msg.expanded">
      <span class="tool-result-status" :class="msg.success ? 'success' : 'error'">
        {{ msg.success ? "✅" : "❌" }}
      </span>
      <span class="tool-result-label">{{ msg.success ? "Успешно" : "Ошибка" }}</span>
      <span class="tool-call-toggle">{{ msg.expanded ? "▲" : "▼" }}</span>
    </div>
    <pre v-if="msg.expanded" class="tool-result-output">{{ msg.output }}</pre>
  </div>
</template>

<script setup>
defineProps({
  msg: { type: Object, required: true },
});
</script>

<style scoped>
.tool-result-block {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  margin: 2px 0;
  max-width: 450px;
}

.tool-result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.15s;
}

.tool-result-header:hover {
  background: var(--bg-hover);
}

.tool-result-status {
  font-size: 13px;
}

.tool-result-label {
  flex: 1;
  font-size: 11px;
  font-weight: 600;
}

.tool-result-header .success {
  color: #10b981;
}

.tool-result-header .error {
  color: #ef4444;
}

.tool-call-toggle {
  font-size: 9px;
  color: var(--text-muted);
}

.tool-result-output {
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  padding: 8px 10px;
  margin: 0;
  background: var(--bg-primary);
  border-top: 1px solid var(--border);
  max-height: 200px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text-secondary);
}

.collapsed .tool-result-output {
  display: none;
}
</style>
