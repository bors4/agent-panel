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
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  margin: 2px 0;
  max-width: 480px;
}

.tool-call-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 12px;
  transition: background var(--t-fast);
}

.tool-call-header:hover {
  background: var(--bg-hover);
}

.tool-call-name {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--accent);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-call-toggle {
  font-size: 9px;
  color: var(--text-3);
}

.tool-call-args {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 8px 10px;
  margin: 0;
  background: var(--bg-0);
  border-top: 1px solid var(--border-subtle);
  max-height: 200px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text-2);
}
</style>
