<template>
  <Card>
    <template #header>
      <div class="chat-header">
        <div class="chat-header-left">
          <h2>💬 Чат с агентом</h2>
          <span class="status-badge" :class="{ active: isActive }">
            <span class="status-dot" />
            {{ isActive ? "Агент запущен" : "Агент не запущен" }}
          </span>
        </div>
        <div class="chat-header-right">
          <label class="agent-toggle" title="Использовать agent loop с инструментами">
            <span class="toggle-label">Agent</span>
            <input v-model="agentMode" type="checkbox" @change="onAgentModeChange" />
            <span class="toggle-slider" />
          </label>
        </div>
      </div>
    </template>
    <div class="chat-container" @contextmenu.prevent="showContextMenu">
      <div ref="chatContainer" class="chat-messages">
        <div v-if="messages.length === 0" class="chat-placeholder">
          <div class="placeholder-icon">🤖</div>
          <div>
            {{ isActive ? "Введите сообщение для начала диалога" : "Запустите агента для начала общения" }}
          </div>
        </div>
        <div v-for="(msg, index) in messages" :key="index" :class="['chat-msg', msg.role, msg.type ? 'msg-' + msg.type : '']">
          <div class="chat-avatar">
            <template v-if="msg.type === 'tool_call'">🔧</template>
            <template v-else-if="msg.type === 'tool_result'">📊</template>
            <template v-else-if="msg.type === 'approval'">🔐</template>
            <template v-else>{{ msg.role === "user" ? "👤" : "🤖" }}</template>
          </div>
          <div class="chat-msg-col">
            <!-- Tool call block -->
            <div v-if="msg.type === 'tool_call'" class="tool-call-block" :class="{ collapsed: !msg.expanded }">
              <div class="tool-call-header" @click="msg.expanded = !msg.expanded">
                <span class="tool-call-name">🔧 {{ msg.toolName }}({{ msg.toolArgsShort }})</span>
                <span class="tool-call-toggle">{{ msg.expanded ? "▲" : "▼" }}</span>
              </div>
              <pre v-if="msg.expanded" class="tool-call-args">{{ msg.toolArgsPretty }}</pre>
            </div>
            <!-- Tool result block -->
            <div v-else-if="msg.type === 'tool_result'" class="tool-result-block" :class="{ collapsed: !msg.expanded }">
              <div class="tool-result-header" @click="msg.expanded = !msg.expanded">
                <span class="tool-result-status" :class="msg.success ? 'success' : 'error'">
                  {{ msg.success ? "✅" : "❌" }}
                </span>
                <span class="tool-result-label">{{ msg.success ? "Успешно" : "Ошибка" }}</span>
                <span class="tool-call-toggle">{{ msg.expanded ? "▲" : "▼" }}</span>
              </div>
              <pre v-if="msg.expanded" class="tool-result-output">{{ msg.output }}</pre>
            </div>
            <!-- Approval request block -->
            <div v-else-if="msg.type === 'approval'" class="approval-block">
              <div class="approval-header">🔐 Требуется одобрение</div>
              <div class="approval-tool">Инструмент: <strong>{{ msg.toolName }}</strong></div>
              <pre class="approval-args">{{ msg.toolArgsPretty }}</pre>
              <div class="approval-buttons">
                <button class="approval-btn approve" @click="approveTool(msg)">✅ Одобрить</button>
                <button class="approval-btn reject" @click="rejectTool(msg)">❌ Отклонить</button>
              </div>
            </div>
            <!-- Regular message -->
            <template v-else>
              <div class="chat-bubble" :class="{ streaming: msg.streaming }">
                {{ msg.content }}
                <span v-if="msg.streaming && msg.content" class="cursor-blink">|</span>
              </div>
              <div v-if="showTokens && msg.usage && msg.role === 'bot'" class="token-info">
                <span>⚡ {{ msg.usage.total_tokens }} tokens</span>
                <span class="token-detail">(p:{{ msg.usage.prompt_tokens }}, c:{{ msg.usage.completion_tokens }})</span>
                <span v-if="msg.usage.prompt_tokens_details?.cached_tokens !== undefined" class="token-detail"
                  >cached:{{ msg.usage.prompt_tokens_details.cached_tokens }}</span
                >
              </div>
            </template>
          </div>
        </div>
        <div v-if="isTyping" class="chat-msg bot">
          <div class="chat-avatar">🤖</div>
          <div class="chat-bubble">
            <div class="typing-indicator">
              <span />
              <span />
              <span />
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
          :placeholder="isActive ? 'Введите сообщение...' : 'Сначала запустите агента'"
          @keypress="handleKeypress"
        />
        <button class="chat-send" :disabled="!isActive || !inputMessage.trim()" @click="sendMessage">➤</button>
        <button
          class="chat-clear"
          :disabled="messages.length === 0"
          title="Очистить чат"
          @click="handleClearChat"
        >
          🗑
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
        <div class="context-menu-item" @click="handleClearChat">🗑️ Очистить чат</div>
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
  История сохраняется в localStorage.
