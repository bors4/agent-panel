<!--
  Шапка вкладки чата. Содержит:
  - Название секции (COM://CHAT)
  - Статус агента (ONLINE / OFFLINE) с пульсирующей точкой
  - VERBOSE-бейдж (если включён verbose-режим)
  - Тогл REASONING (показывать/скрывать reasoning-блок)
  - Тогл AGENT (использовать agent loop или direct chat)
-->
<template>
  <div class="chat-header">
    <div class="chat-header-left">
      <h3 class="mono-label">COM://CHAT</h3>
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
.mono-label {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.65rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-muted);
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
  gap: 10px;
}

.chat-header-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.verbose-badge {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.55rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 3px 8px;
  background: rgba(212, 135, 74, 0.15);
  color: var(--accent-secondary);
  border: 1px solid rgba(212, 135, 74, 0.3);
  clip-path: polygon(
    0 2px,
    2px 0,
    calc(100% - 2px) 0,
    100% 2px,
    100% calc(100% - 2px),
    calc(100% - 2px) 100%,
    2px 100%,
    0 calc(100% - 2px)
  );
}

.chat-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.6rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 3px 8px;
  background: var(--bg-tertiary);
  color: var(--text-muted);
  border: 1px solid var(--border);
  clip-path: polygon(
    0 2px,
    2px 0,
    calc(100% - 2px) 0,
    100% 2px,
    100% calc(100% - 2px),
    calc(100% - 2px) 100%,
    2px 100%,
    0 calc(100% - 2px)
  );
  transition: var(--transition);
}

.chat-status.active {
  background: rgba(16, 185, 129, 0.1);
  color: var(--success);
  border-color: rgba(16, 185, 129, 0.3);
}

.chat-dot {
  width: 6px;
  height: 6px;
  background: var(--text-muted);
  flex-shrink: 0;
}

.chat-status.active .chat-dot {
  background: var(--success);
  box-shadow: 0 0 6px var(--success);
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

/* Agent mode toggle */
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

.toggle-label.active {
  color: #8b5cf6;
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
  background: var(--accent);
  border-color: var(--accent);
}

.agent-toggle input:checked + .toggle-slider::before {
  transform: translateX(14px);
  background: white;
}

.chat-header-right .agent-toggle:first-child {
  margin-right: 2px;
}
</style>
