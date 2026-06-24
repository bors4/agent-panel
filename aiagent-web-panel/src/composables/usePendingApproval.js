/**
 * Composable для approval-флоу агента: хранит pending approval + tool calls,
 * обрабатывает approve/reject через /chat/continue. State персистится в localStorage.
 * @module composables/usePendingApproval
 */

import { ref, onUnmounted } from "vue";
import { agentChatContinue } from "@/api/client";

function genId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

const PENDING_APPROVAL_KEY = "agent-pending-approval";
const PENDING_TOOL_CALLS_KEY = "agent-pending-tool-calls";

/**
 * @param {{
 *   messages: import("vue").Ref<Array>,
 *   approvalMessages: import("vue").Ref<Array>,
 *   cancel: ReturnType<typeof import("./useChatCancel").useChatCancel>
 * }} deps
 */
export function usePendingApproval({ messages, approvalMessages, cancel }) {
  const pendingApproval = ref(null);
  const pendingToolCalls = ref([]);

  // Загружаем сразу при инициализации
  load();

  function load() {
    try {
      const saved = localStorage.getItem(PENDING_APPROVAL_KEY);
      if (saved) pendingApproval.value = JSON.parse(saved);
    } catch {}
    try {
      const saved = localStorage.getItem(PENDING_TOOL_CALLS_KEY);
      if (saved) pendingToolCalls.value = JSON.parse(saved);
    } catch {}
  }

  function savePendingApproval() {
    try {
      if (pendingApproval.value) {
        localStorage.setItem(PENDING_APPROVAL_KEY, JSON.stringify(pendingApproval.value));
      } else {
        localStorage.removeItem(PENDING_APPROVAL_KEY);
      }
    } catch {}
  }

  function savePendingToolCalls() {
    try {
      if (pendingToolCalls.value && pendingToolCalls.value.length > 0) {
        localStorage.setItem(PENDING_TOOL_CALLS_KEY, JSON.stringify(pendingToolCalls.value));
      } else {
        localStorage.removeItem(PENDING_TOOL_CALLS_KEY);
      }
    } catch {}
  }

  function clear() {
    pendingApproval.value = null;
    pendingToolCalls.value = [];
    localStorage.removeItem(PENDING_APPROVAL_KEY);
    localStorage.removeItem(PENDING_TOOL_CALLS_KEY);
  }

  // Загружаем сразу при инициализации (используется в onMounted через вызов load())
  onUnmounted(() => {
    savePendingApproval();
    savePendingToolCalls();
  });

  /**
   * Превращает tool calls/results/approval из ответа агента в сообщения чата.
   * @param {Array} toolCalls
   * @param {Array} toolResults
   * @param {boolean} requiresApproval
   * @param {string} approvalToolName
   * @param {string} approvalArgs
   * @param {string} approvalToolCallId
   */
  function addToolMessages(
    toolCalls,
    toolResults,
    requiresApproval,
    approvalToolName,
    approvalArgs,
    approvalToolCallId
  ) {
    if (toolCalls?.length > 0) {
      for (const tc of toolCalls) {
        let argsParsed;
        try {
          argsParsed = JSON.parse(tc.args);
        } catch {
          argsParsed = tc.args;
        }
        const argsStr = typeof argsParsed === "object" ? JSON.stringify(argsParsed, null, 2) : String(tc.args);
        const shortStr =
          typeof argsParsed === "object"
            ? Object.keys(argsParsed)
                .slice(0, 3)
                .map((k) => `${k}=${String(argsParsed[k]).substring(0, 30)}`)
                .join(", ") + (Object.keys(argsParsed).length > 3 ? "..." : "")
            : String(tc.args).substring(0, 50);
        messages.value.push({
          role: "system",
          type: "tool_call",
          toolName: tc.name,
          toolArgsPretty: argsStr,
          toolArgsShort: shortStr,
          expanded: false,
          toolCallId: tc.id,
        });
      }
    }

    if (toolResults?.length > 0) {
      for (const tr of toolResults) {
        messages.value.push({
          role: "system",
          type: "tool_result",
          success: tr.success,
          output: String(tr.output),
          expanded: false,
        });
      }
    }

    if (requiresApproval) {
      let argsParsed;
      try {
        argsParsed = JSON.parse(approvalArgs);
      } catch {
        argsParsed = approvalArgs;
      }
      const argsStr = typeof argsParsed === "object" ? JSON.stringify(argsParsed, null, 2) : String(approvalArgs);
      pendingApproval.value = {
        toolName: approvalToolName,
        args: approvalArgs,
        toolCallId: approvalToolCallId,
      };
      if (approvalToolName === "question") {
        messages.value.push({
          role: "system",
          type: "question",
          toolName: approvalToolName,
          toolArgsPretty: argsStr,
          _rawArgs: typeof approvalArgs === "string" ? approvalArgs : JSON.stringify(approvalArgs),
          pendingApproval: true,
          toolCallId: approvalToolCallId,
        });
      } else {
        messages.value.push({
          role: "system",
          type: "approval",
          toolName: approvalToolName,
          toolArgsPretty: argsStr,
          pendingApproval: true,
          toolCallId: approvalToolCallId,
        });
      }
    }
  }

  /**
   * Одобрить или отклонить pending approval и продолжить агент-цикл.
   * @param {Object} msg — approval-сообщение из чата
   * @param {boolean} approved
   * @param {import("vue").Ref<boolean>} isTyping
   * @param {Function} onLog — emit("log", ...) callback
   * @returns {Promise<Object>} result
   */
  async function handleToolDecision(msg, approved, isTyping, onLog, questionAnswers) {
    if (!pendingApproval.value) return null;

    const decision = {
      approved,
      toolName: pendingApproval.value.toolName,
      args: pendingApproval.value.args,
      toolCallId: pendingApproval.value.toolCallId,
    };

    if (approved && pendingApproval.value.toolName === "question" && questionAnswers) {
      decision.answers = questionAnswers;
    }

    messages.value = messages.value.filter((m) => m !== msg);
    isTyping.value = true;
    cancel.isCancelling.value = false;
    const controller = cancel.createController();
    const continueAbortId = genId();
    cancel.attachAbortId(continueAbortId);
    pendingApproval.value = null;
    pendingToolCalls.value = [];

    try {
      const result = await agentChatContinue(
        {
          messages: approvalMessages.value,
          approvalDecision: decision,
          accountName: "",
          abortId: continueAbortId,
        },
        controller.signal
      );

      isTyping.value = false;

      if (result.abortId) cancel.attachAbortId(result.abortId);

      if (!result.success) {
        messages.value.push({ role: "bot", content: `❌ Ошибка: ${result.error}` });
        return result;
      }

      if (result.reply) {
        messages.value.push({
          role: "bot",
          content: result.reply,
          reasoning: result.reasoning || "",
          reasoningExpanded: false,
          usage: result.tokenUsage || null,
        });
      }

      addToolMessages(
        result.toolCalls,
        result.toolResults,
        result.requiresApproval,
        result.approvalToolName,
        result.approvalArgs,
        result.approvalToolCallId
      );

      approvalMessages.value = result.messages || [];
    } catch (e) {
      isTyping.value = false;
      if (e.name === "AbortError") {
        messages.value.push({ role: "bot", content: "🔴 Cancelled" });
      } else {
        messages.value.push({ role: "bot", content: `❌ Ошибка: ${e.message}` });
        onLog?.({ message: `Tool decision error: ${e.message}`, type: "error" });
      }
    } finally {
      cancel.clearAbort(controller);
    }
    return null;
  }

  return {
    pendingApproval,
    pendingToolCalls,
    load,
    clear,
    addToolMessages,
    handleToolDecision,
  };
}
