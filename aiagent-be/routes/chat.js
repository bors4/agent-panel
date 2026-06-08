/**
 * Chat endpoints: POST /api/chat (direct + agent loop), /api/chat/cancel,
 * /api/chat/continue (after approval), /api/chat/clean-text.
 * @module routes/chat
 */
import crypto from "node:crypto";
import { Router } from "express";
import { configDefaults } from "../lib/configDefaults.js";
import { agentLoopStep, MAX_AGENT_ITERATIONS } from "../lib/agent/agentLoop.js";
import { executeTool, getToolModelOutput } from "../lib/agent/executeTool.js";
import { webfetch } from "../lib/agent/tools/webfetch.js";
import { getAccountByUsername } from "../lib/accounts.js";
import { parseStreamedResponse } from "../lib/parseSSE.js";
import { normalizeUsage } from "../lib/responseNormalizer.js";

/**
 * @param {Object} deps
 * @param {Object} deps.config
 * @param {Object} deps.tokenUsage
 * @param {Object} deps.stats
 * @param {Function} deps.addLog
 * @param {Function} deps.wsBroadcast
 * @returns {Router}
 */
export function createChatRouter(deps) {
  const router = Router();
  const { config: cfg, tokenUsage: tu, stats: st, addLog, wsBroadcast } = deps;
  const activeChatControllers = new Map();

  /**
   * Build headers for AI server requests, handling OpenRouter auto-detection.
   */
  function buildChatHeaders(serverUrl) {
    const isOpenRouter = serverUrl.includes("openrouter.ai");
    const headers = { "Content-Type": "application/json" };
    if (isOpenRouter) {
      headers["Authorization"] = `Bearer ${cfg.openrouterApiKey || ""}`;
      headers["HTTP-Referer"] = "https://agent-panel.local";
      headers["X-OpenRouter-Title"] = "AI Agent Panel";
    } else {
      headers["Authorization"] = `Bearer ${cfg.apiKey}`;
    }
    return { headers, isOpenRouter };
  }

  /**
   * Extract tool calls and tool results from agent loop messages.
   */
  function extractToolData(messages) {
    const toolCalls = [];
    const toolResults = [];
    for (const msg of messages || []) {
      if (msg.role === "assistant" && msg.tool_calls?.length > 0) {
        for (const tc of msg.tool_calls) {
          toolCalls.push({ id: tc.id, name: tc.function?.name, args: tc.function?.arguments });
        }
      }
      if (msg.role === "tool") {
        let parsed;
        let isJson = true;
        try {
          parsed = JSON.parse(msg.content);
        } catch {
          isJson = false;
          parsed = msg.content;
        }
        toolResults.push({
          toolCallId: msg.tool_call_id,
          success: isJson ? parsed?.success : true,
          output: isJson ? parsed?.stdout || parsed?.content || parsed?.error || msg.content : msg.content,
        });
      }
    }
    return { toolCalls, toolResults };
  }

  /**
   * POST /api/chat — direct chat (with optional agent loop).
   */
  router.post("/chat", async (req, res) => {
    try {
      const { message, modelName, serverUrl, projectPath, systemPrompt, stream: useStream, useAgentLoop } = req.body;
      if (!message) return res.status(400).json({ error: "Message required" });

      const actualServerUrl = serverUrl || cfg.serverUrl;
      const model = modelName || cfg.modelName;
      const workPath = projectPath || cfg.projectPath;
      const sysPrompt = systemPrompt !== undefined ? systemPrompt : cfg.systemPrompt;
      const isStream = useStream ?? cfg.stream ?? false;

      st.requests++;

      if (useAgentLoop) {
        const accountName = req.body.accountName;
        const account = accountName ? getAccountByUsername(accountName) : null;

        if (!actualServerUrl) {
          const urlMatch = message.match(/https?:\/\/[^\s,;)]+/);
          if (urlMatch) {
            const fetchUrl = urlMatch[0];
            addLog(`Direct fetch (no AI server): ${fetchUrl}`, "info");
            const result = await webfetch({ url: fetchUrl, format: "text" });
            st.tools++;
            wsBroadcast("stats", { requests: st.requests, tools: st.tools, errors: st.errors });
            if (result.success) {
              return res.json({
                success: true,
                reply: `Содержимое страницы ${fetchUrl}:\n\n${result.data.content.slice(0, 10000)}`,
                toolCalls: [{ name: "webfetch", args: { url: fetchUrl } }],
                toolResults: [{ success: true, output: result.data.content.slice(0, 10000) }],
                messages: [],
              });
            }
            return res.json({ success: false, error: `Не удалось загрузить страницу: ${result.error}`, messages: [] });
          }
          return res.json({
            success: false,
            error: "AI server URL is not configured. Set it in the panel settings.",
            messages: [],
          });
        }

        const agentCfg = {
          ...cfg,
          projectPath: workPath,
          serverUrl: actualServerUrl,
          modelName: model,
          systemPrompt: sysPrompt,
        };
        const messages = req.body.messages || [];
        const abortId = req.body.abortId || crypto.randomUUID();
        const abortController = new AbortController();
        activeChatControllers.set(abortId, abortController);

        if (isStream) {
          let responseFinished = false;
          res.on("close", () => {
            if (!responseFinished && !abortController.signal.aborted) abortController.abort();
          });

          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");
          res.setHeader("X-Accel-Buffering", "no");

          const t0 = performance.now();
          let firstTokenMs = 0;
          let fullReasoning = "";

          const onProgress = (progress) => {
            try {
              if (progress.type === "reasoning" && progress.chunk) {
                if (!firstTokenMs) firstTokenMs = performance.now() - t0;
                fullReasoning += progress.chunk;
                res.write(`data: ${JSON.stringify({ reasoning: progress.chunk, accumulated: fullReasoning })}\n\n`);
              } else if (progress.type === "reasoning_done") {
                res.write(`data: ${JSON.stringify({ reasoningDone: true })}\n\n`);
              } else if (progress.type === "content" && progress.chunk) {
                if (!firstTokenMs) firstTokenMs = performance.now() - t0;
                res.write(`data: ${JSON.stringify({ reply: progress.chunk, accumulated: progress.accumulated })}\n\n`);
              }
            } catch (_err) {
              if (!abortController.signal.aborted) abortController.abort();
            }
          };

          let result;
          try {
            result = await agentLoopStep(
              message, "web-chat", messages, agentCfg,
              MAX_AGENT_ITERATIONS, account, onProgress, abortController.signal
            );
          } finally {
            activeChatControllers.delete(abortId);
          }

          if (result.cancelled) {
            responseFinished = true;
            res.write(`data: ${JSON.stringify({ cancelled: true, done: true })}\n\n`);
            res.write("data: [DONE]\n\n");
            res.end();
            return;
          }

          if (result.error && !result.cancelled) {
            responseFinished = true;
            res.write(`data: ${JSON.stringify({ error: result.error, done: true })}\n\n`);
            res.write("data: [DONE]\n\n");
            res.end();
            return;
          }

          if (result.tokenUsage) {
            const delta = {
              prompt: result.tokenUsage.prompt || 0,
              completion: result.tokenUsage.completion || 0,
              total: result.tokenUsage.total || 0,
              cached: result.tokenUsage.cached || 0,
            };
            tu.prompt += delta.prompt;
            tu.completion += delta.completion;
            tu.total += delta.total;
            tu.cached += delta.cached;
            wsBroadcast("tokenUsage", { ...delta, timestamp: Date.now() });
          }
          wsBroadcast("stats", { requests: st.requests, tools: st.tools, errors: st.errors });
          if (result.timings) {
            wsBroadcast("perfStats", buildPerfStats(result.timings));
          }

          const { toolCalls, toolResults } = extractToolData(result.messages);
          const finalEvent = {
            done: true,
            reply: result.response || "",
            reasoning: result.reasoning || fullReasoning || "",
            messages: result.messages || [],
            toolCalls,
            toolResults,
            requiresApproval: result.requiresApproval || false,
            approvalToolName: result.toolName,
            approvalArgs: result.args,
            approvalToolCallId: result.toolCallId,
            pendingToolCalls: result.pendingToolCalls || null,
            tokenUsage: result.tokenUsage || null,
            cancelled: false,
            abortId,
          };
          res.write(`data: ${JSON.stringify(finalEvent)}\n\n`);
          res.write("data: [DONE]\n\n");
          responseFinished = true;
          res.end();
          return;
        }

        let result;
        try {
          result = await agentLoopStep(
            message,
            "web-chat",
            messages,
            agentCfg,
            MAX_AGENT_ITERATIONS,
            account,
            null,
            abortController.signal
          );
        } finally {
          activeChatControllers.delete(abortId);
        }

        if (result.error && !result.cancelled) {
          return res.json({ success: false, error: result.error, messages: result.messages || messages, abortId });
        }

        const { toolCalls, toolResults } = extractToolData(result.messages);
        if (result.tokenUsage) {
          const delta = {
            prompt: result.tokenUsage.prompt || 0,
            completion: result.tokenUsage.completion || 0,
            total: result.tokenUsage.total || 0,
            cached: result.tokenUsage.cached || 0,
          };
          tu.prompt += delta.prompt;
          tu.completion += delta.completion;
          tu.total += delta.total;
          tu.cached += delta.cached;
          wsBroadcast("tokenUsage", { ...delta, timestamp: Date.now() });
        }
        wsBroadcast("stats", { requests: st.requests, tools: st.tools, errors: st.errors });
        if (result.timings) {
          wsBroadcast("perfStats", buildPerfStats(result.timings));
        }
        return res.json({
          success: true,
          reply: result.response || "",
          reasoning: result.reasoning || "",
          messages: result.messages || [],
          toolCalls,
          toolResults,
          requiresApproval: result.requiresApproval || false,
          approvalToolName: result.toolName,
          approvalArgs: result.args,
          approvalToolCallId: result.toolCallId,
          pendingToolCalls: result.pendingToolCalls || null,
          tokenUsage: result.tokenUsage || null,
          cancelled: result.cancelled || false,
          abortId,
        });
      }

      let systemContext = `Ты работаешь в проекте: ${workPath}. Все операции выполняй относительно этого пути.`;
      if (sysPrompt) systemContext += `\n\n${sysPrompt}`;

      const controller = new AbortController();
      const timeout = cfg.timeout ?? configDefaults.timeout;
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      const { headers: chatHeaders } = buildChatHeaders(actualServerUrl);

      let response;
      try {
        response = await fetch(`${actualServerUrl}/chat/completions`, {
          method: "POST",
          headers: chatHeaders,
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemContext },
              { role: "user", content: message },
            ],
            max_tokens: cfg.maxTokens ?? configDefaults.maxTokens,
            temperature: cfg.temperature ?? configDefaults.temperature,
            stream: isStream,
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response) throw new Error("AI server unreachable: request failed");
      if (!response.ok) {
        st.errors++;
        throw new Error(`AI API error: ${response.status}`);
      }

      if (isStream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");

        const t0 = performance.now();
        let firstTokenMs = 0;
        let fullContent = "";
        let perfStatsSent = false;
        const {
          usage: sseUsage,
          timings: sseTimings,
          tokensCached,
        } = await parseStreamedResponse(response, {
          onReasoning: (chunk, _accumulated) => {
            if (!firstTokenMs) firstTokenMs = performance.now() - t0;
            res.write(`data: ${JSON.stringify({ reasoning: chunk })}\n\n`);
          },
          onReasoningDone: () => res.write(`data: ${JSON.stringify({ reasoningDone: true })}\n\n`),
          onContent: (chunk, accumulated) => {
            if (!firstTokenMs) firstTokenMs = performance.now() - t0;
            fullContent += chunk;
            res.write(`data: ${JSON.stringify({ reply: chunk, accumulated })}\n\n`);
          },
          onFinish: (reason) => res.write(`data: ${JSON.stringify({ finishReason: reason })}\n\n`),
          onUsage: (u) => {
            if (u) {
              const nu = normalizeUsage(u);
              tu.prompt += nu.prompt;
              tu.completion += nu.completion;
              tu.total += nu.total;
              tu.cached += nu.cached;
              wsBroadcast("tokenUsage", { ...nu, timestamp: Date.now() });
            }
          },
          onTimings: (t) => {
            if (t) {
              const delta = {
                prompt: t.prompt_n || 0,
                completion: t.predicted_n || 0,
                total: (t.prompt_n || 0) + (t.predicted_n || 0),
                cached: t.cache_n || 0,
              };
              tu.prompt += delta.prompt;
              tu.completion += delta.completion;
              tu.total += delta.total;
              tu.cached += delta.cached;
              if (t.tokens_cached) tu.tokensCached = t.tokens_cached;
              wsBroadcast("tokenUsage", { ...delta, timestamp: Date.now() });
              if (!t.prompt_n && !t.predicted_n) return;
              perfStatsSent = true;
              wsBroadcast("perfStats", buildPerfStats(t));
            }
          },
        }, actualServerUrl);
        const totalMs = performance.now() - t0;

        if (!perfStatsSent && fullContent) {
          const promptText = systemContext + (message || "");
          const promptN = Math.ceil(promptText.length / 4);
          const predictedN = Math.ceil(fullContent.length / 4);
          if (predictedN > 0) {
            wsBroadcast(
              "perfStats",
              buildPerfStats({
                prompt_n: promptN,
                predicted_n: predictedN,
                prompt_ms: firstTokenMs || totalMs,
                predicted_ms: firstTokenMs ? totalMs - firstTokenMs : 0,
                draft_n: sseTimings?.draft_n || 0,
                draft_n_accepted: sseTimings?.draft_n_accepted || 0,
              })
            );
          }
        }

        const finalTimings = sseTimings;
        let finalUsage = sseUsage;
        if (!finalUsage) {
          if (finalTimings?.prompt_n) {
            finalUsage = normalizeUsage({
              prompt: finalTimings.prompt_n || 0,
              completion: finalTimings.predicted_n || 0,
              cached: finalTimings.tokens_cached ?? tokensCached ?? 0,
            });
          } else if (fullContent) {
            const promptText = systemContext + (message || "");
            const promptN = Math.ceil(promptText.length / 4);
            const predictedN = Math.ceil(fullContent.length / 4);
            const delta = { prompt: promptN, completion: predictedN, total: promptN + predictedN, cached: 0 };
            tu.prompt += delta.prompt;
            tu.completion += delta.completion;
            tu.total += delta.total;
            wsBroadcast("tokenUsage", { ...delta, timestamp: Date.now() });
            finalUsage = delta;
          }
        }

        wsBroadcast("stats", { requests: st.requests, tools: st.tools, errors: st.errors });
        res.write(`data: ${JSON.stringify({ reply: "", usage: finalUsage, done: true })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
      } else {
        const data = await response.json();
        const msg = data.choices?.[0]?.message || {};
        const reply = msg.content || msg.reasoning_content || "Пустой ответ от модели";
        const reasoning = msg.reasoning_content || "";
        const usage = data.usage || null;
        const dataTokensCached = data.tokens_cached ?? data.__verbose?.tokens_cached ?? 0;
        const timings = data.timings ? { ...data.timings, tokens_cached: dataTokensCached } : null;

        if (usage || timings) {
          if (usage) {
            const nu = normalizeUsage(usage);
            tu.prompt += nu.prompt;
            tu.completion += nu.completion;
            tu.total += nu.total;
            tu.cached += nu.cached;
            wsBroadcast("tokenUsage", { ...nu, timestamp: Date.now() });
          } else if (timings) {
            const delta = {
              prompt: timings.prompt_n || 0,
              completion: timings.predicted_n || 0,
              total: (timings.prompt_n || 0) + (timings.predicted_n || 0),
              cached: timings.cache_n || 0,
            };
            tu.prompt += delta.prompt;
            tu.completion += delta.completion;
            tu.total += delta.total;
            tu.cached += delta.cached;
            wsBroadcast("tokenUsage", { ...delta, timestamp: Date.now() });
          }
        }
        if (timings && (timings.prompt_n || timings.predicted_n)) {
          wsBroadcast("perfStats", buildPerfStats(timings));
        }
        wsBroadcast("stats", { requests: st.requests, tools: st.tools, errors: st.errors });
        const normalizedUsage = usage ? normalizeUsage(usage) : null;
        res.json({ success: true, reply, reasoning, usage: normalizedUsage, timings });
      }
    } catch (error) {
      st.errors++;
      addLog(`Chat error: ${error.message}`, "error");
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      } else {
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
      }
    }
  });

  /**
   * POST /api/chat/cancel — abort a running agent loop. Body: { abortId }
   */
  router.post("/chat/cancel", (req, res) => {
    const { abortId } = req.body;
    if (!abortId) return res.status(400).json({ error: "abortId required" });
    const controller = activeChatControllers.get(abortId);
    if (!controller) return res.json({ success: false, error: "No active request found for this abortId" });
    if (!controller.signal.aborted) controller.abort();
    activeChatControllers.delete(abortId);
    res.json({ success: true, cancelled: true });
  });

  /**
   * POST /api/chat/continue — continue agent loop after approval/denial. Body: { messages, approvalDecision, accountName? }
   */
  router.post("/chat/continue", async (req, res) => {
    try {
      const { messages, approvalDecision } = req.body;
      if (!messages || !approvalDecision) {
        return res.status(400).json({ error: "messages and approvalDecision required" });
      }
      const { approved, toolName, args, toolCallId, answers } = approvalDecision;
      const accountName = req.body.accountName;
      const account = accountName ? getAccountByUsername(accountName) : null;

      if (approved) {
        let toolResult;
        if (toolName === "question") {
          if (answers) {
            toolResult = { success: true, data: { questions: args.questions, answers } };
          } else {
            toolResult = { success: false, error: "No answers provided for question" };
          }
        } else {
          try {
            toolResult = await executeTool({ name: toolName, args }, { projectPath: cfg.projectPath, account });
          } catch (e) {
            toolResult = { success: false, error: e.message };
          }
        }
        const content = getToolModelOutput(toolName, toolResult);
        messages.push({
          role: "tool",
          tool_call_id: toolCallId || `web_${Date.now()}`,
          content,
        });
      } else {
        messages.push({
          role: "tool",
          tool_call_id: toolCallId || `web_${Date.now()}`,
          content: JSON.stringify({ success: false, error: "Tool execution was rejected by user" }),
        });
      }

      if (cfg.insertUserAfterTool) {
        messages.push({ role: "user", content: "Continue" });
      }

      const agentCfg = {
        ...cfg,
        projectPath: cfg.projectPath,
        serverUrl: cfg.serverUrl,
        modelName: cfg.modelName,
        systemPrompt: cfg.systemPrompt,
      };
      const abortId = crypto.randomUUID();
      const abortController = new AbortController();
      activeChatControllers.set(abortId, abortController);
      req.on("close", () => {
        if (!res.writableEnded && activeChatControllers.has(abortId)) {
          abortController.abort();
          activeChatControllers.delete(abortId);
        }
      });

      let result;
      try {
        result = await agentLoopStep(
          "",
          "web-chat",
          messages,
          agentCfg,
          MAX_AGENT_ITERATIONS,
          account,
          null,
          abortController.signal
        );
      } finally {
        activeChatControllers.delete(abortId);
      }

      if (result.error && !result.cancelled) {
        return res.json({ success: false, error: result.error, messages: result.messages || messages, abortId });
      }

      const { toolCalls, toolResults } = extractToolData(result.messages);
      wsBroadcast("stats", { requests: st.requests, tools: st.tools, errors: st.errors });
      res.json({
        success: true,
        reply: result.response || "",
        reasoning: result.reasoning || "",
        messages: result.messages || [],
        toolCalls,
        toolResults,
        requiresApproval: result.requiresApproval || false,
        approvalToolName: result.toolName,
        approvalArgs: result.args,
        approvalToolCallId: result.toolCallId,
        tokenUsage: result.tokenUsage || null,
        cancelled: result.cancelled || false,
        abortId,
      });
    } catch (error) {
      st.errors++;
      addLog(`Chat continue error: ${error.message}`, "error");
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/chat/clean-text — LLM-based cleanup of voice transcripts.
   */
  router.post("/chat/clean-text", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Text required" });
      }
      if (text.trim().length === 0) {
        return res.json({ cleaned: text });
      }

      const actualServerUrl = cfg.serverUrl;
      const model = cfg.modelName;
      const cleanPrompt = `Ты — редактор текста. Убери из текста слова-паразиты и воду: "ну", "эм", "ээм", "короче", "типа", "вот", "значит", "как бы", "это", "вообще", "просто", "даже", "пожалуй", "самое", "такое", "скажем", "допустим", "конечно", "блин", "то есть", "кстати", "видишь ли", "понимаешь", "типа того", "ну вот", "ну типа", "ну короче", "ну как бы", "это самое", "в общем", "короче говоря", повторы и лишние слова. Сохрани смысл и стиль. Верни ТОЛЬКО очищенный текст без кавычек и пояснений. Не добавляй ничего лишнего.`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const { headers: cleanHeaders } = buildChatHeaders(actualServerUrl);

      let response;
      try {
        response = await fetch(`${actualServerUrl}/chat/completions`, {
          method: "POST",
          headers: cleanHeaders,
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: cleanPrompt },
              { role: "user", content: text },
            ],
            max_tokens: Math.min(text.length + 200, 512),
            temperature: 0.1,
            stream: false,
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response || !response.ok) {
        addLog(`Clean text: AI server error ${response?.status}`, "warn");
        return res.json({ cleaned: text });
      }
      const data = await response.json();
      const cleaned = data.choices?.[0]?.message?.content?.trim();
      if (!cleaned) {
        addLog("Clean text: empty LLM response, using original", "warn");
        return res.json({ cleaned: text });
      }
      res.json({ cleaned });
    } catch (error) {
      addLog(`Clean text error: ${error.message}`, "warn");
      res.json({ cleaned: req.body?.text || "" });
    }
  });

  return router;
}

function buildPerfStats(timings) {
  return {
    prompt_n: timings.prompt_n ?? 0,
    predicted_n: timings.predicted_n ?? 0,
    prompt_ms: Math.round(timings.prompt_ms ?? 0),
    predicted_ms: Math.round(timings.predicted_ms ?? 0),
    prompt_per_second: timings.prompt_per_second ?? 0,
    predicted_per_second: timings.predicted_per_second ?? 0,
    cache_n: timings.cache_n ?? 0,
    tokens_cached: timings.tokens_cached ?? 0,
    draft_n: timings.draft_n ?? 0,
    draft_n_accepted: timings.draft_n_accepted ?? 0,
    draft_acceptance_rate: (timings.draft_n ?? 0) > 0 ? (timings.draft_n_accepted ?? 0) / (timings.draft_n ?? 0) : 0,
    total_ms: Math.round((timings.prompt_ms ?? 0) + (timings.predicted_ms ?? 0)),
  };
}
