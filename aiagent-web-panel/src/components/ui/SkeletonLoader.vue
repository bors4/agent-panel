<template>
  <div :class="['skeleton', variant]">
    <div v-if="type === 'text'" class="skeleton-text" :style="{ width, height }" />
    <div v-else-if="type === 'circle'" class="skeleton-circle" :style="{ width, height }" />
    <div v-else-if="type === 'card'" class="skeleton-card">
      <div class="skeleton-header" />
      <div class="skeleton-body" />
    </div>
    <div v-else-if="type === 'stat'" class="skeleton-stat">
      <div class="skeleton-label" />
      <div class="skeleton-value" />
    </div>
  </div>
</template>

<script setup>
defineProps({
  type: { type: String, default: "text" },
  width: { type: String, default: "100%" },
  height: { type: String, default: "20px" },
  variant: { type: String, default: "" },
});
</script>

<style scoped>
.skeleton {
  display: inline-block;
}

.skeleton-text,
.skeleton-circle,
.skeleton-value,
.skeleton-label {
  background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-hover) 50%, var(--bg-tertiary) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius-sm);
}

.skeleton-text {
  width: v-bind(width);
  height: v-bind(height);
}

.skeleton-circle {
  width: v-bind(width);
  height: v-bind(height);
  border-radius: 50%;
}

.skeleton-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  width: v-bind(width);
}

.skeleton-card .skeleton-header {
  height: 20px;
  width: 60%;
  margin-bottom: 12px;
  border-radius: var(--radius-sm);
}

.skeleton-card .skeleton-body {
  height: v-bind(height);
  border-radius: var(--radius-sm);
}

.skeleton-stat {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px;
}

.skeleton-stat .skeleton-label {
  height: 12px;
  width: 40%;
  margin-bottom: 6px;
}

.skeleton-stat .skeleton-value {
  height: 24px;
  width: 60%;
}

.skeleton.loading {
  opacity: 0.5;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
