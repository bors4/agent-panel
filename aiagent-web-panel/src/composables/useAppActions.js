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
  const agent = useAgent();
  const toast = useToast();

  const logs = overrides.logs ?? agent.logs;
  const tokenUsage = overrides.tokenUsage ?? agent.tokenUsage;
  const startAgent = overrides.startAgent ?? agent.startAgent;
  const stopAgent = overrides.stopAgent ?? agent.stopAgent;
  const restartAgent = overrides.restartAgent ?? agent.restartAgent;
  const clearLogsFn = overrides.clearLogs ?? agent.clearLogs;
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
      await startAgent();
      success("Агент запущен");
    } catch (e) {
      error(e.message);
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
   * @param {{ prompt_tokens?: number, completion_tokens?: number, total_tokens?: number, prompt_tokens_details?: { cached_tokens?: number } }} usage
   */
  function handleTokenUsage(usage) {
    if (!usage) return;
    tokenUsage.value.prompt += usage.prompt_tokens || 0;
    tokenUsage.value.completion += usage.completion_tokens || 0;
    tokenUsage.value.total += usage.total_tokens || 0;
    if (usage.prompt_tokens_details?.cached_tokens !== undefined) {
      tokenUsage.value.cached += usage.prompt_tokens_details.cached_tokens;
    }
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
