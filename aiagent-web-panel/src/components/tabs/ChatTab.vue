<template>
     <Card>
         <template #header>
<div class="chat-header">
                  <h2>💬 Чат с агентом</h2>
                  <span class="status-badge" :class="{ active: isActive }">
                      <span class="status-dot"></span>
                      {{ isActive ? "Агент запущен" : "Агент не запущен" }}
                  </span>
              </div>
         </template>
         <div class="chat-container" @contextmenu.prevent="showContextMenu">
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
                      <div class="chat-msg-col">
                          <div class="chat-bubble">
                              {{ msg.content }}
                          </div>
                          <div v-if="showTokens && msg.usage && msg.role === 'bot'" class="token-info">
                              <span>⚡ {{ msg.usage.total_tokens }} tokens</span>
                              <span class="token-detail">(p:{{ msg.usage.prompt_tokens }}, c:{{ msg.usage.completion_tokens }})</span>
                              <span v-if="msg.usage.prompt_tokens_details?.cached_tokens !== undefined" class="token-detail">cached:{{ msg.usage.prompt_tokens_details.cached_tokens }}</span>
                          </div>
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
<div class="chat-tools-menu">
                      <button
                          class="chat-tools-btn"
                          :class="{ active: toolsMenuOpen }"
                          @click="toolsMenuOpen = !toolsMenuOpen"
                          title="Инструменты чата"
                      >
                          <span class="dot dot-top"></span>
                          <span class="dot dot-middle"></span>
                          <span class="dot dot-bottom"></span>
                      </button>
                     <Transition name="tools-menu-fade">
                         <div
                             v-if="toolsMenuOpen"
                             class="tools-dropdown"
                             @click="toolsMenuOpen = false"
                         >
                             <div
                                 class="tools-dropdown-item"
                                 :class="{ disabled: messages.length === 0 }"
                                 @click.stop="handleClearChat"
                             >
                                 🗑️ Очистить чат
                             </div>
                         </div>
                     </Transition>
                 </div>
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
         <Transition name="contextmenu-fade">
             <div
                 v-if="contextMenuVisible"
                 class="context-menu"
                 :style="{ top: menuY + 'px', left: menuX + 'px' }"
                 @contextmenu.prevent
             >
                 <div class="context-menu-item" @click="handleClearChat">
                     🗑️ Очистить чат
                 </div>
             </div>
         </Transition>
         <Transition name="confirm-fade">
             <div v-if="showConfirm" class="confirm-overlay" @click.self="showConfirm = false">
                 <div class="confirm-dialog">
                     <p>Очистить весь чат? История сообщений будет удалена.</p>
                     <div class="confirm-actions">
                         <button class="confirm-btn cancel" @click="showConfirm = false">Отмена</button>
                         <button class="confirm-btn confirm" @click="confirmClearChat">Очистить</button>
                     </div>
                 </div>
             </div>
         </Transition>
     </Card>
 </template>

<!--
  Компонент чата для тестирования AI агента.
  Поддерживает отправку сообщений, отображение истории, очистку чата.
  История сохраняетсяется в localStorage.
-->
<script setup>
import { ref, nextTick, onMounted, onUnmounted, watch } from "vue";
import Card from "../ui/Card.vue";
import { directChat } from "@/api/client";

const props = defineProps({
    isActive: Boolean,
    modelName: { type: String, default: "Qwen3.5-9B-OmniCoder-Claude-Polaris.i1-IQ4_NL" },
    serverUrl: { type: String, default: "http://192.168.1.101:8080/v1" },
    projectPath: { type: String, default: "C:\\" },
    systemPrompt: { type: String, default: "" },
    verbose: { type: Boolean, default: false },
    showTokens: { type: Boolean, default: true },
});

const emit = defineEmits(["log", "token-usage"]);

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

const showConfirm = ref(false);
const contextMenuVisible = ref(false);
const menuX = ref(0);
const menuY = ref(0);
const toolsMenuOpen = ref(false);

// 🔥 Очистка истории
function clearChatHistory() {
     messages.value = [];
     localStorage.removeItem(CHAT_HISTORY_KEY);
}

// 🎯 Контекстное меню
function showContextMenu(e) {
     contextMenuVisible.value = false;
     nextTick(() => {
         menuX.value = e.clientX;
         menuY.value = e.clientY;
         contextMenuVisible.value = true;
     });
}

