/**
 * Основной сервер приложения (Express + GrammY).
 * Управляет Telegram ботом, REST API и агентным циклом.
 * @module server
 */

import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import fs from "fs";
import { Bot, InlineKeyboard } from "grammy";
import { stream } from "@grammyjs/stream";
import { autoRetry } from "@grammyjs/auto-retry";
import dotenv from "dotenv";
import { configDefaults } from "./lib/configDefaults.js";

dotenv.config();

// ─── Инициализация Express и Telegram бота ─────────────────────────────────

const app = express();
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);
bot.api.config.use(autoRetry());
bot.use(stream());

// ─── Состояние приложения ──────────────────────────────────────────────────

/**
 * Конфигурация приложения. Обновляется через API /api/config.
 * Все дефолтные значения — в lib/configDefaults.js.
 * .env используется только для TELEGRAM_BOT_TOKEN и API_KEY.
 * @type {Object}
 * @property {string} serverUrl - URL AI сервера
 * @property {string} modelName - Имя модели (из UI или .env)
 * @property {string} projectPath - Путь к проекту
 * @property {string} systemPrompt - Системный промпт
 * @property {string} apiKey - Ключ авторизации
 * @property {number} maxTokens - Максимальное количество токенов
 * @property {number} temperature - Температура генерации
 * @property {number} timeout - Таймаут запросов
 * @property {number} maxFileChars - Макс. символов при чтении файла
 * @property {number} maxHistoryPairs - Макс. пар сообщений в истории
 * @property {number} maxSearchResults - Макс. результатов поиска
 * @property {number} maxFilesInPrompt - Макс. файлов в промпте
 */
const config = {
  serverUrl: configDefaults.serverUrl,
  modelName: configDefaults.modelName,
  projectPath: configDefaults.projectPath,
  systemPrompt: configDefaults.systemPrompt,
  apiKey: process.env.API_KEY || configDefaults.apiKey,
  maxTokens: configDefaults.maxTokens,
  temperature: configDefaults.temperature,
  timeout: configDefaults.timeout,
  stream: configDefaults.stream,
};

/**
 * Общее состояние приложения (передаётся по ссылке в routes/api.js).
 * @type {{botStatus: "idle"|"running"|"error", botStatusMessage: string, startTime: number|null}}
 */
const state = {
  botStatus: "idle",
  botStatusMessage: "",
  startTime: null,
};

/** @type {{requests: number, tools: number, errors: number}} */
let stats = { requests: 0, tools: 0, errors: 0 };

/** @type {{prompt: number, completion: number, total: number, cached: number, tokensCached: number}} */
const tokenUsage = { prompt: 0, completion: 0, total: 0, cached: 0, tokensCached: 0 };

/** Rate limiter: map of chatId → { count, windowStart }. */
const rateLimitMap = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60_000;

function recordAndCheckRateLimit(chatId) {
  const now = Date.now();
  const entry = rateLimitMap.get(chatId) || { count: 0, windowStart: now };
  if (now - entry.windowStart > RATE_WINDOW) {
    entry.count = 0;
    entry.windowStart = now;
  }
  entry.count++;
  rateLimitMap.set(chatId, entry);
  return entry.count <= RATE_LIMIT;
}

// Periodic cleanup: remove stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [chatId, entry] of rateLimitMap) {
    if (now - entry.windowStart > RATE_WINDOW * 2) {
      rateLimitMap.delete(chatId);
    }
  }
}, 5 * 60_000).unref();

/** Сбросить статистику запросов, инструментов и ошибок. */
function resetStats() {
  stats.requests = 0;
  stats.tools = 0;
  stats.errors = 0;
}

/** Сбросить счётчик использования токенов. */
function resetTokenUsage() {
  tokenUsage.prompt = 0;
  tokenUsage.completion = 0;
  tokenUsage.total = 0;
  tokenUsage.cached = 0;
  tokenUsage.tokensCached = 0;
}

/**
 * Преобразует сырые timings от llama.cpp в объект perfStats для WebSocket.
 * @param {Object} timings - Сырые timings из ответа llama.cpp
 * @returns {Object} Нормализованный объект статистики
 */
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
    draft_acceptance_rate: timings.draft_n > 0 ? timings.draft_n_accepted / timings.draft_n : 0,
    total_ms: Math.round((timings.prompt_ms ?? 0) + (timings.predicted_ms ?? 0)),
  };
}

