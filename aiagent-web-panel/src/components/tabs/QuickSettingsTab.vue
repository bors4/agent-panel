<template>
    <Card>
        <template #header>
            <h2>Быстрые настройки</h2>
        </template>
        <ToggleSwitch
            :model-value="settings.autoSave"
            @update:model-value="updateSetting('autoSave', $event)"
            label="Auto-save промпт"
        />
        <ToggleSwitch
            :model-value="settings.verbose"
            @update:model-value="updateSetting('verbose', $event)"
            label="Verbose логи"
        />
        <ToggleSwitch
            :model-value="settings.autoStart"
            @update:model-value="updateSetting('autoStart', $event)"
            label="Автостарт при загрузке"
        />
        <ToggleSwitch
            :model-value="settings.notifications"
            @update:model-value="updateSetting('notifications', $event)"
            label="Уведомления в Telegram"
        />
        <ToggleSwitch
            :model-value="settings.showTokens"
            @update:model-value="updateSetting('showTokens', $event)"
            label="Показывать токены в логах"
        />
    </Card>
</template>

<script setup>
import Card from "../ui/Card.vue";
import Button from "../ui/Button.vue";
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
