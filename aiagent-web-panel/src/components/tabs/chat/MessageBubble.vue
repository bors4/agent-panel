<!--
  Обычное сообщение чата: аватарка + бабл с контентом.
  Опционально:
  - reasoning-блок (если showReasoning && msg.reasoning && msg.role === 'bot')
  - token-info (если showTokens && msg.usage && msg.role === 'bot')
  - resend-кнопка (если msg.role === 'user' && !isTyping && !isStreaming)
-->
<template>
  <div class="chat-msg" :class="msg.role">
    <div class="chat-avatar">{{ msg.role === "user" ? "👤" : "🤖" }}</div>
    <div class="chat-msg-col">
      <div v-if="showReasoning && msg.reasoning && msg.role === 'bot'" class="reasoning-block">
        <div class="reasoning-header" @click="msg.reasoningExpanded = !msg.reasoningExpanded">
          <span class="reasoning-icon">💭</span>
          <span class="reasoning-label">Reasoning</span>
          <span class="tool-call-toggle">{{ msg.reasoningExpanded ? "▲" : "▼" }}</span>
        </div>
        <pre v-if="msg.reasoningExpanded" class="reasoning-content">{{ msg.reasoning }}</pre>
      </div>
      <div class="chat-bubble" :class="{ streaming: msg.streaming }">
        {{ msg.content }}
        <span v-if="msg.streaming && msg.content" class="cursor-blink">|</span>
      </div>
      <div v-if="msg.role === 'user' && !isTyping && !isStreaming" class="msg-actions">
        <button class="msg-action-btn" title="Resend message" @click="$emit('resend', msg)">↻</button>
      </div>
      <div v-if="showTokens && msg.usage && msg.role === 'bot'" class="token-info">
        <span class="tabular-nums">⚡ {{ msg.usage.total }} tokens</span>
        <span class="token-detail tabular-nums">(p:{{ msg.usage.prompt }}, c:{{ msg.usage.completion }})</span>
        <span v-if="msg.usage.cached > 0" class="token-detail tabular-nums">cached:{{ msg.usage.cached }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  msg: { type: Object, required: true },
  showReasoning: { type: Boolean, default: true },
  showTokens: { type: Boolean, default: true },
  isTyping: { type: Boolean, default: false },
  isStreaming: { type: Boolean, default: false },
});

defineEmits(["resend"]);
</script>

<style scoped>
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

.chat-msg.bot .chat-bubble.streaming {
  border-color: var(--accent);
  box-shadow: 0 0 8px var(--accent-glow);
}

.cursor-blink {
  display: inline-block;
  width: 2px;
  height: 16px;
  background: var(--accent);
  margin-left: 2px;
  vertical-align: middle;
  animation: blink 0.8s step-end infinite;
}

@keyframes blink {
  0%,
  50% {
    opacity: 1;
  }
  51%,
  100% {
    opacity: 0;
  }
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

/* Resend button on user messages */
.msg-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 2px;
}

.msg-action-btn {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-muted);
  cursor: pointer;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 8px;
  opacity: 0;
  transition:
    opacity 0.15s,
    color 0.15s;
}

.chat-msg:hover .msg-action-btn {
  opacity: 1;
}

.msg-action-btn:hover {
  color: var(--accent);
  border-color: var(--accent);
}

/* Reasoning block */
.reasoning-block {
  background: rgba(139, 92, 246, 0.06);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: var(--radius-sm);
  overflow: hidden;
  margin: 2px 0;
  max-width: 450px;
}

.reasoning-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.15s;
}

.reasoning-header:hover {
  background: var(--bg-hover);
}

.reasoning-icon {
  font-size: 13px;
}

.reasoning-label {
  flex: 1;
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  font-weight: 600;
  color: #8b5cf6;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.reasoning-content {
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  padding: 8px 10px;
  margin: 0;
  background: var(--bg-primary);
  border-top: 1px solid rgba(139, 92, 246, 0.15);
  max-height: 200px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text-secondary);
  line-height: 1.5;
}

.tool-call-toggle {
  font-size: 9px;
  color: var(--text-muted);
}
</style>