function handleClearChat() {
     contextMenuVisible.value = false;
     showConfirm.value = true;
}

function confirmClearChat() {
     clearChatHistory();
     showConfirm.value = false;
     emit("log", { message: "Чат очищен", type: "success" });
}

// 🔥 Обработчики событий
const handleKeypress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
};

const sendMessage = async () => {
    if (!inputMessage.value.trim()) return;

    const text = inputMessage.value.trim();
    inputMessage.value = "";

    messages.value.push({ role: "user", content: text });
    isTyping.value = true;

    await nextTick();
    scrollToBottom();

    const startTime = Date.now();

    if (props.verbose) {
        emit("log", {
            message: `[VERBOSE] Request → model: ${props.modelName}, server: ${props.serverUrl}`,
            type: "system"
        });
    }

    try {
        const data = await directChat({
            message: text,
            modelName: props.modelName,
            serverUrl: props.serverUrl,
            projectPath: props.projectPath,
            systemPrompt: props.systemPrompt
        });

        const latency = Date.now() - startTime;
        isTyping.value = false;

        const botMsg = {
            role: "bot",
            content: data.reply || "Пустой ответ",
            usage: data.usage || null,
        };
        messages.value.push(botMsg);

        if (props.verbose) {
            emit("log", {
                message: `[VERBOSE] Response ← model (${latency}ms): ${data.reply || "empty"}`,
                type: "success"
            });
            if (data.usage) {
                emit("log", {
                    message: `[VERBOSE] Tokens: prompt=${data.usage.prompt_tokens}, completion=${data.usage.completion_tokens}, total=${data.usage.total_tokens}, cached=${data.usage.prompt_tokens_details?.cached_tokens ?? "N/A"}`,
                    type: "info"
                });
            }
        } else {
            emit("log", {
                message: `Model response (${props.modelName}): ${data.reply?.substring(0, 100)}...`,
                type: "success"
            });
        }

        if (data.usage) {
            emit("token-usage", data.usage);
        }
    } catch (error) {
        const latency = Date.now() - startTime;
        isTyping.value = false;
        messages.value.push({
            role: "bot",
            content: `❌ Ошибка: ${error.message}`,
        });
        emit("log", {
            message: `Chat error (${latency}ms): ${error.message}`,
            type: "error"
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
    nextTick(() => scrollToBottom());
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

 .chat-header {
     display: flex;
     justify-content: space-between;
     align-items: center;
     width: 100%;
 }

 .status-badge {
     display: inline-flex;
     align-items: center;
     gap: 5px;
     font-size: 10px;
     font-weight: 600;
     padding: 3px 8px;
     border-radius: 10px;
     background: var(--bg-tertiary);
     color: var(--text-muted);
     border: 1px solid var(--border);
     transition: var(--transition);
 }

 .status-badge.active {
     background: rgba(16, 185, 129, 0.1);
     color: #10b981;
     border-color: rgba(16, 185, 129, 0.3);
 }

 .status-dot {
     width: 6px;
     height: 6px;
     border-radius: 50%;
     background: var(--text-muted);
     transition: var(--transition);
 }

 .status-badge.active .status-dot {
     background: #10b981;
     box-shadow: 0 0 6px rgba(16, 185, 129, 0.5);
     animation: pulse 2s infinite;
 }

 @keyframes pulse {
     0%, 100% { opacity: 1; }
     50% { opacity: 0.5; }
 }

.chat-tools-menu {
      display: flex;
      align-items: center;
      gap: 8px;
      position: relative;
  }

.tools-btn {
        background: var(--bg-tertiary);
        border: 1px solid var(--border);
        color: var(--text-muted);
        width: 38px;
        height: 38px;
        border-radius: var(--radius-sm);
        cursor: pointer;
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        gap: 5px;
        transition: var(--transition);
        padding: 0;
        position: relative;
        transform: rotate(180deg);
    }

    .tools-btn:hover:not(:disabled) {
        background: var(--bg-hover);
    }

    .tools-btn:hover:not(:disabled) .dot {
        background: var(--accent-primary);
    }

    .tools-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }

    .dot {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: var(--text-muted);
        display: block;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* Анимация в крестик */
    .tools-btn.active .dot-top {
        transform: translateY(5.5px) rotate(45deg);
        background: var(--error);
    }

    .tools-btn.active .dot-middle {
        opacity: 0;
        transform: scale(0);
    }

    .tools-btn.active .dot-bottom {
        transform: translateY(-5.5px) rotate(-45deg);
        background: var(--error);
    }

  /* Tools dropdown — opens upward */
  .tools-dropdown {
      position: absolute;
      bottom: calc(100% + 8px);
      left: 0;
      z-index: 10000;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      box-shadow: var(--shadow-lg);
      min-width: 180px;
      overflow: hidden;
      animation: menuSlideUp 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes menuSlideUp {
      from {
          opacity: 0;
          transform: translateY(8px) scale(0.97);
      }
      to {
          opacity: 1;
          transform: translateY(0) scale(1);
      }
  }

   .tools-dropdown-item {
      padding: 10px 16px;
      cursor: pointer;
      font-size: 13px;
      color: var(--text-primary);
      transition: background 0.15s;
      display: flex;
      align-items: center;
      gap: 8px;
  }

  .tools-dropdown-item:hover {
      background: var(--bg-hover);
      color: var(--accent-primary);
  }

  .tools-dropdown-item.disabled {
      opacity: 0.3;
      cursor: not-allowed;
  }

  /* Context menu (right-click) */
  .context-menu {
     position: fixed;
     z-index: 9999;
     background: var(--bg-card);
     border: 1px solid var(--border);
     border-radius: var(--radius-sm);
     box-shadow: var(--shadow-lg);
     min-width: 180px;
     overflow: hidden;
     animation: contextMenuIn 0.15s ease-out;
 }

 @keyframes contextMenuIn {
     from {
         opacity: 0;
         transform: scale(0.95) translateY(-4px);
     }
     to {
         opacity: 1;
         transform: scale(1) translateY(0);
     }
 }

 .context-menu-item {
     padding: 10px 16px;
     cursor: pointer;
     font-size: 13px;
     color: var(--text-primary);
     transition: background 0.15s;
     display: flex;
     align-items: center;
     gap: 8px;
 }

 .context-menu-item:hover {
     background: var(--bg-hover);
     color: var(--accent-primary);
 }

 /* Confirm dialog */
 .confirm-overlay {
     position: fixed;
     inset: 0;
     background: rgba(0, 0, 0, 0.5);
     z-index: 10000;
     display: flex;
     align-items: center;
     justify-content: center;
     animation: fadeIn 0.2s ease;
 }

 .confirm-dialog {
     background: var(--bg-card);
     border: 1px solid var(--border);
     border-radius: var(--radius);
     padding: 24px;
     max-width: 360px;
     width: 90%;
     box-shadow: var(--shadow-lg);
     animation: dialogIn 0.2s ease;
 }

 .confirm-dialog p {
     color: var(--text-primary);
     margin-bottom: 20px;
     font-size: 14px;
     line-height: 1.5;
 }

 .confirm-actions {
     display: flex;
     justify-content: flex-end;
     gap: 10px;
 }

 .confirm-btn {
     padding: 8px 18px;
     border-radius: var(--radius-sm);
     border: 1px solid var(--border);
     cursor: pointer;
     font-size: 13px;
     font-weight: 500;
     transition: var(--transition);
 }

 .confirm-btn.cancel {
     background: var(--bg-tertiary);
     color: var(--text-secondary);
 }

 .confirm-btn.cancel:hover {
     background: var(--bg-hover);
     color: var(--text-primary);
 }

 .confirm-btn.confirm {
     background: var(--error);
     color: white;
     border-color: var(--error);
 }

 .confirm-btn.confirm:hover {
     background: #dc2626;
 }

 @keyframes dialogIn {
     from {
         opacity: 0;
         transform: scale(0.95) translateY(-8px);
     }
     to {
         opacity: 1;
         transform: scale(1) translateY(0);
     }
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

.chat-msg-col {
    display: flex;
    flex-direction: column;
    gap: 4px;
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
     background: var(--accent-primary);
     color: white;
     border-color: var(--accent-primary);
     border-bottom-right-radius: 4px;
 }

.chat-msg.bot .chat-bubble {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border-bottom-left-radius: 4px;
}

.token-info {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 9px;
    color: var(--text-muted);
    font-family: "JetBrains Mono", monospace;
    padding: 0 4px;
}

.token-detail {
    opacity: 0.7;
}

.chat-input-area {
     display: flex;
     gap: 8px;
     padding: 12px;
     border-top: 1px solid var(--border);
     background: var(--bg-card);
     position: relative;
     overflow: visible;
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
