<!--
  Карточка одного аккаунта: header (username, role, удалить),
  разворачиваемые permissions + include_paths.
-->
<template>
  <div class="account-card">
    <div class="account-header" style="cursor: pointer" @click="onToggleSettings">
      <div class="account-header-left">
        <span class="arrow-detail">{{ isExpanded ? "▼" : "▶" }}</span>
        <div class="account-fields">
          <div class="field">
            <label>Username:</label>
            <input
              type="text"
              :value="acct.username"
              placeholder="@username"
              @input="onUsernameInput"
              @click.stop
            />
          </div>
          <div class="field">
            <label>Role:</label>
            <select :value="acct.role" @change="onRoleSelect" @click.stop>
              <option value="system">system</option>
              <option value="user">user</option>
              <option value="guest">guest</option>
            </select>
          </div>
        </div>
      </div>
      <button class="btn btn-danger btn-sm" @click.stop="onRemove">Удалить</button>
    </div>

    <div v-show="isExpanded" class="account-details">
      <div class="account-permissions">
        <label class="perm-label">Доступные инструменты:</label>
        <div class="perm-grid">
          <label v-for="toolName in allToolNames" :key="toolName" class="perm-check">
            <input
              type="checkbox"
              :checked="acct.permissions?.[toolName] === true"
              @change="onToggleTool(toolName, $event.target.checked)"
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
            @input="onPathInput(pi, $event.target.value)"
          />
          <button class="btn btn-icon" @click="onRemovePath(pi)">✕</button>
        </div>
        <button class="btn btn-link" @click="onAddPath">+ Add path</button>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  acct: { type: Object, required: true },
  idx: { type: Number, required: true },
  isExpanded: { type: Boolean, default: false },
  allToolNames: { type: Array, required: true },
});

const emit = defineEmits([
  "toggle-settings",
  "remove",
  "username-input",
  "role-change",
  "toggle-tool",
  "path-input",
  "add-path",
  "remove-path",
]);

function onToggleSettings() {
  emit("toggle-settings", props.idx);
}

function onRemove() {
  emit("remove", props.idx);
}

function onUsernameInput(event) {
  emit("username-input", props.idx, event.target.value);
}

function onRoleSelect(event) {
  emit("role-change", props.idx, event.target.value);
}

function onToggleTool(toolName, checked) {
  emit("toggle-tool", props.idx, toolName, checked);
}

function onPathInput(pi, value) {
  emit("path-input", props.idx, pi, value);
}

function onAddPath() {
  emit("add-path", props.idx);
}

function onRemovePath(pi) {
  emit("remove-path", props.idx, pi);
}
</script>

<style scoped>
.account-card {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
}

.account-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.account-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.arrow-detail {
  font-size: 10px;
  color: var(--text-muted);
  transition: transform 0.2s;
  cursor: pointer;
  flex-shrink: 0;
}

.account-details {
  margin-top: 12px;
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
  gap: 4px;
}

.perm-check {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  color: var(--text-secondary);
  cursor: pointer;
  font-family: "JetBrains Mono", monospace;
}

.perm-check input[type="checkbox"] {
  accent-color: var(--accent);
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

.btn {
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  transition: var(--transition);
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
