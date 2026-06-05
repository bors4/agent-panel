<!--
  Вкладка чата для тестирования AI агента. Поддерживает отправку сообщений,
  отображение истории, очистку чата. История сохраняется в localStorage.

  Структура:
  - useChatHistory    — localStorage persistence (история, approval state)
  - useChatToggles    — agent mode + reasoning toggles
  - useChatCancel     — AbortController + cancelChat integration
  - usePendingApproval — approval-флоу (approve/reject → continue)
  - useChatSend       — send-флоу (agent/direct/streaming)
  - Child components  — рендеринг отдельных блоков
-->
<template>
  <Card>
    <template #header>
      <ChatHeader
        :is-active="isActive"
        :verbose="verbose"
        :show-reasoning="showReasoning"
        :agent-mode="agentMode"
        @toggle-reasoning="toggleReasoning"
        @toggle-agent="toggleAgentMode"
      />
    </template>
    <div class="chat-container" @contextmenu.prevent="showContextMenu">
      <div ref="chatContainer" class="chat-messages">
        <div v-if="messages.length === 0" class="chat-placeholder">
          <div class="placeholder-icon">🤖</div>
          <div>
            {{ isActive ? "Введите сообщение для начала диалога" : "Запустите агента для начала общения" }}
          </div>
        </div>
        <template v-for="(msg, index) in messages" :key="index">
          <MessageBubble
            v-if="!msg.type"
            :msg="msg"
            :show-reasoning="showReasoning"
            :show-tokens="showTokens"
            :is-typing="isTyping"
            :is-streaming="isStreaming"
            @resend="(m) => onResend(m, index)"
          />
          <div v-else class="chat-msg system" :class="'msg-' + msg.type">
            <div class="chat-avatar">
              <template v-if="msg.type === 'tool_call'">🔧</template>
              <template v-else-if="msg.type === 'tool_result'">📊</template>
              <template v-else-if="msg.type === 'approval'">🔐</template>
              <template v-else>⚙️</template>
            </div>
            <div class="chat-msg-col">
              <ToolCallBlock v-if="msg.type === 'tool_call'" :msg="msg" />
              <ToolResultBlock v-else-if="msg.type === 'tool_result'" :msg="msg" />
              <ApprovalBlock
                v-else-if="msg.type === 'approval'"
                :msg="msg"
                @approve="(m) => handleToolDecision(m, true)"
                @reject="(m) => handleToolDecision(m, false)"
              />
              <div v-else class="chat-bubble system-msg">{{ msg.content }}</div>
            </div>
          </div>
        </template>
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

      <ChatInput
        v-model:input-message="inputMessage"
        :is-active="isActive"
        :is-typing="isTyping"
        :is-streaming="isStreaming"
        :is-cancelling="isCancelling"
        :messages-count="messages.length"
        :voice-supported="voiceSupported"
        :is-recording="isRecording"
        :is-voice-processing="isVoiceProcessing"
        :voice-transcript="voiceTranscript"
        :interim-transcript="interimTranscript"
        :voice-error="voiceError"
        @send="onSend"
        @stop="handleStop"
        @clear="handleClearChat"
        @toggle-recording="toggleRecording"
      />
    </div>

    <ContextMenu :visible="contextMenuVisible" :x="menuX" :y="menuY" @action="onContextAction" />

    <ConfirmDialog
      :visible="showConfirm"
      message="Очистить весь чат? История сообщений будет удалена."
      confirm-label="Очистить"
      cancel-label="Отмена"
      @confirm="confirmClearChat"
      @cancel="showConfirm = false"
    />
  </Card>
</template>

<script setup>
import { ref, onMounted, watch } from "vue";
import Card from "../ui/Card.vue";
import { useSound } from "@/composables/useSound";
import { useVoiceInput } from "@/composables/useVoiceInput";
import { useChatHistory } from "@/composables/useChatHistory";
import { useChatToggles } from "@/composables/useChatToggles";
import { useChatCancel } from "@/composables/useChatCancel";
import { usePendingApproval } from "@/composables/usePendingApproval";
import { useChatSend } from "@/composables/useChatSend";
import ChatHeader from "./chat/ChatHeader.vue";
import MessageBubble from "./chat/MessageBubble.vue";
import ToolCallBlock from "./chat/ToolCallBlock.vue";
import ToolResultBlock from "./chat/ToolResultBlock.vue";
import ApprovalBlock from "./chat/ApprovalBlock.vue";
import ChatInput from "./chat/ChatInput.vue";
import ContextMenu from "./chat/ContextMenu.vue";
import ConfirmDialog from "./chat/ConfirmDialog.vue";