/** @type {Array.<{time: string, message: string, type: string}>} */
const agentLogs = [];

/** @type {Map.<string, Array.<{role: string, content: string}>>} */
const chatHistories = new Map();

/** @type {Map.<string, Object>} */
const pendingApprovals = new Map();

/** @type {Object | null} */
let wss = null;

/**
 * Рассылает сообщение всем подключённым WebSocket клиентам.
 * @param {string} type - Тип события (status, stats, log, tokenUsage)
 * @param {Object} data - Данные события
 */
function wsBroadcast(type, data) {
  if (!wss) return;
  const msg = JSON.stringify({ type, data });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(msg);
  });
}

// ─── Импорт модулей ────────────────────────────────────────────────────────

import { agentLoopStep, buildSystemMessage, MAX_AGENT_ITERATIONS } from "./lib/agent/agentLoop.js";
import { parseStreamedResponse } from "./lib/parseSSE.js";
import { executeTool, getToolConfig, TOOLS } from "./lib/agent/executeTool.js";
import { loadAccounts, getAccounts, getAccountByUsername, isToolEnabledForAccount } from "./lib/accounts.js";
import { logInfo, logWarn, logError, requestLogger } from "./lib/logger.js";
import { createApiRouter } from "./routes/api.js";
import { parseToolCall } from "./lib/utils.js";

// ─── Утилиты логирования ───────────────────────────────────────────────────

/**
 * Добавить запись в журнал агента.
 * @param {string} message - Текст сообщения
 * @param {"info"|"error"|"warning"|"warn"|"success"|"system"} type - Тип записи
 */
function addLog(message, type = "info") {
  const entry = { time: new Date().toISOString(), message, type };
  agentLogs.push(entry);
  if (agentLogs.length > 200) agentLogs.shift();
  if (type === "error") logError(message);
  else if (type === "warning" || type === "warn") logWarn(message);
  else logInfo(message);
  wsBroadcast("log", { ...entry, time: new Date(entry.time).toLocaleTimeString() });
}

/**
 * Обновить статус бота.
 * @param {"idle"|"running"|"error"} newStatus - Новый статус
 * @param {string} message - Описание изменения
 */
function updateStatus(newStatus, message = "") {
  state.botStatus = newStatus;
  state.botStatusMessage = message;
  if (newStatus === "running") state.startTime = Date.now();
  else state.startTime = null;
  addLog(`Status: ${message || newStatus}`, newStatus === "error" ? "error" : "info");
  const uptimeMs = state.startTime ? Date.now() - state.startTime : 0;
  wsBroadcast("status", {
    botStatus: newStatus,
    botStatusMessage: message,
    isRunning: newStatus === "running",
    startTime: state.startTime,
    uptime: Math.floor(uptimeMs / 1000),
  });
}

// ─── Загрузка аккаунтов ────────────────────────────────────────────────────

// Всегда загружаем accounts.json из корня проекта (рядом с package.json)
loadAccounts(process.cwd());
let loaded = getAccounts().length;
if (loaded > 0) {
  addLog(`Accounts loaded from project root: ${loaded}`, "info");
}

// Затем, если projectPath задан и отличается от корня — загружаем оттуда
if (config.projectPath && config.projectPath !== process.cwd() && fs.existsSync(config.projectPath)) {
  loadAccounts(config.projectPath);
  const more = getAccounts().length;
  addLog(`Project path: ${config.projectPath}, accounts: ${more}`, "info");
} else if (!config.projectPath) {
  config.projectPath = "";
  addLog("Project path is not configured. Agent blocked until path is set via API or .env", "warning");
}

// ─── Middleware ─────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(requestLogger);

// ─── API Routes ─────────────────────────────────────────────────────────────

const apiRouter = createApiRouter({
  config,
  bot,
  stats,
  chatHistories,
  pendingApprovals,
  addLog,
  wsBroadcast,
  state,
  agentLogs,
  updateStatus,
  tokenUsage,
  resetStats,
  resetTokenUsage,
});

app.use("/api", apiRouter);

// ─── Telegram HTML Helpers ─────────────────────────────────────────────────

/** Опции ответа по умолчанию для Telegram (HTML parse mode). @type {{parse_mode: string, link_preview_options: {is_disabled: boolean}}} */
const REPLY_OPTS = {
  parse_mode: "HTML",
  link_preview_options: { is_disabled: true },
};

