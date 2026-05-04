<template>
    <Card>
        <template #header>
            <h2>💬 Чат с агентом</h2>
            <span style="font-size: 10px; color: var(--text-muted)">
                {{ isActive ? "Агент запущен" : "Бот не запущен" }}
            </span>
        </template>
        <div class="chat-container">
            <div class="chat-messages" ref="chatContainer">
                <div v-if="messages.length === 0" class="chat-placeholder">
                    <div class="placeholder-icon">🤖</div>
                    <div>
                        {{
                            isActive
                                ? "Введите сообщение для начала диалога"
                                : "Запустите агента для начала общения"
                        }}
                    </div>
                </div>
                <div
                    v-for="(msg, index) in messages"
                    :key="index"
                    :class="['chat-msg', msg.role]"
                >
                    <div class="chat-avatar">
                        {{ msg.role === "user" ? "👤" : "🤖" }}
                    </div>
                    <div class="chat-bubble">
                        {{ msg.content }}
                    </div>
                </div>
                <div v-if="isTyping" class="chat-msg bot">
                    <div class="chat-avatar">🤖</div>
                    <div class="chat-bubble">
                        <div class="typing-indicator">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="chat-input-area">
                <input
                    v-model="inputMessage"
                    type="text"
                    class="chat-input"
                    :disabled="!isActive"
                    :placeholder="
                        isActive
                            ? 'Введите сообщение...'
                            : 'Сначала запустите агента'
                    "
                    @keypress="handleKeypress"
                />
                <button
                    class="chat-send"
                    :disabled="!isActive || !inputMessage.trim()"
                    @click="sendMessage"
                >
                    ➤
                </button>
            </div>
        </div>
    </Card>
</template>

<script setup>
import { ref, nextTick, onMounted, onUnmounted, watch } from "vue";
import Card from "../ui/Card.vue";

const props = defineProps({
    isActive: Boolean,
});

const messages = ref([]);
const inputMessage = ref("");
const isTyping = ref(false);
const chatContainer = ref(null);

// 🔥 Константы для localStorage
const CHAT_HISTORY_KEY = "agent-chat-history";
const MAX_HISTORY_LENGTH = 50;

// 🔥 Именованная функция для слушателя storage (чтобы можно было удалить)
function handleStorageChange(e) {
    if (e.key === CHAT_HISTORY_KEY && e.newValue) {
        try {
            const parsed = JSON.parse(e.newValue);
            if (Array.isArray(parsed)) {
                messages.value = parsed.slice(-MAX_HISTORY_LENGTH);
            }
        } catch {}
    }
}

// 🔥 Загрузка истории из localStorage
function loadChatHistory() {
    try {
        const saved = localStorage.getItem(CHAT_HISTORY_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (
                Array.isArray(parsed) &&
                parsed.every((m) => m.role && m.content)
            ) {
                messages.value = parsed.slice(-MAX_HISTORY_LENGTH);
            }
        }
    } catch (e) {
        console.warn("Failed to load chat history:", e);
    }
}

// 🔥 Сохранение истории в localStorage
function saveChatHistory(history) {
    try {
        const toSave = history.slice(-MAX_HISTORY_LENGTH);
        localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(toSave));
    } catch (e) {
        console.warn("Failed to save chat history:", e);
    }
}

// 🔥 Очистка истории
function clearChatHistory() {
    messages.value = [];
    localStorage.removeItem(CHAT_HISTORY_KEY);
}

// 🔥 API конфигурация
const API_BASE = "http://127.0.0.1:3000/api";
const API_KEY = "agent-secret-key";

async function apiFetch(endpoint, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        ...options.headers,
    };
    const resp = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: resp.statusText }));
        throw new Error(err.error || `HTTP ${resp.status}`);
    }
    return resp.json();
}

// 🔥 Обработчики событий
const handleKeypress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
};

const sendMessage = async () => {
    if (!inputMessage.value.trim() || !props.isActive) return;

    const text = inputMessage.value.trim();
    inputMessage.value = "";

    messages.value.push({ role: "user", content: text });
    isTyping.value = true;

    await nextTick();
    scrollToBottom();

    try {
        const data = await apiFetch("/chat", {
            method: "POST",
            body: JSON.stringify({ message: text }),
        });

        isTyping.value = false;
        messages.value.push({
            role: "bot",
            content: data.reply || "Пустой ответ",
        });
    } catch (error) {
        isTyping.value = false;
        messages.value.push({
            role: "bot",
            content: `❌ Ошибка: ${error.message}`,
        });
    }

    await nextTick();
    scrollToBottom();
};

const scrollToBottom = () => {
    if (chatContainer.value) {
        chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    }
};

// 🔥 Lifecycle hooks
onMounted(() => {
    loadChatHistory();
    window.addEventListener("storage", handleStorageChange);
});

onUnmounted(() => {
    window.removeEventListener("storage", handleStorageChange);
});

// 🔥 Автосохранение при изменении истории
watch(
    messages,
    (newVal) => {
        saveChatHistory(newVal);
    },
    { deep: true },
);

// 🔥 Экспорт для использования извне
defineExpose({ clearChatHistory });
</script>

<style scoped>
.chat-container {
    display: flex;
    flex-direction: column;
    height: 480px;
}

.chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.chat-placeholder {
    text-align: center;
    padding: 20px;
    color: var(--text-muted);
    font-size: 13px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
}

.placeholder-icon {
    font-size: 32px;
}

.chat-msg {
    display: flex;
    gap: 10px;
    max-width: 85%;
    animation: fadeIn 0.2s ease;
}

.chat-msg.user {
    align-self: flex-end;
    flex-direction: row-reverse;
}

.chat-msg.bot {
    align-self: flex-start;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(3px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.chat-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    flex-shrink: 0;
}

.chat-msg.user .chat-avatar {
    background: var(--accent);
}
.chat-msg.bot .chat-avatar {
    background: #8b5cf6;
}

.chat-bubble {
    padding: 10px 14px;
    border-radius: 14px;
    font-size: 13px;
    line-height: 1.5;
    border: 1px solid var(--border);
}

.chat-msg.user .chat-bubble {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
    border-bottom-right-radius: 4px;
}

.chat-msg.bot .chat-bubble {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border-bottom-left-radius: 4px;
}

.chat-input-area {
    display: flex;
    gap: 8px;
    padding: 12px;
    border-top: 1px solid var(--border);
    background: var(--bg-card);
}

.chat-input {
    flex: 1;
    padding: 10px 14px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 100px;
    color: var(--text-primary);
    font-size: 13px;
    font-family: inherit;
    transition: var(--transition);
}

.chat-input:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: 0 0 0 3px var(--accent-glow);
}

.chat-input:disabled {
    opacity: 0.5;
}

.chat-send {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--accent);
    border: none;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    transition: var(--transition);
}

.chat-send:hover:not(:disabled) {
    background: var(--accent-hover);
    box-shadow: 0 0 16px var(--accent-glow);
}

.chat-send:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.typing-indicator {
    display: flex;
    gap: 4px;
    padding: 12px 16px;
}

.typing-indicator span {
    width: 6px;
    height: 6px;
    background: var(--text-muted);
    border-radius: 50%;
    animation: typing 1.2s infinite;
}

.typing-indicator span:nth-child(2) {
    animation-delay: 0.2s;
}
.typing-indicator span:nth-child(3) {
    animation-delay: 0.4s;
}

@keyframes typing {
    0%,
    100% {
        transform: translateY(0);
        opacity: 0.4;
    }
    50% {
        transform: translateY(-6px);
        opacity: 1;
    }
}
</style>
