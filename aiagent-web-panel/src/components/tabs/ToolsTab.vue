<template>
    <div class="tools-tab">
        <Card>
            <template #header>
                <div class="header-row">
                    <h2>Инструменты агента</h2>
                    <span class="badge">{{ enabledCount }} / {{ toolsCount }} активны</span>
                </div>
            </template>

            <div class="tools-list">
                <div v-for="(tool, name) in tools" :key="name" class="tool-item" :class="{ disabled: !config[name]?.enabled }">
                    <div class="tool-header">
                        <div class="tool-info">
                            <span class="tool-name">{{ name }}</span>
                            <span class="tool-category" :class="tool.category">{{ tool.category }}</span>
                        </div>
                        <label class="toggle">
                            <input
                                type="checkbox"
                                :checked="config[name]?.enabled"
                                @change="toggleTool(name, $event)"
                            />
                            <span class="slider"></span>
                        </label>
                    </div>

                    <p class="tool-description">{{ tool.description }}</p>

                    <div class="tool-settings">
                        <div class="setting-row">
                            <label>Permission:</label>
                            <select
                                :value="config[name]?.permission || 'ask'"
                                @change="updatePermission(name, $event.target.value)"
                            >
                                <option value="ask">ask (с подтверждением)</option>
                                <option value="always">always (автоматически)</option>
                                <option value="deny">deny (запрещено)</option>
                            </select>
                        </div>

                        <div class="setting-row">
                            <label>Exclude paths:</label>
                            <input
                                type="text"
                                :value="(config[name]?.exclude_paths || []).join(', ')"
                                placeholder="node_modules, .git, dist"
                                @change="updateExcludePaths(name, $event.target.value)"
                            />
                        </div>
                    </div>

                    <div class="tool-examples">
                        <span class="examples-label">Примеры:</span>
                        <ul>
                            <li v-for="(example, i) in tool.examples" :key="i">{{ example }}</li>
                        </ul>
                    </div>
                </div>
            </div>
        </Card>

        <Card>
            <template #header>
                <h2>Описание параметров</h2>
            </template>
            <div class="params-info">
                <div class="param">
                    <h4>enabled</h4>
                    <p>Включить/выключить инструмент</p>
                </div>
                <div class="param">
                    <h4>permission</h4>
                    <ul>
                        <li><b>ask</b> — запросить подтверждение у пользователя (inline keyboard в Telegram)</li>
                        <li><b>always</b> — выполнять автоматически без подтверждения</li>
                        <li><b>deny</b> — заблокировать выполнение</li>
                    </ul>
                </div>
                <div class="param">
                    <h4>exclude_paths</h4>
                    <p>Пути, к которым инструмент не имеет доступа (node_modules, .git и т.д.)</p>
                </div>
            </div>
        </Card>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import Card from "../ui/Card.vue";
import { getTools, updateTools } from "@/api/client";

const tools = ref({});
const config = ref({});

const toolsCount = computed(() => Object.keys(tools.value).length);
const enabledCount = computed(() =>
    Object.keys(config.value).filter(k => config.value[k]?.enabled).length
);

const fetchTools = async () => {
    try {
        const data = await getTools();
        if (data.success) {
            tools.value = data.tools;
            config.value = data.config;
        }
    } catch (error) {
        console.error("Failed to fetch tools:", error);
    }
};

const toggleTool = async (name, event) => {
    const newEnabled = event.target.checked;
    config.value[name] = { ...config.value[name], enabled: newEnabled };
    await saveConfig(name);
};

const updatePermission = async (name, permission) => {
    config.value[name] = { ...config.value[name], permission };
    await saveConfig(name);
};

const updateExcludePaths = async (name, value) => {
    const paths = value.split(",").map(p => p.trim()).filter(p => p);
    config.value[name] = { ...config.value[name], exclude_paths: paths };
    await saveConfig(name);
};

const saveConfig = async (name) => {
    try {
        const settings = { ...config.value[name] };
        delete settings.description;
        delete settings.category;
        delete settings.examples;

        await fetch("http://127.0.0.1:3000/api/tools", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": "agent-secret-key"
            },
            body: JSON.stringify({ name, ...settings })
        });

        localStorage.setItem("agent-tool-config", JSON.stringify(config.value));
    } catch (error) {
        console.error("Failed to save tool config:", error);
    }
};

onMounted(async () => {
    await fetchTools();

    const saved = localStorage.getItem("agent-tool-config");
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            Object.keys(parsed).forEach(name => {
                if (config.value[name]) {
                    config.value[name] = { ...config.value[name], ...parsed[name] };
                }
            });
        } catch {}
    }
});
</script>

<style scoped>
.tools-tab {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.badge {
    background: var(--accent);
    color: white;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
}

.tools-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.tool-item {
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 16px;
    transition: var(--transition);
}

.tool-item.disabled {
    opacity: 0.5;
}

.tool-item:hover {
    border-color: var(--border-focus);
}

.tool-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
}

.tool-info {
    display: flex;
    align-items: center;
    gap: 10px;
}

.tool-name {
    font-weight: 700;
    font-size: 14px;
    color: var(--text-primary);
    font-family: "JetBrains Mono", monospace;
}

.tool-category {
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: 600;
    text-transform: uppercase;
}

.tool-category.file { background: #3b82f620; color: #3b82f6; }
.tool-category.shell { background: #ef444420; color: #ef4444; }

.toggle {
    position: relative;
    width: 44px;
    height: 24px;
    cursor: pointer;
}

.toggle input {
    opacity: 0;
    width: 0;
    height: 0;
}

.slider {
    position: absolute;
    inset: 0;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 12px;
    transition: var(--transition);
}

.slider::before {
    content: "";
    position: absolute;
    width: 18px;
    height: 18px;
    left: 2px;
    top: 2px;
    background: var(--text-muted);
    border-radius: 50%;
    transition: var(--transition);
    border: 1px solid var(--border);
}

.toggle input:checked + .slider {
    background: var(--accent-primary);
    border-color: var(--accent-primary);
}

.toggle input:checked + .slider::before {
    transform: translateX(20px);
    background: var(--text-primary);
    border-color: var(--text-primary);
}

.tool-description {
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 12px;
}

.tool-settings {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 12px;
}

.setting-row {
    display: flex;
    align-items: center;
    gap: 10px;
}

.setting-row label {
    font-size: 11px;
    color: var(--text-muted);
    min-width: 100px;
}

.setting-row select,
.setting-row input {
    flex: 1;
    padding: 6px 10px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-size: 11px;
    font-family: "JetBrains Mono", monospace;
}

.setting-row select:focus,
.setting-row input:focus {
    outline: none;
    border-color: var(--accent);
}

.tool-examples {
    background: var(--bg-tertiary);
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    font-size: 11px;
}

.examples-label {
    color: var(--text-muted);
    font-weight: 600;
    display: block;
    margin-bottom: 6px;
}

.tool-examples ul {
    margin: 0;
    padding-left: 18px;
    color: var(--text-secondary);
}

.tool-examples li {
    margin-bottom: 3px;
}

.params-info {
    display: grid;
    gap: 16px;
}

.param h4 {
    font-size: 12px;
    font-weight: 700;
    color: var(--accent);
    margin-bottom: 6px;
    font-family: "JetBrains Mono", monospace;
}

.param p, .param li {
    font-size: 11px;
    color: var(--text-secondary);
    line-height: 1.5;
}

.param ul {
    margin: 0;
    padding-left: 16px;
}

.param li {
    margin-bottom: 4px;
}
</style>
