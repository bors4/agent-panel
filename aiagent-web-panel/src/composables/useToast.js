/**
 * Composable для управления уведомлениями (Vue 3).
 * @module composables/useToast
 */

import { ref } from "vue";

const TOAST_DURATION = 4000;

export const toasts = ref([]);

/**
 * Composable для отображения уведомлений.
 * @returns {Object} Методы toast: info, success, error, warning
 */
export function useToast() {
  /**
   * Добавить информационное уведомление.
   * @param {string} message - Текст уведомления
   */
  function info(message) {
    addToast("info", message);
  }

  /**
   * Добавить успешное уведомление.
   * @param {string} message - Текст уведомления
   */
  function success(message) {
    addToast("success", message);
  }

  /**
   * Добавить ошибочное уведомление.
   * @param {string} message - Текст уведомления
   */
  function error(message) {
    addToast("error", message);
  }

  /**
   * Добавить предупреждающее уведомление.
   * @param {string} message - Текст уведомления
   */
  function warning(message) {
    addToast("warning", message);
  }

  function addToast(type, message) {
    const id = Date.now().toString();
    toasts.value.push({ id, type, message });
    setTimeout(() => removeToast(id), TOAST_DURATION);
  }

  function removeToast(id) {
    const index = toasts.value.findIndex((t) => t.id === id);
    if (index !== -1) {
      toasts.value.splice(index, 1);
    }
  }

  return {
    toasts,
    info,
    success,
    error,
    warning,
  };
}
