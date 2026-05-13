<template>
    <div class="app-container">
        <Header :status="status" :active-tab="activeTab" @navigate="handleNavigate" />

        <aside class="sidebar">
            <ControlsCard
                :is-running="isRunning"
                @start="handleStart"
                @stop="handleStop"
                @restart="handleRestart"
            />
            <StatsCard :uptime="uptime" :stats="stats" />
            <BotCheckCard />
            <div class="quick-actions">
                <button class="quick-action-btn" @click="activeTab = 'prompt'">
                    <span class="icon">📝</span>
                    <span>Промпт</span>
                </button>
                <button class="quick-action-btn" @click="activeTab = 'settings'">
                    <span class="icon">⚙️</span>
                    <span>Настройки</span>
                </button>
                <button class="quick-action-btn" @click="activeTab = 'chat'">
                    <span class="icon">💬</span>
                    <span>Чат</span>
                </button>
                <button class="quick-action-btn" @click="activeTab = 'logs'">
                    <span class="icon">🖥️</span>
                    <span>Логи</span>
                </button>
            </div>
        </aside>

        <main class="main-content">
            <div class="tabs" role="tablist" aria-label="Навигация по разделам">
                <button
                    v-for="tab in tabs"
                    :key="tab.id"
                    :class="['tab', { active: activeTab === tab.id }]"
                    role="tab"
                    :aria-selected="activeTab === tab.id"
                    :aria-controls="`panel-${tab.id}`"
                    @click="activeTab = tab.id"
                >
                    <span aria-hidden="true">{{ tab.icon }}</span>
                    {{ tab.label }}
                </button>
                <button
                    v-if="activeTab === 'chat'"
                    class="btn"
                    aria-label="Очистить историю чата"
                    @click="clearChat"
                    style="margin-left: auto; font-size: 10px"
                >
                    🗑️ Очистить чат
                </button>
            </div>

            <PromptTab
                v-if="activeTab === 'prompt'"
                v-model="systemPrompt"
                role="tabpanel"
                id="panel-prompt"
                aria-label="Редактор системного промпта"
                @save="savePrompt"
                @reset="resetPrompt"
                @format="formatPrompt"
                @copy="copyPrompt"
                @export="exportConfig"
                @import="importConfig"
            />

            <SettingsTab
                v-if="activeTab === 'settings'"
                :config="localConfig"
                :api-bases="apiBases"
                :available-models="availableModels"
                :model-name="modelName"
                @save="handleSettingsSave"
                @reset="resetSettings"
                @models-updated="updateModels"
            />

            <QuickSettingsTab
                v-if="activeTab === 'quick'"
                :settings="quickSettings"
                @save="handleQuickSettingsSave"
            />

            <ChatTab
                v-if="activeTab === 'chat'"
                :is-active="isRunning"
                :model-name="modelName"
                :server-url="serverUrl"
                :project-path="localConfig.projectPath"
                :system-prompt="systemPrompt"
                @log="addLog"
                ref="chatTabRef"
            />

            <LogsTab
                v-if="activeTab === 'logs'"
                :logs="logs"
                @clear="handleClearLogs"
            />

            <ToolsTab
                v-if="activeTab === 'tools'"
            />
        </main>

        <ToastContainer />
    </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { useAgent } from "@/composables/useAgent";
import { useToast } from "@/composables/useToast";
import { updateConfig } from "@/api/client";

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
import ToolsTab from "@/components/tabs/ToolsTab.vue";
import ToastContainer from "@/components/ui/ToastContainer.vue";

// В начале setup(), после импортов:
const defaultConfig = {
    token: "",
    projectPath: "E:\\Git\\web-panel\\aiagent-web",
    serverUrl: "http://192.168.1.101:8080/v1",
    modelName: "gemma-4-E4B-it-Q4_K_M.gguf",
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
    logs,
    refreshStatus,
    startAgent,
    stopAgent,
    restartAgent,
} = useAgent();

const { info, success, error, warning } = useToast();

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

const apiBases = ref([
    { url: "http://192.168.1.101:8080/v1", connected: true },
    { url: "http://192.168.1.101:1234/v1", connected: false }
]);

const modelName = ref("gemma-4-E4B-it-Q4_K_M.gguf");
const serverUrl = ref("http://192.168.1.101:8080/v1");
const availableModels = ref([]);

const addLog = (message, type = "info") => {
    logs.value.push({
        time: new Date().toLocaleTimeString(),
        message,
        type
    });
    if (logs.value.length > 200) logs.value.shift();
};

const handleClearLogs = () => {
    logs.value = [];
    success("Логи очищены");
};

const tabs = [
    { id: "prompt", label: "Системный промпт", icon: "📝" },
    { id: "settings", label: "Параметры", icon: "⚙️" },
    { id: "quick", label: "Быстрые настройки", icon: "🔘" },
    { id: "tools", label: "Инструменты", icon: "🔧" },
    { id: "chat", label: "Чат-тест", icon: "💬" },
    { id: "logs", label: "Логи", icon: "🖥️" },
];

