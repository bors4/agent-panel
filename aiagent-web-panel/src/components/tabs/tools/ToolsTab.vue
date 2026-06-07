<!--
  Вкладка управления инструментами агента и аккаунтами Telegram.
  Содержит три секции:
    1. TLS://TOOLS — список инструментов с настройками (enabled, permission, exclude_paths)
    2. ACT://ACCOUNTS — управление аккаунтами (CRUD, роли, permissions, include_paths)
    3. CFG://FUTURE — заготовка для будущих настроек

  Логика вынесена в composables/useToolsConfig и composables/useAccounts.
  UI отдельных элементов — components/tabs/tools/{ToolItem,AccountCard}.vue.
-->
<template>
  <div class="tools-tab">
    <Card>
      <template #header>
        <div class="header-row">
          <div class="header-left">
            <h3 class="mono-label">TLS://TOOLS</h3>
            <AppTooltip>
              <template #trigger>
                <span class="info-trigger">?</span>
              </template>
              <b>enabled</b> — toggle on/off<br />
              <b>permission</b>: ask / always / deny<br />
              <b>exclude_paths</b> — restricted paths
            </AppTooltip>
          </div>
          <span class="badge">{{ enabledCount }}/{{ toolsCount }}</span>
        </div>
      </template>

      <div class="tools-list">
        <ToolItem
          v-for="(tool, name) in tools"
          :key="name"
          :name="name"
          :tool="tool"
          :config="config"
          :is-expanded="!!toolSettingsExpanded[name]"
          @toggle-settings="toggleToolSettings"
          @toggle="toggleTool"
          @update-permission="updatePermission"
          @update-exclude-paths="updateExcludePaths"
        />
      </div>
    </Card>

    <Card>
      <template #header>
        <div class="header-row">
          <div class="header-left">
            <h3 class="mono-label">ACT://ACCOUNTS</h3>
          </div>
        </div>
      </template>

      <div>
        <div class="account-toolbar">
          <input v-model="accountSearch" type="text" placeholder="Поиск..." class="search-input search-input-compact" />
          <button class="btn btn-secondary btn-sm" @click="importAccounts">Импорт</button>
          <input ref="importFileInput" type="file" accept=".json" style="display: none" @change="handleImportFile" />
        </div>
        <div class="accounts-list">
          <AccountCard
            v-for="(acct, idx) in filteredAccounts"
            :key="idx"
            :acct="acct"
            :idx="accounts.indexOf(acct)"
            :is-expanded="!!accountSettingsExpanded[accounts.indexOf(acct)]"
            :all-tool-names="allToolNames"
            @toggle-settings="toggleAccountSettings"
            @remove="removeAccount"
            @username-input="onUsernameInput"
            @role-change="onRoleChange"
            @toggle-tool="toggleAccountTool"
            @path-input="onPathInput"
            @add-path="addPath"
            @remove-path="removePath"
          />
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

    <Card>
      <template #header>
        <div class="header-row">
          <div class="header-left">
            <h3 class="mono-label">CFG://FUTURE</h3>
          </div>
        </div>
      </template>
      <div class="placeholder-card">
        <p class="placeholder-text">Будущие настройки</p>
      </div>
    </Card>
  </div>
</template>

<script setup>
import { onMounted } from "vue";
import Card from "../../ui/Card.vue";
import AppTooltip from "../../ui/AppTooltip.vue";
import ToolItem from "./ToolItem.vue";
import AccountCard from "./AccountCard.vue";
import { useToolsConfig } from "@/composables/useToolsConfig";
import { useAccounts, ALL_TOOL_NAMES } from "@/composables/useAccounts";

const {
  tools,
  config,
  toolSettingsExpanded,
  toolsCount,
  enabledCount,
  fetchTools,
  toggleTool,
  updatePermission,
  updateExcludePaths,
  toggleToolSettings,
  mergeLocalConfig,
} = useToolsConfig();

const {
  accounts,
  accountSearch,
  accountSettingsExpanded,
  importFileInput,
  filteredAccounts,
  toggleAccountSettings,
  fetchAccounts,
  addAccount,
  removeAccount,
  onRoleChange,
  toggleAccountTool,
  addPath,
  removePath,
  saveAccounts,
  importAccounts,
  handleImportFile,
} = useAccounts();

const allToolNames = ALL_TOOL_NAMES;

function onUsernameInput(idx, value) {
  accounts.value[idx].username = value;
}

function onPathInput(idx, pi, value) {
  accounts.value[idx].include_paths[pi] = value;
}

onMounted(async () => {
  await fetchTools();
  await fetchAccounts();
  mergeLocalConfig();
});
</script>

<style scoped>
.mono-label {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.65rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-muted);
}

.tools-tab {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
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

.account-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.search-input-compact {
  width: 100px;
  font-size: 10px;
  padding: 3px 8px;
}

.placeholder-card {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100px;
}

.placeholder-text {
  color: var(--text-muted);
  font-size: 12px;
  font-style: italic;
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
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 350px;
  overflow-y: auto;
}

.accounts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 350px;
  overflow-y: auto;
}

.no-results {
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  padding: 40px 0;
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
  background: var(--accent);
  color: white;
  border-color: var(--accent);
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

.btn-sm {
  padding: 4px 10px;
  font-size: 11px;
}
</style>
