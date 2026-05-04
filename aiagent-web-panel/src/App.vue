<template>
    <div class="app-container">
        <Header :status="status" />

        <aside class="sidebar">
            <ControlsCard
                :is-running="isRunning"
                @start="handleStart"
                @stop="handleStop"
                @restart="handleRestart"
            />
            <StatsCard :uptime="uptime" :stats="stats" />
            <BotCheckCard />
        </aside>

        <main class="main-content">
            <div class="tabs">
                <button
                    v-for="tab in tabs"
                    :key="tab.id"
                    :class="['tab', { active: activeTab === tab.id }]"
                    @click="activeTab = tab.id"
                >
                    {{ tab.icon }} {{ tab.label }}
                </button>
                <button v-if="activeTab === 'chat'" class="btn" @click="clearChat" style="margin-left: auto; font-size: 10px;">
                  🗑️ Очистить чат
                </button>
            </div>

            <PromptTab
                v-if="activeTab === 'prompt'"
                v-model="systemPrompt"
                @save="savePrompt"
                @reset="resetPrompt"
                @format="formatPrompt"
                @copy="copyPrompt"
                @export="exportConfig"
                @import="importConfig"
            />

            <SettingsTab
                v-if="activeTab === 'settings'"
                v-model:config="localConfig"
                @save="saveSettings"
                @reset="resetSettings"
            />

            <QuickSettingsTab
                v-if="activeTab === 'quick'"
                v-model:settings="quickSettings"
                @save="saveQuickSettings"
                @preset="applyPreset"
            />

            <ChatTab
            v-if="activeTab === 'chat'"
            :is-active="isRunning"
            ref="chatTabRef"
            />

            <LogsTab
                v-if="activeTab === 'logs'"
                :logs="logs"
                @clear="clearLogs"
            />
        </main>

        <div id="toast-container" class="toast-container"></div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useAgent } from "@/composables/useAgent";
import { useToast } from "@/composables/useToast";

// Components
import Header from "@/components/layout/Header.vue";
import ControlsCard from "@/components/features/ControlsCard.vue";
import StatsCard from "@/components/features/StatsCard.vue";
import BotCheckCard from "@/components/features/BotCheckCard.vue";
import PromptTab from "@/components/tabs/PromptTab.vue";
import SettingsTab from "@/components/tabs/SettingsTab.vue";
import QuickSettingsTab from "@/components/tabs/QuickSettingsTab.vue";
import ChatTab from "@/components/tabs/ChatTab.vue";
import LogsTab from "@/components/tabs/LogsTab.vue";

// В начале setup(), после импортов:
const defaultConfig = {
    token: "",
    projectPath: "",
    serverUrl: "",
    modelName: "qwen2.5-coder-7b-instruct",
    maxFileChars: 2000,
    maxHistoryPairs: 5,
    maxSearchResults: 15,
    maxFilesInPrompt: 2,
    maxTokens: 1024,
    timeout: 120000,
    temperature: 0.1,
};

const localConfig = ref({ ...defaultConfig });

// Composables
const {
    status,
    isRunning,
    stats,
    uptime,
    config,
    logs,
    refreshStatus,
    startAgent,
    stopAgent,
    restartAgent,
    saveConfig,
    sendChatMessage,
    cleanup,
} = useAgent();

const { showToast } = useToast();

// State
const activeTab = ref("prompt");
const systemPrompt = ref("");
const quickSettings = ref({
    autoSave: true,
    verbose: false,
    autoStart: false,
    notifications: true,
    showTokens: true,
});

const tabs = [
    { id: "prompt", label: "Системный промпт", icon: "📝" },
    { id: "settings", label: "Параметры", icon: "⚙️" },
    { id: "quick", label: "Быстрые настройки", icon: "🔘" },
    { id: "chat", label: "Чат-тест", icon: "💬" },
    { id: "logs", label: "Логи", icon: "🖥️" },
];

// Initialize
onMounted(async () => {
    await refreshStatus();
    setInterval(refreshStatus, 5000);

    // Load saved config
    const saved = localStorage.getItem("agent-config");
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            systemPrompt.value = parsed.systemPrompt || "";

            // 🔥 Безопасное слияние: только известные поля из defaultConfig
            Object.keys(defaultConfig).forEach((key) => {
                if (key in parsed) {
                    localConfig.value[key] = parsed[key];
                }
            });

            quickSettings.value = {
                autoSave: parsed.autoSave !== false,
                verbose: parsed.verbose === true,
                autoStart: parsed.autoStart === true,
                notifications: parsed.notifications !== false,
                showTokens: parsed.showTokens !== false,
            };
        } catch {}
    }
});

onUnmounted(() => {
    cleanup();
});

// Handlers
const handleStart = async () => {
    try {
        await startAgent();
        showToast("Агент запущен", "success");
    } catch (e) {
        showToast(e.message, "error");
    }
};

const handleStop = async () => {
    try {
        await stopAgent();
        showToast("Агент остановлен", "warning");
    } catch (e) {
        showToast(e.message, "error");
    }
};

const handleRestart = async () => {
    try {
        await restartAgent();
        showToast("Агент перезапущен", "success");
    } catch (e) {
        showToast(e.message, "error");
    }
};

