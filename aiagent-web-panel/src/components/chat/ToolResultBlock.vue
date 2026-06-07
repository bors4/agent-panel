<template>
  <div class="tool-result-block" :class="{ collapsed: !msg.expanded }">
    <div class="tool-result-header" @click="msg.expanded = !msg.expanded">
      <span class="tool-result-status" :class="msg.success ? 'success' : 'error'">
        {{ msg.success ? "✅" : "❌" }}
      </span>
      <span class="tool-result-label">{{ msg.success ? "Success" : "Error" }}</span>
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
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  margin: 2px 0;
  max-width: 480px;
}

.tool-result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 12px;
  transition: background var(--t-fast);
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
  color: var(--text-1);
}

.tool-result-header .success {
  color: var(--success);
}

.tool-result-header .error {
  color: var(--error);
}

.tool-call-toggle {
  font-size: 9px;
  color: var(--text-3);
}

.tool-result-output {
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
