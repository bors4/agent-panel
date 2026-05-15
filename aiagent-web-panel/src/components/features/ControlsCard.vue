<template>
    <Card>
        <template #header>
            <h2>⚡ Управление</h2>
        </template>
        <div class="controls-grid">
<Button
                 variant="primary"
                 full-width
                 :disabled="isRunning || !projectPath"
                 @click="$emit('start')"
             >
                 <span class="btn-icon">▶️</span> Запустить
             </Button>
             <Button
                 variant="danger"
                 :disabled="!isRunning || !projectPath"
                 @click="$emit('stop')"
             >
                 <span class="btn-icon">⏹️</span> Стоп
             </Button>
             <Button :disabled="!isRunning || !projectPath" @click="$emit('restart')">
                 <span class="btn-icon">🔄</span> Рестарт
             </Button>
        </div>
    </Card>
</template>

<script setup>
import Card from "../ui/Card.vue";
import Button from "../ui/Button.vue";

defineProps({ isRunning: Boolean, projectPath: String });
defineEmits(["start", "stop", "restart"]);
</script>

<style scoped>
.controls-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
}

.controls-grid .btn {
    position: relative;
    overflow: hidden;
}

.controls-grid .btn::before {
    content: "";
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
    transition: left 0.5s ease;
}

.controls-grid .btn:hover::before {
    left: 100%;
}

.controls-grid .btn:hover:not(.disabled) {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
}

.controls-grid .btn:active:not(.disabled) {
    transform: translateY(0);
}

.controls-grid .btn.primary {
    grid-column: 1 / -1;
}

.controls-grid .btn.primary:hover:not(.disabled) {
    background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
    box-shadow: 0 4px 24px var(--accent-glow);
}

.controls-grid .btn.danger:hover:not(.disabled) {
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.1));
    box-shadow: 0 4px 16px rgba(239, 68, 68, 0.4);
}

.controls-grid .btn:hover:not(.disabled) {
    border-color: var(--border-focus);
}

.controls-grid .btn.disabled {
    opacity: 0.3;
    transform: none !important;
}

.controls-grid .btn .btn-icon {
    font-size: 14px;
    margin-right: 4px;
}
</style>
