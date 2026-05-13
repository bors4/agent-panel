<template>
    <button 
        class="theme-toggle" 
        @click="toggleTheme" 
        :title="isDark ? 'Светлая тема' : 'Тёмная тема'"
    >
        <span class="theme-icon">{{ isDark ? '☀️' : '🌙' }}</span>
    </button>
</template>

<script setup>
import { ref, onMounted } from "vue";

const isDark = ref(true);

const toggleTheme = () => {
    isDark.value = !isDark.value;
    document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light');
    localStorage.setItem('theme', isDark.value ? 'dark' : 'light');
};

onMounted(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        isDark.value = savedTheme === 'dark';
        document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light');
    }
});
</script>

<style scoped>
.theme-toggle {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 6px 10px;
    cursor: pointer;
    transition: var(--transition);
    display: flex;
    align-items: center;
    justify-content: center;
}

.theme-toggle:hover {
    background: var(--bg-hover);
    border-color: var(--accent-primary);
    box-shadow: 0 0 12px var(--accent-glow);
    transform: scale(1.1);
}

.theme-icon {
    font-size: 16px;
    transition: transform 0.3s ease;
}

.theme-toggle:hover .theme-icon {
    transform: scale(1.2);
}
</style>