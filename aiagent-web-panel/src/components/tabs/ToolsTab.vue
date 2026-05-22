<template>
  <div class="tools-tab">
    <Card>
      <template #header>
        <div class="header-row">
          <div class="header-left" @click="toolsExpanded = !toolsExpanded">
            <span class="arrow">{{ toolsExpanded ? "▼" : "▶" }}</span>
            <h2>Инструменты агента</h2>
            <span class="info-trigger">?</span>
          </div>
          <span class="badge">{{ enabledCount }} / {{ toolsCount }} активны</span>
        </div>

        <div class="params-tooltip">
          <div class="param">
            <h4>enabled</h4>
            <p>Включить/выключить инструмент</p>
          </div>
          <div class="param">
            <h4>permission</h4>
            <ul>
              <li><b>ask</b> — запросить подтверждение (inline keyboard в Telegram)</li>
              <li><b>always</b> — выполнять автоматически</li>
              <li><b>deny</b> — заблокировать выполнение</li>
            </ul>
          </div>
          <div class="param">
            <h4>exclude_paths</h4>
            <p>Пути, к которым инструмент не имеет доступа (node_modules, .git и т.д.)</p>
          </div>
        </div>
      </template>

      <div v-show="toolsExpanded" class="tools-list">
        <div v-for="(tool, name) in tools" :key="name" class="tool-item" :class="{ disabled: !config[name]?.enabled }">
          <div class="tool-header">
            <div class="tool-info">
              <span class="tool-name">{{ name }}</span>
              <span class="tool-category" :class="tool.category">{{ tool.category }}</span>
            </div>
            <label class="toggle">
              <input type="checkbox" :checked="config[name]?.enabled" @change="toggleTool(name, $event)" />
              <span class="slider" />
            </label>
          </div>

          <p class="tool-description">
            {{ tool.description }}
          </p>

          <div class="tool-settings">
            <div class="setting-row">
              <label>Permission:</label>
              <select :value="config[name]?.permission || 'ask'" @change="updatePermission(name, $event.target.value)">
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
              <li v-for="(example, i) in tool.examples" :key="i">
                {{ example }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </Card>

    <Card>
      <template #header>
        <div class="header-row">
          <div class="header-left" @click="accountsExpanded = !accountsExpanded">
            <span class="arrow">{{ accountsExpanded ? "▼" : "▶" }}</span>
            <h2>Управление аккаунтами</h2>
          </div>
          <div class="header-actions">
            <input
              v-show="accountsExpanded"
              type="text"
              :value="accountSearch"
              placeholder="Поиск по username..."
              class="search-input"
              @input="accountSearch = $event.target.value"
            />
            <button class="btn btn-secondary" @click="importAccounts">Импортировать</button>
            <input ref="importFileInput" type="file" accept=".json" style="display: none" @change="handleImportFile" />
          </div>
        </div>
      </template>

      <div v-show="accountsExpanded">
        <div class="accounts-list">
          <div v-for="(acct, idx) in filteredAccounts" :key="idx" class="account-card">
            <div class="account-header">
              <div class="account-fields">
                <div class="field">
                  <label>Username:</label>
                  <input
                    type="text"
                    :value="acct.username"
                    placeholder="@username"
                    @input="acct.username = $event.target.value"
                  />
                </div>
                <div class="field">
                  <label>Role:</label>
                  <select :value="acct.role" @change="onRoleChange(getAccountIndex(acct), $event.target.value)">
                    <option value="system">system</option>
                    <option value="user">user</option>
                    <option value="guest">guest</option>
                  </select>
                </div>
              </div>
              <button class="btn btn-danger btn-sm" @click="removeAccount(getAccountIndex(acct))">Удалить</button>
            </div>

            <div class="account-permissions">
              <label class="perm-label">Доступные инструменты:</label>
              <div class="perm-grid">
                <label v-for="toolName in allToolNames" :key="toolName" class="perm-check">
                  <input
                    type="checkbox"
                    :checked="acct.permissions?.[toolName] === true"
                    @change="toggleAccountTool(getAccountIndex(acct), toolName, $event.target.checked)"
                  />
                  <span>{{ toolName }}</span>
                </label>
              </div>
            </div>

            <div class="account-paths">
              <label class="perm-label">Include paths:</label>
              <div v-for="(p, pi) in acct.include_paths" :key="pi" class="path-row">
                <input
                  type="text"
                  :value="p"
                  placeholder="E:\path\to\allowed\dir"
                  @input="acct.include_paths[pi] = $event.target.value"
                />
                <button class="btn btn-icon" @click="removePath(getAccountIndex(acct), pi)">✕</button>
              </div>
              <button class="btn btn-link" @click="addPath(getAccountIndex(acct))">+ Add path</button>
            </div>
          </div>
          <div v-if="filteredAccounts.length === 0" class="no-results">
            {{ accountSearch ? "Аккаунты не найдены" : "Нет аккаунтов. Нажмите «+ Добавить аккаунт»" }}
          </div>
        </div>

        <div class="accounts-actions">
          <button class="btn btn-primary" @click="addAccount">+ Добавить аккаунт</button>
          <button class="btn btn-primary" @click="saveAccounts">Сохранить</button>
        </div>
      </div>
    </Card>
  </div>
</template>

<!--
  Компонент управления инструментами агента и аккаунтами пользователей.
  Позволяет включать/выключать инструменты, настраивать права доступа,
  управлять аккаунтами и их разрешениями.
-->
<script setup>
import { ref, computed, onMounted } from "vue";
import Card from "../ui/Card.vue";
import { getTools, updateTools } from "@/api/client";
import { useToast } from "@/composables/useToast";

const { success: toastSuccess, error: toastError } = useToast();

const tools = ref({});
const config = ref({});
const accounts = ref([]);
const toolsExpanded = ref(false);
const accountsExpanded = ref(false);
const accountSearch = ref("");
const allToolNames = ["read", "write", "search", "list_dir", "execute", "create_dir", "delete", "move", "copy"];
const importFileInput = ref(null);

const toolsCount = computed(() => Object.keys(tools.value).length);
const enabledCount = computed(() => Object.keys(config.value).filter((k) => config.value[k]?.enabled).length);

const filteredAccounts = computed(() => {
  if (!accountSearch.value) return accounts.value;
  const q = accountSearch.value.toLowerCase().replace(/^@/, "");
  return accounts.value.filter((a) => a.username.toLowerCase().replace(/^@/, "").includes(q));
});

const ROLE_DEFAULTS = {
  system: {
    read: true,
    write: true,
    search: true,
    list_dir: true,
    execute: true,
    create_dir: true,
    delete: true,
    move: true,
    copy: true,
  },
  user: { read: true, write: true, list_dir: true, search: true, create_dir: true },
  guest: { read: true },
};

function getAccountIndex(acct) {
  return accounts.value.indexOf(acct);
}

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
  const paths = value
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p);
  config.value[name] = { ...config.value[name], exclude_paths: paths };
  await saveConfig(name);
};

