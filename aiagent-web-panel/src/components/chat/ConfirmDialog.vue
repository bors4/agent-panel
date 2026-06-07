<!--
  Универсальный confirm dialog (modal overlay). События confirm/cancel.
-->
<template>
  <Transition name="confirm-fade">
    <div v-if="visible" class="confirm-overlay" @click.self="$emit('cancel')">
      <div class="confirm-dialog">
        <p>{{ message }}</p>
        <div class="confirm-actions">
          <button class="confirm-btn cancel" @click="$emit('cancel')">{{ cancelLabel }}</button>
          <button class="confirm-btn confirm" @click="$emit('confirm')">{{ confirmLabel }}</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  message: { type: String, default: "Вы уверены?" },
  confirmLabel: { type: String, default: "Ок" },
  cancelLabel: { type: String, default: "Отмена" },
});

defineEmits(["confirm", "cancel"]);
</script>

<style scoped>
.confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s ease;
}

.confirm-dialog {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 24px;
  max-width: 360px;
  width: 90%;
  box-shadow: var(--shadow-lg);
  animation: dialogIn 0.2s ease;
}

.confirm-dialog p {
  color: var(--text-primary);
  margin-bottom: 20px;
  font-size: 14px;
  line-height: 1.5;
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.confirm-btn {
  padding: 8px 18px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: var(--transition);
}

.confirm-btn.cancel {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.confirm-btn.cancel:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.confirm-btn.confirm {
  background: var(--error);
  color: white;
  border-color: var(--error);
}

.confirm-btn.confirm:hover {
  background: #dc2626;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes dialogIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
</style>
