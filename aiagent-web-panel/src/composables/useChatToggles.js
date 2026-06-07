/**
 * Composable для UI-togglov чата: agent mode (с тулзами) и show reasoning.
 * Состояние персистится в localStorage. Дефолт — `true` (если ключ не задан).
 * @module composables/useChatToggles
 */

import { ref, watch } from "vue";

const AGENT_MODE_KEY = "agent-chat-mode";
const SHOW_REASONING_KEY = "agent-show-reasoning";

/**
 * @returns {{
 *   agentMode: import("vue").Ref<boolean>,
 *   showReasoning: import("vue").Ref<boolean>,
 *   toggleAgentMode: () => void,
 *   toggleReasoning: () => void
 * }}
 */
export function useChatToggles() {
  const agentMode = ref(localStorage.getItem(AGENT_MODE_KEY) !== "false");
  const showReasoning = ref(localStorage.getItem(SHOW_REASONING_KEY) !== "false");

  function toggleAgentMode() {
    agentMode.value = !agentMode.value;
    localStorage.setItem(AGENT_MODE_KEY, agentMode.value.toString());
  }

  function toggleReasoning() {
    showReasoning.value = !showReasoning.value;
    localStorage.setItem(SHOW_REASONING_KEY, showReasoning.value.toString());
  }

  // Синхронизация при изменении извне (например, через DevTools)
  watch(agentMode, (v) => localStorage.setItem(AGENT_MODE_KEY, v.toString()));
  watch(showReasoning, (v) => localStorage.setItem(SHOW_REASONING_KEY, v.toString()));

  return { agentMode, showReasoning, toggleAgentMode, toggleReasoning };
}
