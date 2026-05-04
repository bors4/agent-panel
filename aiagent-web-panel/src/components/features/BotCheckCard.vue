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

const { showToast } = useToast();
const checking = ref(false);
const statusText = ref("Нажмите для проверки");
const statusColor = ref("var(--text-muted)");

async function checkBot() {
    try {
        // 🔥 Читаем токен из localStorage (где он сохраняется при настройке)
        const savedConfig = localStorage.getItem("agent-config");
        let token = "";

        if (savedConfig) {
            try {
                const parsed = JSON.parse(savedConfig);
                token = parsed.token || "";
            } catch {}
        }

        // Если не нашли в localStorage — пробуем получить из API (fallback)
        if (!token) {
            try {
                const resp = await fetch("http://127.0.0.1:3000/api/config", {
                    headers: { "x-api-key": "agent-secret-key" },
                    method: "POST", // POST возвращает текущий конфиг после обновления
                    body: JSON.stringify({}), // пустой запрос для получения текущего состояния
                });
                if (resp.ok) {
                    const data = await resp.json();
                    token = data.config?.token || "";
                }
            } catch {}
        }

        if (!token) {
            showToast("Укажите токен в настройках", "error");
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
            showToast("Бот подключён", "success");
        } else {
            throw new Error(data.description);
        }
    } catch (e) {
        statusText.value = "✗ Ошибка подключения";
        statusColor.value = "var(--error)";
        showToast(e.message || "Неизвестная ошибка", "error");
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
