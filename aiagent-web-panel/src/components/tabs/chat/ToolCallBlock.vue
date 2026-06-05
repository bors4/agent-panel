<!--
  Collapsible tool call block. Показывает имя + сокращённые args по клику
  разворачивает pretty-printed JSON.
-->
<template>
  <div class="tool-call-block" :class="{ collapsed: !msg.expanded }">
    <div class="tool-call-header" @click="msg.expanded = !msg.expanded">
      <span class="tool-call-name">🔧 {{ msg.toolName }}({{ msg.toolArgsShort }})</span>
      <span class="tool-call-toggle">{{ msg.expanded ? "▲" : "▼" }}</span>
    </div>
    <pre v-if="msg.expanded" class="tool-call-args">{{ msg.toolArgsPretty }}</pre>
  </div>
</template>

<script setup>
defineProps({
  msg: { type: Object, required: true },
});
</script>

<style scoped>
.tool-call-block {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  margin: 2px 0;
  max-width: 450px;
}

.tool-call-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.15s;
}

.tool-call-header:hover {
  background: var(--bg-hover);
}

.tool-call-name {
  flex: 1;
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  color: var(--accent);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-call-toggle {
  font-size: 9px;
  color: var(--text-muted);
}

.tool-call-args {
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

.collapsed .tool-call-args {
  display: none;
}
</style>
