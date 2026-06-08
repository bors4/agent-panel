/**
 * Continue agent loop after user approves a pending tool call.
 * Recursive: handles a tool call, then re-enters agent loop to continue.
 * @module telegram/approval
 */
import { agentLoopStep, MAX_AGENT_ITERATIONS } from "../agent/agentLoop.js";
import { executeTool, waitForTask, getToolConfig, getToolModelOutput } from "../agent/executeTool.js";
import { chatHistories, pendingApprovals, config, stats, tokenUsage } from "../state.js";
import { addLog, wsBroadcast } from "./log.js";
import { replyMsg, KEYBOARD_YES_NO } from "./reply.js";
import { buildPerfStats, safeErrorMessage, sendLongMessage } from "./util.js";

const MAX_APPROVAL_DEPTH = 10;

/**
 * @param {Object} ctx - GrammY контекст
 * @param {Object} pending - {toolName, args, toolCallId, messages, account, createdAt, pendingToolCalls}
 * @param {number} [depth=0] - Глубина рекурсии
 * @param {AbortSignal} [abortSignal] - Сигнал отмены
 * @param {Function} handleAgentResult - Channel-agnostic handler
 * @returns {Promise<void>}
 */
export async function continueAfterApproval(ctx, pending, depth = 0, abortSignal, handleAgentResult) {
  if (depth >= MAX_APPROVAL_DEPTH) {
    addLog(`continueAfterApproval: depth limit (${MAX_APPROVAL_DEPTH}) reached`, "warning");
    await replyMsg(ctx, `⚠️ Reached tool call chain limit (${MAX_APPROVAL_DEPTH}).`);
    return;
  }

  addLog(`continueAfterApproval: ${pending.toolName} (depth ${depth})`, "info");

  stats.tools++;
  wsBroadcast("stats", { requests: stats.requests, tools: stats.tools, errors: stats.errors });
  const chatId = ctx.chat.id.toString();
  const account = pending.account;

  try {
    let result;
    if (pending.toolName === "question" && pending.approvalAnswers) {
      const questions = pending.args.questions || [];
      const formattedAnswers = [];
      for (let i = 0; i < questions.length; i++) {
        formattedAnswers.push(pending.approvalAnswers[i] || []);
      }
      result = { success: true, data: { questions, answers: formattedAnswers } };
      addLog(`Question answers: ${JSON.stringify(formattedAnswers)}`, "info");
    } else {
      result = await executeTool(
        { name: pending.toolName, args: pending.args },
        { projectPath: config.projectPath, account }
      );
    }

    if (result.data?.taskId) {
      const taskId = result.data.taskId;
      await replyMsg(ctx, `🔄 <b>${pending.toolName}</b>: Task <code>${taskId}</code> started…`);
      try {
        result = await waitForTask(taskId);
      } catch (error) {
        addLog(`waitForTask error for ${pending.toolName}: ${error.message}`, "error");
        result = { success: false, error: `Task execution failed: ${error.message}` };
      }
    }

    addLog(
      `Tool executed: ${pending.toolName} = ${result.success ? "OK" : "FAIL:" + result.error}`,
      result.success ? "success" : "error"
    );

    if (!result.success) {
      const errorToolMessage = {
        role: "tool",
        tool_call_id: pending.toolCallId,
        content: getToolModelOutput(pending.toolName, result),
      };
      const rawH = chatHistories.get(chatId) || pending.messages || [];
      const h = rawH.filter((m) => !m.content?.includes("[TOOL APPROVAL REQUIRED]"));
      const newHistory = [...h, errorToolMessage]
        .filter((m) => m.role !== "system")
        .slice(-(config.maxHistoryPairs * 2));
      chatHistories.set(chatId, newHistory);
      const stderr = result.data?.stderr?.trim();
      const errorShort = String(result.error || "unknown").slice(0, 200);
      const stderrShort = stderr ? stderr.slice(0, 300) : "";
      const errorMsg = errorShort + (stderrShort ? `\n\nstderr:\n\`\`\`\n${stderrShort}\n\`\`\`` : "");
      await sendLongMessage(ctx, `❌ <b>${pending.toolName}</b> failed: ${errorMsg}`);
      return;
    }

    const toolContent = getToolModelOutput(pending.toolName, result);
    const toolMessage = {
      role: "tool",
      content: toolContent,
    };
    if (pending.toolCallId) {
      toolMessage.tool_call_id = pending.toolCallId;
    }

    const rawHistory = pending.messages || chatHistories.get(chatId) || [];
    const cleanHistory = rawHistory.filter(
      (m) => m.role !== "system" && !m.content?.includes("[TOOL APPROVAL REQUIRED]")
    );
    let newHistory = [...cleanHistory, toolMessage];

    if (config.insertUserAfterTool) {
      newHistory.push({ role: "user", content: "Continue" });
    }

    const remaining = pending.pendingToolCalls || [];
    for (const next of remaining) {
      const ts = getToolConfig()[next.name] || {};
      if (ts.permission === "ask") {
        pendingApprovals.set(chatId, {
          toolName: next.name,
          args: next.args,
          toolCallId: next.id,
          messages: newHistory,
          account,
          createdAt: Date.now(),
          pendingToolCalls: remaining.slice(remaining.indexOf(next) + 1),
        });
        const paramStr = JSON.stringify(next.args);
        const displayParams = paramStr.length > 300 ? paramStr.substring(0, 300) + "… [truncated]" : paramStr;
        await replyMsg(
          ctx,
          `⚠️ Confirmation needed:\n\n📦 <b>${next.name}</b>\nParams: <code>${displayParams}</code>`,
          { reply_markup: KEYBOARD_YES_NO(next.name) }
        );
        return;
      }
      stats.tools++;
      let nextResult = await executeTool(
        { name: next.name, args: next.args },
        { projectPath: config.projectPath, account }
      );
      if (nextResult.data?.taskId) {
        nextResult = await waitForTask(nextResult.data.taskId);
      }
      addLog(
        `Tool executed (pending): ${next.name} = ${nextResult.success ? "OK" : "FAIL"}`,
        nextResult.success ? "success" : "error"
      );
      newHistory.push({
        role: "tool",
        tool_call_id: next.id,
        content: getToolModelOutput(next.name, nextResult),
      });
    }

    chatHistories.set(chatId, newHistory);

    const retryResult = await agentLoopStep(
      "",
      chatId,
      newHistory,
      config,
      MAX_AGENT_ITERATIONS,
      account,
      null,
      abortSignal
    );
    if (retryResult.tokenUsage) {
      tokenUsage.prompt += retryResult.tokenUsage.prompt || 0;
      tokenUsage.completion += retryResult.tokenUsage.completion || 0;
      tokenUsage.total += retryResult.tokenUsage.total || 0;
      tokenUsage.cached += retryResult.tokenUsage.cached || 0;
      wsBroadcast("tokenUsage", { ...tokenUsage });
    }
    if (retryResult.timings) {
      wsBroadcast("perfStats", buildPerfStats(retryResult.timings));
    }
    return await handleAgentResult(ctx, chatId, retryResult, account, undefined, abortSignal);
  } catch (error) {
    addLog(`continueAfterApproval error: ${error.message}`, "error");
    console.error("[continueAfterApproval] Full error:", error);
    await replyMsg(ctx, safeErrorMessage(error, "❌ Не удалось продолжить выполнение. Попробуйте ещё раз."));
  }
}