const saveConfig = async (name) => {
  try {
    const settings = { ...config.value[name] };
    delete settings.description;
    delete settings.category;
    delete settings.examples;

    await updateTools({ name, ...settings });
    localStorage.setItem("agent-tool-config", JSON.stringify(config.value));
  } catch (error) {
    console.error("Failed to save tool config:", error);
    toastError("Не удалось сохранить настройки инструмента");
  }
};

const fetchAccounts = async () => {
  try {
    const res = await fetch("/api/accounts", {
      headers: { "x-api-key": "agent-secret-key" },
    });
    const data = await res.json();
    if (data.success) {
      accounts.value = data.accounts;
    }
  } catch (error) {
    console.error("Failed to fetch accounts:", error);
  }
};

const addAccount = () => {
  accounts.value.push({
    username: "",
    role: "guest",
    permissions: { ...ROLE_DEFAULTS.guest },
    include_paths: [],
  });
};

const removeAccount = (idx) => {
  if (confirm("Удалить этот аккаунт?")) {
    accounts.value.splice(idx, 1);
  }
};

const onRoleChange = (idx, role) => {
  accounts.value[idx].role = role;
  accounts.value[idx].permissions = { ...ROLE_DEFAULTS[role] };
};

const toggleAccountTool = (idx, toolName, checked) => {
  if (!accounts.value[idx].permissions) {
    accounts.value[idx].permissions = {};
  }
  accounts.value[idx].permissions[toolName] = checked;
};

const addPath = (idx) => {
  accounts.value[idx].include_paths.push("");
};

const removePath = (idx, pi) => {
  accounts.value[idx].include_paths.splice(pi, 1);
};

const saveAccounts = async () => {
  try {
    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "agent-secret-key",
      },
      body: JSON.stringify({ accounts: accounts.value }),
    });
    const data = await res.json();
    if (data.success) {
      accounts.value = data.accounts;
      toastSuccess("Аккаунты сохранены");
    } else {
      toastError("Ошибка: " + (data.error || "Неизвестная ошибка"));
    }
  } catch (error) {
    console.error("Failed to save accounts:", error);
    toastError("Ошибка сохранения: " + error.message);
  }
};

