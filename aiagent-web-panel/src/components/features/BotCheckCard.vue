<template>
    <Card>
        <template #header>
            <h2>🔗 Проверка бота</h2>
        </template>
        <Button
            variant="success"
            full-width
            :disabled="checking"
            @click="checkBot"
        >
            <span class="btn-icon">📨</span> Проверить через Telegram
        </Button>
        <div
            class="status-text"
            :style="{ color: statusColor }"
            v-html="statusText"
        ></div>
    </Card>
</template>

<script setup>
import { ref } from "vue";
import Card from "../ui/Card.vue";
import Button from "../ui/Button.vue";
import { useToast } from "@/composables/useToast";
import { getConfig } from "@/api/client";

const { success, error: showError } = useToast();
const checking = ref(false);
const statusText = ref("Нажмите для проверки");
const statusColor = ref("var(--text-muted)");

async function checkBot() {
    try {
        let token = "";

        try {
            const data = await getConfig();
            token = data.config?.token || "";
        } catch {}

        if (!token) {
            showError("Укажите токен в настройках");
            statusText.value = "✗ Токен не найден";
            statusColor.value = "var(--error)";
            return;
        }

        checking.value = true;
        statusText.value = '<span class="spinner">⏳</span> Подключение...';

        const telegramResp = await fetch(
            `https://api.telegram.org/bot${token}/getMe`,
            { signal: AbortSignal.timeout(10000) },
        );

        const data = await telegramResp.json();

        if (data.ok) {
            statusText.value = `✓ ${data.result.first_name} (@${data.result.username})`;
            statusColor.value = "var(--success)";
            success("Бот подключён");
        } else {
            throw new Error(data.description);
        }
    } catch (e) {
        statusText.value = "✗ Ошибка подключения";
        statusColor.value = "var(--error)";
        showError(e.message || "Неизвестная ошибка");
    } finally {
        checking.value = false;
    }
}
</script>

<style scoped>
.status-text {
    margin-top: 10px;
    font-size: 11px;
    color: var(--text-muted);
    text-align: center;
}

.spinner {
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 2px solid var(--text-muted);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}
</style>
