/**
 * Callback query handler: approve/deny inline keyboard presses.
 * Approval → continueAfterApproval. Denial → record denial, no execution.
 * @module telegram/callback
 */
import { chatHistories, pendingApprovals, activeAgentControllers, config } from "../state.js";
import { addLog } from "./log.js";
import { replyMsg, clearButtons, sendTyping } from "./reply.js";
import { continueAfterApproval } from "./approval.js";

/**
 * Register the callback query handler on a Bot instance.
 * @param {Object} b - GrammY Bot instance
 * @param {Function} handleAgentResult - Channel-agnostic result handler
 */
export function registerCallbackHandler(b, handleAgentResult) {
  b.on("callback_query", async (ctx) => {
    const callbackData = ctx.callbackQuery.data;
    const chatId = ctx.chat.id.toString();
    addLog(`Callback: ${callbackData} from ${chatId}`, "info");

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