const importAccounts = () => {
  importFileInput.value?.click();
};

const handleImportFile = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const imported = parsed.accounts || [];
    if (!Array.isArray(imported)) {
      toastError("Неверный формат: ожидается массив accounts");
      return;
    }
    const res = await fetch("/api/accounts/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "agent-secret-key",
      },
      body: JSON.stringify({ accounts: imported }),
    });
    const data = await res.json();
    if (data.success) {
      accounts.value = data.accounts;
      toastSuccess(`Импортировано ${accounts.value.length} аккаунтов`);
    } else {
      toastError("Ошибка импорта: " + (data.error || "Неизвестная ошибка"));
    }
  } catch (error) {
    console.error("Failed to import accounts:", error);
    toastError("Ошибка импорта: " + error.message);
  }
  event.target.value = "";
};

onMounted(async () => {
  await fetchTools();
  await fetchAccounts();

  const saved = localStorage.getItem("agent-tool-config");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      Object.keys(parsed).forEach((name) => {
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

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  position: relative;
}

.header-left:hover h2 {
  color: var(--accent);
}

.header-left:hover .params-tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.arrow {
  font-size: 12px;
  color: var(--text-muted);
  transition: transform 0.2s;
}

.info-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: var(--transition);
}

.info-trigger:hover {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.params-tooltip {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 100;
  margin-top: 8px;
  padding: 12px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 11px;
  box-shadow: var(--shadow-lg);
  opacity: 0;
  visibility: hidden;
  transform: translateY(-4px);
  transition:
    opacity 0.2s ease,
    visibility 0.2s ease,
    transform 0.2s ease;
  pointer-events: none;
  min-width: 320px;
}

.params-tooltip .param {
  margin-bottom: 10px;
}

.params-tooltip .param:last-child {
  margin-bottom: 0;
}

.params-tooltip h4 {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent);
  margin-bottom: 3px;
  font-family: "JetBrains Mono", monospace;
}

.params-tooltip p,
.params-tooltip li {
  font-size: 10px;
  color: var(--text-secondary);
  line-height: 1.4;
}

.params-tooltip ul {
  margin: 0;
  padding-left: 14px;
}

.params-tooltip li {
  margin-bottom: 2px;
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.search-input {
  padding: 4px 10px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 11px;
  font-family: "JetBrains Mono", monospace;
  width: 180px;
}

.search-input:focus {
  outline: none;
  border-color: var(--accent);
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
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
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

.tool-category.file {
  background: #3b82f620;
  color: #3b82f6;
}
.tool-category.search {
  background: #f59e0b20;
  color: #f59e0b;
}
.tool-category.system {
  background: #ef444420;
  color: #ef4444;
}

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

.accounts-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 300px;
  overflow-y: auto;
}

.no-results {
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  padding: 40px 0;
}

.account-card {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 16px;
}

.account-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.account-fields {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  flex: 1;
}

.account-fields .field {
  display: flex;
  align-items: center;
  gap: 8px;
}

.account-fields .field label {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 600;
}

.account-fields .field input,
.account-fields .field select {
  padding: 6px 10px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 11px;
  font-family: "JetBrains Mono", monospace;
}

.account-fields .field input {
  width: 180px;
}

.account-permissions {
  margin-bottom: 12px;
}

.perm-label {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 600;
  display: block;
  margin-bottom: 8px;
}

.perm-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.perm-check {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-secondary);
  cursor: pointer;
  font-family: "JetBrains Mono", monospace;
}

.perm-check input[type="checkbox"] {
  accent-color: var(--accent-primary);
}

.account-paths {
  margin-bottom: 8px;
}

.path-row {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
}

.path-row input {
  flex: 1;
  padding: 6px 10px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 11px;
  font-family: "JetBrains Mono", monospace;
}

.accounts-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.btn {
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  transition: var(--transition);
}

.btn-primary {
  background: var(--accent-primary);
  color: white;
  border-color: var(--accent-primary);
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.btn-secondary:hover {
  border-color: var(--accent);
}

.btn-danger {
  background: transparent;
  color: #ef4444;
  border-color: #ef4444;
}

.btn-danger:hover {
  background: #ef444420;
}

.btn-sm {
  padding: 4px 10px;
  font-size: 11px;
}

.btn-icon {
  background: transparent;
  color: #ef4444;
  border: none;
  padding: 4px 8px;
  font-size: 14px;
  cursor: pointer;
}

.btn-icon:hover {
  background: #ef444420;
  border-radius: var(--radius-sm);
}

.btn-link {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 11px;
  padding: 4px 0;
}

.btn-link:hover {
  text-decoration: underline;
}
</style>
