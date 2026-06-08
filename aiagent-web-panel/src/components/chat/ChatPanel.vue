<!--
  ChatPanel — главная чат-зона на новом dashboard.
  Оборачивает существующие chat-компоненты, мигрировавшие из tabs/chat/.
  Логика вынесена в useChat* composables.
-->
<template>
  <div class="chat-panel">
    <div class="chat-panel__header">
      <div class="chat-panel__title">
        <h2 class="chat-panel__heading">Chat</h2>
        <span class="chat-panel__sub">Direct test of the agent loop</span>
      </div>
      <ChatHeader
        :is-active="isActive"
        :verbose="verbose"
        :show-reasoning="showReasoning"
        :agent-mode="agentMode"
        @toggle-reasoning="toggleReasoning"
        @toggle-agent="toggleAgentMode"
      />
    </div>

    <div class="chat-panel__body" @contextmenu.prevent="showContextMenu">
      <div ref="chatContainer" class="chat-panel__messages">
        <div v-if="messages.length === 0" class="chat-panel__placeholder">
          <div class="chat-panel__placeholder-icon">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div class="chat-panel__placeholder-text">
            {{ isActive ? "Type a message to start" : "Start the agent to begin" }}
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
              <QuestionBlock
                v-else-if="msg.type === 'question'"
                :msg="msg"
                @submit="(payload) => handleQuestionSubmit(payload)"
                @reject="(m) => handleToolDecision(m, false)"
              />
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
          <div class="chat-avatar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <div class="chat-bubble">
            <div class="typing-indicator"><span /><span /><span /></div>
          </div>
        </div>
      </div>
    </div>

    <div class="chat-panel__footer">
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
      message="Clear entire chat? All messages will be erased."
      confirm-label="Clear"
      cancel-label="Cancel"
      @confirm="confirmClearChat"
      @cancel="showConfirm = false"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from "vue";
import { useSound } from "@/composables/useSound";
import { useVoiceInput } from "@/composables/useVoiceInput";
import { useChatHistory } from "@/composables/useChatHistory";
import { useChatToggles } from "@/composables/useChatToggles";
import { useChatCancel } from "@/composables/useChatCancel";
import { usePendingApproval } from "@/composables/usePendingApproval";
import { useChatSend } from "@/composables/useChatSend";
import ChatHeader from "./ChatHeader.vue";
import MessageBubble from "./MessageBubble.vue";
import ToolCallBlock from "./ToolCallBlock.vue";
import ToolResultBlock from "./ToolResultBlock.vue";
import ApprovalBlock from "./ApprovalBlock.vue";
import QuestionBlock from "./QuestionBlock.vue";
import ChatInput from "./ChatInput.vue";
import ContextMenu from "./ContextMenu.vue";
import ConfirmDialog from "./ConfirmDialog.vue";

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

const emit = defineEmits(["log", "token-usage", "warning"]);

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
  emitWarning: (message) => emit("warning", message),
  options: {
    get modelName() { return props.modelName; },
    get serverUrl() { return props.serverUrl; },
    get projectPath() { return props.projectPath; },
    get systemPrompt() { return props.systemPrompt; },
    get streamEnabled() { return props.streamEnabled; },
    get verbose() { return props.verbose; },
    get soundEnabled() { return props.soundEnabled; },
    get soundVolume() { return props.soundVolume; },
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

async function handleToolDecision(msg, approved, answers) {
  await pending.handleToolDecision(msg, approved, isTyping, emitLog, answers);
}

async function handleQuestionSubmit({ answers }) {
  const msg = messages.value.find((m) => m.type === "question");
  if (!msg) return;
  await pending.handleToolDecision(msg, true, isTyping, emitLog, answers);
}

function handleStop() {
  cancel.handleStop();
}

function showContextMenu(e) {
  contextMenuVisible.value = false;
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
  emitLog({ message: "Chat cleared", type: "success" });
}

onMounted(() => {
  pending.load();
  scrollToBottom();
});

watch(
  () => messages.value.length,
  () => {
    scrollToBottom();
  }
);
</script>

<style scoped>
.chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--bg-0);
  overflow: hidden;
}

.chat-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-1);
  flex-shrink: 0;
  gap: 16px;
  min-height: 56px;
}

.chat-panel__title {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
}

.chat-panel__heading {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
  margin: 0;
  letter-spacing: -0.01em;
}

.chat-panel__sub {
  font-size: 11px;
  color: var(--text-3);
  font-weight: 500;
}

.chat-panel__body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.chat-panel__messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  scroll-behavior: smooth;
}

.chat-panel__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  color: var(--text-3);
}

.chat-panel__placeholder-icon {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius);
  background: var(--bg-2);
  border: 1px solid var(--border);
  color: var(--text-3);
}

.chat-panel__placeholder-text {
  font-size: 13px;
  text-align: center;
}

.chat-panel__footer {
  flex-shrink: 0;
}

.chat-msg {
  display: flex;
  gap: 10px;
  max-width: 88%;
  animation: fadeIn 0.2s var(--ease-out);
}

.chat-msg-col {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.chat-msg.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.chat-msg.bot,
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
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  flex-shrink: 0;
  background: var(--bg-3);
  color: var(--text-2);
}

.chat-msg.user .chat-avatar {
  background: var(--accent);
  color: white;
}

.chat-msg.bot .chat-avatar,
.chat-msg.system .chat-avatar {
  background: var(--gradient-accent);
  color: white;
}

.chat-bubble {
  padding: 9px 13px;
  border-radius: var(--radius);
  font-size: 13px;
  line-height: 1.55;
  border: 1px solid var(--border);
  word-wrap: break-word;
}

.chat-msg.user .chat-bubble {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
  border-bottom-right-radius: 4px;
}

.chat-msg.system .chat-bubble {
  background: var(--bg-2);
  color: var(--text-2);
  font-style: italic;
  font-size: 12px;
  border-bottom-left-radius: 4px;
}

.chat-bubble.system-msg {
  background: var(--bg-2);
  color: var(--text-2);
  font-style: italic;
  font-size: 12px;
}

.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 4px 0;
}

.typing-indicator span {
  width: 6px;
  height: 6px;
  background: var(--text-3);
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
    transform: translateY(-4px);
    opacity: 1;
  }
}
</style>
