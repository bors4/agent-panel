<template>
  <div
    :class="['card', `card--${variant}`, { 'card--hover': hoverEffect }]"
    :style="hoverEffect ? {} : undefined"
  >
    <!-- Terminal variant: траффик-лайты -->
    <div v-if="variant === 'terminal'" class="card__terminal-bar">
      <span class="card__dot card__dot--red" />
      <span class="card__dot card__dot--yellow" />
      <span class="card__dot card__dot--green" />
      <span class="card__terminal-label">
        <slot name="terminal-label">SYS://CONTROL</slot>
      </span>
    </div>

    <!-- Header slot -->
    <div v-if="$slots.header" class="card__header">
      <slot name="header" />
    </div>

    <!-- Body -->
    <div class="card__body">
      <slot />
    </div>

    <!-- Corner accents (только holographic) -->
    <template v-if="variant === 'holographic'">
      <span class="card__corner card__corner--tl" />
      <span class="card__corner card__corner--tr" />
      <span class="card__corner card__corner--bl" />
      <span class="card__corner card__corner--br" />
    </template>
  </div>
</template>

<script setup>
defineProps({
  variant: {
    type: String,
    default: "default",
    validator: (v) => ["default", "terminal", "holographic"].includes(v),
  },
  hoverEffect: {
    type: Boolean,
    default: true,
  },
});
</script>

<style scoped>
/* ═══════════════════════════════════════════
   CARD — Space Flight Mission Control
   ═══════════════════════════════════════════ */

.card {
  position: relative;
  background: var(--bg-card);
  border: 1px solid var(--border);
  clip-path: polygon(
    0 8px, 8px 0,
    calc(100% - 8px) 0, 100% 8px,
    100% calc(100% - 8px), calc(100% - 8px) 100%,
    8px 100%, 0 calc(100% - 8px)
  );
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Верхняя акцентная линия (как индикатор активной панели) */
.card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 8px;
  right: 8px;
  height: 2px;
  background: var(--accent);
  opacity: 0.5;
  z-index: 1;
}

/* ─── HOVER ─── */
.card--hover:hover {
  border-color: var(--accent);
  box-shadow: 0 0 8px rgba(0, 212, 255, 0.08), 0 0 30px rgba(0, 212, 255, 0.04);
  transform: translateY(-1px);
}

/* ═══════════════════════════════════════════
   VARIANTS
   ═══════════════════════════════════════════ */

/* ─── DEFAULT ─── */
.card--default {
  background: var(--bg-card);
}

/* ─── TERMINAL — тёмный фон + индикаторная панель ─── */
.card--terminal {
  background: var(--bg-primary);
}

.card--terminal::before {
  display: none;
}

.card__terminal-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  background: rgba(0, 0, 0, 0.2);
  clip-path: polygon(
    0 0, 100% 0, 100% 100%,
    0 100%
  );
  margin: -1px;
}

.card__terminal-label {
  margin-left: auto;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--text-muted);
}

.card__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.card__dot--red {
  background: #ef4444;
  box-shadow: 0 0 4px rgba(239, 68, 68, 0.6);
}

.card__dot--yellow {
  background: #f59e0b;
  box-shadow: 0 0 4px rgba(245, 158, 11, 0.6);
}

.card__dot--green {
  background: #10b981;
  box-shadow: 0 0 4px rgba(16, 185, 129, 0.6);
}

/* ─── HOLOGRAPHIC — glass + glow ─── */
.card--holographic {
  background: rgba(20, 30, 51, 0.6);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-color: rgba(0, 212, 255, 0.15);
  box-shadow: 0 0 20px rgba(0, 212, 255, 0.04);
}

.card--holographic::before {
  opacity: 0.3;
}

.card--holographic.card--hover:hover {
  border-color: rgba(0, 212, 255, 0.35);
  box-shadow: 0 0 15px rgba(0, 212, 255, 0.1), 0 0 40px rgba(0, 212, 255, 0.05);
}

/* Corner accents для holographic */
.card__corner {
  position: absolute;
  width: 12px;
  height: 12px;
  border-color: var(--accent);
  border-style: solid;
  opacity: 0.4;
}

.card__corner--tl {
  top: -1px;
  left: -1px;
  border-width: 2px 0 0 2px;
}

.card__corner--tr {
  top: -1px;
  right: -1px;
  border-width: 2px 2px 0 0;
}

.card__corner--bl {
  bottom: -1px;
  left: -1px;
  border-width: 0 0 2px 2px;
}

.card__corner--br {
  bottom: -1px;
  right: -1px;
  border-width: 0 2px 2px 0;
}

/* ═══════════════════════════════════════════
   HEADER / BODY
   ═══════════════════════════════════════════ */

.card__header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  z-index: 2;
}

.card__header :deep(h2),
.card__header :deep(h3) {
  font-family: "Orbitron", "Space Grotesk", monospace;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-muted);
}

.card__body {
  padding: 14px 16px;
  position: relative;
  z-index: 1;
}

/* ═══════════════════════════════════════════
   RESPONSIVE
   ═══════════════════════════════════════════ */

@media (max-width: 640px) {
  .card__body {
    padding: 12px;
  }
  .card__header {
    padding: 10px 12px;
  }
}
</style>
