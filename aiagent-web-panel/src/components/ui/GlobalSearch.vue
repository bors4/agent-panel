<template>
  <div ref="searchRef" class="global-search">
    <button class="search-trigger" title="Поиск (Ctrl+K)" @click="toggleSearch">🔍</button>
    <div v-if="isOpen" class="search-dropdown">
      <input
        ref="inputRef"
        v-model="query"
        type="text"
        placeholder="Поиск по приложению..."
        class="search-input"
        @keydown.escape="closeSearch"
        @keydown.enter="executeAction"
      />
      <div v-if="query" class="search-results">
        <div
          v-for="(result, index) in filteredResults"
          :key="index"
          class="search-result-item"
          @click="navigateTo(result.action)"
        >
          <span class="result-icon">{{ result.icon }}</span>
          <span class="result-label">{{ result.label }}</span>
          <span class="result-category">{{ result.category }}</span>
        </div>
        <div v-if="filteredResults.length === 0" class="no-results">Ничего не найдено</div>
      </div>
      <div v-else class="search-hints">
        <div class="hint-title">Быстрый переход:</div>
        <div v-for="item in quickLinks" :key="item.action" class="search-result-item" @click="navigateTo(item.action)">
          <span class="result-icon">{{ item.icon }}</span>
          <span class="result-label">{{ item.label }}</span>
          <span class="result-category">{{ item.category }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from "vue";

defineProps({
  activeTab: { type: String, default: "prompt" },
});

const emit = defineEmits(["navigate"]);

const isOpen = ref(false);
const query = ref("");
const searchRef = ref(null);
const inputRef = ref(null);

const searchItems = [
  { icon: "📝", label: "Системный промпт", category: "Настройки", action: "prompt" },
  { icon: "⚙️", label: "Параметры", category: "Настройки", action: "settings" },
  { icon: "🔘", label: "Быстрые настройки", category: "Настройки", action: "quick" },
  { icon: "💬", label: "Чат-тест", category: "Инструменты", action: "chat" },
  { icon: "🖥️", label: "Логи", category: "Инструменты", action: "logs" },
  { icon: "🔧", label: "Инструменты", category: "Инструменты", action: "tools" },
  { icon: "▶️", label: "Запустить агента", category: "Управление", action: "start" },
  { icon: "⏹️", label: "Остановить агента", category: "Управление", action: "stop" },
  { icon: "🔄", label: "Перезапустить агента", category: "Управление", action: "restart" },
  { icon: "📤", label: "Экспорт конфигурации", category: "Действия", action: "export" },
  { icon: "📥", label: "Импорт конфигурации", category: "Действия", action: "import" },
  { icon: "✨", label: "Формат промпта", category: "Действия", action: "format" },
];

const quickLinks = searchItems.slice(0, 4);

const filteredResults = computed(() => {
  if (!query.value.trim()) return [];
  const q = query.value.toLowerCase();
  return searchItems.filter((item) => item.label.toLowerCase().includes(q) || item.category.toLowerCase().includes(q));
});

const toggleSearch = () => {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    nextTick(() => inputRef.value?.focus());
  }
};

const closeSearch = () => {
  isOpen.value = false;
  query.value = "";
};

const navigateTo = (action) => {
  emit("navigate", action);
  closeSearch();
};

const executeAction = () => {
  if (filteredResults.value.length > 0) {
    navigateTo(filteredResults.value[0].action);
  }
};

const handleKeydown = (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "k") {
    e.preventDefault();
    toggleSearch();
  }
};

const handleClickOutside = (e) => {
  if (searchRef.value && !searchRef.value.contains(e.target)) {
    closeSearch();
  }
};

onMounted(() => {
  document.addEventListener("keydown", handleKeydown);
  document.addEventListener("click", handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("keydown", handleKeydown);
  document.removeEventListener("click", handleClickOutside);
});
</script>

<style scoped>
.global-search {
  position: relative;
}

.search-trigger {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 6px 10px;
  cursor: pointer;
  transition: var(--transition);
  font-size: 14px;
  position: relative;
  z-index: 100;
}

.search-trigger:hover {
  background: var(--bg-hover);
  border-color: var(--accent);
}

.search-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 8px;
  width: 320px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  z-index: 10000;
  animation: slideDown 0.2s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.search-input {
  width: 100%;
  padding: 12px 16px;
  background: var(--bg-tertiary);
  border: none;
  border-bottom: 1px solid var(--border);
  color: var(--text-primary);
  font-size: 14px;
  font-family: inherit;
}

.search-input:focus {
  outline: none;
}

.search-input::placeholder {
  color: var(--text-muted);
}

.search-results,
.search-hints {
  max-height: 300px;
  overflow-y: auto;
  padding: 8px;
}

.hint-title {
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  padding: 8px;
  letter-spacing: 0.05em;
}

.search-result-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition);
}

.search-result-item:hover {
  background: var(--bg-hover);
}

.result-icon {
  font-size: 16px;
}

.result-label {
  flex: 1;
  color: var(--text-primary);
  font-size: 13px;
}

.result-category {
  font-size: 10px;
  color: var(--text-muted);
  background: var(--bg-tertiary);
  padding: 2px 8px;
  border-radius: 10px;
}

.no-results {
  text-align: center;
  padding: 20px;
  color: var(--text-muted);
  font-size: 13px;
}
</style>
