<!--
  Контекстное меню (right-click). Показывает список actions в фиксированной позиции.
-->
<template>
  <Transition name="contextmenu-fade">
    <div v-if="visible" class="context-menu" :style="{ top: y + 'px', left: x + 'px' }" @contextmenu.prevent>
      <div class="context-menu-item" @click="$emit('action', 'clear')">🗑️ Очистить чат</div>
    </div>
  </Transition>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
});

defineEmits(["action"]);
</script>

<style scoped>
.context-menu {
  position: fixed;
  z-index: var(--z-modal);
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-lg);
  min-width: 180px;
  overflow: hidden;
  animation: contextMenuIn 0.15s ease-out;
}

@keyframes contextMenuIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.context-menu-item {
  padding: 10px 16px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
  transition: background 0.15s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.context-menu-item:hover {
  background: var(--bg-hover);
  color: var(--accent);
}
</style>
