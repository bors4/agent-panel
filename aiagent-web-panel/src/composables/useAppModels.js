/**
 * Composable для управления списком AI-моделей и API баз.
 * Хранит `apiBases`, `modelName`, `serverUrl`, `availableModels`.
 * Загружает модели из локальных API и OpenRouter, обновляет при необходимости.
 * @module composables/useAppModels
 */

import { ref, computed } from "vue";
import { getModels } from "@/api/client";
import { configDefaults } from "@backend/lib/configDefaults.js";

/**
 * Composable для моделей и API баз.
 * @param {Object} deps
 * @param {Function} deps.addLog - логгер
 * @param {Function} [deps.success] - toast success
 * @param {Function} [deps.error] - toast error
 * @param {import("vue").Ref<number>} [deps.maxTokensFallback] - fallback для modelContextLength
 */
export function useAppModels({ addLog, success, error, maxTokensFallback }) {
  const apiBases = ref([]);
  const modelName = ref("");
  const serverUrl = ref("");
  const availableModels = ref([]);

  const selectedModel = computed(() => availableModels.value.find((m) => m.id === modelName.value) || null);

  const modelContextLength = computed(() => {
    if (selectedModel.value?.maxContextLength) return selectedModel.value.maxContextLength;
    if (maxTokensFallback?.value) return maxTokensFallback.value;
    return configDefaults.maxTokens;
  });

  function pushModelsUnique(models, source) {
    if (!Array.isArray(models) || models.length === 0) return;
    // Build a Set for O(1) lookup. Previous O(n²) `find()` was noticeable
    // when refreshing from OpenRouter (200+ models) against a growing
    // local list.
    const existing = new Set(availableModels.value.map((x) => x.id));
    for (const m of models) {
      if (!existing.has(m.id)) {
        existing.add(m.id);
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
   * Сохранённый пользователем `serverUrl` имеет приоритет — он не перезаписывается
   * discovery-источником, пока всё ещё входит в активный список `apiBases`.
   */
  async function loadApiBases() {
    const initialModelName = modelName.value;
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
      const saved = availableModels.value.find((m) => m.id === initialModelName);
      const activeApiUrls = new Set(apiBases.value.filter((a) => a.connected).map((a) => a.url));
      const userSavedIsValid = serverUrl.value && activeApiUrls.has(serverUrl.value);
      if (saved && !userSavedIsValid) {
        // saved model found, but user has no (or invalid) serverUrl — use the discovery source
        serverUrl.value = saved.source;
      } else if (!saved && modelName.value === initialModelName) {
        // saved model not found anywhere — pick first available as a default
        const first = availableModels.value[0];
        modelName.value = first.id;
        serverUrl.value = first.source;
      }
    }
  }

  /**
   * Установить выбранную модель. Параллельно обновляет `serverUrl` на тот
   * endpoint, где эта модель была обнаружена. Если модель не найдена в
   * `availableModels` — `serverUrl` остаётся прежним (валидация поймает
   * несоответствие в sendMessage).
   * @param {string} id
   */
  function setModel(id) {
    modelName.value = id;
    const m = availableModels.value.find((x) => x.id === id);
    if (m) {
      serverUrl.value = m.source;
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
          success?.("Модели OpenRouter загружены");
        } else {
          addLog("OpenRouter returned no models", "warning");
        }
      } catch (e) {
        addLog(`Failed to connect OpenRouter: ${e.message}`, "error");
        error?.("Ошибка OpenRouter: " + e.message);
      }
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
    setModel,
  };
}