/**
 * Экранирует недопустимые HTML-теги для Telegram API.
 * Telegram поддерживает только: b, i, u, s, code, pre, tg-spoiler, a, strong, em.
 * @param {string} text - Исходный текст с HTML
 * @returns {string} Безопасный текст
 */
function sanitizeTelegramHtml(text) {
  return text.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g, (match, slash, tag) => {
    const allowed = new Set(["b", "i", "u", "s", "code", "pre", "tg-spoiler", "a", "strong", "em"]);
    if (allowed.has(tag.toLowerCase())) return match;
    return `&lt;${slash}${tag}${match.slice(1 + slash.length + tag.length, match.length - 1)}&gt;`;
  });
}

/**
 * Отправить сообщение в Telegram с fallback на plain text.
 * @param {Object} ctx - GrammY контекст
 * @param {string} text - Текст сообщения
 * @param {Object} extra - Дополнительные опции
 * @returns {Promise<number|null>} ID отправленного сообщения
 */
async function replyMsg(ctx, text, extra = {}) {
  try {
    const sent = await ctx.reply(sanitizeTelegramHtml(text), {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      ...extra,
    });
    return sent.message_id;
  } catch (e) {
    if (e.message?.includes("can't parse entities") || e.message?.includes("Bad Request")) {
      const plain = sanitizeTelegramHtml(text).replace(/<[^>]+>/g, "");
      try {
        const sent = await ctx.reply(plain, {
          link_preview_options: { is_disabled: true },
          ...extra,
        });
        return sent.message_id;
      } catch (e2) {
        console.error("[replyMsg] Fallback also failed:", e2.message);
        return null;
      }
    }
    console.error("[replyMsg] Error:", e.message);
    return null;
  }
}

/**
 * Создать inline-клавиатуру с кнопками YES/NO.
 * @param {string} toolName - Название инструмента
 * @returns {InlineKeyboard}
 */
const KEYBOARD_YES_NO = (toolName) =>
  new InlineKeyboard().text("✅ YES", `approve_${toolName}`).text("❌ NO", `deny_${toolName}`);

/**
 * Отправить сообщение с индикатором набора текста.
 * @param {Object} ctx - GrammY контекст
 * @returns {Promise<void>}
 */
async function sendTyping(ctx) {
  try {
    await ctx.replyWithChatAction("typing");
  } catch {}
}

/**
 * Разбивает текст на чанки для streaming в Telegram.
 * Генерирует части по 80-150 символов, стараясь не разрывать слова.
 * @param {string} text - Исходный текст
 * @returns {AsyncGenerator<string>}
 */
async function* chunkText(text) {
  const maxChunk = 150;
  const minChunk = 80;
  let start = 0;
  while (start < text.length) {
    const remaining = text.length - start;
    if (remaining <= maxChunk) {
      yield text.slice(start);
      return;
    }
    let end = start + maxChunk;
    // Ищем границу слова (пробел) перед maxChunk
    const boundary = text.lastIndexOf(" ", end);
    if (boundary > start + minChunk) {
      end = boundary;
    }
    yield text.slice(start, end);
    start = end + 1;
  }
}

/**
 * Убрать inline-кнопки из сообщения.
 * @param {Object} ctx - GrammY контекст
 * @returns {Promise<void>}
 */
async function clearButtons(ctx) {
  try {
    await ctx.api.editMessageReplyMarkup(ctx.chat.id, ctx.callbackQuery.message.message_id, {
      reply_markup: { inline_keyboard: [] },
    });
  } catch (e) {
    const ignore = ["message to edit not found", "message is not modified"];
    if (!ignore.some((i) => e.message?.includes(i))) {
      console.error("Clear buttons error:", e.message);
    }
  }
}

// ─── Обработка сообщений от пользователей ───────────────────────────────────

/**
 * Обработать входящее сообщение от пользователя Telegram.
 * Маршрутизирует через agent loop и обрабатывает результат.
 * @param {Object} ctx - GrammY контекст сообщения
 * @returns {Promise<void>}
 */
