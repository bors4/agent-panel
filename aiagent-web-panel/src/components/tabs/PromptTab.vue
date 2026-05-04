<template>
    <Card>
        <template #header>
            <h2>Системный промпт агента</h2>
            <span style="font-size: 11px; color: var(--text-muted)">
                {{ charCount }} символов
            </span>
        </template>
        <div class="prompt-editor">
            <div class="editor-toolbar">
                <span>Markdown / Plain text</span>
                <div class="editor-actions">
                    <Button @click="$emit('reset')">↩️ Сброс</Button>
                    <Button @click="$emit('format')">✨ Формат</Button>
                    <Button @click="$emit('copy')">📋 Копировать</Button>
                </div>
            </div>
            <textarea
                v-model="localPrompt"
                class="form-textarea"
                spellcheck="false"
                placeholder="Введите системный промпт..."
                @input="handleInput"
            ></textarea>
        </div>
        <div style="margin-top: 12px; display: flex; gap: 8px">
            <Button variant="primary" @click="$emit('save')" style="flex: 1">
                💾 Сохранить промпт
            </Button>
            <Button @click="$emit('export')">📤 Экспорт</Button>
            <Button @click="$emit('import')">📥 Импорт</Button>
        </div>
    </Card>
</template>

<script setup>
import { ref, watch } from "vue";
import Card from "../ui/Card.vue";
import Button from "../ui/Button.vue";

const props = defineProps({
    modelValue: { type: String, default: "" },
});

const emit = defineEmits([
    "update:modelValue",
    "save",
    "reset",
    "format",
    "copy",
    "export",
    "import",
]);

const localPrompt = ref(props.modelValue);
const charCount = ref(props.modelValue.length);

watch(
    () => props.modelValue,
    (val) => {
        localPrompt.value = val;
        charCount.value = val.length;
    },
);

const handleInput = () => {
    charCount.value = localPrompt.value.length;
    emit("update:modelValue", localPrompt.value);
};
</script>

<style scoped>
.prompt-editor {
    display: flex;
    flex-direction: column;
}

.editor-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-bottom: none;
    border-radius: var(--radius-sm) var(--radius-sm) 0 0;
}

.editor-actions {
    display: flex;
    gap: 5px;
}

.form-textarea {
    width: 100%;
    min-height: 320px;
    resize: vertical;
    line-height: 1.7;
    font-size: 11.5px;
    tab-size: 2;
    font-family: "JetBrains Mono", monospace;
    padding: 14px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 0 0 var(--radius-sm) var(--radius-sm);
    color: var(--text-primary);
    overflow-y: auto;
}

.form-textarea:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: 0 0 0 3px var(--accent-glow);
}
</style>
