<template>
  <span class="tooltip-wrap" @mouseenter="show" @mouseleave="hide" @focusin="show" @focusout="hide">
    <span ref="triggerRef" class="tooltip-trigger">
      <slot name="trigger" />
    </span>
    <Teleport to="body">
      <span
        v-if="visible"
        ref="contentRef"
        class="tooltip-content"
        role="tooltip"
        :style="positionStyle"
      >
        <slot />
      </span>
    </Teleport>
  </span>
</template>

<script setup>
import { ref, nextTick, onBeforeUnmount } from "vue";

const triggerRef = ref(null);
const contentRef = ref(null);
const visible = ref(false);
const positionStyle = ref({});

function show() {
  visible.value = true;
  nextTick(updatePosition);
}

function hide() {
  visible.value = false;
}

function updatePosition() {
  const el = triggerRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  positionStyle.value = {
    position: "fixed",
    top: `${rect.bottom + 6}px`,
    left: `${rect.left}px`,
    zIndex: "var(--z-toast)",
  };
}

function onKeyDown(e) {
  if (e.key === "Escape" && visible.value) {
    hide();
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("keydown", onKeyDown);
}

onBeforeUnmount(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("keydown", onKeyDown);
  }
});
</script>

<style scoped>
.tooltip-wrap {
  display: inline-flex;
}

.tooltip-trigger {
  display: inline-flex;
}

.tooltip-content {
  display: block;
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
  max-width: 280px;
  pointer-events: none;
}
</style>
