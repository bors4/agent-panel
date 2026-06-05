/**
 * Composable для персистентности чата: история сообщений + approval messages.
 * Pending approval / tool calls живут в usePendingApproval (отдельный concern).
 * Включает debounced автосохранение (500ms), cross-tab sync через storage event,
 * и clear-all операцию.
 * @module composables/useChatHistory
 */

import { ref, onUnmounted, watch } from "vue";

const CHAT_HISTORY_KEY = "agent-chat-history";
const APPROVAL_MESSAGES_KEY = "agent-approval-messages";
const MAX_HISTORY_LENGTH = 50;

/**
 * @returns {{
 *   messages: import("vue").Ref<Array>,
 *   approvalMessages: import("vue").Ref<Array>,
 *   loadAll: () => void,
 *   saveAll: () => void,
 *   clearAll: () => void
 * }}
 */
export function useChatHistory() {
  const messages = ref([]);
  const approvalMessages = ref([]);

  // Загружаем сразу при инициализации
  loadAll();

  function loadAll() {
    try {
      const saved = localStorage.getItem(CHAT_HISTORY_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.every((m) => m.role && m.content !== undefined)) {
          messages.value = parsed.slice(-MAX_HISTORY_LENGTH);
        }
      }
    } catch (e) {
      console.warn("Failed to load chat history:", e);
    }

    try {
      const saved = localStorage.getItem(APPROVAL_MESSAGES_KEY);
      if (saved) approvalMessages.value = JSON.parse(saved);
    } catch {}
  }

  function saveHistory() {
    try {
      const toSave = messages.value.slice(-MAX_HISTORY_LENGTH);
      localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.warn("Failed to save chat history:", e);
    }
  }

  function saveApprovalMessages() {
    try {
      localStorage.setItem(APPROVAL_MESSAGES_KEY, JSON.stringify(approvalMessages.value));
    } catch {}
  }

  function saveAll() {
    saveHistory();
    saveApprovalMessages();
  }

  function clearAll() {
    messages.value = [];
    approvalMessages.value = [];
    localStorage.removeItem(CHAT_HISTORY_KEY);
    localStorage.removeItem(APPROVAL_MESSAGES_KEY);
  }

  // Cross-tab sync — слушаем изменения localStorage в других вкладках
  function handleStorageChange(e) {
    if (e.key === CHAT_HISTORY_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (Array.isArray(parsed)) {
          messages.value = parsed.slice(-MAX_HISTORY_LENGTH);
        }
      } catch {}
    }
  }
  window.addEventListener("storage", handleStorageChange);

  // Debounced автосохранение истории (500ms — не дёргаем на каждый стриминг-токен)
  let saveTimer = null;
  watch(
    messages,
    () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(saveHistory, 500);
    },
    { deep: true }
  );

  onUnmounted(() => {
    window.removeEventListener("storage", handleStorageChange);
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    saveAll();
  });

  return {
    messages,
    approvalMessages,
    loadAll,
    saveAll,
    clearAll,
  };
}