// Initialize
const loadApiBases = async () => {
    for (const api of apiBases.value) {
        if (api.connected) {
            try {
                const response = await fetch(`${api.url}/models`, {
                    headers: { "x-api-key": "agent-secret-key" }
                });
                if (response.ok) {
                    const data = await response.json();
                    const models = data.data || [];
                    models.forEach(m => {
                        if (!availableModels.value.find(x => x.id === m.id)) {
                            availableModels.value.push({
                                id: m.id,
                                source: api.url
                            });
                        }
                    });
                    addLog(`Connected to ${api.url} - ${models.length} models`, "success");
                }
            } catch (e) {
                addLog(`Failed to connect ${api.url}: ${e.message}`, "error");
            }
        }
    }
    if (availableModels.value.length > 0) {
        modelName.value = availableModels.value[0].id;
        serverUrl.value = availableModels.value[0].source;
    }
};

const updateModels = async () => {
    availableModels.value = [];
    await loadApiBases();
    success("Модели обновлены");
    addLog("Models refreshed", "success");
};

onMounted(async () => {
    await refreshStatus();
    statusInterval = setInterval(refreshStatus, 5000);

    addLog("App initialized", "system");

    // Load saved config
    const saved = localStorage.getItem("agent-config");
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            systemPrompt.value = parsed.systemPrompt || "";

            // Load all config fields
            Object.keys(defaultConfig).forEach((key) => {
                if (parsed[key] !== undefined) {
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

            if (parsed.apiBases) apiBases.value = parsed.apiBases;
            if (parsed.modelName) modelName.value = parsed.modelName;
            if (parsed.serverUrl) serverUrl.value = parsed.serverUrl;
        } catch {}
    } else {
        // Set default projectPath if no saved config
        localConfig.value.projectPath = "E:\\Git\\web-panel\\aiagent-web";
    }

    await loadApiBases();
});

onUnmounted(() => {
    clearInterval(statusInterval);
});

let statusInterval;

// Handlers
const handleStart = async () => {
    try {
        await startAgent();
        success("Агент запущен");
    } catch (e) {
        error(e.message);
    }
};

const handleStop = async () => {
    try {
        await stopAgent();
        warning("Агент остановлен");
    } catch (e) {
        error(e.message);
    }
};

const handleRestart = async () => {
    try {
        await restartAgent();
        success("Агент перезапущен");
    } catch (e) {
        error(e.message);
    }
};

const handleNavigate = (action) => {
    switch (action) {
        case 'start':
            handleStart();
            break;
        case 'stop':
            handleStop();
            break;
        case 'restart':
            handleRestart();
            break;
        case 'export':
            exportConfig();
            break;
        case 'import':
            importConfig();
            break;
        case 'format':
            formatPrompt();
            break;
        default:
            if (['prompt', 'settings', 'quick', 'chat', 'logs', 'tools'].includes(action)) {
                activeTab.value = action;
            }
    }
};

const savePrompt = async () => {
    try {
        localStorage.setItem(
            "agent-config",
            JSON.stringify({
                ...localConfig.value,
                systemPrompt: systemPrompt.value,
                ...quickSettings.value,
                apiBases: apiBases.value,
                modelName: modelName.value,
                serverUrl: serverUrl.value,
            }),
        );
        success("Промпт сохранён");
        addLog("Prompt saved", "success");
    } catch (e) {
        error(e.message);
    }
};

const resetPrompt = () => {
    if (confirm("Сбросить промпт?")) {
        systemPrompt.value = "";
        warning("Промпт сброшен");
        addLog("Prompt reset", "warning");
    }
};

const formatPrompt = () => {
    systemPrompt.value = systemPrompt.value
        .replace(/\r\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n");
    success("Отформатировано");
    addLog("Prompt formatted", "info");
};

const copyPrompt = () => {
    navigator.clipboard.writeText(systemPrompt.value);
    success("Скопировано");
    addLog("Prompt copied to clipboard", "info");
};

const exportConfig = () => {
    const data = { ...localConfig.value, systemPrompt: systemPrompt.value };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agent-config-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    success("Конфигурация экспортирована");
    addLog("Config exported", "success");
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
                success("Конфигурация импортирована");
                addLog("Config imported", "success");
            } catch {
                error("Ошибка JSON");
                addLog("Config import failed", "error");
            }
        };
        reader.readAsText(file);
    };
    input.click();
};

const handleSettingsSave = (data) => {
    if (data.config) {
        Object.assign(localConfig.value, data.config);
    }
    if (data.apiBases) {
        apiBases.value = data.apiBases;
    }
    if (data.modelName) {
        modelName.value = data.modelName;
    }
    if (data.serverUrl) {
        serverUrl.value = data.serverUrl;
    }
    saveSettings();
    success("Настройки сохранены");
    addLog("Settings saved", "success");
};

const resetSettings = () => {
    if (confirm("Сбросить настройки?")) {
        localConfig.value = {};
        systemPrompt.value = "";
        warning("Настройки сброшены");
        addLog("Settings reset", "warning");
    }
};

