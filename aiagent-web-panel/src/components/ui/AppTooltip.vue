<template>
  <span class="tooltip-wrap">
    <slot name="trigger" />
    <span class="tooltip-content">
      <slot />
    </span>
  </span>
</template>

<style scoped>
.tooltip-wrap {
  position: relative;
  display: inline-flex;
}

.tooltip-content {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 1000;
  margin-top: 6px;
  padding: 10px 14px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-lg);
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-secondary);
  white-space: normal;
  min-width: 180px;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-3px);
  transition:
    opacity 0.15s ease,
    visibility 0.15s ease,
    transform 0.15s ease;
}

.tooltip-wrap:hover .tooltip-content {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}
</style>
