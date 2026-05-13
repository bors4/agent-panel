<template>
    <div class="toggle-container">
        <span class="toggle-label">{{ label }}</span>
        <label class="toggle">
            <input
                type="checkbox"
                :checked="modelValue"
                @change="$emit('update:modelValue', $event.target.checked)"
            />
            <span class="toggle-slider"></span>
        </label>
    </div>
    <div class="toggle-divider"></div>
</template>

<script setup>
defineProps({
    modelValue: Boolean,
    label: { type: String, required: true },
});

defineEmits(["update:modelValue"]);
</script>

<style scoped>
.toggle-container {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 0;
}

.toggle-label {
    font-size: 12px;
    color: var(--text-secondary);
}

.toggle {
    position: relative;
    width: 40px;
    height: 22px;
    cursor: pointer;
}

.toggle input {
    opacity: 0;
    width: 0;
    height: 0;
}

.toggle-slider {
    position: absolute;
    inset: 0;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 100px;
    transition: var(--transition);
}

.toggle-slider::before {
    content: "";
    position: absolute;
    width: 16px;
    height: 16px;
    left: 2px;
    top: 2px;
    background: var(--text-muted);
    border-radius: 50%;
    transition: var(--transition);
}

.toggle input:checked + .toggle-slider {
    background: var(--accent);
    border-color: var(--accent);
}

.toggle input:checked + .toggle-slider::before {
    transform: translateX(18px);
    background: var(--text-primary);
}

.toggle-divider {
    border-top: 1px solid var(--border);
}
</style>