-->
<script setup>
import { ref, nextTick, onMounted, onUnmounted, watch } from "vue";
import Card from "../ui/Card.vue";
import { directChat, directChatStream, agentChat, agentChatContinue } from "@/api/client";

const props = defineProps({
  isActive: Boolean,
  modelName: { type: String, default: "" },
  serverUrl: { type: String, default: "http://127.0.0.1:8080/v1" },
  projectPath: { type: String, default: "C:\\" },
  systemPrompt: { type: String, default: "" },
  verbose: { type: Boolean, default: false },
  showTokens: { type: Boolean, default: true },
  streamEnabled: { type: Boolean, default: false },
});

const emit = defineEmits(["log", "token-usage"]);

const messages = ref([]);
const inputMessage = ref("");
const isTyping = ref(false);
const isStreaming = ref(false);
const streamingContent = ref("");
const chatContainer = ref(null);

// Agent mode state
const AGENT_MODE_KEY = "agent-chat-mode";
const agentMode = ref(localStorage.getItem(AGENT_MODE_KEY) !== "false");
const pendingApproval = ref(null);
const approvalMessages = ref([]);

function onAgentModeChange() {
  localStorage.setItem(AGENT_MODE_KEY, agentMode.value.toString());
}

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
      if (Array.isArray(parsed) && parsed.every((m) => m.role && m.content)) {
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

// 🔥 Очистка истории
function clearChatHistory() {
  messages.value = [];
  pendingApproval.value = null;
  approvalMessages.value = [];
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

// Преобразовать toolCalls и toolResults из ответа в сообщения для чата
function addToolMessages(toolCalls, toolResults, requiresApproval, approvalToolName, approvalArgs, approvalToolCallId) {
  if (toolCalls?.length > 0) {
    for (const tc of toolCalls) {
      let argsParsed;
      try { argsParsed = JSON.parse(tc.args); } catch { argsParsed = tc.args; }
      const argsStr = typeof argsParsed === "object" ? JSON.stringify(argsParsed, null, 2) : String(tc.args);
      const shortStr = typeof argsParsed === "object"
        ? Object.keys(argsParsed).slice(0, 3).map(k => `${k}=${String(argsParsed[k]).substring(0, 30)}`).join(", ") + (Object.keys(argsParsed).length > 3 ? "..." : "")
        : String(tc.args).substring(0, 50);
      messages.value.push({
        role: "system",
        type: "tool_call",
        toolName: tc.name,
        toolArgsPretty: argsStr,
        toolArgsShort: shortStr,
        expanded: false,
        toolCallId: tc.id,
      });
    }
  }

  if (toolResults?.length > 0) {
    for (const tr of toolResults) {
      messages.value.push({
        role: "system",
        type: "tool_result",
        success: tr.success,
        output: String(tr.output),
        expanded: false,
      });
    }
  }

  if (requiresApproval) {
    let argsParsed;
    try { argsParsed = JSON.parse(approvalArgs); } catch { argsParsed = approvalArgs; }
    const argsStr = typeof argsParsed === "object" ? JSON.stringify(argsParsed, null, 2) : String(approvalArgs);
    pendingApproval.value = {
      toolName: approvalToolName,
      args: approvalArgs,
      toolCallId: approvalToolCallId,
    };
    messages.value.push({
      role: "system",
      type: "approval",
      toolName: approvalToolName,
      toolArgsPretty: argsStr,
      pendingApproval: true,
      toolCallId: approvalToolCallId,
    });
  }
}

// Agent loop send message
async function sendAgentMessage(text) {
  // Собираем историю для отправки на бэкенд
  const historyMsgs = messages.value
    .filter(m => !m.type) // только обычные сообщения
    .map(m => ({ role: m.role === "bot" ? "assistant" : m.role, content: m.content }));

  const result = await agentChat({
    message: text,
    messages: historyMsgs,
    accountName: "",
    projectPath: props.projectPath,
    serverUrl: props.serverUrl,
    modelName: props.modelName,
    systemPrompt: props.systemPrompt,
  });

  isTyping.value = false;

  if (!result.success) {
    throw new Error(result.error || "Agent loop failed");
  }

  // Добавляем ответ бота
  if (result.reply) {
    messages.value.push({
      role: "bot",
      content: result.reply,
      usage: result.tokenUsage || null,
    });
  }

  // Добавляем tool calls и results
  addToolMessages(
    result.toolCalls,
    result.toolResults,
    result.requiresApproval,
    result.approvalToolName,
    result.approvalArgs,
    result.approvalToolCallId
  );

  // Сохраняем сообщения для продолжения (при одобрении)
  approvalMessages.value = result.messages || [];
  return result;
}

async function approveTool(msg) {
  if (!pendingApproval.value) return;

  const decision = {
    approved: true,
    toolName: pendingApproval.value.toolName,
    args: pendingApproval.value.args,
    toolCallId: pendingApproval.value.toolCallId,
  };

  // Убираем approval блок и добавляем одобрение
  messages.value = messages.value.filter(m => m !== msg);

  isTyping.value = true;
  pendingApproval.value = null;

  try {
    const result = await agentChatContinue({
      messages: approvalMessages.value,
      approvalDecision: decision,
      accountName: "",
    });

    isTyping.value = false;

    if (!result.success) {
      messages.value.push({ role: "bot", content: `❌ Ошибка: ${result.error}` });
      return;
    }

    if (result.reply) {
      messages.value.push({
        role: "bot",
        content: result.reply,
        usage: result.tokenUsage || null,
      });
    }

    addToolMessages(
      result.toolCalls,
      result.toolResults,
      result.requiresApproval,
      result.approvalToolName,
      result.approvalArgs,
      result.approvalToolCallId
    );

    approvalMessages.value = result.messages || [];
  } catch (e) {
    isTyping.value = false;
    messages.value.push({ role: "bot", content: `❌ Ошибка: ${e.message}` });
  }
}

async function rejectTool(msg) {
  if (!pendingApproval.value) return;

  const decision = {
    approved: false,
    toolName: pendingApproval.value.toolName,
    args: pendingApproval.value.args,
    toolCallId: pendingApproval.value.toolCallId,
  };

  messages.value = messages.value.filter(m => m !== msg);
  isTyping.value = true;
  pendingApproval.value = null;

  try {
    const result = await agentChatContinue({
      messages: approvalMessages.value,
      approvalDecision: decision,
      accountName: "",
    });

    isTyping.value = false;

    if (!result.success) {
      messages.value.push({ role: "bot", content: `❌ Ошибка: ${result.error}` });
      return;
    }

    if (result.reply) {
      messages.value.push({
        role: "bot",
        content: result.reply,
        usage: result.tokenUsage || null,
      });
    }

    addToolMessages(
      result.toolCalls,
      result.toolResults,
      result.requiresApproval,
      result.approvalToolName,
      result.approvalArgs,
      result.approvalToolCallId
    );

    approvalMessages.value = result.messages || [];
  } catch (e) {
    isTyping.value = false;
    messages.value.push({ role: "bot", content: `❌ Ошибка: ${e.message}` });
  }
}

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
      type: "system",
    });
  }

  // Agent mode — используем agent loop
  if (agentMode.value) {
    try {
      const result = await sendAgentMessage(text);
      const latency = Date.now() - startTime;

      if (props.verbose) {
        const toolCount = (result.toolCalls?.length || 0) + (result.toolResults?.length || 0);
        emit("log", {
          message: `[VERBOSE] Agent loop (${latency}ms): ${result.reply?.substring(0, 100) || "empty"}, tools: ${toolCount}`,
          type: "success",
        });
      } else {
        emit("log", {
          message: `Agent response (${latency}ms): ${result.reply?.substring(0, 100)}...`,
          type: "success",
        });
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      isTyping.value = false;
      messages.value.push({
        role: "bot",
        content: `❌ Ошибка: ${error.message}`,
      });
      emit("log", {
        message: `Agent error (${latency}ms): ${error.message}`,
        type: "error",
      });
    }

    await nextTick();
    scrollToBottom();
    return;
  }

  try {
    if (props.streamEnabled) {
      // Потоковый режим
      isStreaming.value = true;
      isTyping.value = false;
      streamingContent.value = "";

      // Добавляем пустое сообщение бота, которое будем обновлять
      const botMsgIdx = messages.value.length;
      messages.value.push({ role: "bot", content: "", streaming: true });

      let fullContent = "";
      let lastUsage = null;

      await directChatStream(
        {
          message: text,
          modelName: props.modelName,
          serverUrl: props.serverUrl,
          projectPath: props.projectPath,
          systemPrompt: props.systemPrompt,
        },
        {
          onContent: (chunk, accumulated) => {
            fullContent = accumulated;
            streamingContent.value = accumulated;
            messages.value[botMsgIdx].content = accumulated;
            nextTick(() => scrollToBottom());
          },
          onDone: (usage) => {
            lastUsage = usage;
            messages.value[botMsgIdx].streaming = false;
            messages.value[botMsgIdx].usage = usage || null;
            if (usage) emit("token-usage", usage);
          },
          onError: (error) => {
            throw new Error(error);
          },
        }
      );

      const latency = Date.now() - startTime;
      isStreaming.value = false;

      if (props.verbose) {
        emit("log", {
          message: `[VERBOSE] Response ← model (${latency}ms): ${fullContent.substring(0, 100) || "empty"}`,
          type: "success",
        });
        if (lastUsage) {
          emit("log", {
            message: `[VERBOSE] Tokens: prompt=${lastUsage.prompt_tokens}, completion=${lastUsage.completion_tokens}, total=${lastUsage.total_tokens}, cached=${lastUsage.prompt_tokens_details?.cached_tokens ?? "N/A"}`,
            type: "info",
          });
        }
      } else {
        emit("log", {
          message: `Model response (${props.modelName}): ${fullContent.substring(0, 100)}...`,
          type: "success",
        });
      }
    } else {
      // Обычный режим
      const data = await directChat({
        message: text,
        modelName: props.modelName,
        serverUrl: props.serverUrl,
        projectPath: props.projectPath,
        systemPrompt: props.systemPrompt,
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
          type: "success",
        });
        if (data.usage) {
          emit("log", {
            message: `[VERBOSE] Tokens: prompt=${data.usage.prompt_tokens}, completion=${data.usage.completion_tokens}, total=${data.usage.total_tokens}, cached=${data.usage.prompt_tokens_details?.cached_tokens ?? "N/A"}`,
            type: "info",
          });
        }
      } else {
        emit("log", {
          message: `Model response (${props.modelName}): ${data.reply?.substring(0, 100)}...`,
          type: "success",
        });
      }

      if (data.usage) {
        emit("token-usage", data.usage);
      }
    }
  } catch (error) {
    const latency = Date.now() - startTime;
    isTyping.value = false;
    isStreaming.value = false;
    messages.value.push({
      role: "bot",
      content: `❌ Ошибка: ${error.message}`,
    });
    emit("log", {
      message: `Chat error (${latency}ms): ${error.message}`,
      type: "error",
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
  { deep: true }
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
  gap: 8px;
  flex-wrap: wrap;
}

.chat-header-left {
  display: flex;
  align-items: center;
}

.chat-header-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
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
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* Chat clear button */
.chat-clear {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  transition: var(--transition);
  flex-shrink: 0;
}

.chat-clear:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

.chat-clear:disabled {
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

.chat-msg.bot .chat-bubble.streaming {
  border-color: var(--accent-primary);
  box-shadow: 0 0 8px var(--accent-glow);
}

.cursor-blink {
  display: inline-block;
  width: 2px;
  height: 16px;
  background: var(--accent-primary);
  margin-left: 2px;
  vertical-align: middle;
  animation: blink 0.8s step-end infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
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

/* ─── Agent mode toggle ─── */
.agent-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  position: relative;
  user-select: none;
}

.toggle-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.agent-toggle input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  width: 32px;
  height: 18px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 20px;
  position: relative;
  transition: var(--transition);
}

.toggle-slider::before {
  content: "";
  position: absolute;
  width: 12px;
  height: 12px;
  left: 2px;
  top: 2px;
  background: var(--text-muted);
  border-radius: 50%;
  transition: var(--transition);
}

.agent-toggle input:checked + .toggle-slider {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
}

.agent-toggle input:checked + .toggle-slider::before {
  transform: translateX(14px);
  background: white;
}

/* Tool call block */
.tool-call-block,
.tool-result-block {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  margin: 2px 0;
  max-width: 450px;
}

.tool-call-header,
.tool-result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.15s;
}

.tool-call-header:hover,
.tool-result-header:hover {
  background: var(--bg-hover);
}

.tool-call-name {
  flex: 1;
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  color: var(--accent-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-call-toggle {
  font-size: 9px;
  color: var(--text-muted);
}

.tool-call-args,
.tool-result-output {
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  padding: 8px 10px;
  margin: 0;
  background: var(--bg-primary);
  border-top: 1px solid var(--border);
  max-height: 200px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text-secondary);
}

.tool-result-block .tool-result-status {
  font-size: 13px;
}

.tool-result-label {
  flex: 1;
  font-size: 11px;
  font-weight: 600;
}

.tool-result-header .success {
  color: #10b981;
}

.tool-result-header .error {
  color: #ef4444;
}

.collapsed .tool-call-args,
.collapsed .tool-result-output {
  display: none;
}

/* Approval block */
.approval-block {
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: var(--radius-sm);
  padding: 10px;
  max-width: 400px;
}

.approval-header {
  font-size: 12px;
  font-weight: 600;
  color: #f59e0b;
  margin-bottom: 6px;
}

.approval-tool {
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.approval-args {
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 6px;
  margin: 4px 0 8px;
  max-height: 120px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.approval-buttons {
  display: flex;
  gap: 6px;
}

.approval-btn {
  padding: 5px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  transition: var(--transition);
}

.approval-btn.approve {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
  border-color: rgba(16, 185, 129, 0.3);
}

.approval-btn.approve:hover {
  background: rgba(16, 185, 129, 0.2);
}

.approval-btn.reject {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.3);
}

.approval-btn.reject:hover {
  background: rgba(239, 68, 68, 0.2);
}
</style>
