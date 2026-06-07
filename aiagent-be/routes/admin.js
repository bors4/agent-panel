/**
 * Admin endpoints: bot lifecycle (start/stop/restart), tasks, agent/tool direct.
 * @module routes/admin
 */
import { Router } from "express";
import { executeTool, getActiveTasks, cancelTask } from "../lib/agent/executeTool.js";
import { loadAccounts, getAccounts, getAccountByUsername } from "../lib/accounts.js";

/**
 * @param {Object} deps
 * @param {Object} deps.config
 * @param {Function} deps.addLog
 * @param {Function} deps.wsBroadcast
 * @param {Object} deps.state
 * @param {Function} deps.resetStats
 * @param {Function} deps.resetTokenUsage
 * @param {Function} deps.updateStatus
 * @param {Object} deps.bot - getter
 * @param {Object} deps.initBot
 * @param {Object} deps.stats
 * @param {Map} deps.chatHistories
 * @param {Map} deps.pendingApprovals
 * @param {Map} deps.activeAgentControllers
 * @returns {Router}
 */
export function createAdminRouter(deps) {
  const router = Router();
  const { config, chatHistories, pendingApprovals, activeAgentControllers } = deps;

  /**
   * GET /api/tasks — list active execute tasks.
   */
  router.get("/tasks", (_req, res) => {
    res.json({ success: true, tasks: getActiveTasks() });
  });

  /**
   * POST /api/tasks/cancel — cancel task by id. Body: { taskId }
   */
  router.post("/tasks/cancel", (req, res) => {
    const { taskId } = req.body;
    if (!taskId) return res.status(400).json({ error: "taskId required" });
    if (cancelTask(taskId)) {
      deps.addLog(`Task ${taskId} cancelled via API`, "warning");
      res.json({ success: true });
    } else {
      res.json({ success: false, error: "Task not found or not running" });
    }
  });

  /**
   * POST /api/agent/tool — direct tool execution (no agent loop). Body: { name, args, accountName? }
   */
  router.post("/agent/tool", async (req, res) => {
    const { name, args, accountName } = req.body;
    if (!name) return res.status(400).json({ error: "Tool name required" });
    const account = accountName ? getAccountByUsername(accountName) : null;
    try {
      const result = await executeTool({ name, args: args || {} }, { projectPath: config.projectPath, account });
      deps.stats.tools++;
      deps.wsBroadcast("stats", { requests: deps.stats.requests, tools: deps.stats.tools, errors: deps.stats.errors });
      res.json({ success: true, result });
    } catch (e) {
      deps.stats.errors++;
      deps.addLog(`Agent tool error (${name}): ${e.message}`, "error");
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * POST /api/start — start the Telegram bot.
   */
  router.post("/start", async (_req, res) => {
    try {
      if (deps.state.botStatus === "running") return res.json({ success: true, message: "Bot already running" });
      const token = config.telegramToken || process.env.TELEGRAM_BOT_TOKEN;
      if (!token) return res.status(400).json({ error: "Telegram token not configured" });
      if (!deps.bot) deps.bot = deps.initBot(token);
      await deps.bot.start();
      deps.updateStatus("running", "Работает");
      deps.addLog("Telegram connected", "success");
      res.json({ success: true, message: "Starting..." });
    } catch (error) {
      deps.updateStatus("error", "Ошибка Telegram");
      res.status(500).json({ error: "Failed to start: " + error.message });
    }
  });

  /**
   * POST /api/stop — stop the Telegram bot and reset state.
   */
  router.post("/stop", async (_req, res) => {
    try {
      if (deps.state.botStatus === "running") {
        await deps.bot.stop();
        await new Promise((r) => setTimeout(r, 800));
      }
      chatHistories.clear();
      deps.resetStats();
      pendingApprovals.clear();
      deps.resetTokenUsage();
      for (const [, ctrl] of activeAgentControllers) {
        if (!ctrl.signal.aborted) ctrl.abort();
      }
      activeAgentControllers.clear();
      deps.updateStatus("idle", "Отключен");
      deps.wsBroadcast("stats", { requests: 0, tools: 0, errors: 0 });
      deps.wsBroadcast("tokenUsage", { prompt: 0, completion: 0, total: 0, cached: 0 });
      deps.addLog("Bot stopped", "warning");
      res.json({ success: true, message: "Bot stopped" });
    } catch (error) {
      res.status(500).json({ error: "Failed to stop: " + error.message });
    }
  });

  /**
   * POST /api/restart — restart the Telegram bot.
   */
  router.post("/restart", async (_req, res) => {
    try {
      const token = config.telegramToken || process.env.TELEGRAM_BOT_TOKEN;
      if (!token) return res.status(400).json({ error: "Telegram token not configured" });
      if (!deps.bot) deps.bot = deps.initBot(token);
      if (deps.state.botStatus === "running") {
        await deps.bot.stop();
        await new Promise((r) => setTimeout(r, 1000));
      }
      loadAccounts(process.cwd());
      deps.addLog(`Accounts reloaded: ${getAccounts().length}`, "info");
      deps.bot.start();
      deps.updateStatus("running", "Работает");
      deps.addLog("Bot restarted", "success");
      res.json({ success: true });
    } catch (error) {
      deps.updateStatus("error", "Ошибка Telegram");
      res.status(500).json({ error: "Failed to restart: " + error.message });
    }
  });

  return router;
}
