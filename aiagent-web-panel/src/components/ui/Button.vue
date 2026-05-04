<template>
    <button
        :class="[
            'btn',
            variant,
            { 'full-width': fullWidth, disabled: disabled },
        ]"
        :disabled="disabled"
        @click="$emit('click')"
    >
        <span v-if="icon" class="btn-icon-text">{{ icon }}</span>
        <slot></slot>
    </button>
</template>

<script setup>
defineProps({
    variant: {
        type: String,
        default: "default",
        validator: (v) =>
            ["default", "primary", "danger", "success"].includes(v),
    },
    fullWidth: Boolean,
    disabled: Boolean,
    icon: String,
});

defineEmits(["click"]);
</script>

<style scoped>
.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-tertiary);
    color: var(--text-primary);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition);
    font-family: inherit;
    white-space: nowrap;
}

.btn:hover:not(.disabled) {
    border-color: var(--border-focus);
    background: rgba(59, 130, 246, 0.08);
}

.btn:active:not(.disabled) {
    transform: scale(0.97);
}
.btn.disabled {
    opacity: 0.35;
    cursor: not-allowed;
}

.btn.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
}

.btn.primary:hover:not(.disabled) {
    background: var(--accent-hover);
    box-shadow: 0 0 16px var(--accent-glow);
}

.btn.danger {
    background: var(--error-bg);
    border-color: rgba(239, 68, 68, 0.3);
    color: var(--error);
}

.btn.danger:hover:not(.disabled) {
    background: rgba(239, 68, 68, 0.15);
}

.btn.success {
    background: var(--success-bg);
    border-color: rgba(16, 185, 129, 0.3);
    color: var(--success);
}

.btn.success:hover:not(.disabled) {
    background: rgba(16, 185, 129, 0.15);
}
.btn.full-width {
    width: 100%;
}

.btn-icon-text {
    font-size: 14px;
}
</style>