const props = defineProps({
  isActive: Boolean,
  modelName: { type: String, default: "" },
  serverUrl: { type: String, default: "http://127.0.0.1:8080/v1" },
  projectPath: { type: String, default: "C:\\" },
  systemPrompt: { type: String, default: "" },
  verbose: { type: Boolean, default: false },
  showTokens: { type: Boolean, default: true },
  soundEnabled: { type: Boolean, default: true },
  soundVolume: { type: Number, default: 50 },
  streamEnabled: { type: Boolean, default: false },
});

const emit = defineEmits(["log", "token-usage"]);

const { messages, approvalMessages, clearAll: clearAllHistory } = useChatHistory();
const { agentMode, showReasoning, toggleAgentMode, toggleReasoning } = useChatToggles();
const cancel = useChatCancel();
const pending = usePendingApproval({ messages, approvalMessages, cancel });

const inputMessage = ref("");
const chatContainer = ref(null);
const showConfirm = ref(false);
const contextMenuVisible = ref(false);
const menuX = ref(0);
const menuY = ref(0);

const sound = useSound({ volume: props.soundVolume });
watch(
  () => props.soundVolume,
  (v) => sound.setVolume(v)
);

const voice = useVoiceInput({
  onResult: (cleanedText) => {
    inputMessage.value = cleanedText;
  },
});

const {
  isRecording,
  isProcessing: isVoiceProcessing,
  transcript: voiceTranscript,
  interimTranscript,
  error: voiceError,
  isSupported: voiceSupported,
  toggleRecording,
  cancel: cancelVoice,
} = voice;

const sendDeps = {
  messages,
  approvalMessages,
  pendingToolCalls: pending.pendingToolCalls,
  chatContainer,
  cancel,
  pending,
  toggles: { agentMode },
  options: {
    modelName: props.modelName,
    serverUrl: props.serverUrl,
    projectPath: props.projectPath,
    systemPrompt: props.systemPrompt,
    streamEnabled: props.streamEnabled,
    verbose: props.verbose,
    soundEnabled: props.soundEnabled,
    soundVolume: props.soundVolume,
    sound,
  },
};
const { isTyping, isStreaming, sendMessage, resendMessage, scrollToBottom } = useChatSend(sendDeps);

const isCancelling = cancel.isCancelling;

function emitLog(entry) {
  emit("log", entry);
}

function emitTokenUsage(usage) {
  emit("token-usage", usage);
}

async function onSend() {
  if (!inputMessage.value.trim()) return;
  if (isRecording.value) cancelVoice();
  const text = inputMessage.value.trim();
  inputMessage.value = "";
  await sendMessage(text, emitLog, emitTokenUsage);
}

async function onResend(msg, index) {
  await resendMessage(msg, index, async (t) => {
    await sendMessage(t, emitLog, emitTokenUsage);
  });
}

async function handleToolDecision(msg, approved) {
  await pending.handleToolDecision(msg, approved, isTyping, emitLog);
}

function handleStop() {
  cancel.handleStop();
}

function showContextMenu(e) {
  contextMenuVisible.value = false;
  // nextTick гарантирует, что Transition завершит hide перед show
  setTimeout(() => {
    menuX.value = e.clientX;
    menuY.value = e.clientY;
    contextMenuVisible.value = true;
  }, 0);
}

function onContextAction(action) {
  contextMenuVisible.value = false;
  if (action === "clear") handleClearChat();
}

function handleClearChat() {
  showConfirm.value = true;
}

function confirmClearChat() {
  clearAllHistory();
  showConfirm.value = false;
  emitLog({ message: "Чат очищен", type: "success" });
}

onMounted(() => {
  // Восстанавливаем state из localStorage. useChatHistory уже синхронизировал
  // messages/approvalMessages в своём onMounted (вызывается раньше родительского).
  // Здесь восстанавливаем pending-approval state (отдельный concern).
  pending.load();
  scrollToBottom();
});

// Sync с chatContainer ref — нужны для scrollToBottom
watch(
  () => messages.value.length,
  () => {
    scrollToBottom();
  }
);
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

.chat-msg.system {
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
  background: var(--bg-tertiary);
}

.chat-bubble {
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 13px;
  line-height: 1.5;
  border: 1px solid var(--border);
}

.chat-bubble.system-msg {
  background: var(--bg-tertiary);
  color: var(--text-muted);
  font-style: italic;
  font-size: 12px;
  border-bottom-left-radius: 4px;
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
