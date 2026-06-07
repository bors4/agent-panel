<template>
  <div class="toggle-container">
    <span v-if="label" class="toggle-label">{{ label }}</span>
    <label class="toggle">
      <input type="checkbox" :checked="modelValue" @change="$emit('update:modelValue', $event.target.checked)" />
      <span class="toggle-slider" />
    </label>
  </div>
</template>

<script setup>
defineProps({
  modelValue: Boolean,
  label: { type: String, default: "" },
});

defineEmits(["update:modelValue"]);
</script>

<style scoped>
.toggle-container {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0;
}

.toggle-label {
  font-size: 11px;
  color: var(--text-2);
}

.toggle {
  position: relative;
  display: inline-block;
  width: 34px;
  height: 20px;
  cursor: pointer;
  flex-shrink: 0;
}

.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.toggle-slider {
  position: absolute;
  inset: 0;
  background: var(--bg-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  transition: var(--t);
}

.toggle-slider::before {
  content: "";
  position: absolute;
  width: 14px;
  height: 14px;
  left: 2px;
  top: 2px;
  background: var(--text-3);
  border-radius: 50%;
  transition: var(--t);
}

.toggle input:checked + .toggle-slider {
  background: var(--accent);
  border-color: var(--accent);
}

.toggle input:checked + .toggle-slider::before {
  transform: translateX(14px);
  background: white;
}
</style>
