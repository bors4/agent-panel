<template>
  <div :class="['sbadge', `sbadge--${status}`]">
    <span class="sbadge__dot" />
    <span class="sbadge__label">{{ label }}</span>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  status: { type: String, default: "stopped" },
});

const label = computed(() => {
  const map = {
    stopped: "OFFLINE",
    idle: "STANDBY",
    running: "ONLINE",
    checking: "DIAGNOSIS",
    error: "CRITICAL",
  };
  return map[props.status] || props.status.toUpperCase();
});
</script>

<style scoped>
.sbadge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 12px;
  min-height: 30px;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.65rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  clip-path: polygon(
    0 3px, 3px 0,
    calc(100% - 3px) 0, 100% 3px,
    100% calc(100% - 3px), calc(100% - 3px) 100%,
    3px 100%, 0 calc(100% - 3px)
  );
  transition: var(--transition);
  user-select: none;
}

/* ─── Dot ─── */
.sbadge__dot {
  width: 7px;
  height: 7px;
  border-radius: 0;
  clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
  flex-shrink: 0;
  transition: all 0.3s ease;
}

/* ═══════════════════════════════════
   STATUS VARIANTS
   ═══════════════════════════════════ */

/* ONLINE (running) — зелёный */
.sbadge--running {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: var(--success);
}

.sbadge--running .sbadge__dot {
  background: var(--success);
  box-shadow: 0 0 6px var(--success);
  animation: dotPulse 2s ease-in-out infinite;
}

/* OFFLINE (stopped) — красный */
.sbadge--stopped {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.25);
  color: var(--error);
}

.sbadge--stopped .sbadge__dot {
  background: var(--error);
}

/* CRITICAL (error) — красный с анимацией */
.sbadge--error {
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.35);
  color: var(--error);
}

.sbadge--error .sbadge__dot {
  background: var(--error);
  box-shadow: 0 0 6px var(--error);
  animation: dotBlink 0.8s step-end infinite;
}

/* DIAGNOSIS (checking) — жёлтый */
.sbadge--checking {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: var(--warning);
}

.sbadge--checking .sbadge__dot {
  background: var(--warning);
  box-shadow: 0 0 6px var(--warning);
  animation: dotPulse 1s ease-in-out infinite;
}

/* STANDBY (idle) — серый */
.sbadge--idle {
  background: rgba(107, 125, 158, 0.08);
  border: 1px solid rgba(107, 125, 158, 0.2);
  color: var(--text-muted);
}

.sbadge--idle .sbadge__dot {
  background: var(--text-muted);
}

/* ─── Animations ─── */
@keyframes dotPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.75); }
}

@keyframes dotBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.2; }
}

/* ─── Responsive ─── */
@media (max-width: 640px) {
  .sbadge {
    padding: 4px 10px;
    font-size: 0.6rem;
  }
}
</style>
