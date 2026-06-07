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
.chat-msg.bot .chat-avatar {
  background: var(--gradient-accent);
  color: white;
}

.chat-bubble {
  padding: 9px 13px;
  border-radius: var(--radius);
  font-size: 13px;
  line-height: 1.55;
  word-wrap: break-word;
  border: 1px solid var(--border);
}

.chat-msg.user .chat-bubble {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
  border-bottom-right-radius: 4px;
}

.chat-msg.bot .chat-bubble {
  background: var(--bg-2);
  color: var(--text-1);
  border-bottom-left-radius: 4px;
}

.chat-msg.bot .chat-bubble.streaming {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent-soft);
}

.cursor-blink {
  display: inline-block;
  width: 2px;
  height: 14px;
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
  font-size: 10px;
  color: var(--text-3);
  font-family: var(--font-mono);
  padding: 0 4px;
}

.token-detail {
  opacity: 0.7;
}

.msg-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 2px;
}

.msg-action-btn {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-3);
  cursor: pointer;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  opacity: 0;
  transition:
    opacity var(--t-fast),
    color var(--t-fast),
    border-color var(--t-fast);
}

.chat-msg:hover .msg-action-btn {
  opacity: 1;
}

.msg-action-btn:hover {
  color: var(--accent);
  border-color: var(--accent);
}

.reasoning-block {
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  margin: 2px 0;
  max-width: 480px;
}

.reasoning-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 12px;
  transition: background var(--t-fast);
}

.reasoning-header:hover {
  background: var(--bg-hover);
}

.reasoning-icon {
  font-size: 13px;
}

.reasoning-label {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  color: var(--text-2);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.reasoning-content {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 8px 10px;
  margin: 0;
  background: var(--bg-0);
  border-top: 1px solid var(--border-subtle);
  max-height: 200px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text-2);
  line-height: 1.5;
}

.tool-call-toggle {
  font-size: 9px;
  color: var(--text-3);
}
</style>
