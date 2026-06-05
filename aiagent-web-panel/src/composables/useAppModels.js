/**
 * Composable для управления списком AI-моделей и API баз.
 * Хранит `apiBases`, `modelName`, `serverUrl`, `availableModels`.
 * Загружает модели из локальных API и OpenRouter, обновляет при необходимости.
 * @module composables/useAppModels
 */

import { ref, computed } from "vue";
import { getModels } from "@/api/client";
import { configDefaults } from "@backend/lib/configDefaults.js";

const DEFAULT_API_BASES = [
  { url: "http://192.168.1.101:8080/v1", connected: true },
  { url: "http://192.168.1.101:1234/v1", connected: false },
];

const DEFAULT_MODEL = "gemma-4-E4B-it-Q4_K_M.gguf";
const DEFAULT_SERVER_URL = "http://192.168.1.101:8080/v1";

/**
 * Composable для моделей и API баз.
 * @param {Object} deps
 * @param {Function} deps.addLog - логгер
 * @param {Function} [deps.success] - toast success
 * @param {import("vue").Ref<number>} [deps.maxTokensFallback] - fallback для modelContextLength
 */
export function useAppModels({ addLog, success, maxTokensFallback }) {
  const apiBases = ref([...DEFAULT_API_BASES]);
  const modelName = ref(DEFAULT_MODEL);
  const serverUrl = ref(DEFAULT_SERVER_URL);
  const availableModels = ref([]);

  const selectedModel = computed(() => availableModels.value.find((m) => m.id === modelName.value) || null);

  const modelContextLength = computed(() => {
    if (selectedModel.value?.maxContextLength) return selectedModel.value.maxContextLength;
    if (maxTokensFallback?.value) return maxTokensFallback.value;
    return configDefaults.maxTokens;
  });

  function pushModelsUnique(models, source) {
    for (const m of models) {
      if (!availableModels.value.find((x) => x.id === m.id)) {
        availableModels.value.push({
          id: m.id,
          source,
          maxContextLength: m.max_context_length || null,
        });
      }
    }
  }

  /**
   * Загрузить модели из всех локальных API баз с флагом `connected: true`.
   * Также обновляет `modelName`/`serverUrl` на первый доступный, если текущий не найден.
   */
  async function loadApiBases() {
    for (const api of apiBases.value) {
      if (!api.connected) continue;
      try {
        const data = await getModels(api.url);
        if (data.models) {
          pushModelsUnique(data.models, api.url);
          addLog(`Connected to ${api.url} - ${data.models.length} models`, "success");
        }
      } catch (e) {
        addLog(`Failed to connect ${api.url}: ${e.message}`, "error");
      }
    }
    if (availableModels.value.length > 0) {
      const saved = availableModels.value.find((m) => m.id === modelName.value);
      if (saved) {
        serverUrl.value = saved.source;
      } else {
        const first = availableModels.value[0];
        modelName.value = first.id;
        serverUrl.value = first.source;
      }
    }
  }

  /**
   * Обновить список моделей. Если передан openrouterUrl — загружает модели из OpenRouter.
   * @param {string} [openrouterUrl] - URL OpenRouter (если задан — используется вместо локальных баз)
   * @param {string} [openrouterApiKey] - API ключ OpenRouter
   */
  async function updateModels(openrouterUrl, openrouterApiKey) {
    if (openrouterUrl) {
      try {
        const data = await getModels(openrouterUrl, openrouterApiKey);
        if (data.models) {
          pushModelsUnique(data.models, openrouterUrl);
          addLog(`Connected to OpenRouter - ${data.models.length} models`, "success");
        }
      } catch (e) {
        addLog(`Failed to connect OpenRouter: ${e.message}`, "error");
      }
      success?.("Модели OpenRouter загружены");
    } else {
      availableModels.value = [];
      await loadApiBases();
      success?.("Модели обновлены");
    }
    addLog("Models refreshed", "success");
  }

  return {
    apiBases,
    modelName,
    serverUrl,
    availableModels,
    selectedModel,
    modelContextLength,
    loadApiBases,
    updateModels,
  };
}