bot.on("message", async (ctx) => {
  const message = ctx.message?.text || ctx.message?.caption;
  if (!message) {
    ctx.reply("Только текст.", REPLY_OPTS);
    return;
  }

  // Игнорировать тексты кнопок подтверждения
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

  const username = ctx.chat.username;
  const account = getAccountByUsername(username);
  if (!account) {
    await replyMsg(
      ctx,
      `❌ <b>Access denied</b>\n\nYour account (@${username || "unknown"}) is not registered. Contact the administrator.`
    );
    return;
  }

  const chatId = ctx.chat.id.toString();
  if (!recordAndCheckRateLimit(chatId)) {
    await replyMsg(ctx, "⏳ Too many requests. Please wait and try again.");
    return;
  }
  addLog(`Message from ${ctx.chat.username || chatId}: ${message.substring(0, 50)}...`, "info");
  stats.requests++;
  wsBroadcast("stats", { requests: stats.requests, tools: stats.tools, errors: stats.errors });

  let draftMsgId;
  try {
    await sendTyping(ctx);
    draftMsgId = await sendDraft(ctx, "⏳ Analyzing request...");

    const history = chatHistories.get(chatId) || [];
    let accumulatedContent = "";
    let lastEditTime = 0;
    const MIN_EDIT_INTERVAL = 1000; // Не чаще раза в секунду

    const result = await agentLoopStep(message, chatId, history, config, MAX_AGENT_ITERATIONS, account, async (progress) => {
      if (progress.type === "content") {
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
    });
    if (result.tokenUsage) {
      tokenUsage.prompt += result.tokenUsage.prompt;
      tokenUsage.completion += result.tokenUsage.completion;
      tokenUsage.total += result.tokenUsage.total;
      tokenUsage.cached += result.tokenUsage.cached;
      if (result.timings?.tokens_cached) tokenUsage.tokensCached = result.timings.tokens_cached;
      wsBroadcast("tokenUsage", { ...tokenUsage });
    }
    if (result.timings) {
      wsBroadcast("perfStats", buildPerfStats(result.timings));
    }
    addLog(
      `agentLoopStep: requiresApproval=${result.requiresApproval}, error=${!!result.error}, response=${result.response?.substring?.(0, 30)}`,
      "info"
    );

    await handleAgentResult(ctx, chatId, result, account, draftMsgId);
  } catch (error) {
    if (typeof draftMsgId === "number") ctx.api.deleteMessage(ctx.chat.id, draftMsgId).catch(() => {});
    await replyMsg(ctx, `❌ Error: ${error.message}`);
    addLog(`Bot error: ${error.message}`, "error");
  }
});

/**
 * Отправить черновик сообщения.
 * @param {Object} ctx - GrammY контекст
 * @param {string} text - Текст
 * @param {Object} extra - Дополнительные опции
 * @returns {Promise<number>}
 */
async function sendDraft(ctx, text, extra = {}) {
  const sent = await ctx.reply(sanitizeTelegramHtml(text), {
    ...REPLY_OPTS,
    ...extra,
  });
  return sent.message_id;
}

/**
 * Обновить существующее сообщение (для потокового вывода).
 * @param {Object} ctx - GrammY контекст
 * @param {number} messageId - ID сообщения для обновления
 * @param {string} text - Новый текст
 * @returns {Promise<void>}
 */
async function editDraftMessage(ctx, messageId, text) {
  if (!messageId) return;
  try {
    await ctx.api.editMessageText(ctx.chat.id, messageId, sanitizeTelegramHtml(text), {
      ...REPLY_OPTS,
    });
  } catch (e) {
    const ignore = ["message is not modified", "message to edit not found", "MESSAGE_ID_INVALID"];
    if (!ignore.some((i) => e.message?.includes(i))) {
      console.error("[editDraftMessage] Error:", e.message);
    }
  }
}

/**
 * Унифицированная обработка результата agent loop.
 * Избегает дублирования кода для первичного и повторного вызовов.
 * @param {Object} ctx - GrammY контекст
 * @param {string} chatId - ID чата
 * @param {Object} result - Результат agentLoopStep
 * @param {Object} account - Аккаунт пользователя
 * @param {number} [draftMsgId] - ID черновика для обновления (streaming mode)
 * @returns {Promise<boolean>} true если обработка завершена (ответ отправлен)
 */
async function handleAgentResult(ctx, chatId, result, account, draftMsgId) {
  // Требуется подтверждение
  if (result.requiresApproval) {
    pendingApprovals.set(chatId, {
      toolName: result.toolName,
      args: result.args,
      toolCallId: result.toolCallId,
      messages: result.messages,
      account,
    });
    chatHistories.set(chatId, result.messages.filter((m) => m.role !== "system").slice(-20));
    const paramStr = JSON.stringify(result.args);
    const displayParams =
      paramStr.length > 300 ? paramStr.substring(0, 300) + "… [truncated]" : paramStr;
    await replyMsg(
      ctx,
      `⚠️ Confirmation needed:\n\n📦 <b>${result.toolName}</b>\nParams: <code>${displayParams}</code>`,
      { reply_markup: KEYBOARD_YES_NO(result.toolName) }
    );
    return true;
  }

  // Ошибка
  if (result.error) {
    const cleanHistory = (chatHistories.get(chatId) || []).filter(
      (m) => !m.content?.includes("[TOOL APPROVAL REQUIRED]") && m.role !== "tool" && m.role !== "system"
    );
    chatHistories.set(chatId, cleanHistory.slice(-10));
    if (draftMsgId) ctx.api.deleteMessage(ctx.chat.id, draftMsgId).catch(() => {});
    await replyMsg(ctx, `❌ Error: ${result.error}`);
    return true;
  }

  // Финальный ответ
  if (result.response !== undefined && result.response !== "continue") {
    if (result.messages) chatHistories.set(chatId, result.messages.filter((m) => m.role !== "system").slice(-20));
    let cleanResponse = result.response.replace(/\[TOOL APPROVAL REQUIRED\].*/gi, "").trim();
    if (!cleanResponse) cleanResponse = "✅ Done.";
    if (draftMsgId) {
      // Если есть черновик — обновляем его (streaming mode)
      await editDraftMessage(ctx, draftMsgId, "✅ " + cleanResponse);
    } else if (ctx.chat?.type === "private") {
      await ctx.replyWithStream(chunkText(cleanResponse));
    } else {
      await replyMsg(ctx, cleanResponse);
    }
    return true;
  }

  // Продолжение (нужен ещё один шаг)
  if (result.response === "continue") {
    const history = result.messages || chatHistories.get(chatId) || [];
    const retryResult = await agentLoopStep("", chatId, history, config, MAX_AGENT_ITERATIONS, account);
    addLog(`agentLoopStep (retry): requiresApproval=${retryResult.requiresApproval}`, "info");
    return await handleAgentResult(ctx, chatId, retryResult, account);
  }

  // Лимит итераций
  if (draftMsgId) ctx.api.deleteMessage(ctx.chat.id, draftMsgId).catch(() => {});
  await replyMsg(ctx, "Iteration limit reached");
  return true;
}

// ─── Обработка подтверждений (callback queries) ─────────────────────────────

/**
 * Продолжить выполнение после подтверждения пользователем.
 * Выполняет инструмент, отправляет результат модели и обрабатывает ответ.
 * @param {Object} ctx - GrammY контекст
 * @param {Object} pending - Ожидающий инструмент
 * @param {number} depth - Текущая глубина рекурсии (default: 0)
 * @returns {Promise<void>}
 */
const MAX_APPROVAL_DEPTH = 10;

async function continueAfterApproval(ctx, pending, depth = 0) {
  if (depth >= MAX_APPROVAL_DEPTH) {
    addLog(`continueAfterApproval: depth limit (${MAX_APPROVAL_DEPTH}) reached`, "warning");
    await replyMsg(ctx, `⚠️ Reached tool call chain limit (${MAX_APPROVAL_DEPTH}).`);
    return;
  }

  addLog(`continueAfterApproval: ${pending.toolName} (depth ${depth})`, "info");
  });

  stats.tools++;
  wsBroadcast("stats", { requests: stats.requests, tools: stats.tools, errors: stats.errors });
  const chatId = ctx.chat.id.toString();
  const account = pending.account;

  try {
    const result = await executeTool(
      { name: pending.toolName, args: pending.args },
      { projectPath: config.projectPath, account }
    );

    addLog(
      `Tool executed: ${pending.toolName} = ${result.success ? "OK" : "FAIL:" + result.error}`,
      result.success ? "success" : "error"
    );

    if (!result.success) {
      await replyMsg(ctx, `❌ <b>${pending.toolName}</b> failed: ${result.error}`);
      return;
    }

    const toolMessage = {
      role: "tool",
      content: JSON.stringify(result).replace(/</g, "&lt;").replace(/>/g, "&gt;"),
    };
    if (pending.toolCallId) {
      toolMessage.tool_call_id = pending.toolCallId;
    }

    const mergedToolConfig = getToolConfig();
    const toolsDef = Object.values(mergedToolConfig)
      .filter((t) => isToolEnabledForAccount(account, t.name, mergedToolConfig))
      .map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      }));

    const history = chatHistories.get(chatId) || pending.messages || [];
    const systemMessage = {
      role: "system",
      content: buildSystemMessage(config.projectPath, config.systemPrompt, true, account),
    };

    const controller = new AbortController();
    const timeout = config.timeout ?? configDefaults.timeout;
    let timeoutId = setTimeout(() => controller.abort(), timeout);
    let response;
    try {
      response = await fetch(config.serverUrl + "/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + config.apiKey,
        },
        body: JSON.stringify({
          model: config.modelName,
          messages: [systemMessage, ...history, toolMessage],
          max_tokens: config.maxTokens ?? configDefaults.maxTokens,
          temperature: config.temperature ?? configDefaults.temperature,
          tools: toolsDef,
          tool_choice: "auto",
          stream: config.stream ?? false,
        }),
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timeoutId);
      if (e.name === "AbortError") {
        throw new Error("Request timed out. Try again or increase the timeout setting.", { cause: e });
      }
      throw e;
    }

    if (!response.ok) {
      clearTimeout(timeoutId);
      throw new Error(`AI API error: ${response.status}`);
    }

    let nextMessage, finishReason;
    if (config.stream) {
      try {
        const { content, toolCalls, finishReason: fr, usage, timings } = await parseStreamedResponse(response, {
          onContent: () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => controller.abort(), timeout);
          },
        });
        finishReason = fr;
        nextMessage = {
          role: "assistant",
          content: content || null,
          tool_calls: toolCalls
            ? toolCalls.map((tc) => ({
                id: tc.id,
                type: tc.type,
                function: { name: tc.function.name, arguments: tc.function.arguments },
              }))
            : undefined,
        };
        let effectiveUsage = usage;
        if (!effectiveUsage && timings) {
          effectiveUsage = {
            prompt_tokens: timings.prompt_n || 0,
            completion_tokens: timings.predicted_n || 0,
            total_tokens: (timings.prompt_n || 0) + (timings.predicted_n || 0),
            prompt_tokens_details: {
              cached_tokens: timings.cache_n || 0,
            },
          };
        }
          if (effectiveUsage) {
            tokenUsage.prompt += effectiveUsage.prompt_tokens || 0;
            tokenUsage.completion += effectiveUsage.completion_tokens || 0;
            tokenUsage.total += effectiveUsage.total_tokens || 0;
            if (effectiveUsage.prompt_tokens_details?.cached_tokens !== undefined) {
              tokenUsage.cached += effectiveUsage.prompt_tokens_details.cached_tokens;
            }
            if (timings?.tokens_cached) tokenUsage.tokensCached = timings.tokens_cached;
            wsBroadcast("tokenUsage", { ...tokenUsage });
          }
          if (timings) {
            wsBroadcast("perfStats", buildPerfStats(timings));
          }
        } catch (e) {
          if (e.name === "AbortError") {
          throw new Error("Generation timed out. Try again or increase the timeout setting.", { cause: e });
        }
        throw e;
      } finally {
        clearTimeout(timeoutId);
      }
    } else {
      clearTimeout(timeoutId);
      const data = await response.json();
      finishReason = data.choices?.[0]?.finish_reason;
      nextMessage = data.choices?.[0]?.message || {};
      const usage = data.usage;
      const timings = data.timings;
      let effectiveUsage = usage;
      if (!effectiveUsage && timings) {
        effectiveUsage = {
          prompt_tokens: timings.prompt_n || 0,
          completion_tokens: timings.predicted_n || 0,
          total_tokens: (timings.prompt_n || 0) + (timings.predicted_n || 0),
          prompt_tokens_details: {
            cached_tokens: timings.cache_n || 0,
          },
        };
      }
      if (effectiveUsage) {
        tokenUsage.prompt += effectiveUsage.prompt_tokens || 0;
        tokenUsage.completion += effectiveUsage.completion_tokens || 0;
        tokenUsage.total += effectiveUsage.total_tokens || 0;
        if (effectiveUsage.prompt_tokens_details?.cached_tokens !== undefined) {
          tokenUsage.cached += effectiveUsage.prompt_tokens_details.cached_tokens;
        }
        if (timings?.tokens_cached) tokenUsage.tokensCached = timings.tokens_cached;
        wsBroadcast("tokenUsage", { ...tokenUsage });
      }
      if (timings) {
        wsBroadcast("perfStats", buildPerfStats(timings));
      }
    }

    addLog(`Model response: finish=${finishReason}, toolCalls=${!!nextMessage?.tool_calls?.length}, content=${nextMessage?.content?.length}`, "info");

    if (!nextMessage || (!nextMessage.content?.trim() && !nextMessage.tool_calls?.length)) {
      const reason = finishReason === "length" ? "Лимит токенов (max_tokens)" : "Ответ модели обрезан или невалиден";
      addLog(`Model response empty/invalid. finish_reason: ${finishReason}`, "warning");
      await replyMsg(
        ctx,
        `⚠️ ${reason}. Модель не сгенерировала полный вызов инструмента. Попробуйте разбить задачу или увеличить MAX_TOKENS.`
      );
      return;
    }

    const newHistory = [...history, toolMessage, nextMessage].filter((m) => m.role !== "system").slice(-20);
    chatHistories.set(chatId, newHistory);

    // XML fallback: parse XML tool call if native function calling absent
    if (!nextMessage.tool_calls?.length) {
      const xmlTc = parseToolCall(nextMessage.content || "");
      if (xmlTc) {
        nextMessage.tool_calls = [{
          id: xmlTc.id,
          type: "function",
          function: { name: xmlTc.name, arguments: JSON.stringify(xmlTc.args) },
        }];
      }
    }

    // Модель вернула новый tool_call
    if (nextMessage.tool_calls?.length > 0) {
      const tc = nextMessage.tool_calls[0];
      const tn = tc.function.name;
      let ta;
      try {
        ta = JSON.parse(tc.function.arguments);
      } catch {
        throw new Error("Invalid JSON in tool call");
      }

      const ts = mergedToolConfig[tn] || {};
      if (!mergedToolConfig[tn]?.enabled) {
        await replyMsg(ctx, `❌ <b>${tn}</b> is disabled globally.`);
        return;
      }
      if (account && account.permissions?.[tn] === false) {
        await replyMsg(ctx, `❌ <b>${tn}</b> is not available for your account.`);
        return;
      }
      if (ts.permission === "ask") {
        pendingApprovals.set(chatId, {
          toolName: tn,
          args: ta,
          toolCallId: tc.id,
          messages: newHistory,
          account,
        });
        const paramStr = JSON.stringify(ta);
        const displayParams = paramStr.length > 300 ? paramStr.substring(0, 300) + "… [truncated]" : paramStr;
        await replyMsg(ctx, `⚠️ Confirmation needed:\n\n📦 <b>${tn}</b>\nParams: <code>${displayParams}</code>`, {
          reply_markup: KEYBOARD_YES_NO(tn),
        });
        return;
      }

      // Авто-выполнение следующего инструмента
      await continueAfterApproval(
        ctx,
        {
          toolName: tn,
          args: ta,
          toolCallId: tc.id,
          messages: newHistory,
          account,
        },
        depth + 1
      );
      return;
    }

    const finalText = nextMessage.content || "✅ Готово.";
    if (ctx.chat?.type === "private") {
      await ctx.replyWithStream(chunkText(finalText));
    } else {
      await replyMsg(ctx, finalText);
    }
  } catch (error) {
    addLog(`continueAfterApproval error: ${error.message}`, "error");
    console.error("[continueAfterApproval] Full error:", error);
    await replyMsg(ctx, `❌ Error continuing: ${error.message}`);
  }
}

