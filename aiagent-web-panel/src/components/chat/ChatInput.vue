<!--
  Поле ввода чата: текст + микрофон + send + stop + clear.
  Снизу — voice-status и voice-error.
-->
<template>
  <div class="chat-input-area">
    <input
      :value="inputMessage"
      type="text"
      class="chat-input"
      :disabled="!isActive"
      :placeholder="isActive ? 'Type a message…' : 'Start the agent first'"
      @input="$emit('update:inputMessage', $event.target.value)"
      @keypress="handleKeypress"
    />
    <button
      v-if="voiceSupported"
      class="chat-icon-btn chat-mic"
      :class="{ recording: isRecording, processing: isVoiceProcessing }"
      :disabled="isVoiceProcessing || isTyping || isStreaming"
      :title="isRecording ? 'Stop recording' : isVoiceProcessing ? 'Cleaning up…' : 'Voice input'"
      @click="$emit('toggle-recording')"
    >
      {{ isVoiceProcessing ? "⏳" : isRecording ? "⏹" : "🎙" }}
    </button>
    <button
      class="chat-send"
      :disabled="!isActive || !inputMessage.trim() || isCancelling || isTyping"
      title="Send (Enter)"
      @click="$emit('send')"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
      </svg>
    </button>
    <button
      v-if="isTyping || isStreaming"
      class="chat-icon-btn chat-stop"
      title="Cancel request"
      @click="$emit('stop')"
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
        <rect x="5" y="5" width="14" height="14" rx="1.5" />
      </svg>
    </button>
    <button class="chat-icon-btn chat-clear" :disabled="messagesCount === 0" title="Clear chat" @click="$emit('clear')">
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
        <path d="M10 11v6M14 11v6" />
      </svg>
    </button>
  </div>
  <div v-if="isRecording || isVoiceProcessing" class="voice-status">
    <span v-if="isRecording" class="voice-pulse" />
    <span class="voice-status-text">
      {{ isVoiceProcessing ? "Cleaning up text…" : interimTranscript || voiceTranscript || "Speak now…" }}
    </span>
  </div>
  <div v-if="voiceError" class="voice-error">{{ voiceError }}</div>
</template>

<script setup>
defineProps({
  isActive: { type: Boolean, default: false },
  isTyping: { type: Boolean, default: false },
  isStreaming: { type: Boolean, default: false },
  isCancelling: { type: Boolean, default: false },
  messagesCount: { type: Number, default: 0 },
  voiceSupported: { type: Boolean, default: false },
  isRecording: { type: Boolean, default: false },
  isVoiceProcessing: { type: Boolean, default: false },
  voiceTranscript: { type: String, default: "" },
  interimTranscript: { type: String, default: "" },
  voiceError: { type: String, default: "" },
  inputMessage: { type: String, default: "" },
});

const emit = defineEmits(["update:inputMessage", "send", "stop", "clear", "toggle-recording"]);

function handleKeypress(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    emit("send");
  }
}
</script>

<style scoped>
.chat-input-area {
  display: flex;
  gap: 6px;
  padding: 10px 12px;
  border-top: 1px solid var(--border);
  background: var(--bg-1);
  align-items: center;
}

.chat-input {
  flex: 1;
  min-width: 0;
  padding: 9px 14px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  color: var(--text-1);
  font-size: 13px;
  font-family: inherit;
  transition: var(--t);
}

.chat-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--accent-glow);
}

.chat-input:disabled {
  opacity: 0.5;
}

.chat-icon-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  background: var(--bg-2);
  border: 1px solid var(--border);
  color: var(--text-2);
  cursor: pointer;
  font-size: 14px;
  transition: var(--t-fast);
  flex-shrink: 0;
}

.chat-icon-btn:hover:not(:disabled) {
  background: var(--bg-3);
  color: var(--text-1);
  border-color: var(--border-strong);
}

.chat-icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.chat-send {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  background: var(--accent);
  border: 1px solid var(--accent);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--t-fast);
  flex-shrink: 0;
}

.chat-send:hover:not(:disabled) {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

.chat-send:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  background: var(--bg-3);
  border-color: var(--border);
  color: var(--text-3);
}

.chat-mic.recording {
  color: var(--error);
  border-color: var(--error);
  background: var(--error-soft);
  animation: mic-pulse 1.2s ease-in-out infinite;
}

.chat-mic.processing {
  opacity: 0.5;
  cursor: wait;
}

@keyframes mic-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 var(--error-soft);
  }
  50% {
    box-shadow: 0 0 0 6px transparent;
  }
}

.chat-clear:hover:not(:disabled) {
  background: var(--error-soft);
  color: var(--error);
  border-color: var(--error-soft);
}

.chat-stop {
  background: var(--error-soft);
  color: var(--error);
  border-color: var(--error-soft);
  animation: pulse 1.5s ease-in-out infinite;
}

.chat-stop:hover {
  background: var(--error);
  color: white;
  border-color: var(--error);
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.voice-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  font-size: 12px;
  color: var(--text-2);
  border-top: 1px solid var(--border-subtle);
  background: var(--bg-1);
}

.voice-pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--error);
  flex-shrink: 0;
  animation: mic-pulse 1.2s ease-in-out infinite;
}

.voice-status-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.voice-error {
  padding: 6px 12px;
  font-size: 11px;
  color: var(--error);
  background: var(--error-soft);
  border-top: 1px solid var(--border-subtle);
}
</style>
