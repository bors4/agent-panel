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
      :placeholder="isActive ? 'Введите сообщение...' : 'Сначала запустите агента'"
      @input="$emit('update:inputMessage', $event.target.value)"
      @keypress="handleKeypress"
    />
    <button
      v-if="voiceSupported"
      class="chat-mic"
      :class="{ recording: isRecording, processing: isVoiceProcessing }"
      :disabled="isVoiceProcessing || isTyping || isStreaming"
      :title="isRecording ? 'Остановить запись' : isVoiceProcessing ? 'Очистка текста...' : 'Голосовой ввод'"
      @click="$emit('toggle-recording')"
    >
      {{ isVoiceProcessing ? "⏳" : isRecording ? "⏹" : "🎙" }}
    </button>
    <button
      class="chat-send"
      :disabled="!isActive || !inputMessage.trim() || isCancelling || isTyping"
      @click="$emit('send')"
    >
      ➤
    </button>
    <button v-if="isTyping || isStreaming" class="chat-stop" title="Отменить запрос" @click="$emit('stop')">■</button>
    <button class="chat-clear" :disabled="messagesCount === 0" title="Очистить чат" @click="$emit('clear')">🗑</button>
  </div>
  <div v-if="isRecording || isVoiceProcessing" class="voice-status">
    <span v-if="isRecording" class="voice-pulse"></span>
    <span class="voice-status-text">{{
      isVoiceProcessing ? "Очистка текста..." : interimTranscript || voiceTranscript || "Говорите..."
    }}</span>
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

.chat-mic {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  transition: var(--transition);
}

.chat-mic:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--border-focus);
}

.chat-mic.recording {
  color: #ef4444;
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.15);
  animation: mic-pulse 1.2s ease-in-out infinite;
}

.chat-mic.processing {
  opacity: 0.5;
  cursor: wait;
}

.chat-mic:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@keyframes mic-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
  }
}

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

.chat-stop {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: bold;
  transition: var(--transition);
  flex-shrink: 0;
  animation: pulse 1.5s ease-in-out infinite;
}

.chat-stop:hover {
  background: rgba(239, 68, 68, 0.3);
  box-shadow: 0 0 12px rgba(239, 68, 68, 0.4);
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

.voice-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  font-size: 12px;
  color: var(--text-secondary);
  border-top: 1px solid var(--border);
  background: var(--bg-card);
}

.voice-pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  flex-shrink: 0;
  animation: mic-pulse 1.2s ease-in-out infinite;
}

.voice-status-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.voice-error {
  padding: 4px 12px;
  font-size: 11px;
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
  border-top: 1px solid rgba(239, 68, 68, 0.2);
}
</style>
