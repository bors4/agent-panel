<template>
    <Card>
        <template #header>
            <h2>⚡ Управление</h2>
        </template>
        <div class="controls-grid">
            <Button
                variant="primary"
                full-width
                :disabled="isRunning"
                @click="$emit('start')"
            >
                <span class="btn-icon">▶️</span> Запустить
            </Button>
            <Button
                variant="danger"
                :disabled="!isRunning"
                @click="$emit('stop')"
            >
                <span class="btn-icon">⏹️</span> Стоп
            </Button>
            <Button :disabled="!isRunning" @click="$emit('restart')">
                <span class="btn-icon">🔄</span> Рестарт
            </Button>
        </div>
    </Card>
</template>

<script setup>
import Card from "../ui/Card.vue";
import Button from "../ui/Button.vue";

defineProps({ isRunning: Boolean });
defineEmits(["start", "stop", "restart"]);
</script>

<style scoped>
.controls-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
}
</style>
