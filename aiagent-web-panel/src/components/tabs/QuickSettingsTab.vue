<!--
  QuickSettingsTab
  - autoSave: при false — success-уведомления скрыты, localStorage пишется всегда
  - verbose: при true — ChatTab логирует тайминги и полные ответы в LogsTab
  - autoStart: при true + token + projectPath — агент запускается при загрузке
  - showTokens: StatsCard (диаграмма + мини-бары), ChatTab (токены под ответами)
-->
<template>
  <Card>
    <template #header>
      <h2>Быстрые настройки</h2>
    </template>
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
  </Card>
</template>

<script setup>
import Card from "../ui/Card.vue";
import ToggleSwitch from "../ui/ToggleSwitch.vue";

const props = defineProps({
  settings: { type: Object, required: true },
});

const emit = defineEmits(["save"]);

const updateSetting = (key, value) => {
  emit("save", { ...props.settings, [key]: value });
};
</script>

<style scoped></style>
