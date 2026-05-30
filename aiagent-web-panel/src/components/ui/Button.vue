<template>
  <button
    :class="[
      'btn',
      `btn--${variant}`,
      {
        'btn--full': fullWidth,
        'btn--disabled': disabled,
        'btn--loading': loading,
      },
    ]"
    :disabled="disabled || loading"
    :aria-label="ariaLabel"
    :aria-disabled="disabled || loading"
    @click="$emit('click')"
  >
    <span v-if="icon" class="btn__icon" aria-hidden="true">{{ icon }}</span>
    <span v-if="loading" class="btn__loader" aria-hidden="true" />
    <span :class="{ 'btn__text--hidden': loading }">
      <slot />
    </span>
  </button>
</template>

<script setup>
defineProps({
  variant: {
    type: String,
    default: "primary",
    validator: (v) => ["primary", "secondary", "ghost", "danger"].includes(v),
  },
  fullWidth: Boolean,
  disabled: Boolean,
  loading: Boolean,
  icon: String,
  ariaLabel: String,
});

defineEmits(["click"]);
</script>

<style scoped>
.btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 9px 18px;
  min-height: 38px;
  border: 1.5px solid var(--border);
  background: transparent;
  color: var(--text-primary);
  font-family: "JetBrains Mono", "Fira Code", monospace;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  cursor: pointer;
  white-space: nowrap;
  clip-path: polygon(
    0 4px, 4px 0,
    calc(100% - 4px) 0, 100% 4px,
    100% calc(100% - 4px), calc(100% - 4px) 100%,
    4px 100%, 0 calc(100% - 4px)
  );
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
  -webkit-user-select: none;
}

/* ─── PRIMARY (Electric Blue — LAUNCH/ACTIVATE) ─── */
.btn--primary {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(0, 212, 255, 0.06);
}

.btn--primary:hover:not(.btn--disabled) {
  background: var(--accent);
  color: var(--space-black);
  box-shadow: var(--glow-accent);
  border-color: var(--accent);
}

.btn--primary:active:not(.btn--disabled) {
  transform: scale(0.97);
}

/* ─── SECONDARY (Warm Orange — WARNING/ABORT) ─── */
.btn--secondary {
  border-color: var(--accent-secondary);
  color: var(--accent-secondary);
  background: rgba(255, 107, 53, 0.06);
}

.btn--secondary:hover:not(.btn--disabled) {
  background: var(--accent-secondary);
  color: var(--space-black);
  box-shadow: var(--glow-orange);
  border-color: var(--accent-secondary);
}

.btn--secondary:active:not(.btn--disabled) {
  transform: scale(0.97);
}

/* ─── GHOST — прозрачный, без границы ─── */
.btn--ghost {
  border-color: transparent;
  color: var(--text-muted);
  background: transparent;
}

.btn--ghost:hover:not(.btn--disabled) {
  color: var(--accent);
  background: rgba(0, 212, 255, 0.08);
  border-color: transparent;
  box-shadow: none;
}

.btn--ghost:active:not(.btn--disabled) {
  background: rgba(0, 212, 255, 0.14);
}

/* ─── DANGER (Red — DESTRUCT/ABORT) ─── */
.btn--danger {
  border-color: var(--error);
  color: var(--error);
  background: rgba(239, 68, 68, 0.06);
}

.btn--danger:hover:not(.btn--disabled) {
  background: var(--error);
  color: white;
  box-shadow: 0 0 6px rgba(239, 68, 68, 0.5), 0 0 20px rgba(239, 68, 68, 0.3);
  border-color: var(--error);
}

.btn--danger:active:not(.btn--disabled) {
  transform: scale(0.97);
}

/* ─── FULL WIDTH ─── */
.btn--full {
  width: 100%;
  justify-content: center;
}

/* ─── DISABLED ─── */
.btn--disabled {
  opacity: 0.35;
  cursor: not-allowed;
  pointer-events: none;
}

/* ─── LOADING ─── */
.btn--loading {
  pointer-events: none;
}

.btn__loader {
  width: 14px;
  height: 14px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-right-color: currentColor;
  border-radius: 50%;
  animation: btnSpin 0.6s linear infinite;
  flex-shrink: 0;
}

.btn__text--hidden {
  opacity: 0;
}

.btn__icon {
  font-size: 0.875rem;
  line-height: 1;
  flex-shrink: 0;
}

/* ─── FOCUS ─── */
.btn:focus-visible {
  outline: none;
  box-shadow: var(--glow-accent-sm), 0 0 0 1px var(--accent);
}

.btn--danger:focus-visible {
  box-shadow: 0 0 4px rgba(239, 68, 68, 0.5), 0 0 0 1px var(--error);
}

.btn--secondary:focus-visible {
  box-shadow: var(--glow-orange), 0 0 0 1px var(--accent-secondary);
}

@keyframes btnSpin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
