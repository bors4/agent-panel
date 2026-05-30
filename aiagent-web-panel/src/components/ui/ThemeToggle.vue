<template>
  <div class="theme-indicator" title="Space Dark mode — always on">
    <span class="theme-indicator__icon">⚫</span>
    <span class="theme-indicator__label">DARK</span>
  </div>
</template>

<style scoped>
.theme-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: rgba(0, 212, 255, 0.04);
  border: 1px solid var(--border);
  clip-path: polygon(0 2px, 2px 0, calc(100% - 2px) 0, 100% 2px, 100% calc(100% - 2px), calc(100% - 2px) 100%, 2px 100%, 0 calc(100% - 2px));
  user-select: none;
  cursor: default;
}

.theme-indicator__icon {
  font-size: 0.6rem;
  line-height: 1;
}

.theme-indicator__label {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.55rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-muted);
}
</style>