const saveSettings = async () => {
    try {
        localStorage.setItem(
            "agent-config",
            JSON.stringify({
                ...localConfig.value,
                systemPrompt: systemPrompt.value,
                ...quickSettings.value,
                apiBases: apiBases.value,
                modelName: modelName.value,
                serverUrl: serverUrl.value,
            }),
        );
        try {
            await updateConfig({
                modelName: modelName.value,
                serverUrl: serverUrl.value,
                projectPath: localConfig.value.projectPath,
                systemPrompt: systemPrompt.value
            });
            addLog(`Config updated: ${modelName.value}`, "info");
        } catch (e) {
            console.error("Failed to update backend config:", e);
        }
        success("Настройки сохранены");
    } catch (e) {
        error(e.message);
    }
};

const saveQuickSettings = (newSettings) => {
    if (newSettings) {
        quickSettings.value = newSettings;
    }
    localStorage.setItem(
        "agent-config",
        JSON.stringify({
            ...localConfig.value,
            systemPrompt: systemPrompt.value,
            ...quickSettings.value,
            apiBases: apiBases.value,
            modelName: modelName.value,
            serverUrl: serverUrl.value,
        }),
    );
    success("Сохранено");
};

const handleQuickSettingsSave = (newSettings) => {
    quickSettings.value = newSettings;
    saveQuickSettings(newSettings);
    success("Быстрые настройки сохранены");
    addLog("Quick settings saved", "info");
};

const chatTabRef = ref(null);

const clearChat = () => {
    if (confirm("Очистить историю чата?")) {
        chatTabRef.value?.clearChatHistory?.();
        success("История очищена");
    }
};
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
    background: var(--gradient-bg);
}

.sidebar {
    display: flex;
    flex-direction: column;
    gap: 16px;
    position: relative;
}

.sidebar::before {
    content: "";
    position: absolute;
    top: 0;
    right: -1px;
    width: 1px;
    height: 100%;
    background: var(--gradient-accent);
    opacity: 0.2;
}

.sidebar-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px;
    transition: var(--transition);
    backdrop-filter: blur(10px);
}

.sidebar-card:hover {
    border-color: var(--border-hover);
    transform: translateX(2px);
}

.quick-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: var(--gradient-bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    backdrop-filter: blur(10px);
}

.quick-action-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    font-size: 11px;
    cursor: pointer;
    transition: var(--transition);
}

.quick-action-btn:hover {
    background: var(--bg-hover);
    border-color: var(--accent-primary);
    color: var(--text-primary);
    transform: translateX(4px);
}

.quick-action-btn .icon {
    font-size: 14px;
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
    background: var(--bg-card);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    flex-wrap: wrap;
    backdrop-filter: blur(10px);
    position: relative;
}

.tabs::before {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: var(--gradient-accent);
    opacity: 0.3;
}

.tab {
    padding: 9px 16px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: var(--transition);
    font-family: inherit;
    white-space: nowrap;
    position: relative;
    display: flex;
    align-items: center;
    gap: 6px;
}

.tab::before {
    content: "";
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 2px;
    background: var(--accent-primary);
    border-radius: 2px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    opacity: 0;
}

.tab:hover:not(.active) {
    color: var(--text-secondary);
    background: var(--bg-hover);
}

.tab:hover:not(.active)::before {
    width: 30%;
    opacity: 0.5;
}

.tab.active {
    background: var(--gradient-accent);
    color: white;
    box-shadow: 0 2px 12px var(--accent-glow);
    position: relative;
    overflow: hidden;
}

.tab.active::before {
    content: "";
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 60%;
    height: 2px;
    background: var(--text-primary);
    border-radius: 2px;
    opacity: 1;
}

.tab.active::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.1) 50%, transparent 70%);
    animation: shimmer 2s infinite;
}

.tab-icon {
    font-size: 14px;
}

.tab-badge {
    background: var(--error);
    color: white;
    font-size: 9px;
    padding: 2px 5px;
    border-radius: 10px;
    min-width: 16px;
    text-align: center;
}

@keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
}

.tab {
    padding: 9px 16px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: var(--transition);
    font-family: inherit;
    white-space: nowrap;
}

.tab:hover:not(.active) {
    color: var(--text-secondary);
    background: var(--bg-hover);
}

.tab.active {
    background: var(--gradient-accent);
    color: white;
    box-shadow: 0 2px 12px var(--accent-glow);
    position: relative;
    overflow: hidden;
}

.tab.active::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.1) 50%, transparent 70%);
    animation: shimmer 2s infinite;
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
    .sidebar::before {
        display: none;
    }
    .quick-actions {
        grid-column: 1 / -1;
        flex-direction: row;
        flex-wrap: wrap;
    }
    .quick-action-btn {
        flex: 1;
        justify-content: center;
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
        -webkit-overflow-scrolling: touch;
    }
    .tab {
        padding: 8px 12px;
        font-size: 11px;
    }
    .quick-actions {
        flex-direction: column;
    }
    .quick-action-btn {
        justify-content: flex-start;
    }
}

.btn-loading {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid transparent;
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
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
