import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

const STORAGE_KEY = 'agent-config';

const defaultConfig = {
    token: "",
    projectPath: "E:\\Git\\web-panel",
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

const defaultQuickSettings = {
    autoSave: true,
    verbose: false,
    autoStart: false,
    notifications: true,
    showTokens: true,
};

function loadFromStorage() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            return JSON.parse(saved);
        }
    } catch {}
    return null;
}

function saveToStorage(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
}

export const useSettingsStore = defineStore('settings', () => {
    const config = ref({ ...defaultConfig });
    const quickSettings = ref({ ...defaultQuickSettings });
    const systemPrompt = ref("");
    const apiBases = ref([
        { url: "http://192.168.1.101:8080/v1", connected: true },
        { url: "http://192.168.1.101:1234/v1", connected: false }
    ]);
    const modelName = ref("gemma-4-E4B-it-Q4_K_M.gguf");
    const serverUrl = ref("http://192.168.1.101:8080/v1");

    function loadSaved() {
        const saved = loadFromStorage();
        if (saved) {
            Object.keys(defaultConfig).forEach((key) => {
                if (saved[key] !== undefined) {
                    config.value[key] = saved[key];
                }
            });

            quickSettings.value = {
                autoSave: saved.autoSave !== false,
                verbose: saved.verbose === true,
                autoStart: saved.autoStart === true,
                notifications: saved.notifications !== false,
                showTokens: saved.showTokens !== false,
            };

            systemPrompt.value = saved.systemPrompt || "";
            if (saved.apiBases) apiBases.value = saved.apiBases;
            if (saved.modelName) modelName.value = saved.modelName;
            if (saved.serverUrl) serverUrl.value = saved.serverUrl;
        } else {
            config.value.projectPath = defaultConfig.projectPath;
        }
    }

    function save() {
        saveToStorage({
            ...config.value,
            systemPrompt: systemPrompt.value,
            ...quickSettings.value,
            apiBases: apiBases.value,
            modelName: modelName.value,
            serverUrl: serverUrl.value,
        });
    }

    function reset() {
        config.value = { ...defaultConfig };
        quickSettings.value = { ...defaultQuickSettings };
        systemPrompt.value = "";
        localStorage.removeItem(STORAGE_KEY);
    }

    return {
        config,
        quickSettings,
        systemPrompt,
        apiBases,
        modelName,
        serverUrl,
        loadSaved,
        save,
        reset,
    };
});
