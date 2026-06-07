<template>
  <section class="settings-section">
    <header class="accounts-header">
      <h2 class="accounts-header__title">Accounts</h2>
      <p class="accounts-header__desc">
        Telegram user accounts and their per-tool permissions. <code>system</code> role has full access.
      </p>
    </header>

    <div class="settings-section__body">
      <div class="accounts-toolbar">
        <input v-model="accountSearch" type="text" placeholder="Search accounts…" class="accounts-search" />
        <button class="btn-secondary" @click="importAccounts">Import</button>
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
        <div v-if="filteredAccounts.length === 0" class="accounts-empty">
          {{ accountSearch ? "No accounts found" : 'No accounts. Click "+ Add account"' }}
        </div>
      </div>

      <div class="accounts-actions">
        <button class="btn-primary" @click="addAccount">+ Add account</button>
        <button class="btn-primary" @click="saveAccounts">Save</button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { onMounted } from "vue";
import AccountCard from "../tabs/tools/AccountCard.vue";
import { useAccounts, ALL_TOOL_NAMES } from "@/composables/useAccounts";

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
  await fetchAccounts();
});
</script>

<style scoped>
.settings-section {
  padding: 24px;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.accounts-header {
  margin-bottom: 16px;
  flex-shrink: 0;
}

.accounts-header__title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 4px;
  color: var(--text-1);
}

.accounts-header__desc {
  font-size: 13px;
  color: var(--text-3);
  margin: 0;
  line-height: 1.5;
}

.accounts-header__desc code {
  font-family: var(--font-mono);
  font-size: 11px;
  background: var(--bg-2);
  padding: 1px 4px;
  border-radius: var(--radius-xs);
}

.settings-section__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
}

.accounts-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.accounts-search {
  flex: 1;
  padding: 7px 12px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-1);
  font-size: 13px;
  outline: none;
  transition: var(--t-fast);
}

.accounts-search:focus {
  border-color: var(--accent);
  box-shadow: var(--accent-glow);
}

.btn-secondary {
  padding: 7px 14px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  color: var(--text-2);
  font-size: 12px;
  font-weight: 500;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--t-fast);
}

.btn-secondary:hover {
  background: var(--bg-2);
  color: var(--text-1);
}

.accounts-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 4px;
}

.accounts-empty {
  text-align: center;
  padding: 40px 0;
  color: var(--text-3);
  font-size: 13px;
  font-style: italic;
}

.accounts-actions {
  display: flex;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.btn-primary {
  padding: 8px 16px;
  background: var(--accent);
  color: white;
  border: 1px solid var(--accent);
  font-size: 12px;
  font-weight: 500;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--t-fast);
}

.btn-primary:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}
</style>