/**
 * Обработка callback-запросов (inline keyboard).
 * @param {Object} ctx - GrammY контекст callback query
 * @returns {Promise<void>}
 */
bot.on("callback_query", async (ctx) => {
  const callbackData = ctx.callbackQuery.data;
  const chatId = ctx.chat.id.toString();
  addLog(`Callback: ${callbackData} from ${chatId}`, "info");

  if (callbackData.startsWith("approve_")) {
    const toolName = callbackData.replace("approve_", "");
    const pending = pendingApprovals.get(chatId);

    if (!pending || pending.toolName !== toolName) {
      addLog(`Stale approve: tool=${toolName}, pending=${pending?.toolName || "none"}`, "warning");
      await ctx.answerCallbackQuery("❌ Request not found or outdated");
      return;
    }

    addLog(`Executing: ${toolName} with args=${JSON.stringify(pending.args)}`, "success");
    await ctx.answerCallbackQuery("Executing...");
    await clearButtons(ctx);
    pendingApprovals.delete(chatId);
    await sendTyping(ctx);
    continueAfterApproval(ctx, pending).catch((err) => {
      addLog(`continueAfterApproval (async) error: ${err.message}`, "error");
    });
  } else if (callbackData.startsWith("deny_")) {
    const toolName = callbackData.replace("deny_", "");
    const pending = pendingApprovals.get(chatId);
    pendingApprovals.delete(chatId);
    addLog(`Deny: ${toolName}`, "warning");
    await ctx.answerCallbackQuery("Cancelled");
    await clearButtons(ctx);

    if (pending) {
      const deniedMessages = [
        ...pending.messages,
        {
          role: "tool",
          tool_call_id: pending.toolCallId,
          content: JSON.stringify({ success: false, error: "denied by user" }),
        },
      ];
      deniedMessages.push({ role: "assistant", content: "" });
      chatHistories.set(chatId, deniedMessages.filter((m) => m.role !== "system").slice(-20));
    }

    await replyMsg(ctx, `❌ <b>${toolName}</b> cancelled. The tool was not executed.`);
  }
});