const savePrompt = async () => {
    try {
        await saveConfig({
            ...localConfig.value,
            systemPrompt: systemPrompt.value,
        });
        showToast("Промпт сохранён", "success");
    } catch (e) {
        showToast(e.message, "error");
    }
};

const resetPrompt = () => {
    if (confirm("Сбросить промпт?")) {
        systemPrompt.value = "";
        showToast("Промпт сброшен", "warning");
    }
};

const formatPrompt = () => {
    systemPrompt.value = systemPrompt.value
        .replace(/\r\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n");
    showToast("Отформатировано", "success");
};

const copyPrompt = () => {
    navigator.clipboard.writeText(systemPrompt.value);
    showToast("Скопировано", "success");
};

const exportConfig = () => {
    const data = { ...localConfig.value, systemPrompt: systemPrompt.value };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "agent-config.json";
    a.click();
    URL.revokeObjectURL(url);
    showToast("Экспортировано", "success");
};

const importConfig = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const imported = JSON.parse(ev.target.result);
                systemPrompt.value = imported.systemPrompt || "";
                localConfig.value = { ...imported };
                showToast("Импортировано", "success");
            } catch {
                showToast("Ошибка JSON", "error");
            }
        };
        reader.readAsText(file);
    };
    input.click();
};

const saveSettings = async () => {
    try {
        await saveConfig(localConfig.value);
        localStorage.setItem(
            "agent-config",
            JSON.stringify({
                ...localConfig.value,
                systemPrompt: systemPrompt.value,
                ...quickSettings.value,
            }),
        );
        showToast("Настройки сохранены", "success");
    } catch (e) {
        showToast(e.message, "error");
    }
};

const resetSettings = () => {
    if (confirm("Сбросить настройки?")) {
        localConfig.value = {};
        systemPrompt.value = "";
        showToast("Настройки сброшены", "warning");
    }
};

const saveQuickSettings = () => {
    localStorage.setItem(
        "agent-config",
        JSON.stringify({
            ...localConfig.value,
            systemPrompt: systemPrompt.value,
            ...quickSettings.value,
        }),
    );
    showToast("Сохранено", "success");
};

const applyPreset = (name) => {
    const presets = {
        fast: {
            modelName: "qwen2.5-coder:3b",
            maxTokens: 512,
            maxHistoryPairs: 4,
            temperature: 0.1,
        },
        balanced: {
            modelName: "qwen2.5-coder-7b-instruct",
            maxTokens: 2048,
            maxHistoryPairs: 8,
        },
        quality: {
            modelName: "qwen2.5-coder:14b",
            maxTokens: 4096,
            maxHistoryPairs: 12,
            temperature: 0.2,
        },
        debug: {
            modelName: "qwen2.5-coder-7b-instruct",
            maxTokens: 512,
            temperature: 0,
            verbose: true,
        },
    };

    const preset = presets[name];
    if (!preset || !confirm(`Применить "${name}"?`)) return;

    localConfig.value = { ...localConfig.value, ...preset };
    showToast(`Пресет "${name}" применён`, "success");
};

const clearLogs = () => {
    logs.value = [];
    showToast("Логи очищены", "success");
};

const chatTabRef = ref(null)

const clearChat = () => {
  if (confirm('Очистить историю чата?')) {
    chatTabRef.value?.clearChatHistory?.()
    showToast('История очищена', 'success')
  }
}

</script>

<style>
@import "@/styles/main.css";

.app-container {
    position: relative;
    z-index: 1;
    max-width: 1440px;
    margin: 0 auto;
    padding: 24px;
    display: grid;
    grid-template-columns: 300px 1fr;
    grid-template-rows: auto 1fr;
    gap: 20px;
    min-height: 100vh;
}

.sidebar {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.main-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.tabs {
    display: flex;
    gap: 3px;
    padding: 3px;
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    flex-wrap: wrap;
}

.tab {
    padding: 9px 16px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    border-radius: 6px;
    transition: var(--transition);
    font-family: inherit;
}

.tab:hover:not(.active) {
    color: var(--text-secondary);
    background: rgba(255, 255, 255, 0.03);
}

.tab.active {
    background: var(--accent);
    color: white;
    box-shadow: 0 2px 8px var(--accent-glow);
}

.toast-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.toast {
    padding: 12px 16px;
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    border: 1px solid var(--border);
    box-shadow: var(--shadow);
    font-size: 12px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
    animation: slideIn 0.3s ease;
    min-width: 260px;
}

@keyframes slideIn {
    from {
        opacity: 0;
        transform: translateX(80px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

.toast.success {
    border-left: 3px solid var(--success);
}
.toast.error {
    border-left: 3px solid var(--error);
}
.toast.warning {
    border-left: 3px solid var(--warning);
}
.toast.info {
    border-left: 3px solid var(--accent);
}

@media (max-width: 1024px) {
    .app-container {
        grid-template-columns: 1fr;
        padding: 16px;
    }
    .sidebar {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
    }
}

@media (max-width: 640px) {
    .sidebar {
        grid-template-columns: 1fr;
    }
    .header {
        flex-direction: column;
        gap: 10px;
        text-align: center;
    }
    .header-left {
        flex-direction: column;
    }
    .tabs {
        overflow-x: auto;
        flex-wrap: nowrap;
    }
}
</style>
