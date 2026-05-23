<template>
  <div class="quick-settings">
    <ToggleSwitch
      :model-value="settings.autoSave"
      label="Автосохранение"
      @update:model-value="updateSetting('autoSave', $event)"
    />
    <ToggleSwitch
      :model-value="settings.verbose"
      label="Подробный режим"
      @update:model-value="updateSetting('verbose', $event)"
    />
    <ToggleSwitch
      :model-value="settings.autoStart"
      label="Автозапуск агента"
      @update:model-value="updateSetting('autoStart', $event)"
    />
    <ToggleSwitch
      :model-value="settings.showTokens"
      label="Показ токенов"
      @update:model-value="updateSetting('showTokens', $event)"
    />
  </div>
</template>

<script setup>
import ToggleSwitch from "../ui/ToggleSwitch.vue";

const props = defineProps({
  settings: { type: Object, required: true },
});

const emit = defineEmits(["save"]);

const updateSetting = (key, value) => {
  emit("save", { ...props.settings, [key]: value });
};
</script>

<style scoped>
.quick-settings {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
</style>
