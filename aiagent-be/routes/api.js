/**
 * API маршруты для управления агентом, конфигурацией, инструментами и аккаунтами.
 * @module routes/api
 */

import { Router } from "express";
import path from "path";
import {
  executeTool,
  getToolConfig,
  updateToolConfig,
  TOOLS,
} from "../lib/agent/executeTool.js";
import {
  loadAccounts,
  saveAccounts,
  getAccounts,
} from "../lib/accounts.js";
import { logInfo, logError } from "../lib/logger.js";

/**
 * Создаёт Express Router с API маршрутами.
 * @param {Object} deps - Зависимости из сервера
 * @param {Object} deps.config - Объект конфигурации (мутируемый)
 * @param {Object} deps.stats - Объект статистики (мутируемый)
 * @param {Map} deps.chatHistories - История чатов
 * @param {Map} deps.pendingApprovals - Ожидающие подтверждения инструменты
 * @param {Function} deps.addLog - Функция логирования
 * @param {Function} deps.updateAgentConfig - Обновление конфигурации агента
 * @param {Object} deps.state - Общее состояние (botStatus, botStatusMessage, startTime)
 * @param {Object} deps.tokenUsage - Счётчик токенов (prompt, completion, total, cached)
 * @param {Function} deps.resetStats - Сброс статистики
 * @param {Function} deps.resetTokenUsage - Сброс счётчика токенов
 * @param {Function} deps.wsBroadcast - WebSocket рассылка событий
 * @returns {Router} Express Router
 */
export function createApiRouter(deps) {
  const router = Router();
  const { config, stats, chatHistories, pendingApprovals, addLog, updateAgentConfig, telegramBotToken, wsBroadcast } = deps;

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
    if (!TOOLS[name])
      return res.status(404).json({ error: `Tool '${name}' not found` });
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
    if (!Array.isArray(accounts))
      return res.status(400).json({ error: "accounts array required" });
    saveAccounts(config.projectPath, accounts);
    res.json({ success: true, accounts: getAccounts() });
  });

  /**
   * POST /api/accounts/import — Импортировать аккаунты из JSON.
   * Body: { accounts: [...] }
   */
  router.post("/accounts/import", (req, res) => {
    const { accounts } = req.body;
    if (!Array.isArray(accounts))
      return res.status(400).json({ error: "accounts array required" });
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
      if (!toolCall?.name)
        return res.status(400).json({ error: "toolCall.name required" });
      const result = await executeTool(toolCall, {
        projectPath: projectPath || config.projectPath,
      });
      res.json({
        success: true,
        result,
        requiresApproval: result.requiresApproval,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Config ──────────────────────────────────────────────────────────────

  /**
   * GET /api/config — Получить текущую конфигурацию.
   */
  router.get("/config", (req, res) => {
    res.json({
      success: true,
      config: { ...config, token: process.env.TELEGRAM_BOT_TOKEN || "" },
    });
  });

  /**
   * POST /api/config — Обновить конфигурацию.
   * Body: { serverUrl?, modelName?, projectPath?, systemPrompt?, maxTokens?, temperature?, timeout?, token? }
   */
  router.post("/config", (req, res) => {
    const body = req.body || {};
    let tokenChanged = false;
    addLog(`POST /api/config received keys: ${Object.keys(body).join(", ")}`, "info");
    if (body.serverUrl) config.serverUrl = body.serverUrl;
    if (body.modelName) config.modelName = body.modelName;
    if (body.projectPath !== undefined && body.projectPath !== null && body.projectPath !== "") {
      const resolved = path.resolve(body.projectPath);
      config.projectPath = resolved;
      addLog(`projectPath: "${body.projectPath}" → resolved: "${resolved}"`, "info");
    } else {
      addLog(`projectPath: skipped (value=${JSON.stringify(body.projectPath)})`, "warning");
    }
    if (body.systemPrompt !== undefined) config.systemPrompt = body.systemPrompt;
    if (body.maxTokens) config.maxTokens = parseInt(body.maxTokens);
    if (body.temperature !== undefined)
      config.temperature = parseFloat(body.temperature);
    if (body.timeout) config.timeout = parseInt(body.timeout);
    if (body.maxFileChars) config.maxFileChars = parseInt(body.maxFileChars);
    if (body.maxHistoryPairs) config.maxHistoryPairs = parseInt(body.maxHistoryPairs);
    if (body.maxSearchResults) config.maxSearchResults = parseInt(body.maxSearchResults);
    if (body.maxFilesInPrompt) config.maxFilesInPrompt = parseInt(body.maxFilesInPrompt);
    if (body.token && body.token !== process.env.TELEGRAM_BOT_TOKEN) {
      process.env.TELEGRAM_BOT_TOKEN = body.token;
      tokenChanged = true;
      addLog("Token changed — restart bot to apply", "warning");
    }
    updateAgentConfig(config);
    addLog(`Config updated: ${config.modelName}, projectPath=${config.projectPath}`, "info");
    res.json({ success: true, config, tokenChanged });
  });

  // ─── Models ──────────────────────────────────────────────────────────────

  /**
   * GET /api/models — Получить доступные модели с AI сервера.
   */
  router.get("/models", async (req, res) => {
    try {
      const response = await fetch(`${config.serverUrl}/models`, {
        headers: { Authorization: `Bearer ${config.apiKey}` },
      });
      if (!response.ok) throw new Error(`Server ${response.status}`);
      const data = await response.json();
      res.json({ success: true, models: data.data || [] });
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
        uptime: Math.floor(uptimeMs / 1000),
        requests: stats.requests,
        tools: stats.tools,
        errors: stats.errors,
      },
      uptime: Math.floor(uptimeMs / 1000),
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
      logs: deps.agentLogs
        .slice(-limit)
        .map((l) => ({ ...l, time: new Date(l.time).toLocaleTimeString() })),
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
      if (deps.state.botStatus === "running")
        return res.json({ success: true, message: "Bot already running" });
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
      wsBroadcast("stats", { requests: 0, tools: 0, errors: 0, uptime: 0 });
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
      const { message, modelName, serverUrl, projectPath, systemPrompt } =
        req.body;
      if (!message) return res.status(400).json({ error: "Message required" });

      const actualServerUrl = serverUrl || config.serverUrl;
      const model = modelName || config.modelName;
      const workPath = projectPath || config.projectPath;
      const sysPrompt =
        systemPrompt !== undefined ? systemPrompt : config.systemPrompt;

      stats.requests++;

      let systemContext = `Ты работаешь в проекте: ${workPath}. Все операции выполняй относительно этого пути.`;
      if (sysPrompt) systemContext += `\n\n${sysPrompt}`;

      const response = await fetch(`${actualServerUrl}/chat/completions`, {
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
          max_tokens: 4096,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        stats.errors++;
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();
      const reply =
        data.choices?.[0]?.message?.content || "Пустой ответ от модели";
      const usage = data.usage || null;
      if (usage) {
        deps.tokenUsage.prompt += usage.prompt_tokens || 0;
        deps.tokenUsage.completion += usage.completion_tokens || 0;
        deps.tokenUsage.total += usage.total_tokens || 0;
        if (usage.prompt_tokens_details?.cached_tokens !== undefined) {
          deps.tokenUsage.cached += usage.prompt_tokens_details.cached_tokens;
        }
        wsBroadcast("tokenUsage", { ...deps.tokenUsage });
      }
      wsBroadcast("stats", { requests: stats.requests, tools: stats.tools, errors: stats.errors });
      res.json({ success: true, reply, usage });
    } catch (error) {
      stats.errors++;
      addLog(`Chat error: ${error.message}`, "error");
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
