<template>
  <div class="theme-toggle" :title="isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'" @click="toggleTheme">
    <span class="theme-toggle__indicator" :class="{ 'theme-toggle__indicator--light': !isDark }">
      {{ isDark ? "🌌" : "☀️" }}
    </span>
    <span class="theme-toggle__label">{{ isDark ? "NIGHT" : "DAY" }}</span>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from "vue";

const isDark = ref(true);

const applyTheme = (dark) => {
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  localStorage.setItem("theme", dark ? "dark" : "light");
};

const toggleTheme = () => {
  isDark.value = !isDark.value;
  applyTheme(isDark.value);
};

onMounted(() => {
  const saved = localStorage.getItem("theme");
  if (saved === "light") {
    isDark.value = false;
    applyTheme(false);
  } else {
    isDark.value = true;
    applyTheme(true);
  }
});
</script>

<style scoped>
.theme-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: rgba(0, 212, 255, 0.04);
  border: 1px solid var(--border);
  clip-path: polygon(0 2px, 2px 0, calc(100% - 2px) 0, 100% 2px, 100% calc(100% - 2px), calc(100% - 2px) 100%, 2px 100%, 0 calc(100% - 2px));
  cursor: pointer;
  user-select: none;
  transition: var(--transition);
}
.theme-toggle:hover {
  border-color: var(--accent);
}

.theme-toggle__indicator {
  font-size: 0.7rem;
  line-height: 1;
}

.theme-toggle__label {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-muted);
  transition: var(--transition);
}
.theme-toggle:hover .theme-toggle__label {
  color: var(--accent);
}
</style>
