<!--
  Approval request block: показывает имя инструмента + args, кнопки Одобрить/Отклонить.
-->
<template>
  <div class="approval-block">
    <div class="approval-header">🔐 Требуется одобрение</div>
    <div class="approval-tool">
      Инструмент: <strong>{{ msg.toolName }}</strong>
    </div>
    <pre class="approval-args">{{ msg.toolArgsPretty }}</pre>
    <div class="approval-buttons">
      <button class="approval-btn approve" @click="$emit('approve', msg)">✅ Одобрить</button>
      <button class="approval-btn reject" @click="$emit('reject', msg)">❌ Отклонить</button>
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
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: var(--radius-sm);
  padding: 10px;
  max-width: 400px;
}

.approval-header {
  font-size: 12px;
  font-weight: 600;
  color: #f59e0b;
  margin-bottom: 6px;
}

.approval-tool {
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.approval-args {
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 6px;
  margin: 4px 0 8px;
  max-height: 120px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.approval-buttons {
  display: flex;
  gap: 6px;
}

.approval-btn {
  padding: 5px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  transition: var(--transition);
}

.approval-btn.approve {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
  border-color: rgba(16, 185, 129, 0.3);
}

.approval-btn.approve:hover {
  background: rgba(16, 185, 129, 0.2);
}

.approval-btn.reject {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.3);
}

.approval-btn.reject:hover {
  background: rgba(239, 68, 68, 0.2);
}
</style>
