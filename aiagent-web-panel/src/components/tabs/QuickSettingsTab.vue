<!--
  QuickSettingsTab
  - autoSave: при false — success-уведомления скрыты, localStorage пишется всегда
  - verbose: при true — ChatTab логирует тайминги и полные ответы в LogsTab
  - autoStart: при true + token + projectPath — агент запускается при загрузке
  - showTokens: StatsCard (диаграмма + мини-бары), ChatTab (токены под ответами)
  Удалено: notifications (не было логики потребления)
-->
<template>
    <Card>
        <template #header>
            <h2>Быстрые настройки</h2>
        </template>
        <ToggleSwitch
            :model-value="settings.autoSave"
            @update:model-value="updateSetting('autoSave', $event)"
            label="Автосохранение"
        />
        <ToggleSwitch
            :model-value="settings.verbose"
            @update:model-value="updateSetting('verbose', $event)"
            label="Подробный режим"
        />
        <ToggleSwitch
            :model-value="settings.autoStart"
            @update:model-value="updateSetting('autoStart', $event)"
            label="Автозапуск агента"
        />
        <ToggleSwitch
            :model-value="settings.showTokens"
            @update:model-value="updateSetting('showTokens', $event)"
            label="Показ токенов"
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

<style scoped>
</style>
