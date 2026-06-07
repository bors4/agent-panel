/**
 * Composable для отмены in-flight HTTP-запросов чата.
 * Содержит AbortController + lastAbortId, функции handleStop и cleanup.
 * При анмаунте автоматически отменяет активный запрос и шлёт cancelChat на бэкенд.
 * @module composables/useChatCancel
 */

import { ref, onUnmounted } from "vue";
import { cancelChat } from "@/api/client";

/**
 * @returns {{
 *   abortController: import("vue").Ref<AbortController|null>,
 *   isCancelling: import("vue").Ref<boolean>,
 *   lastAbortId: import("vue").Ref<string|null>,
 *   createController: () => AbortController,
 *   attachAbortId: (id: string) => void,
 *   handleStop: () => void,
 *   clearAbort: (controller: AbortController) => void,
 *   clearAbortId: (id: string) => void
 * }}
 */
export function useChatCancel() {
  const abortController = ref(null);
  const isCancelling = ref(false);
  const lastAbortId = ref(null);

  /**
   * Создаёт новый AbortController и сохраняет как текущий.
   * @returns {AbortController}
   */
  function createController() {
    const controller = new AbortController();
    abortController.value = controller;
    return controller;
  }

  /**
   * Запоминает backend abortId для возможной отмены через /chat/cancel.
   * @param {string} id
   */
  function attachAbortId(id) {
    lastAbortId.value = id;
  }

  /**
   * Сбрасывает abortController, если он всё ещё наш (race-safe).
   * @param {AbortController} controller
   */
  function clearAbort(controller) {
    if (abortController.value === controller) abortController.value = null;
  }

  /**
   * Сбрасывает lastAbortId, если он всё ещё наш (race-safe).
   * @param {string} id
   */
  function clearAbortId(id) {
    if (lastAbortId.value === id) lastAbortId.value = null;
  }

  /**
   * Отменяет текущий запрос: и на фронте (abort), и на бэке (cancelChat).
   */
  function handleStop() {
    if (isCancelling.value || !abortController.value) return;
    isCancelling.value = true;
    abortController.value.abort();
    abortController.value = null;
    if (lastAbortId.value) {
      cancelChat(lastAbortId.value).catch(() => {});
      lastAbortId.value = null;
    }
  }

  // При уходе со страницы — гарантированно отменяем всё
  onUnmounted(() => {
    if (abortController.value) {
      abortController.value.abort();
      abortController.value = null;
    }
    isCancelling.value = false;
    if (lastAbortId.value) {
      cancelChat(lastAbortId.value).catch(() => {});
    }
    lastAbortId.value = null;
  });

  return {
    abortController,
    isCancelling,
    lastAbortId,
    createController,
    attachAbortId,
    handleStop,
    clearAbort,
    clearAbortId,
  };
}
