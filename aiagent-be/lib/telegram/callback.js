/**
 * Callback query handler: approve/deny inline keyboard presses,
 * question answer selections, and tool config changes.
 * @module telegram/callback
 */
import { chatHistories, pendingApprovals, activeAgentControllers, config } from "../state.js";
import { addLog } from "./log.js";
import { replyMsg, clearButtons, sendTyping } from "./reply.js";
import { continueAfterApproval } from "./approval.js";

/** Track pending question answers per chat. @type {Map<string, Map<number, string[]>>} */
const questionAnswers = new Map();

/**
 * Register the callback query handler on a Bot instance.
 * @param {Object} b - GrammY Bot instance
 * @param {Function} handleAgentResult - Channel-agnostic result handler
 */
export function registerCallbackHandler(b, handleAgentResult) {
  const checkAllQuestionsAnswered = async (ctx, chatId, pending) => {
    const questions = pending.args.questions;
    const answers = questionAnswers.get(chatId) || new Map();
    let allAnswered = true;
    for (let i = 0; i < questions.length; i++) {
      if (!answers.has(i) || answers.get(i).length === 0) {
        allAnswered = false;
        break;
      }
    }
    if (!allAnswered) {
      await ctx.answerCallbackQuery("Please answer all questions first");
      return;
    }

    questionAnswers.delete(chatId);
    const resultAnswers = [];
    for (let i = 0; i < questions.length; i++) {
      resultAnswers.push(answers.get(i) || []);
    }

    pending.approvalAnswers = resultAnswers;
    await ctx.answerCallbackQuery("All answered! Continuing...");
    await sendTyping(ctx);

    const prevController = activeAgentControllers.get(chatId);
    if (prevController && !prevController.signal.aborted) prevController.abort();
    const approvalAbortController = new AbortController();
    activeAgentControllers.set(chatId, approvalAbortController);

    continueAfterApproval(ctx, { ...pending, toolName: "question" }, 0, approvalAbortController.signal, handleAgentResult)
      .catch((err) => {
        addLog(`continueAfterApproval (question) error: ${err.message}`, "error");
      })
      .finally(() => {
        if (activeAgentControllers.get(chatId) === approvalAbortController) {
          activeAgentControllers.delete(chatId);
        }
      });
  };

  b.on("callback_query", async (ctx) => {
    const callbackData = ctx.callbackQuery.data;
    const chatId = ctx.chat.id.toString();
    addLog(`Callback: ${callbackData} from ${chatId}`, "info");

    if (callbackData.startsWith("q_ans_")) {
      const parts = callbackData.split("_");
      const qIdx = parseInt(parts[3], 10);
      const optIdx = parseInt(parts[4], 10);
      const pending = pendingApprovals.get(chatId);
      if (!pending || pending.toolName !== "question") {
        await ctx.answerCallbackQuery("❌ Question session expired");
        return;
      }
      const q = pending.args.questions?.[qIdx];
      if (!q) {
        await ctx.answerCallbackQuery("❌ Question not found");
        return;
      }
      if (!questionAnswers.has(chatId)) questionAnswers.set(chatId, new Map());
      const answers = questionAnswers.get(chatId);
      if (!answers.has(qIdx)) answers.set(qIdx, []);
      const selected = answers.get(qIdx);
      const label = q.options?.[optIdx]?.label || `Option ${optIdx}`;
      if (selected.includes(label)) {
        selected.splice(selected.indexOf(label), 1);
        await ctx.answerCallbackQuery(`Deselected: ${label}`);
      } else if (q.multiple) {
        selected.push(label);
        await ctx.answerCallbackQuery(`Selected: ${label}`);
      } else {
        answers.set(qIdx, [label]);
        await ctx.answerCallbackQuery(`Selected: ${label}`);
        checkAllQuestionsAnswered(ctx, chatId, pending);
      }
      return;
    }

    if (callbackData.startsWith("q_done_")) {
      const pending = pendingApprovals.get(chatId);
      if (!pending || pending.toolName !== "question") {
        await ctx.answerCallbackQuery("❌ Question session expired");
        return;
      }
      await ctx.answerCallbackQuery("Submitting answers...");
      checkAllQuestionsAnswered(ctx, chatId, pending);
      return;
    }

    if (callbackData.startsWith("approve_")) {
      const toolName = callbackData.replace("approve_", "");
      const pending = pendingApprovals.get(chatId);

      if (!pending || pending.toolName !== toolName) {
        addLog(`Stale approve: tool=${toolName}, pending=${pending?.toolName || "none"}`, "warning");
        await ctx.answerCallbackQuery("❌ Request not found or outdated");
        return;
      }

      addLog(`Executing: ${toolName} with args=${JSON.stringify(pending.args)}`, "success");
      await ctx.answerCallbackQuery("Executing...");
      await clearButtons(ctx);
      pendingApprovals.delete(chatId);
      await sendTyping(ctx);

      const prevController = activeAgentControllers.get(chatId);
      if (prevController && !prevController.signal.aborted) prevController.abort();
      const approvalAbortController = new AbortController();
      activeAgentControllers.set(chatId, approvalAbortController);

      continueAfterApproval(ctx, pending, 0, approvalAbortController.signal, handleAgentResult)
        .catch((err) => {
          addLog(`continueAfterApproval (async) error: ${err.message}`, "error");
        })
        .finally(() => {
          if (activeAgentControllers.get(chatId) === approvalAbortController) {
            activeAgentControllers.delete(chatId);
          }
        });
    } else if (callbackData.startsWith("deny_")) {
      const toolName = callbackData.replace("deny_", "");
      const pending = pendingApprovals.get(chatId);
      pendingApprovals.delete(chatId);
      addLog(`Deny: ${toolName}`, "warning");
      await ctx.answerCallbackQuery("Cancelled");
      await clearButtons(ctx);

      if (pending) {
        const deniedMessages = [
          ...pending.messages,
          {
            role: "tool",
            tool_call_id: pending.toolCallId,
            content: JSON.stringify({ success: false, error: "denied by user" }),
          },
        ];
        deniedMessages.push({ role: "assistant", content: "" });
        chatHistories.set(
          chatId,
          deniedMessages.filter((m) => m.role !== "system").slice(-(config.maxHistoryPairs * 2))
        );
      }

      await replyMsg(ctx, `❌ <b>${toolName}</b> cancelled. The tool was not executed.`);
    }
  });
}