// ─── Telegram Commands ─────────────────────────────────────────────────────

bot.command("start", (ctx) => {
  if (config.modelName === "Имя модели") {
    ctx.reply("⚠️ Модель не выбрана. Настройте модель в веб-интерфейсе.", REPLY_OPTS);
    return;
  }
  updateStatus("running", "Работает");
  ctx.reply("🤖 AI Agent active!\nModel: " + config.modelName, REPLY_OPTS);
});

bot.command("help", (ctx) => {
  ctx.reply(
    "Commands:\n/start - Start\n/help - Help\n/model - Current model\n/clear - Clear history\n/tools - Tool list",
    REPLY_OPTS
  );
});

bot.command("model", (ctx) => {
  ctx.reply(`Model: ${config.modelName}\nServer: ${config.serverUrl}`, REPLY_OPTS);
});

bot.command("clear", (ctx) => {
  chatHistories.delete(ctx.chat.id.toString());
  ctx.reply("🗑️ History cleared!", REPLY_OPTS);
});

bot.command("tools", async (ctx) => {
  const username = ctx.chat.username;
  const account = getAccountByUsername(username);
  let toolList;
  if (account) {
    toolList = Object.entries(TOOLS)
      .map(([name, tool]) => {
        const enabled = account.permissions?.[name] !== false;
        const icon = enabled ? "✅" : "❌";
        return `${icon} <b>${name}</b>: ${tool.description}`;
      })
      .join("\n");
    ctx.reply(`📦 Tools for @${username} (${account.role}):\n\n${toolList}`, {
      ...REPLY_OPTS,
      parse_mode: "HTML",
    });
  } else {
    toolList = Object.entries(TOOLS)
      .map(([name, tool]) => `• <b>${name}</b>: ${tool.description}`)
      .join("\n");
    ctx.reply(`📦 Available tools:\n\n${toolList}`, {
      ...REPLY_OPTS,
      parse_mode: "HTML",
    });
  }
});

bot.catch((err, ctx) => {
  addLog(`Bot error: ${err.message}`, "error");
  if (ctx) {
    ctx.reply(`❌ Error: ${err.message}`, REPLY_OPTS).catch(() => {});
  }
});

// ─── Запуск сервера ────────────────────────────────────────────────────────

const PORT = process.env.API_PORT || 3000;
const server = createServer(app);

// ─── WebSocket Server ──────────────────────────────────────────────────────

wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  if (pathname === "/ws") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  }
});

// Heartbeat — проверяем живые соединения каждые 30 секунд
setInterval(() => {
  wss.clients.forEach((client) => {
    if (client.isAlive === false) return client.terminate();
    client.isAlive = false;
    client.ping();
  });
}, 30000);

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });
});

server.listen(PORT, () => {
  addLog(`Server running on port ${PORT}`, "system");
});

export { app, bot, server };
