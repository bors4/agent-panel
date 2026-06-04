/**
 * Канал-агностик обработчик результата `agentLoopStep()`.
 *
 * Извлечено из `server.js` для возможности переиспользования в других каналах
 * (CLI, Discord, WebSocket). Логика и поведение идентичны оригиналу.
 *
 * Ветвление по 4 формам результата:
 * 1. `result.cancelled === true` — пользователь прервал (`/cancel`); удаляем draft, выходим.
 * 2. `result.requiresApproval === true` — сохраняем в `pendingApprovals`,
 *    показываем inline-кнопки YES/NO, обновляем историю чата.
 * 3. `result.error` присутствует — чистим историю, удаляем draft, отправляем
 *    безопасное сообщение об ошибке.
 * 4. `result.response` финальный (не "continue") — отправляем ответ через
 *    editDraftMessage / replyWithStream / sendLongMessage.
 * 5. `result.response === "continue"` — рекурсивно вызываем `agentLoopStep()`
 *    и обрабатываем результат (без draft).
 *
 * Использует factory pattern: `createHandleAgentResult(deps)` возвращает
 * функцию с закрытыми зависимостями. Это позволяет подменять зависимости
 * в тестах и не загрязнять глобальное состояние.
 *
 * @module telegram/handleAgentResult
 */

/**
 * @typedef {Object} AgentDeps
 * @property {Object} config — мутабельный конфиг (нужен `maxHistoryPairs`)
 * @property {Map<string, Array>} chatHistories — истории чатов
 * @property {Map<string, Object>} pendingApprovals — ожидающие подтверждения
 * @property {Function} addLog — логгер `(message, level) => void`
 * @property {Function} replyMsg — async (ctx, text, opts) => Message
 * @property {Function} editDraftMessage — async (ctx, msgId, text) => void
 * @property {Function} sendLongMessage — async (ctx, text, opts) => number[]
 * @property {Function} chunkText — async generator (text) => AsyncGenerator<string>
 * @property {Function} KEYBOARD_YES_NO — (toolName) => InlineKeyboard
 * @property {Function} agentLoopStep — из lib/agent/agentLoop.js
 * @property {number} MAX_AGENT_ITERATIONS
 */

/**
 * Создать handler для результата agent loop.
 * @param {AgentDeps} deps
 * @returns {(ctx, chatId, result, account, draftMsgId, abortSignal) => Promise<boolean>}
 */
export function createHandleAgentResult(deps) {
  const { config, chatHistories, pendingApprovals, addLog, replyMsg, editDraftMessage, sendLongMessage, chunkText, KEYBOARD_YES_NO, agentLoopStep, MAX_AGENT_ITERATIONS } = deps;

  /**
   * Унифицированная обработка результата agent loop.
   *
   * @param {Object} ctx — GrammY контекст
   * @param {string} chatId — ID чата
   * @param {Object} result — Результат agentLoopStep
   * @param {Object} account — Аккаунт пользователя
   * @param {number} [draftMsgId] — ID черновика (streaming mode)
   * @param {AbortSignal} [abortSignal]
   * @returns {Promise<boolean>} true если обработка завершена
   */
  return async function handleAgentResult(ctx, chatId, result, account, draftMsgId, abortSignal) {
    // 1. Отменено пользователем
    if (result.cancelled) {
      addLog("Agent loop cancelled during continuation", "warning");
      if (typeof draftMsgId === "number") ctx.api.deleteMessage(ctx.chat.id, draftMsgId).catch(() => {});
      return true;
    }

    // 2. Требуется подтверждение
    if (result.requiresApproval) {
      pendingApprovals.set(chatId, {
        toolName: result.toolName,
        args: result.args,
        toolCallId: result.toolCallId,
        messages: result.messages,
        account,
        createdAt: Date.now(),
        pendingToolCalls: result.pendingToolCalls || [],
      });
      chatHistories.set(
        chatId,
        result.messages
          .filter((m) => m.role !== "system" && !m.content?.includes("[TOOL APPROVAL REQUIRED]"))
          .slice(-(config.maxHistoryPairs * 2))
      );
      const paramStr = JSON.stringify(result.args);
      const displayParams =
        result.toolName === "write" && result.args.content
          ? JSON.stringify({
              ...result.args,
              content:
                result.args.content.length > 200
                  ? result.args.content.substring(0, 200) + `… [content truncated: ${result.args.content.length} chars]`
                  : result.args.content,
            })
          : paramStr.length > 300
            ? paramStr.substring(0, 300) + "… [truncated]"
            : paramStr;
      await replyMsg(ctx, `⚠️ Confirmation needed:\n\n📦 <b>${result.toolName}</b>\nParams: <code>${displayParams}</code>`, {
        reply_markup: KEYBOARD_YES_NO(result.toolName),
      });
      return true;
    }

    // 3. Ошибка
    if (result.error) {
      const cleanHistory = (chatHistories.get(chatId) || []).filter(
        (m) => !m.content?.includes("[TOOL APPROVAL REQUIRED]") && m.role !== "tool" && m.role !== "system"
      );
      chatHistories.set(chatId, cleanHistory.slice(-(config.maxHistoryPairs * 2)));
      if (typeof draftMsgId === "number") ctx.api.deleteMessage(ctx.chat.id, draftMsgId).catch(() => {});
      await replyMsg(ctx, `❌ Error: ${result.error}`);
      return true;
    }

    // 4. Финальный ответ
    if (result.response !== undefined && result.response !== "continue") {
      if (result.messages) {
        chatHistories.set(
          chatId,
          result.messages.filter((m) => m.role !== "system").slice(-(config.maxHistoryPairs * 2))
        );
      }
      let cleanResponse = result.response.replace(/\[TOOL APPROVAL REQUIRED\].*/gi, "").trim();
      if (!cleanResponse) cleanResponse = "✅ Done.";
      const hasReasoning = result.reasoning && result.reasoning.length > 0;
      const reasoningBlock = hasReasoning ? `💭 Reasoning:\n\`\`\`\n${result.reasoning}\n\`\`\`\n\n` : "";
      if (typeof draftMsgId === "number") {
        await editDraftMessage(ctx, draftMsgId, reasoningBlock + cleanResponse);
      } else if (ctx.chat?.type === "private") {
        const fullText = reasoningBlock + cleanResponse;
        await ctx.replyWithStream(chunkText(fullText));
      } else {
        await sendLongMessage(ctx, reasoningBlock + cleanResponse);
      }
      return true;
    }

    // 5. Продолжение (рекурсия без draft)
    if (result.response === "continue") {
      const history = result.messages || chatHistories.get(chatId) || [];
      const retryResult = await agentLoopStep(
        "",
        chatId,
        history,
        config,
        MAX_AGENT_ITERATIONS,
        account,
        null,
        abortSignal
      );
      addLog(`agentLoopStep (retry): requiresApproval=${retryResult.requiresApproval}`, "info");
      return await handleAgentResult(ctx, chatId, retryResult, account, undefined, abortSignal);
    }

    // 6. Лимит итераций
    if (typeof draftMsgId === "number") ctx.api.deleteMessage(ctx.chat.id, draftMsgId).catch(() => {});
    await replyMsg(ctx, "Iteration limit reached");
    return true;
  };
}
