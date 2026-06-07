<template>
  <div class="approval-block">
    <div class="approval-header">🔐 Approval required</div>
    <div class="approval-tool">
      Tool: <strong>{{ msg.toolName }}</strong>
    </div>
    <pre class="approval-args">{{ msg.toolArgsPretty }}</pre>
    <div class="approval-buttons">
      <button class="approval-btn approve" @click="$emit('approve', msg)">✅ Approve</button>
      <button class="approval-btn reject" @click="$emit('reject', msg)">❌ Reject</button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  msg: { type: Object, required: true },
});

defineEmits(["approve", "reject"]);
</script>

<style scoped>
.approval-block {
  background: var(--warning-soft);
  border: 1px solid var(--border);
  border-left: 3px solid var(--warning);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  max-width: 420px;
}

.approval-header {
  font-size: 12px;
  font-weight: 600;
  color: var(--warning);
  margin-bottom: 6px;
}

.approval-tool {
  font-size: 11px;
  color: var(--text-2);
  margin-bottom: 6px;
}

.approval-tool strong {
  color: var(--text-1);
}

.approval-args {
  font-family: var(--font-mono);
  font-size: 10px;
  background: var(--bg-0);
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  padding: 6px 8px;
  margin: 4px 0 8px;
  max-height: 120px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text-2);
}

.approval-buttons {
  display: flex;
  gap: 6px;
}

.approval-btn {
  padding: 5px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  transition: var(--t-fast);
  background: var(--bg-2);
}

.approval-btn.approve {
  color: var(--success);
  border-color: var(--success-soft);
}

.approval-btn.approve:hover {
  background: var(--success);
  color: white;
  border-color: var(--success);
}

.approval-btn.reject {
  color: var(--error);
  border-color: var(--error-soft);
}

.approval-btn.reject:hover {
  background: var(--error);
  color: white;
  border-color: var(--error);
}
</style>
