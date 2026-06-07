/**
 * Composable для управления конфигурацией инструментов агента.
 * Загружает список инструментов и их настройки с бэкенда, синхронизирует
 * локальные overrides из localStorage, сохраняет изменения через API.
 * @module composables/useToolsConfig
 */

import { ref, computed } from "vue";
import { getTools, updateTools } from "@/api/client";
import { useToast } from "@/composables/useToast";

const LS_TOOL_CONFIG = "agent-tool-config";

const TOOL_FIELDS_TO_STRIP = ["description", "category", "examples", "input_schema"];

export function useToolsConfig() {
  const { error: toastError } = useToast();

  const tools = ref({});
  const config = ref({});
  const toolSettingsExpanded = ref({});

  const toolsCount = computed(() => Object.keys(tools.value).length);
  const enabledCount = computed(() => Object.keys(config.value).filter((k) => config.value[k]?.enabled).length);

  async function fetchTools() {
    try {
      const data = await getTools();
      if (data.success) {
        tools.value = data.tools;
        config.value = data.config;
      }
    } catch (error) {
      console.error("Failed to fetch tools:", error);
    }
  }

  async function saveConfig(name) {
    try {
      const settings = { ...config.value[name] };
      for (const field of TOOL_FIELDS_TO_STRIP) {
        delete settings[field];
      }

      await updateTools({ name, ...settings });
      localStorage.setItem(LS_TOOL_CONFIG, JSON.stringify(config.value));
    } catch (error) {
      console.error("Failed to save tool config:", error);
      toastError("Не удалось сохранить настройки инструмента");
    }
  }

  async function toggleTool(name, event) {
    const newEnabled = event.target.checked;
    config.value[name] = { ...config.value[name], enabled: newEnabled };
    await saveConfig(name);
  }

  async function updatePermission(name, permission) {
    config.value[name] = { ...config.value[name], permission };
    await saveConfig(name);
  }

  async function updateExcludePaths(name, value) {
    const paths = value
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p);
    config.value[name] = { ...config.value[name], exclude_paths: paths };
    await saveConfig(name);
  }

  function toggleToolSettings(name) {
    toolSettingsExpanded.value[name] = !toolSettingsExpanded.value[name];
  }

  function mergeLocalConfig() {
    const saved = localStorage.getItem(LS_TOOL_CONFIG);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      for (const name of Object.keys(parsed)) {
        if (config.value[name]) {
          config.value[name] = { ...config.value[name], ...parsed[name] };
        }
      }
    } catch {}
  }

  return {
    tools,
    config,
    toolSettingsExpanded,
    toolsCount,
    enabledCount,
    fetchTools,
    saveConfig,
    toggleTool,
    updatePermission,
    updateExcludePaths,
    toggleToolSettings,
    mergeLocalConfig,
  };
}
