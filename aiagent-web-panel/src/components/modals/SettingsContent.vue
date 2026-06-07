<template>
  <div class="settings-content">
    <component :is="currentSection" v-bind="sectionProps" v-on="sectionListeners" />
    <div v-if="!currentSection" class="settings-content__empty">Select a section from the left</div>
  </div>
</template>

<script setup>
import { computed, markRaw } from "vue";
import SystemPromptSection from "../sections/SystemPromptSection.vue";
import ParametersSection from "../sections/ParametersSection.vue";
import LimitsSection from "../sections/LimitsSection.vue";
import BehaviorSection from "../sections/BehaviorSection.vue";
import DisplaySection from "../sections/DisplaySection.vue";
import AppearanceSection from "../sections/AppearanceSection.vue";
import ToolsSection from "../sections/ToolsSection.vue";
import AccountsSection from "../sections/AccountsSection.vue";
import AboutSection from "../sections/AboutSection.vue";

const props = defineProps({
  section: { type: String, required: true },
  config: { type: Object, required: true },
  apiBases: { type: Array, required: true },
  modelName: { type: String, required: true },
  availableModels: { type: Array, default: () => [] },
  modelContextLength: { type: Number, default: 0 },
  systemPrompt: { type: String, required: true },
  asrStatus: { type: Object, default: null },
});

const emit = defineEmits([
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

const sectionMap = {
  "system-prompt": markRaw(SystemPromptSection),
  parameters: markRaw(ParametersSection),
  limits: markRaw(LimitsSection),
  behavior: markRaw(BehaviorSection),
  display: markRaw(DisplaySection),
  appearance: markRaw(AppearanceSection),
  tools: markRaw(ToolsSection),
  accounts: markRaw(AccountsSection),
  about: markRaw(AboutSection),
};

const currentSection = computed(() => sectionMap[props.section] || null);

const sectionProps = computed(() => ({
  config: props.config,
  apiBases: props.apiBases,
  modelName: props.modelName,
  availableModels: props.availableModels,
  modelContextLength: props.modelContextLength,
  systemPrompt: props.systemPrompt,
  asrStatus: props.asrStatus,
}));

const sectionListeners = {
  "update:config": (v) => emit("update:config", v),
  "update:api-bases": (v) => emit("update:api-bases", v),
  "update:model-name": (v) => emit("update:model-name", v),
  "update:system-prompt": (v) => emit("update:system-prompt", v),
  save: () => emit("save"),
  reset: () => emit("reset"),
  format: () => emit("format"),
  browse: () => emit("browse"),
  "add-api-base": () => emit("add-api-base"),
  "remove-api-base": (i) => emit("remove-api-base", i),
  "refresh-models": () => emit("refresh-models"),
  "load-openrouter": () => emit("load-openrouter"),
  "test-asr": () => emit("test-asr"),
};
</script>

<style scoped>
.settings-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: var(--bg-0);
}

.settings-content__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-3);
  font-size: 13px;
}
</style>
