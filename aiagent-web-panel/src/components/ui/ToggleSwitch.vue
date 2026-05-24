<template>
  <div class="toggle-container">
    <span class="toggle-label">{{ label }}</span>
    <label class="toggle">
      <input type="checkbox" :checked="modelValue" @change="$emit('update:modelValue', $event.target.checked)" />
      <span class="toggle-slider" />
    </label>
  </div>
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
  padding: 8px 0;
}

.toggle-label {
  font-size: 11px;
  color: var(--text-secondary);
  min-width: 400px;
}

.toggle {
  position: relative;
  width: 34px;
  height: 20px;
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
  width: 14px;
  height: 14px;
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
  transform: translateX(14px);
  background: var(--text-primary);
}

.toggle-divider {
  border-top: 1px solid var(--border);
}
</style>
