<!--
  Вкладка настроек. Содержит четыре секции:
    1. CFG://CONFIG    — токен, projectPath, API bases, model, OpenRouter, ASR
    2. CFG://LIMITS    — числовые параметры контекста
    3. CFG://BEHAVIOR  — тумблеры поведения
    4. CFG://DISPLAY   — тумблеры UI + громкость

  Состояние и логика вынесены в composables/useSettingsForm.
  UI секций — components/tabs/settings/{ConfigCard,LimitsCard,BehaviorCard,DisplayCard}.vue.
-->
<template>
  <div class="settings-tab">
    <ConfigCard
      :config="configCopy"
      :api-bases="apiBasesCopy"
      :model-name="modelNameCopy"
      :model-filter="modelFilter"
      :filtered-models="filteredModels"
      :project-path-draft="projectPathDraft"
      :path-error="pathError"
      :token-visible="tokenVisible"
      :or-key-visible="orKeyVisible"
      :has-token="hasToken"
      :loading-states="loadingStates"
      :asr-status="asrStatus"
      @browse="browseDirectory"
      @save-path="handleSaveProjectPath"
      @check-path="checkProjectPath"
      @add-api-base="addApiBase"
      @remove-api-base="removeApiBase"
      @sync-api-bases="syncApiBases"
      @refresh-models="handleRefreshModels"
      @load-openrouter="handleLoadOpenRouterModels"
      @test-asr="testAsrServer"
      @update:token-visible="(v) => (tokenVisible = v)"
      @update:or-key-visible="(v) => (orKeyVisible = v)"
      @update:path-error="(v) => (pathError = v)"
      @update:project-path-draft="(v) => (projectPathDraft = v)"
      @update:model-filter="(v) => (modelFilter = v)"
      @update:model-name="(v) => (modelNameCopy = v)"
    />

    <LimitsCard :config="configCopy" @adjust-tokens="adjustTokens" />

    <BehaviorCard :config="configCopy" />

    <DisplayCard :config="configCopy" />

    <div class="settings-actions">
      <Button variant="primary" :disabled="loadingStates.save" @click="handleSave"> SAVE ALL </Button>
      <Button variant="ghost" :disabled="loadingStates.reset" @click="handleReset"> RESET </Button>
    </div>
  </div>
</template>

<script setup>
import Button from "../../ui/Button.vue";
import ConfigCard from "./ConfigCard.vue";
import LimitsCard from "./LimitsCard.vue";
import BehaviorCard from "./BehaviorCard.vue";
import DisplayCard from "./DisplayCard.vue";
import { useSettingsForm } from "@/composables/useSettingsForm";

const props = defineProps({
  config: { type: Object, default: () => ({}) },
  apiBases: { type: Array, default: () => [] },
  availableModels: { type: Array, default: () => [] },
  modelName: { type: String, default: "" },
  serverUrl: { type: String, default: "" },
});

const emit = defineEmits(["save", "reset", "models-updated", "save-path"]);

const {
  configCopy,
  apiBasesCopy,
  modelNameCopy,
  modelFilter,
  tokenVisible,
  orKeyVisible,
  pathError,
  projectPathDraft,
  hasToken,
  loadingStates,
  asrStatus,
  filteredModels,
  checkProjectPath,
  handleSave,
  handleSaveProjectPath,
  handleReset,
  handleRefreshModels,
  handleLoadOpenRouterModels,
  addApiBase,
  removeApiBase,
  syncApiBases,
  adjustTokens,
  browseDirectory,
  testAsrServer,
} = useSettingsForm(props, emit);
</script>

<style scoped>
.settings-tab {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 14px;
  align-items: start;
}

@media (max-width: 1200px) {
  .settings-tab {
    grid-template-columns: 1fr 1fr;
  }
  .settings-actions {
    grid-column: 2;
  }
}

@media (max-width: 700px) {
  .settings-tab {
    grid-template-columns: 1fr;
  }
  .settings-actions {
    grid-column: 1;
  }
}

.settings-actions {
  display: flex;
  gap: 12px;
  padding: 8px 0;
  justify-content: center;
  grid-column: 4;
  align-self: end;
}
</style>
