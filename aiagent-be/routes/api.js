/**
 * API маршруты для управления агентом, конфигурацией, инструментами и аккаунтами.
 * @module routes/api
 */

import { Router } from "express";
import path from "path";
import fs from "fs";
import { executeTool, waitForTask, cancelTask, getActiveTasks, getToolConfig, updateToolConfig, TOOLS } from "../lib/agent/executeTool.js";
import { agentLoopStep, MAX_AGENT_ITERATIONS } from "../lib/agent/agentLoop.js";
import { loadAccounts, saveAccounts, getAccounts, getAccountByUsername } from "../lib/accounts.js";
import { configDefaults } from "../lib/configDefaults.js";
import { parseStreamedResponse } from "../lib/parseSSE.js";

/**
 * Создаёт Express Router с API маршрутами.
 * @param {Object} deps - Зависимости из сервера
 * @param {Object} deps.config - Объект конфигурации (мутируемый)
 * @param {Object} deps.stats - Объект статистики (мутируемый)
 * @param {Map} deps.chatHistories - История чатов
 * @param {Map} deps.pendingApprovals - Ожидающие подтверждения инструменты
 * @param {Function} deps.addLog - Функция логирования
 * @param {Object} deps.state - Общее состояние (botStatus, botStatusMessage, startTime)
 * @param {Object} deps.tokenUsage - Счётчик токенов (prompt, completion, total, cached)
 * @param {Function} deps.resetStats - Сброс статистики
 * @param {Function} deps.resetTokenUsage - Сброс счётчика токенов
 * @param {Function} deps.wsBroadcast - WebSocket рассылка событий
 * @returns {Router} Express Router
 */
