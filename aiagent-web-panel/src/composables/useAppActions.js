/**
 * Composable для глобальных действий приложения: логгер, запуск/остановка/рестарт агента,
 * очистка логов, накопление статистики токенов.
 * @module composables/useAppActions
 */

import { useAgent } from "./useAgent.js";
import { useToast } from "./useToast.js";

const MAX_LOG_ENTRIES = 200;

/**
 * Composable для глобальных действий.
 * @param {Object} [overrides] - опциональные overrides (для тестов): { logs, tokenUsage, startAgent, stopAgent, restartAgent, clearLogs }
 * @returns {Object} { addLog, handleStart, handleStop, handleRestart, handleClearLogs, handleTokenUsage, formatPrompt, copyPrompt }
 */
export function useAppActions(overrides = {}) {
  const agentKeys = ["logs", "tokenUsage", "startAgent", "stopAgent", "restartAgent", "clearLogs"];
  const hasAllAgentKeys = agentKeys.every((key) => key in overrides);
  const agent = hasAllAgentKeys ? null : useAgent();
  const toast = useToast();

  const logs = overrides.logs ?? agent?.logs;
  const tokenUsage = overrides.tokenUsage ?? agent?.tokenUsage;
  const startAgent = overrides.startAgent ?? agent?.startAgent;
  const stopAgent = overrides.stopAgent ?? agent?.stopAgent;
  const restartAgent = overrides.restartAgent ?? agent?.restartAgent;
  const clearLogsFn = overrides.clearLogs ?? agent?.clearLogs;
  const success = overrides.success ?? toast.success;
  const error = overrides.error ?? toast.error;
  const warning = overrides.warning ?? toast.warning;

  /**
   * Добавить запись в лог (frontend-side). Старые записи (>200) удаляются.
   * @param {string} message - текст сообщения
   * @param {"info"|"error"|"warning"|"success"|"system"} [type="info"]
   */
  function addLog(message, type = "info") {
    logs.value.push({
      time: new Date().toLocaleTimeString(),
      message,
      type,
    });
    if (logs.value.length > MAX_LOG_ENTRIES) logs.value.shift();
  }

  async function handleStart() {
    try {
      const result = await startAgent();
      success("Агент запущен");
      return result;
    } catch (e) {
      error(e.message);
      throw e;
    }
  }

  async function handleStop() {
    try {
      await stopAgent();
      warning("Агент остановлен");
    } catch (e) {
      error(e.message);
    }
  }

  async function handleRestart() {
    try {
      await restartAgent();
      success("Агент перезапущен");
    } catch (e) {
      error(e.message);
    }
  }

  async function handleClearLogs() {
    try {
      await clearLogsFn();
      success("Логи очищены");
    } catch {
      error("Не удалось очистить логи");
    }
  }

  /**
   * Аккумулировать usage в реактивный tokenUsage.
   * Принимает как канонический формат ({ prompt, completion, total, cached }),
   * так и OpenAI формат ({ prompt_tokens, completion_tokens, total_tokens }).
   * @param {{ prompt?: number, completion?: number, total?: number, cached?: number, prompt_tokens?: number, completion_tokens?: number, total_tokens?: number }|null} usage
   */
  function handleTokenUsage(usage) {
    if (!usage) return;
    const prompt = usage.prompt ?? usage.prompt_tokens ?? 0;
    const completion = usage.completion ?? usage.completion_tokens ?? 0;
    const total = usage.total ?? usage.total_tokens ?? (prompt + completion);
    const cached = usage.cached ?? usage.prompt_tokens_details?.cached_tokens ?? 0;
    tokenUsage.value.prompt += prompt;
    tokenUsage.value.completion += completion;
    tokenUsage.value.total += total;
    tokenUsage.value.cached += cached;
  }

  /**
   * Отформатировать системный промпт: убрать лишние пробелы и пустые строки.
   * @param {import("vue").Ref<string>} systemPrompt
   */
  function formatPrompt(systemPrompt) {
    systemPrompt.value = systemPrompt.value.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");
    success("Отформатировано");
    addLog("Prompt formatted", "info");
  }

  /**
   * Скопировать системный промпт в буфер обмена.
   * @param {import("vue").Ref<string>} systemPrompt
   */
  async function copyPrompt(systemPrompt) {
    try {
      await navigator.clipboard.writeText(systemPrompt.value);
      success("Скопировано");
      addLog("Prompt copied to clipboard", "info");
    } catch (e) {
      error("Не удалось скопировать: " + e.message);
    }
  }

  return {
    addLog,
    handleStart,
    handleStop,
    handleRestart,
    handleClearLogs,
    handleTokenUsage,
    formatPrompt,
    copyPrompt,
  };
}
