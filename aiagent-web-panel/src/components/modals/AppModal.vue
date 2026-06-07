<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="app-modal" @keydown.esc.stop="$emit('update:modelValue', false)">
        <div class="app-modal__backdrop" @click="handleBackdrop" />
        <div
          class="app-modal__panel"
          :class="[`app-modal__panel--${size}`]"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
        >
          <header v-if="title || $slots.header" class="app-modal__header">
            <slot name="header">
              <h2 class="app-modal__title">{{ title }}</h2>
            </slot>
            <button class="app-modal__close" title="Close (Esc)" @click="$emit('update:modelValue', false)">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </header>
          <div class="app-modal__body">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="app-modal__footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: "" },
  size: { type: String, default: "md" },
  dismissable: { type: Boolean, default: true },
});

const emit = defineEmits(["update:modelValue", "close"]);

function handleBackdrop() {
  emit("update:modelValue", false);
  emit("close");
}
</script>

<style>
.app-modal {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.app-modal__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.app-modal__panel {
  position: relative;
  display: flex;
  flex-direction: column;
  max-width: var(--modal-max-w, 900px);
  max-height: var(--modal-max-h, 720px);
  width: 100%;
  height: 100%;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-modal);
  overflow: hidden;
  outline: none;
}

.app-modal__panel--sm {
  max-width: 520px;
  max-height: 600px;
}
.app-modal__panel--md {
  max-width: 720px;
  max-height: 680px;
}
.app-modal__panel--lg {
  max-width: var(--modal-max-w);
  max-height: var(--modal-max-h);
}
.app-modal__panel--full {
  max-width: 96vw;
  max-height: 94vh;
}

.app-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  gap: 12px;
}

.app-modal__title {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
  color: var(--text-1);
  letter-spacing: -0.01em;
}

.app-modal__close {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  color: var(--text-3);
  transition: var(--t-fast);
  margin-left: auto;
}

.app-modal__close:hover {
  background: var(--bg-2);
  color: var(--text-1);
}

.app-modal__body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.app-modal__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity var(--t) var(--ease-out);
}

.modal-enter-active .app-modal__panel,
.modal-leave-active .app-modal__panel {
  transition: transform var(--t) var(--ease-out);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .app-modal__panel,
.modal-leave-to .app-modal__panel {
  transform: scale(0.96) translateY(8px);
}
</style>
