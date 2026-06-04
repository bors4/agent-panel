/**
 * Shared runtime state for the agent panel backend.
 *
 * Centralises module-level state that was previously declared in server.js.
 * All exports are mutable references — callers (bot handlers, API routes,
 * WebSocket broadcast) share the same instance.
 *
 * @module state
 */
import { configDefaults } from "./configDefaults.js";

/**
 * Главный объект конфигурации приложения. Обновляется через API /api/config.
 * @type {Object}
 */
export const config = {
  serverUrl: configDefaults.serverUrl,
  modelName: configDefaults.modelName,
  projectPath: configDefaults.projectPath,
  systemPrompt: configDefaults.systemPrompt,
  apiKey: process.env.API_KEY || configDefaults.apiKey,
  maxTokens: configDefaults.maxTokens,
  temperature: configDefaults.temperature,
  timeout: configDefaults.timeout,
  maxSearchFileSize: configDefaults.maxSearchFileSize,
  stream: configDefaults.stream,
  insertUserAfterTool: configDefaults.insertUserAfterTool,
  openrouterApiKey: process.env.OPENROUTER_API_KEY || configDefaults.openrouterApiKey,
  asrServerUrl: process.env.ASR_SERVER_URL || configDefaults.asrServerUrl,
  asrLanguage: configDefaults.asrLanguage,
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || "",
};

/**
 * Runtime state: bot lifecycle.
 * @type {{botStatus: "idle"|"running"|"error", botStatusMessage: string, startTime: number|null}}
 */
export const runtime = {
  bot: null,
  botStatus: "idle",
  botStatusMessage: "",
  startTime: null,
};

/** @type {{requests: number, tools: number, errors: number}} */
export const stats = { requests: 0, tools: 0, errors: 0 };

/** @type {{prompt: number, completion: number, total: number, cached: number, tokensCached: number}} */
export const tokenUsage = { prompt: 0, completion: 0, total: 0, cached: 0, tokensCached: 0 };

/** @type {Map.<string, Array.<{role: string, content: string}>>} */
export const chatHistories = new Map();

/** @type {Map.<string, Object>} */
export const pendingApprovals = new Map();

/** @type {Map<string, AbortController>} */
export const activeAgentControllers = new Map();

/** @type {Array.<{time: string, message: string, type: string}>} */
export const agentLogs = [];

/** @type {Map.<string, {count: number, windowStart: number}>} */
export const rateLimitMap = new Map();

/** @type {Object | null} */
export let wss = null;

/** Set the WebSocket server reference (assigned in server.js). */
export function setWss(server) {
  wss = server;
}

/** Сбросить статистику запросов, инструментов и ошибок. */
export function resetStats() {
  stats.requests = 0;
  stats.tools = 0;
  stats.errors = 0;
}

/** Сбросить счётчик использования токенов. */
export function resetTokenUsage() {
  tokenUsage.prompt = 0;
  tokenUsage.completion = 0;
  tokenUsage.total = 0;
  tokenUsage.cached = 0;
  tokenUsage.tokensCached = 0;
}
