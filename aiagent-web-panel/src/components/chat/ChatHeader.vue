<!--
  Шапка вкладки чата. Содержит:
  - Статус агента (ONLINE / OFFLINE) с пульсирующей точкой
  - VERBOSE-бейдж (если включён verbose-режим)
  - Тогл REASONING (показывать/скрывать reasoning-блок)
  - Тогл AGENT (использовать agent loop или direct chat)
-->
<template>
  <div class="chat-header">
    <div class="chat-header-left">
      <span class="chat-status" :class="{ active: isActive }">
        <span class="chat-dot" />
        {{ isActive ? "ONLINE" : "OFFLINE" }}
      </span>
    </div>
    <div class="chat-header-right">
      <span v-if="verbose" class="verbose-badge">VERBOSE</span>
      <label class="agent-toggle" title="Toggle reasoning display">
        <span class="toggle-label" :class="{ active: showReasoning }">REASONING</span>
        <input type="checkbox" :checked="showReasoning" @change="$emit('toggle-reasoning')" />
        <span class="toggle-slider" />
      </label>
      <label class="agent-toggle" title="Toggle agent loop with tools">
        <span class="toggle-label">AGENT</span>
        <input type="checkbox" :checked="agentMode" @change="$emit('toggle-agent')" />
        <span class="toggle-slider" />
      </label>
    </div>
  </div>
</template>

<script setup>
defineProps({
  isActive: { type: Boolean, default: false },
  verbose: { type: Boolean, default: false },
  showReasoning: { type: Boolean, default: true },
  agentMode: { type: Boolean, default: true },
});

defineEmits(["toggle-reasoning", "toggle-agent"]);
</script>

<style scoped>
.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  gap: 12px;
  flex-wrap: wrap;
}

.chat-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.chat-header-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.verbose-badge {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 3px 7px;
  background: var(--warning-soft);
  color: var(--warning);
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
}

.chat-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 500;
  padding: 3px 9px;
  background: var(--bg-3);
  color: var(--text-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  transition: var(--t);
}

.chat-status.active {
  background: var(--success-soft);
  color: var(--success);
  border-color: var(--success-soft);
}

.chat-dot {
  width: 6px;
  height: 6px;
  background: var(--text-3);
  flex-shrink: 0;
  border-radius: 50%;
}

.chat-status.active .chat-dot {
  background: var(--success);
  animation: chatPulse 2s ease-in-out infinite;
}

@keyframes chatPulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

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
  font-weight: 500;
  color: var(--text-3);
  letter-spacing: 0.01em;
}

.toggle-label.active {
  color: var(--accent);
}

.agent-toggle input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}

.toggle-slider {
  width: 30px;
  height: 16px;
  background: var(--bg-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  position: relative;
  transition: var(--t);
  flex-shrink: 0;
}

.toggle-slider::before {
  content: "";
  position: absolute;
  width: 10px;
  height: 10px;
  left: 2px;
  top: 2px;
  background: var(--text-3);
  border-radius: 50%;
  transition: var(--t);
}

.agent-toggle input:checked + .toggle-slider {
  background: var(--accent);
  border-color: var(--accent);
}

.agent-toggle input:checked + .toggle-slider::before {
  transform: translateX(14px);
  background: white;
}
</style>
