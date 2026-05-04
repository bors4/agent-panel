<template>
    <Card>
        <template #header>
            <h2>Быстрые настройки</h2>
        </template>
        <ToggleSwitch
            v-model="localSettings.autoSave"
            label="Auto-save промпт"
        />
        <ToggleSwitch v-model="localSettings.verbose" label="Verbose логи" />
        <ToggleSwitch
            v-model="localSettings.autoStart"
            label="Автостарт при загрузке"
        />
        <ToggleSwitch
            v-model="localSettings.notifications"
            label="Уведомления в Telegram"
        />
        <ToggleSwitch
            v-model="localSettings.showTokens"
            label="Показывать токены в логах"
        />
        <Button
            variant="primary"
            full-width
            @click="$emit('save')"
            style="margin-top: 16px"
        >
            💾 Сохранить
        </Button>
    </Card>

    <Card>
        <template #header>
            <h2>⚡ Пресеты</h2>
        </template>
        <div class="preset-buttons">
            <Button @click="$emit('preset', 'fast')" full-width>
                🚀 Быстрый (3B модель, малый контекст)
            </Button>
            <Button @click="$emit('preset', 'balanced')" full-width>
                ⚖️ Баланс (7B модель, 32K контекст)
            </Button>
            <Button @click="$emit('preset', 'quality')" full-width>
                🧠 Качество (14B модель, 64K контекст)
            </Button>
            <Button
                variant="danger"
                @click="$emit('preset', 'debug')"
                full-width
            >
                🐛 Режим отладки
            </Button>
        </div>
    </Card>
</template>

<script setup>
import { ref, watch } from "vue";
import Card from "../ui/Card.vue";
import Button from "../ui/Button.vue";
import ToggleSwitch from "../ui/ToggleSwitch.vue";

const props = defineProps({
    settings: { type: Object, required: true },
});

const emit = defineEmits(["update:settings", "save", "preset"]);

const localSettings = ref({ ...props.settings });

watch(
    () => props.settings,
    (newVal) => {
        localSettings.value = { ...newVal };
    },
    { deep: true },
);

watch(
    localSettings,
    (newVal) => {
        emit("update:settings", { ...newVal });
    },
    { deep: true },
);
</script>

<style scoped>
.preset-buttons {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
</style>
