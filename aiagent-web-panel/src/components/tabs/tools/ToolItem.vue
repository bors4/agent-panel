<!--
  Карточка одного инструмента: header с toggle, описание, разворачиваемые
  настройки (permission, exclude_paths) и примеры использования.
-->
<template>
  <div class="tool-item" :class="{ disabled: !config[name]?.enabled }">
    <div class="tool-header">
      <div class="tool-info" @click="onToggleSettings">
        <span class="arrow-detail">{{ isExpanded ? "▼" : "▶" }}</span>
        <span class="tool-name">{{ name }}</span>
        <span class="tool-category" :class="tool.category">{{ tool.category }}</span>
      </div>
      <label class="toggle">
        <input type="checkbox" :checked="config[name]?.enabled" @change="onToggle" />
        <span class="slider" />
      </label>
    </div>

    <p class="tool-description">
      {{ tool.description }}
    </p>

    <div v-show="isExpanded" class="tool-settings">
      <div class="setting-row">
        <label>Permission:</label>
        <select :value="config[name]?.permission || 'ask'" @change="onPermissionChange">
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
          @change="onExcludePathsChange"
        />
      </div>
    </div>

    <div v-show="isExpanded" class="tool-examples">
      <span class="examples-label">Примеры:</span>
      <ul>
        <li v-for="(example, i) in tool.examples" :key="i">
          {{ example }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  name: { type: String, required: true },
  tool: { type: Object, required: true },
  config: { type: Object, required: true },
  isExpanded: { type: Boolean, default: false },
});

const emit = defineEmits(["toggle-settings", "toggle", "update-permission", "update-exclude-paths"]);

function onToggleSettings() {
  emit("toggle-settings", props.name);
}

function onToggle(event) {
  emit("toggle", props.name, event);
}

function onPermissionChange(event) {
  emit("update-permission", props.name, event.target.value);
}

function onExcludePathsChange(event) {
  emit("update-exclude-paths", props.name, event.target.value);
}
</script>

<style scoped>
.tool-item {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  transition: var(--transition);
}

.tool-item.disabled {
  opacity: 0.5;
}

.tool-item:hover {
  border-color: var(--accent);
}

.tool-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.tool-info {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.arrow-detail {
  font-size: 10px;
  color: var(--text-muted);
  transition: transform 0.2s;
  cursor: pointer;
  flex-shrink: 0;
}

.tool-name {
  font-weight: 700;
  font-size: 12px;
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
  background: var(--accent);
  border-color: var(--accent);
}

.toggle input:checked + .slider::before {
  transform: translateX(20px);
  background: var(--text-primary);
  border-color: var(--text-primary);
}

.tool-description {
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.tool-settings {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
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
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  font-size: 10px;
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
</style>
