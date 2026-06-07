<template>
  <section class="section" :class="{ 'section--collapsed': collapsed }">
    <button
      v-if="collapsible"
      class="section__header section__header--btn"
      :aria-expanded="!collapsed"
      @click="$emit('toggle')"
    >
      <span class="section__title">{{ title }}</span>
      <svg
        class="section__chevron"
        :class="{ 'section__chevron--down': !collapsed }"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
    <div v-else class="section__header">
      <span class="section__title">{{ title }}</span>
    </div>
    <Transition name="collapse">
      <div v-show="!collapsed" class="section__body">
        <slot />
      </div>
    </Transition>
  </section>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  collapsed: { type: Boolean, default: false },
  collapsible: { type: Boolean, default: true },
});

defineEmits(["toggle"]);
</script>

<style scoped>
.section {
  border-bottom: 1px solid var(--border-subtle);
}

.section:last-child {
  border-bottom: none;
}

.section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 12px 16px;
  text-align: left;
  user-select: none;
}

.section__header--btn {
  cursor: pointer;
  transition: background var(--t-fast);
}

.section__header--btn:hover {
  background: var(--bg-hover);
}

.section__title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-3);
}

.section__chevron {
  color: var(--text-3);
  transition: transform var(--t);
  transform: rotate(-90deg);
}

.section__chevron--down {
  transform: rotate(0deg);
}

.section__body {
  padding: 4px 16px 16px;
}

.collapse-enter-active,
.collapse-leave-active {
  transition:
    opacity var(--t),
    max-height var(--t-slow) var(--ease-out);
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  opacity: 0;
  max-height: 0;
}

.collapse-enter-to,
.collapse-leave-from {
  opacity: 1;
  max-height: 800px;
}
</style>
