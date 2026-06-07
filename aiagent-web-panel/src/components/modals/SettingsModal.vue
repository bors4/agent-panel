<template>
  <AppModal
    :model-value="modelValue"
    size="lg"
    title="Settings"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template #header>
      <div class="settings-header">
        <h2 class="settings-header__title">Settings</h2>
        <span class="settings-header__hint"> <kbd>Ctrl</kbd>+<kbd>,</kbd> to toggle </span>
      </div>
    </template>
    <div class="settings-modal">
      <SettingsSidebar v-model="section" />
      <SettingsContent
        :section="section"
        :config="config"
        :api-bases="apiBases"
        :model-name="modelName"
        :available-models="availableModels"
        :model-context-length="modelContextLength"
        :system-prompt="systemPrompt"
        :asr-status="asrStatus"
        @update:config="(v) => $emit('update:config', v)"
        @update:api-bases="(v) => $emit('update:api-bases', v)"
        @update:model-name="(v) => $emit('update:model-name', v)"
        @update:system-prompt="(v) => $emit('update:system-prompt', v)"
        @save="$emit('save')"
        @reset="$emit('reset')"
        @format="$emit('format')"
        @browse="$emit('browse')"
        @add-api-base="$emit('add-api-base')"
        @remove-api-base="(i) => $emit('remove-api-base', i)"
        @refresh-models="$emit('refresh-models')"
        @load-openrouter="$emit('load-openrouter')"
        @test-asr="$emit('test-asr')"
      />
    </div>
    <template #footer>
      <button class="btn btn-ghost" @click="$emit('reset')">Reset to defaults</button>
      <button class="btn btn-primary" @click="$emit('save')">Save</button>
    </template>
  </AppModal>
</template>

<script setup>
import { ref, watch } from "vue";
import AppModal from "./AppModal.vue";
import SettingsSidebar from "./SettingsSidebar.vue";
import SettingsContent from "./SettingsContent.vue";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  config: { type: Object, required: true },
  apiBases: { type: Array, required: true },
  modelName: { type: String, required: true },
  availableModels: { type: Array, default: () => [] },
  modelContextLength: { type: Number, default: 0 },
  systemPrompt: { type: String, required: true },
  asrStatus: { type: Object, default: null },
});

defineEmits([
  "update:modelValue",
  "update:config",
  "update:api-bases",
  "update:model-name",
  "update:system-prompt",
  "save",
  "reset",
  "format",
  "browse",
  "add-api-base",
  "remove-api-base",
  "refresh-models",
  "load-openrouter",
  "test-asr",
]);

const section = ref("parameters");

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      section.value = "parameters";
    }
  }
);
</script>

<style scoped>
.settings-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.settings-header__title {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
  color: var(--text-1);
}

.settings-header__hint {
  font-size: 11px;
  color: var(--text-3);
}

.settings-header__hint kbd {
  display: inline-block;
  padding: 1px 5px;
  font-family: var(--font-mono);
  font-size: 10px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  color: var(--text-2);
  margin: 0 1px;
}

.settings-modal {
  display: flex;
  flex: 1;
  min-height: 0;
  height: 100%;
}

.btn {
  padding: 6px 14px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: var(--t-fast);
  border: 1px solid transparent;
}

.btn-ghost {
  background: transparent;
  color: var(--text-2);
  border-color: var(--border);
}

.btn-ghost:hover {
  background: var(--bg-2);
  color: var(--text-1);
}

.btn-primary {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.btn-primary:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}
</style>
