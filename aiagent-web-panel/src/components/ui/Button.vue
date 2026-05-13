<template>
    <button
        :class="[
            'btn',
            variant,
            { 'full-width': fullWidth, disabled: disabled },
        ]"
        :disabled="disabled"
        :aria-label="ariaLabel"
        :aria-disabled="disabled"
        @click="$emit('click')"
    >
        <span v-if="icon" class="btn-icon-text" aria-hidden="true">{{ icon }}</span>
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
    ariaLabel: String,
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
    background: var(--bg-card);
    color: var(--text-primary);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition);
    font-family: inherit;
    white-space: nowrap;
    position: relative;
    overflow: hidden;
}

.btn::before {
    content: "";
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
    transition: left 0.5s ease;
}

.btn:hover::before {
    left: 100%;
}

.btn:hover:not(.disabled) {
    border-color: var(--border-focus);
    background: var(--bg-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
}

.btn:active:not(.disabled) {
    transform: translateY(0);
    box-shadow: none;
}

.btn.disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none !important;
}

.btn.primary {
    background: var(--gradient-accent);
    border: none;
    color: white;
    position: relative;
    overflow: hidden;
}

.btn.primary::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.2) 50%, transparent 70%);
    opacity: 0;
    transition: opacity 0.3s ease;
}

.btn.primary:hover:not(.disabled)::after {
    opacity: 1;
}

.btn.primary:hover:not(.disabled) {
    background: linear-gradient(135deg, var(--accent-hover), #6d28d9);
    box-shadow: 0 4px 20px var(--accent-glow);
    transform: translateY(-2px);
}

.btn.danger {
    background: linear-gradient(135deg, var(--error-bg), rgba(239, 68, 68, 0.05));
    border: 1px solid var(--error-border);
    color: var(--error);
    position: relative;
}

.btn.danger:hover:not(.disabled) {
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.1));
    border-color: var(--error);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(239, 68, 68, 0.3);
}

.btn.success {
    background: linear-gradient(135deg, var(--success-bg), rgba(16, 185, 129, 0.05));
    border: 1px solid var(--success-border);
    color: var(--success);
    position: relative;
}

.btn.success:hover:not(.disabled) {
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.1));
    border-color: var(--success);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
}

.btn.full-width {
    width: 100%;
}

.btn-icon-text {
    font-size: 14px;
}

/* Loading state */
.btn.loading {
    position: relative;
    color: transparent;
}

.btn.loading::after {
    content: "";
    position: absolute;
    width: 16px;
    height: 16px;
    top: 50%;
    left: 50%;
    margin-left: -8px;
    margin-top: -8px;
    border: 2px solid transparent;
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    color: white;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
</style>
