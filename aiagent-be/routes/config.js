/**
 * Config endpoints: GET/POST /api/config, GET /api/models.
 * @module routes/config
 */
import { Router } from "express";
import fs from "fs";
import path from "path";
import { configDefaults } from "../lib/configDefaults.js";
import { validateAsrUrl, sanitizeLanguage } from "../lib/asrClient.js";
import { loadAccounts, getAccounts } from "../lib/accounts.js";

/**
 * @param {Object} deps
 * @param {Object} deps.config
 * @param {Function} deps.addLog
 * @param {Object} deps.bot - getter/setter
 * @param {Object} deps.initBot
 * @returns {Router}
 */
export function createConfigRouter(deps) {
  const router = Router();
  const { config, addLog } = deps;

  /**
   * GET /api/config — current config (with secrets stripped, replaced by hasToken).
   */
  router.get("/config", (_req, res) => {
    const token = config.telegramToken || process.env.TELEGRAM_BOT_TOKEN || "";
    // eslint-disable-next-line no-unused-vars
    const { apiKey, openrouterApiKey, telegramToken, ...safeConfig } = config;
    res.json({
      success: true,
      config: { ...safeConfig, token, hasToken: !!token },
    });
  });

  /**
   * POST /api/config — update config. Validates projectPath, SSRF for asrServerUrl.
   * Reinitializes bot if token changed.
   */
  router.post("/config", async (req, res) => {
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
    if (body.temperature !== undefined) {
      const t = parseFloat(body.temperature);
      config.temperature = isNaN(t) ? configDefaults.temperature : t;
    }
    if (body.timeout !== undefined) config.timeout = parseInt(body.timeout);
    if (body.maxFileChars !== undefined) config.maxFileChars = parseInt(body.maxFileChars);
    if (body.maxHistoryPairs !== undefined) config.maxHistoryPairs = parseInt(body.maxHistoryPairs);
    if (body.maxSearchResults !== undefined) config.maxSearchResults = parseInt(body.maxSearchResults);
    if (body.maxFilesInPrompt !== undefined) config.maxFilesInPrompt = parseInt(body.maxFilesInPrompt);
    if (body.maxSearchFileSize !== undefined) config.maxSearchFileSize = parseInt(body.maxSearchFileSize);
    if (body.stream !== undefined) config.stream = !!body.stream;
    if (body.insertUserAfterTool !== undefined) config.insertUserAfterTool = !!body.insertUserAfterTool;
    if (body.chatMode !== undefined) config.chatMode = !!body.chatMode;
    if (body.openrouterApiKey !== undefined) config.openrouterApiKey = body.openrouterApiKey;
    if (body.asrServerUrl !== undefined) {
      try {
        config.asrServerUrl = validateAsrUrl(body.asrServerUrl);
      } catch (e) {
        return res.status(400).json({ error: `Invalid asrServerUrl: ${e.message}` });
      }
    }
    if (body.asrLanguage !== undefined) {
      config.asrLanguage = sanitizeLanguage(body.asrLanguage);
    }
    if (body.token !== undefined && body.token !== (config.telegramToken || "")) {
      config.telegramToken = body.token;
      process.env.TELEGRAM_BOT_TOKEN = body.token;
      if (deps.bot) {
        try {
          await deps.bot.stop();
        } catch {}
        deps.bot = null;
      }
      if (body.token) {
        deps.bot = deps.initBot(body.token);
        addLog("Telegram bot reinitialized with new token", "success");
      }
      tokenChanged = true;
    }
    addLog(`Config updated: ${config.modelName}, projectPath=${config.projectPath}`, "info");
    res.json({ success: true, config, tokenChanged });
  });

  /**
   * GET /api/models — fetch available models from AI server (or OpenRouter).
   */
  router.get("/models", async (req, res) => {
    try {
      const serverUrl = req.query.serverUrl || config.serverUrl;
      const isOpenRouter = serverUrl.includes("openrouter.ai");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const headers = { "Content-Type": "application/json" };
      if (isOpenRouter) {
        const apiKey = req.headers["x-openrouter-key"] || config.openrouterApiKey;
        headers["Authorization"] = `Bearer ${apiKey || ""}`;
        headers["HTTP-Referer"] = "https://agent-panel.local";
        headers["X-OpenRouter-Title"] = "AI Agent Panel";
      } else {
        headers["Authorization"] = `Bearer ${config.apiKey}`;
      }

      const response = await fetch(`${serverUrl}/models`, { headers, signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) throw new Error(`Server ${response.status}`);
      const data = await response.json();
      const models = (data.data || []).map((m) => ({
        id: m.id,
        name: m.name || m.id,
        object: m.object || "model",
        owned_by: m.owned_by || "",
        max_context_length: m.max_context_length || m.context_length || null,
        pricing: m.pricing || null,
      }));
      res.json({ success: true, models, source: isOpenRouter ? "openrouter" : "local" });
    } catch (error) {
      addLog(`Failed to fetch models: ${error.message}`, "error");
      res.status(500).json({ error: "Failed to fetch models" });
    }
  });

  return router;
}
