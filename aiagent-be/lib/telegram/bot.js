/**
 * Telegram bot factory. Creates a fully-configured Bot instance with
 * commands, voice/text/callback handlers, and account middleware.
 * @module telegram/bot
 */
import { Bot, InlineKeyboard } from "grammy";
import { stream } from "@grammyjs/stream";
import { autoRetry } from "@grammyjs/auto-retry";
import { getAccountByUsername } from "../accounts.js";
import { config, chatHistories, pendingApprovals, activeAgentControllers } from "../state.js";
import { addLog } from "./log.js";
import { replyMsg, REPLY_OPTS, chunkText, editDraftMessage, KEYBOARD_YES_NO } from "./reply.js";
import { safeErrorMessage, sendLongMessage } from "./util.js";
import { agentLoopStep, MAX_AGENT_ITERATIONS } from "../agent/agentLoop.js";
import { createHandleAgentResult } from "./handleAgentResult.js";
import { registerCommands } from "./commands.js";
import { registerVoiceHandler } from "./voice.js";
import { registerTextHandler } from "./text.js";
import { registerCallbackHandler } from "./callback.js";

/**
 * Account middleware: blocks requests from unregistered Telegram usernames.
 * Looks up account by `ctx.chat.username` and attaches it as `ctx.account`.
 */
function accountMiddleware(getAccountByUsername) {
  return async (ctx, next) => {
    const username = ctx.chat?.username;
    const account = getAccountByUsername(username);
    if (!account) {
      await replyMsg(
        ctx,
        `❌ <b>Access denied</b>\n\nYour account (@${username || "unknown"}) is not registered.\nContact the administrator to get access.`
      );
      return;
    }
    ctx.account = account;
    await next();
  };
}

/**
 * Create a fully-wired GrammY Bot instance.
 * @param {string} token - Telegram Bot API token
 * @returns {Bot|null} Bot instance, or null if token is empty
 */
export function initBot(token) {
  if (!token) return null;
  const b = new Bot(token);
  const maxRetries = parseInt(process.env.MAX_RETRIES, 10);
  b.api.config.use(autoRetry({ maxRetryAttempts: Number.isFinite(maxRetries) ? maxRetries : 3 }));
  b.use(stream());
  b.use(accountMiddleware(getAccountByUsername));

  const handleAgentResult = createHandleAgentResult({
    config,
    chatHistories,
    pendingApprovals,
    addLog,
    replyMsg,
    REPLY_OPTS,
    editDraftMessage,
    sendLongMessage,
    chunkText,
    KEYBOARD_YES_NO,
    InlineKeyboard,
    agentLoopStep,
    MAX_AGENT_ITERATIONS,
  });

  registerCommands(b);
  registerVoiceHandler(b, handleAgentResult);
  registerTextHandler(b, handleAgentResult);
  registerCallbackHandler(b, handleAgentResult);

  b.catch((err, ctx) => {
    addLog(`Bot error: ${err.message}`, "error");
    if (ctx) {
      ctx.reply(safeErrorMessage(err, "❌ Внутренняя ошибка бота."), REPLY_OPTS).catch(() => {});
    }
  });

  // Silence unused — these are imported for the bot's wiring but may not
  // be referenced by name in this file.
  void agentLoopStep;
  void MAX_AGENT_ITERATIONS;
  void activeAgentControllers;

  return b;
}