export function createApiRouter(deps) {
  const router = Router();
  const { config, stats, chatHistories, pendingApprovals, addLog, wsBroadcast } =
    deps;

  // ─── Tools ───────────────────────────────────────────────────────────────

  /**
   * GET /api/tools — Получить список всех инструментов с конфигурацией.
   */
  router.get("/tools", (req, res) => {
    const toolDefs = {};
    for (const [name, tool] of Object.entries(TOOLS)) {
      toolDefs[name] = {
        name: tool.name,
        description: tool.description,
        category: tool.category,
        parameters: tool.input_schema,
        examples: tool.examples,
      };
    }
    res.json({ success: true, tools: toolDefs, config: getToolConfig() });
  });

  /**
   * POST /api/tools — Обновить конфигурацию инструмента.
   * Body: { name, enabled?, permission?, exclude_paths? }
   */
  router.post("/tools", (req, res) => {
    const { name, ...settings } = req.body;
    if (!name) return res.status(400).json({ error: "Tool name required" });
    if (!TOOLS[name]) return res.status(404).json({ error: `Tool '${name}' not found` });
    updateToolConfig(name, settings);
    res.json({ success: true, config: getToolConfig()[name] });
  });

  // ─── Accounts ────────────────────────────────────────────────────────────

  /**
   * GET /api/accounts — Получить список аккаунтов.
   */
  router.get("/accounts", (req, res) => {
    res.json({ success: true, accounts: getAccounts() });
  });

  /**
   * POST /api/accounts — Сохранить список аккаунтов.
   * Body: { accounts: [...] }
   */
  router.post("/accounts", (req, res) => {
    const { accounts } = req.body;
    if (!Array.isArray(accounts)) return res.status(400).json({ error: "accounts array required" });
    saveAccounts(config.projectPath, accounts);
    res.json({ success: true, accounts: getAccounts() });
  });

  /**
   * POST /api/accounts/import — Импортировать аккаунты из JSON.
   * Body: { accounts: [...] }
   */
  router.post("/accounts/import", (req, res) => {
    const { accounts } = req.body;
    if (!Array.isArray(accounts)) return res.status(400).json({ error: "accounts array required" });
    saveAccounts(config.projectPath, accounts);
    res.json({ success: true, accounts: getAccounts() });
  });

  // ─── Agent Tool Execution ────────────────────────────────────────────────

  /**
   * POST /api/agent/tool — Выполнить инструмент напрямую.
   * Body: { toolCall: { name, args }, projectPath? }
   */
  router.post("/agent/tool", async (req, res) => {
    try {
      const { toolCall, projectPath } = req.body;
      if (!toolCall?.name) return res.status(400).json({ error: "toolCall.name required" });
      let result = await executeTool(toolCall, {
        projectPath: projectPath || config.projectPath,
      });
      // If async task (execute), await completion before returning to API caller
      if (result.data?.taskId) {
        result = await waitForTask(result.data.taskId);
      }
      res.json({
        success: true,
        result,
        requiresApproval: result.requiresApproval,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Task Management ────────────────────────────────────────────────────

  /**
   * GET /api/tasks — Список активных фоновых задач.
   */
  router.get("/tasks", (req, res) => {
    res.json({ success: true, tasks: getActiveTasks() });
  });

  /**
   * POST /api/tasks/:taskId/cancel — Отменить активную задачу.
   */
  router.post("/tasks/cancel", (req, res) => {
    const { taskId } = req.body;
    if (!taskId) return res.status(400).json({ error: "taskId required" });
    const ok = cancelTask(taskId);
    res.json({ success: ok, cancelled: ok });
  });

  // ─── Config ──────────────────────────────────────────────────────────────

  /**
   * GET /api/config — Получить текущую конфигурацию.
   */
  router.get("/config", (req, res) => {
    res.json({
      success: true,
      config: { ...config, hasToken: !!process.env.TELEGRAM_BOT_TOKEN },
    });
  });

  /**
   * GET /api/validate-path — Проверить существование директории.
   * Query: ?path=...
   */
  router.get("/validate-path", async (req, res) => {
    const checkPath = req.query.path;
    if (!checkPath) return res.status(400).json({ valid: false, error: "Path parameter required" });
    try {
      const stat = await fs.promises.stat(path.resolve(checkPath));
      res.json({ valid: stat.isDirectory() });
    } catch {
      res.json({ valid: false });
    }
  });

  /**
   * POST /api/config — Обновить конфигурацию.
   * Body: { serverUrl?, modelName?, projectPath?, systemPrompt?, maxTokens?, temperature?, timeout?, token? }
   */
  router.post("/config", (req, res) => {
    const body = req.body || {};
    const blockedKeys = ["__proto__", "constructor", "prototype"];
    const hasPrototypePollution = Object.keys(body).some((k) => blockedKeys.includes(k));
    if (hasPrototypePollution) {
      addLog("POST /api/config blocked: prototype pollution attempt detected", "error");
      return res.status(400).json({ error: "Invalid config keys" });
    }
    let tokenChanged = false;
    addLog(`POST /api/config received keys: ${Object.keys(body).join(", ")}`, "info");
    if (body.serverUrl) config.serverUrl = body.serverUrl;
    if (body.modelName) config.modelName = body.modelName;
    if (body.projectPath !== undefined && body.projectPath !== null && body.projectPath !== "") {
      let resolved;
      try {
        resolved = path.resolve(body.projectPath);
        if (!fs.existsSync(resolved)) {
          return res.status(400).json({ error: `Directory does not exist: ${resolved}` });
        }
        if (!fs.statSync(resolved).isDirectory()) {
          return res.status(400).json({ error: `Path is not a directory: ${resolved}` });
        }
        try {
          fs.accessSync(resolved, fs.constants.R_OK | fs.constants.W_OK);
        } catch {
          return res.status(400).json({ error: `No read/write access: ${resolved}` });
        }
      } catch (e) {
        return res.status(400).json({ error: `Cannot access path: ${e.message}` });
      }
      config.projectPath = resolved;
      loadAccounts(config.projectPath);
      addLog(`projectPath: "${body.projectPath}" → resolved: "${resolved}", accounts: ${getAccounts().length}`, "info");
    } else {
      addLog(`projectPath: skipped (value=${JSON.stringify(body.projectPath)})`, "warning");
    }
    if (body.systemPrompt !== undefined) config.systemPrompt = body.systemPrompt;
    if (body.maxTokens !== undefined) config.maxTokens = parseInt(body.maxTokens) || configDefaults.maxTokens;
    if (body.temperature !== undefined) config.temperature = parseFloat(body.temperature);
    if (body.timeout !== undefined) config.timeout = parseInt(body.timeout);
    if (body.maxFileChars !== undefined) config.maxFileChars = parseInt(body.maxFileChars);
    if (body.maxHistoryPairs !== undefined) config.maxHistoryPairs = parseInt(body.maxHistoryPairs);
    if (body.maxSearchResults !== undefined) config.maxSearchResults = parseInt(body.maxSearchResults);
    if (body.maxFilesInPrompt !== undefined) config.maxFilesInPrompt = parseInt(body.maxFilesInPrompt);
    if (body.maxSearchFileSize !== undefined) config.maxSearchFileSize = parseInt(body.maxSearchFileSize);
    if (body.stream !== undefined) config.stream = !!body.stream;
    if (body.insertUserAfterTool !== undefined) config.insertUserAfterTool = !!body.insertUserAfterTool;
    if (body.token && body.token !== process.env.TELEGRAM_BOT_TOKEN) {
      process.env.TELEGRAM_BOT_TOKEN = body.token;
      tokenChanged = true;
      addLog("Token changed — restart bot to apply", "warning");
    }
    addLog(`Config updated: ${config.modelName}, projectPath=${config.projectPath}`, "info");
    res.json({ success: true, config, tokenChanged });
  });

  // ─── Models ──────────────────────────────────────────────────────────────

  /**
   * GET /api/models — Получить доступные модели с AI сервера.
   * Query: ?serverUrl=... (опционально, для прокси с фронтенда)
   */
  router.get("/models", async (req, res) => {
    try {
      const serverUrl = req.query.serverUrl || config.serverUrl;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${serverUrl}/models`, {
        headers: { Authorization: `Bearer ${config.apiKey}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!response.ok) throw new Error(`Server ${response.status}`);
      const data = await response.json();
      const models = (data.data || []).map((m) => ({
        id: m.id,
        object: m.object,
        owned_by: m.owned_by,
        max_context_length: m.max_context_length || null,
      }));
      res.json({ success: true, models });
    } catch (error) {
      addLog(`Failed to fetch models: ${error.message}`, "error");
      res.status(500).json({ error: "Failed to fetch models" });
    }
  });

  // ─── Status ──────────────────────────────────────────────────────────────

  /**
   * GET /api/status — Получить статус сервера, статистику и uptime.
   */
  router.get("/status", (req, res) => {
    const uptimeMs = deps.state.startTime ? Date.now() - deps.state.startTime : 0;
    res.json({
      success: true,
      status: deps.state.botStatus,
      statusMessage: deps.state.botStatusMessage,
      isRunning: deps.state.botStatus === "running",
      configRequired: !config.projectPath,
      configMessage: !config.projectPath
        ? "Project path is not configured. Set it in Settings or PROJECT_PATH in .env"
        : undefined,
      stats: {
        requests: stats.requests,
        tools: stats.tools,
        errors: stats.errors,
      },
      uptime: Math.floor(uptimeMs / 1000),
      startTime: deps.state.startTime,
      tokenUsage: deps.tokenUsage,
    });
  });

  // ─── Logs ────────────────────────────────────────────────────────────────

  /**
   * GET /api/logs — Получить последние логи.
   * Query: limit (default 50)
   */
  router.get("/logs", (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    res.json({
      success: true,
      logs: deps.agentLogs.slice(-limit).map((l) => ({ ...l, time: new Date(l.time).toLocaleTimeString() })),
    });
  });

  /**
   * DELETE /api/logs — Очистить все логи.
   */
  router.delete("/logs", (req, res) => {
    deps.agentLogs.length = 0;
    res.json({ success: true, message: "Logs cleared" });
  });

  // ─── Bot Control ─────────────────────────────────────────────────────────

  /**
   * POST /api/start — Запустить Telegram бота.
   */
  router.post("/start", async (req, res) => {
    try {
      if (deps.state.botStatus === "running") return res.json({ success: true, message: "Bot already running" });
      deps.updateStatus("running", "Работает");
      deps.bot.start();
      addLog("Telegram connected", "success");
      res.json({ success: true, message: "Starting..." });
    } catch (error) {
      deps.updateStatus("error", "Ошибка Telegram");
      res.status(500).json({ error: "Failed to start: " + error.message });
    }
  });

  /**
   * POST /api/stop — Остановить Telegram бота и сбросить состояние.
   */
  router.post("/stop", async (req, res) => {
    try {
      if (deps.state.botStatus === "running") {
        await deps.bot.stop();
        await new Promise((r) => setTimeout(r, 800));
      }
      chatHistories.clear();
      deps.resetStats();
      pendingApprovals.clear();
      deps.resetTokenUsage();
      deps.updateStatus("idle", "Отключен");
      wsBroadcast("stats", { requests: 0, tools: 0, errors: 0 });
      wsBroadcast("tokenUsage", { prompt: 0, completion: 0, total: 0, cached: 0 });
      addLog("Bot stopped", "warning");
      res.json({ success: true, message: "Bot stopped" });
    } catch (error) {
      res.status(500).json({ error: "Failed to stop: " + error.message });
    }
  });

  /**
   * POST /api/restart — Перезапустить Telegram бота.
   */
  router.post("/restart", async (req, res) => {
    try {
      if (deps.state.botStatus === "running") {
        await deps.bot.stop();
        await new Promise((r) => setTimeout(r, 1000));
      }
      loadAccounts(config.projectPath);
      addLog(`Accounts reloaded: ${getAccounts().length}`, "info");
      deps.bot.start();
      deps.updateStatus("running", "Работает");
      addLog("Bot restarted", "success");
      res.json({ success: true });
    } catch (error) {
      deps.updateStatus("error", "Ошибка Telegram");
      res.status(500).json({ error: "Failed to restart: " + error.message });
    }
  });

  // ─── Direct Chat ─────────────────────────────────────────────────────────

  /**
   * POST /api/chat — Прямой чат с AI (без agent loop).
   * Body: { message, modelName?, serverUrl?, projectPath?, systemPrompt? }
   */
  router.post("/chat", async (req, res) => {
    try {
      const { message, modelName, serverUrl, projectPath, systemPrompt, stream: useStream, useAgentLoop } = req.body;
      if (!message) return res.status(400).json({ error: "Message required" });

      const actualServerUrl = serverUrl || config.serverUrl;
      const model = modelName || config.modelName;
      const workPath = projectPath || config.projectPath;
      const sysPrompt = systemPrompt !== undefined ? systemPrompt : config.systemPrompt;
      const isStream = useStream ?? config.stream ?? false;

      stats.requests++;

      // Agent loop mode — использует agentLoopStep с инструментами и правами
      if (useAgentLoop) {
        const accountName = req.body.accountName;
        const account = accountName ? getAccountByUsername(accountName) : null;

        const agentCfg = {
          ...config,
          projectPath: workPath,
          serverUrl: actualServerUrl,
          modelName: model,
          systemPrompt: sysPrompt,
        };

        const messages = req.body.messages || [];
        const result = await agentLoopStep(message, "web-chat", messages, agentCfg, MAX_AGENT_ITERATIONS, account);

        if (result.error) {
          return res.json({ success: false, error: result.error, messages: result.messages || messages });
        }

        // Извлекаем tool_calls и tool_results из сообщений для удобства фронтенда
        const toolCalls = [];
        const toolResults = [];
        for (const msg of (result.messages || [])) {
          if (msg.role === "assistant" && msg.tool_calls?.length > 0) {
            for (const tc of msg.tool_calls) {
              toolCalls.push({
                id: tc.id,
                name: tc.function?.name,
                args: tc.function?.arguments,
              });
            }
          }
          if (msg.role === "tool") {
            let parsed;
            try { parsed = JSON.parse(msg.content); } catch { parsed = msg.content; }
            toolResults.push({
              toolCallId: msg.tool_call_id,
              success: parsed?.success,
              output: parsed?.stdout || parsed?.content || parsed?.error || msg.content,
            });
          }
        }

        if (result.tokenUsage) {
          deps.tokenUsage.prompt += result.tokenUsage.prompt || 0;
          deps.tokenUsage.completion += result.tokenUsage.completion || 0;
          deps.tokenUsage.total += result.tokenUsage.total || 0;
          deps.tokenUsage.cached += result.tokenUsage.cached || 0;
          wsBroadcast("tokenUsage", { ...deps.tokenUsage });
        }
        if (result.timings) {
          wsBroadcast("perfStats", {
            prompt_n: result.timings.prompt_n || 0,
            predicted_n: result.timings.predicted_n || 0,
            prompt_ms: Math.round(result.timings.prompt_ms || 0),
            predicted_ms: Math.round(result.timings.predicted_ms || 0),
            prompt_per_second: result.timings.prompt_per_second || 0,
            predicted_per_second: result.timings.predicted_per_second || 0,
            cache_n: result.timings.cache_n ?? 0,
            tokens_cached: result.timings.tokens_cached ?? 0,
            draft_n: result.timings.draft_n || 0,
            draft_n_accepted: result.timings.draft_n_accepted || 0,
            draft_acceptance_rate: (result.timings.draft_n ?? 0) > 0 ? (result.timings.draft_n_accepted ?? 0) / (result.timings.draft_n ?? 0) : 0,
            total_ms: Math.round((result.timings.prompt_ms || 0) + (result.timings.predicted_ms || 0)),
          });
        }

        return res.json({
          success: true,
          reply: result.response || "",
          messages: result.messages || [],
          toolCalls,
          toolResults,
          requiresApproval: result.requiresApproval || false,
          approvalToolName: result.toolName,
          approvalArgs: result.args,
          approvalToolCallId: result.toolCallId,
          tokenUsage: result.tokenUsage || null,
        });
      }

      let systemContext = `Ты работаешь в проекте: ${workPath}. Все операции выполняй относительно этого пути.`;
      if (sysPrompt) systemContext += `\n\n${sysPrompt}`;

      const controller = new AbortController();
      const timeout = config.timeout ?? configDefaults.timeout;
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      let response;
      try {
        response = await fetch(`${actualServerUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: "system", content: systemContext },
              { role: "user", content: message },
            ],
            max_tokens: config.maxTokens ?? configDefaults.maxTokens,
            temperature: config.temperature ?? configDefaults.temperature,
            stream: isStream,
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response) {
        throw new Error("AI server unreachable: request failed");
      }
      if (!response.ok) {
        stats.errors++;
        throw new Error(`AI API error: ${response.status}`);
      }

      // SSE режим
      if (isStream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");

        const t0 = performance.now();
        let firstTokenMs = 0;
        let fullContent = "";
        let perfStatsSent = false;
        const { usage: sseUsage, timings: sseTimings, tokensCached } = await parseStreamedResponse(response, {
          onContent: (chunk, accumulated) => {
            if (!firstTokenMs) firstTokenMs = performance.now() - t0;
            fullContent += chunk;
            res.write(`data: ${JSON.stringify({ reply: chunk, accumulated })}\n\n`);
          },
          onFinish: (reason) => {
            res.write(`data: ${JSON.stringify({ finishReason: reason })}\n\n`);
          },
          onUsage: (u) => {
            if (u) {
              deps.tokenUsage.prompt += u.prompt_tokens || 0;
              deps.tokenUsage.completion += u.completion_tokens || 0;
              deps.tokenUsage.total += u.total_tokens || 0;
              if (u.prompt_tokens_details?.cached_tokens !== undefined) {
                deps.tokenUsage.cached += u.prompt_tokens_details.cached_tokens;
              }
              wsBroadcast("tokenUsage", { ...deps.tokenUsage });
            }
          },
          onTimings: (t) => {
            if (t) {
              deps.tokenUsage.prompt += t.prompt_n || 0;
              deps.tokenUsage.completion += t.predicted_n || 0;
              deps.tokenUsage.total += (t.prompt_n || 0) + (t.predicted_n || 0);
              if (t.cache_n) deps.tokenUsage.cached += t.cache_n;
              if (t.tokens_cached) deps.tokenUsage.tokensCached = t.tokens_cached;
              wsBroadcast("tokenUsage", { ...deps.tokenUsage });
              if (!t.prompt_n && !t.predicted_n) return;
              perfStatsSent = true;
              wsBroadcast("perfStats", {
                prompt_n: t.prompt_n || 0,
                predicted_n: t.predicted_n || 0,
                prompt_ms: Math.round(t.prompt_ms || 0),
                predicted_ms: Math.round(t.predicted_ms || 0),
                prompt_per_second: t.prompt_per_second || 0,
                predicted_per_second: t.predicted_per_second || 0,
                cache_n: t.cache_n ?? 0,
                tokens_cached: t.tokens_cached ?? 0,
                draft_n: t.draft_n || 0,
                draft_n_accepted: t.draft_n_accepted || 0,
                draft_acceptance_rate: (t.draft_n ?? 0) > 0 ? (t.draft_n_accepted ?? 0) / (t.draft_n ?? 0) : 0,
                total_ms: Math.round((t.prompt_ms || 0) + (t.predicted_ms || 0)),
              });
            }
          },
        });
        const totalMs = performance.now() - t0;

        // Synthetic perfStats for servers without real timing data (e.g. LM Studio)
        if (!perfStatsSent && fullContent) {
          const promptText = systemContext + (message || "");
          const promptN = Math.ceil(promptText.length / 4);
          const predictedN = Math.ceil(fullContent.length / 4);
          if (predictedN > 0) {
            wsBroadcast("perfStats", {
              prompt_n: promptN,
              predicted_n: predictedN,
              prompt_ms: Math.round(firstTokenMs || totalMs),
              predicted_ms: firstTokenMs ? Math.round(totalMs - firstTokenMs) : 0,
              prompt_per_second: firstTokenMs && promptN ? promptN / (firstTokenMs / 1000) : 0,
              predicted_per_second: firstTokenMs ? predictedN / ((totalMs - firstTokenMs) / 1000) : 0,
              cache_n: 0,
              tokens_cached: 0,
              draft_n: sseTimings?.draft_n || 0,
              draft_n_accepted: sseTimings?.draft_n_accepted || 0,
              draft_acceptance_rate: (sseTimings?.draft_n ?? 0) > 0 ? (sseTimings?.draft_n_accepted ?? 0) / (sseTimings?.draft_n ?? 0) : 0,
              total_ms: Math.round(totalMs),
            });
          }
        }

        // Строим synthetic usage из timings или контента, если модель не прислала usage
        const finalTimings = sseTimings;
        let finalUsage = sseUsage;
        if (!finalUsage) {
          if (finalTimings?.prompt_n) {
            finalUsage = {
              prompt_tokens: finalTimings.prompt_n || 0,
              completion_tokens: finalTimings.predicted_n || 0,
              total_tokens: (finalTimings.prompt_n || 0) + (finalTimings.predicted_n || 0),
              prompt_tokens_details: {
                cached_tokens: finalTimings.tokens_cached ?? tokensCached ?? 0,
              },
            };
          } else if (fullContent) {
            const promptText = systemContext + (message || "");
            const promptN = Math.ceil(promptText.length / 4);
            const predictedN = Math.ceil(fullContent.length / 4);
            finalUsage = {
              prompt_tokens: promptN,
              completion_tokens: predictedN,
              total_tokens: promptN + predictedN,
            };
            deps.tokenUsage.prompt += promptN;
            deps.tokenUsage.completion += predictedN;
            deps.tokenUsage.total += promptN + predictedN;
            wsBroadcast("tokenUsage", { ...deps.tokenUsage });
          }
        }

        res.write(`data: ${JSON.stringify({ reply: "", usage: finalUsage, done: true })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
      } else {
        // JSON режим (обратная совместимость)
        const data = await response.json();
        const msg = data.choices?.[0]?.message || {};
        const reply = msg.content || msg.reasoning_content || "Пустой ответ от модели";
        const usage = data.usage || null;

        // Извлекаем tokens_cached (общий размер KV-кэша) и встраиваем в timings
        const dataTokensCached = data.tokens_cached ?? data.__verbose?.tokens_cached ?? 0;
        const timings = data.timings ? { ...data.timings, tokens_cached: dataTokensCached } : null;

          if (usage || timings) {
            if (usage) {
              deps.tokenUsage.prompt += usage.prompt_tokens || 0;
              deps.tokenUsage.completion += usage.completion_tokens || 0;
              deps.tokenUsage.total += usage.total_tokens || 0;
              if (usage.prompt_tokens_details?.cached_tokens !== undefined) {
                deps.tokenUsage.cached += usage.prompt_tokens_details.cached_tokens;
              } else if (timings?.cache_n) {
                deps.tokenUsage.cached += timings.cache_n;
              }
            } else if (timings) {
              deps.tokenUsage.prompt += timings.prompt_n || 0;
              deps.tokenUsage.completion += timings.predicted_n || 0;
              deps.tokenUsage.total += (timings.prompt_n || 0) + (timings.predicted_n || 0);
              if (timings.cache_n) deps.tokenUsage.cached += timings.cache_n;
            }
            if (timings?.tokens_cached) deps.tokenUsage.tokensCached = timings.tokens_cached;
          wsBroadcast("tokenUsage", { ...deps.tokenUsage });
        }
        if (timings && (timings.prompt_n || timings.predicted_n)) {
          wsBroadcast("perfStats", {
            prompt_n: timings.prompt_n || 0,
            predicted_n: timings.predicted_n || 0,
            prompt_ms: Math.round(timings.prompt_ms || 0),
            predicted_ms: Math.round(timings.predicted_ms || 0),
            prompt_per_second: timings.prompt_per_second || 0,
            predicted_per_second: timings.predicted_per_second || 0,
            cache_n: timings.cache_n ?? 0,
            tokens_cached: timings.tokens_cached ?? 0,
            draft_n: timings.draft_n || 0,
            draft_n_accepted: timings.draft_n_accepted || 0,
            draft_acceptance_rate: (timings.draft_n ?? 0) > 0 ? (timings.draft_n_accepted ?? 0) / (timings.draft_n ?? 0) : 0,
            total_ms: Math.round((timings.prompt_ms || 0) + (timings.predicted_ms || 0)),
          });
        }
        wsBroadcast("stats", { requests: stats.requests, tools: stats.tools, errors: stats.errors });
        res.json({ success: true, reply, usage, timings });
      }
    } catch (error) {
      stats.errors++;
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

  // ─── Agent Loop Approval ─────────────────────────────────────────────────

  /**
   * POST /api/chat/continue — Продолжить agent loop после одобрения/отклонения инструмента.
   * Body: { messages, approvalDecision: { approved, toolName, args, toolCallId } }
   */
  router.post("/chat/continue", async (req, res) => {
    try {
      const { messages, approvalDecision } = req.body;
      if (!messages || !approvalDecision) {
        return res.status(400).json({ error: "messages and approvalDecision required" });
      }

      const { approved, toolName, args, toolCallId } = approvalDecision;
      const accountName = req.body.accountName;
      const account = accountName ? getAccountByUsername(accountName) : null;

      if (approved) {
        // Выполняем инструмент и добавляем результат в историю
        let toolResult;
        try {
          toolResult = await executeTool({ name: toolName, args }, { projectPath: config.projectPath, account });
        } catch (e) {
          toolResult = { success: false, error: e.message };
        }
        messages.push({
          role: "tool",
          tool_call_id: toolCallId || `web_${Date.now()}`,
          content: JSON.stringify(toolResult),
        });
      } else {
        // Отклонено — добавляем сообщение об отказе
        messages.push({
          role: "tool",
          tool_call_id: toolCallId || `web_${Date.now()}`,
          content: JSON.stringify({ success: false, error: "Tool execution was rejected by user" }),
        });
      }

      if (config.insertUserAfterTool) {
        messages.push({ role: "user", content: "Continue" });
      }

      const agentCfg = {
        ...config,
        projectPath: config.projectPath,
        serverUrl: config.serverUrl,
        modelName: config.modelName,
        systemPrompt: config.systemPrompt,
      };

      const result = await agentLoopStep("", "web-chat", messages, agentCfg, MAX_AGENT_ITERATIONS, account);

      if (result.error) {
        return res.json({ success: false, error: result.error, messages: result.messages || messages });
      }

      const toolCalls = [];
      const toolResults = [];
      for (const msg of (result.messages || [])) {
        if (msg.role === "assistant" && msg.tool_calls?.length > 0) {
          for (const tc of msg.tool_calls) {
            toolCalls.push({
              id: tc.id,
              name: tc.function?.name,
              args: tc.function?.arguments,
            });
          }
        }
        if (msg.role === "tool") {
          let parsed;
          try { parsed = JSON.parse(msg.content); } catch { parsed = msg.content; }
          toolResults.push({
            toolCallId: msg.tool_call_id,
            success: parsed?.success,
            output: parsed?.stdout || parsed?.content || parsed?.error || msg.content,
          });
        }
      }

      res.json({
        success: true,
        reply: result.response || "",
        messages: result.messages || [],
        toolCalls,
        toolResults,
        requiresApproval: result.requiresApproval || false,
        approvalToolName: result.toolName,
        approvalArgs: result.args,
        approvalToolCallId: result.toolCallId,
        tokenUsage: result.tokenUsage || null,
      });
    } catch (error) {
      stats.errors++;
      addLog(`Chat continue error: ${error.message}`, "error");
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Health ──────────────────────────────────────────────────────────────

  /**
   * GET /api/health — Health check endpoint for monitoring.
   * Returns bot status and AI server reachability.
   */
  router.get("/health", async (req, res) => {
    const uptimeMs = deps.state.startTime ? Date.now() - deps.state.startTime : 0;
    const botRunning = deps.state.botStatus === "running";

    let aiReachable = false;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const aiResp = await fetch(`${config.serverUrl}/models`, {
        signal: controller.signal,
        headers: { Authorization: `Bearer ${config.apiKey}` },
      });
      clearTimeout(timeoutId);
      aiReachable = aiResp.ok;
    } catch {} // AI server unreachable, aiReachable stays false

    let status;
    if (botRunning && aiReachable) {
      status = "healthy";
    } else if (aiReachable) {
      status = "degraded";
    } else {
      status = "unhealthy";
    }

    res.json({
      status,
      bot: {
        isRunning: botRunning,
        status: deps.state.botStatus,
        uptime: Math.floor(uptimeMs / 1000),
      },
      aiServer: {
        reachable: aiReachable,
      },
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
