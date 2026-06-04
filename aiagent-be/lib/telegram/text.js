/**
 * Text message handler: routes through the agent loop and handles
 * progress updates, drafts, and final result.
 * @module telegram/text
 */
import { agentLoopStep, MAX_AGENT_ITERATIONS } from "../agent/agentLoop.js";
import { config, chatHistories, activeAgentControllers, tokenUsage, stats } from "../state.js";
import { addLog, wsBroadcast } from "./log.js";
import { replyMsg, sendTyping, sendDraft, editDraftMessage, REPLY_OPTS } from "./reply.js";
import { safeErrorMessage, recordAndCheckRateLimit, buildPerfStats } from "./util.js";

const MIN_EDIT_INTERVAL = 1000;

/**
 * Register the text message handler on a Bot instance.
 * Filters out inline-button press messages (✅ YES, ❌ NO).
 * @param {Object} b - GrammY Bot instance
 * @param {Function} handleAgentResult - Channel-agnostic result handler
 */
export function registerTextHandler(b, handleAgentResult) {
  b.on("message", async (ctx) => {
    const message = ctx.message?.text || ctx.message?.caption;
    if (!message) {
      ctx.reply("Только текст.", REPLY_OPTS);
      return;
    }

    if (message === "✅ YES" || message === "❌ NO" || message === "YES" || message === "NO") {
      return;
    }

    if (!config.projectPath) {
      await replyMsg(
        ctx,
        "⚠️ <b>Project path not configured</b>\n\nAsk the admin to set it in Settings or PROJECT_PATH in .env"
      );
      return;
    }

    const account = ctx.account;
    const chatId = ctx.chat.id.toString();
    if (!recordAndCheckRateLimit(chatId)) {
      await replyMsg(ctx, "⏳ Too many requests. Please wait and try again.");
      return;
    }
    addLog(`Message from ${ctx.chat.username || chatId}: ${message.substring(0, 50)}...`, "info");
    stats.requests++;
    wsBroadcast("stats", { requests: stats.requests, tools: stats.tools, errors: stats.errors });

    let draftMsgId;
    let safeCleanup;
    let abortController;
    try {
      await sendTyping(ctx);
      draftMsgId = await sendDraft(ctx, "⏳ Analyzing request...");

      const history = chatHistories.get(chatId) || [];
      let accumulatedContent = "";
      let lastEditTime = 0;

      const prevController = activeAgentControllers.get(chatId);
      if (prevController && !prevController.signal.aborted) prevController.abort();

      safeCleanup = (ctrl) => {
        if (activeAgentControllers.get(chatId) === ctrl) {
          activeAgentControllers.delete(chatId);
        }
      };

      abortController = new AbortController();
      activeAgentControllers.set(chatId, abortController);

      agentLoopStep(message, chatId, history, config, MAX_AGENT_ITERATIONS, account, async (progress) => {
        try {
          if (progress.type === "reasoning") {
            const now = Date.now();
            if (now - lastEditTime >= MIN_EDIT_INTERVAL) {
              lastEditTime = now;
              const snippet = progress.accumulated.length > 200
                ? progress.accumulated.substring(0, 200) + "..."
                : progress.accumulated;
              await editDraftMessage(ctx, draftMsgId, `💭 ${snippet}`);
            }
          } else if (progress.type === "reasoning_done") {
            await editDraftMessage(ctx, draftMsgId, "💭 Reasoning complete");
          } else if (progress.type === "content") {
            accumulatedContent = progress.accumulated;
            const now = Date.now();
            if (now - lastEditTime >= MIN_EDIT_INTERVAL && accumulatedContent.length > 0) {
              lastEditTime = now;
              const display = accumulatedContent.length > 300
                ? accumulatedContent.substring(0, 300) + "..."
                : accumulatedContent;
              await editDraftMessage(ctx, draftMsgId, `💬 ${display}`);
            }
          } else if (progress.type === "tool") {
            await editDraftMessage(ctx, draftMsgId, `🔧 Executing <b>${progress.toolName}</b>...`);
          } else if (progress.type === "response") {
            await editDraftMessage(ctx, draftMsgId, `💬 ${progress.response.substring(0, 200)}...`);
          }
        } catch (e) {
          addLog(`Progress update error: ${e.message}`, "error");
        }
      }, abortController.signal)
        .then((result) => {
          safeCleanup(abortController);
          if (result.tokenUsage) {
            tokenUsage.prompt += result.tokenUsage.prompt || 0;
            tokenUsage.completion += result.tokenUsage.completion || 0;
            tokenUsage.total += result.tokenUsage.total || 0;
            tokenUsage.cached += result.tokenUsage.cached || 0;
            wsBroadcast("tokenUsage", { ...tokenUsage });
          }
          if (result.timings) {
            wsBroadcast("perfStats", buildPerfStats(result.timings));
          }
          if (result.cancelled) {
            addLog("Agent loop cancelled by user", "warning");
            return;
          }
          addLog(
            `agentLoopStep: requiresApproval=${result.requiresApproval}, error=${!!result.error}, response=${result.response?.substring?.(0, 30)}`,
            "info"
          );
          handleAgentResult(ctx, chatId, result, account, draftMsgId, abortController.signal).catch((err) => {
            addLog(`handleAgentResult error: ${err.message}`, "error");
          });
        })
        .catch((error) => {
          safeCleanup(abortController);
          addLog(`Bot error: ${error.message}`, "error");
          if (typeof draftMsgId === "number") ctx.api.deleteMessage(ctx.chat.id, draftMsgId).catch(() => {});
          replyMsg(ctx, safeErrorMessage(error, "❌ Ошибка при обработке запроса. Попробуйте позже.")).catch(() => {});
        });

    } catch (error) {
      if (typeof draftMsgId === "number") ctx.api.deleteMessage(ctx.chat.id, draftMsgId).catch(() => {});
      safeCleanup?.(abortController);
      await replyMsg(ctx, safeErrorMessage(error, "❌ Ошибка при обработке сообщения."));
      addLog(`Bot error: ${error.message}`, "error");
    }
  });
}
