/**
 * Основной сервер приложения (Express + GrammY).
 */

import express from "express";
import cors from "cors";
import { createServer } from "http";
import path from "path";
import pkg from "grammy";
import { Bot, InlineKeyboard } from "grammy"; // ← InlineKeyboard вместо Keyboard
import dotenv from "dotenv";

dotenv.config();

const app = express();
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

let config = {
   serverUrl: process.env.SERVER_URL || "http://192.168.1.101:1234/v1",
   modelName: process.env.MODEL_NAME || "qwen3.5-2b",
   projectPath: path.resolve(process.env.PROJECT_PATH || "E:\\Git\\agent-panel"),
   systemPrompt: process.env.SYSTEM_PROMPT || "",
   apiKey: process.env.API_KEY || "agent-secret-key",
   maxTokens: parseInt(process.env.MAX_TOKENS) || 8192,
   temperature: parseFloat(process.env.TEMPERATURE) || 0.1,
   timeout: parseInt(process.env.TIMEOUT) || 120000,
 };

let botStatus = "idle";
let botStatusMessage = "";
let startTime = null;

let stats = { requests: 0, tools: 0, errors: 0 };

const agentLogs = [];
const chatHistories = new Map();

const pendingApprovals = new Map();

function addLog(message, type = "info") {
   const entry = { time: new Date().toISOString(), message, type };
   agentLogs.push(entry);
   if (agentLogs.length > 200) agentLogs.shift();
   if (type === "error") logError(message);
   else if (type === "warning" || type === "warn") logWarn(message);
   else logInfo(message);
 }

function updateStatus(newStatus, message = "") {
  botStatus = newStatus;
  botStatusMessage = message;
  if (newStatus === "running") startTime = Date.now();
  else startTime = null;
  addLog(
    `Status: ${message || newStatus}`,
    newStatus === "error" ? "error" : "info",
  );
}

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(requestLogger);

import {
  agentLoopStep,
  updateAgentConfig,
  buildSystemMessage,
} from "./lib/agent/agentLoop.js";
import {
  executeTool,
  getToolConfig,
  updateToolConfig,
  TOOLS,
  formatValue,
} from "./lib/agent/executeTool.js";
import { logInfo, logWarn, logError, requestLogger } from "./lib/logger.js";

function updateConfig(newConfig) {
  Object.assign(config, newConfig);
  updateAgentConfig(newConfig);
}

app.get("/api/tools", (req, res) => {
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

app.post("/api/tools", (req, res) => {
  const { name, ...settings } = req.body;
  if (!name) return res.status(400).json({ error: "Tool name required" });
  if (!TOOLS[name])
    return res.status(404).json({ error: `Tool '${name}' not found` });
  updateToolConfig(name, settings);
  res.json({ success: true, config: getToolConfig()[name] });
});

app.post("/api/agent/tool", async (req, res) => {
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

app.get("/api/config", (req, res) => {
  res.json({
    success: true,
    config: { ...config, token: process.env.TELEGRAM_BOT_TOKEN || "" },
  });
});

app.post("/api/config", (req, res) => {
  const body = req.body || {};
  if (body.serverUrl) config.serverUrl = body.serverUrl;
  if (body.modelName) config.modelName = body.modelName;
  if (body.projectPath) {
     config.projectPath = path.resolve(body.projectPath);
     addLog(`projectPath resolved to: ${config.projectPath}`, "info");
   }
  if (body.systemPrompt !== undefined) config.systemPrompt = body.systemPrompt;
  if (body.maxTokens) config.maxTokens = parseInt(body.maxTokens);
  if (body.temperature !== undefined)
    config.temperature = parseFloat(body.temperature);
  if (body.timeout) config.timeout = parseInt(body.timeout);
  if (body.token) process.env.TELEGRAM_BOT_TOKEN = body.token;
  updateConfig(config);
  addLog(`Config updated: ${config.modelName}`, "info");
  res.json({ success: true, config });
});

app.get("/api/models", async (req, res) => {
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

app.get("/api/status", (req, res) => {
  const uptimeMs = startTime ? Date.now() - startTime : 0;
  res.json({
    success: true,
    status: botStatus,
    statusMessage: botStatusMessage,
    isRunning: botStatus === "running",
    stats: {
      uptime: Math.floor(uptimeMs / 1000),
      requests: stats.requests,
      tools: stats.tools,
      errors: stats.errors,
    },
    uptime: Math.floor(uptimeMs / 1000),
  });
});

app.get("/api/logs", (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json({
    success: true,
    logs: agentLogs
      .slice(-limit)
      .map((l) => ({ ...l, time: new Date(l.time).toLocaleTimeString() })),
  });
});

app.post("/api/start", async (req, res) => {
  try {
    if (botStatus === "running")
      return res.json({ success: true, message: "Bot already running" });
    updateStatus("running", "Работает");
    bot.start();
    addLog("Telegram connected", "success");
    res.json({ success: true, message: "Starting..." });
  } catch (error) {
    updateStatus("error", "Ошибка Telegram");
    res.status(500).json({ error: "Failed to start: " + error.message });
  }
});

app.post("/api/stop", async (req, res) => {
  try {
    if (botStatus === "running") {
      await bot.stop();
      await new Promise((r) => setTimeout(r, 800)); // ждём завершения polling
    }
    chatHistories.clear();
    stats = { requests: 0, tools: 0, errors: 0 };
    pendingApprovals.clear();
    updateStatus("idle", "Отключен");
    addLog("Bot stopped", "warning");
    res.json({ success: true, message: "Bot stopped" });
  } catch (error) {
    res.status(500).json({ error: "Failed to stop: " + error.message });
  }
});

app.post("/api/restart", async (req, res) => {
  try {
    if (botStatus === "running") {
      await bot.stop();
      await new Promise((r) => setTimeout(r, 1000));
    }
bot.start();
     updateStatus("running", "Работает");
     addLog("Bot restarted", "success");
     res.json({ success: true });
  } catch (error) {
    updateStatus("error", "Ошибка Telegram");
    res.status(500).json({ error: "Failed to restart: " + error.message });
  }
});

app.post("/api/chat", async (req, res) => {
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
    res.json({ success: true, reply });
  } catch (error) {
    stats.errors++;
    addLog(`Chat error: ${error.message}`, "error");
    res.status(500).json({ error: error.message });
  }
});

const REPLY_OPTS = {
  parse_mode: "HTML",
  link_preview_options: { is_disabled: true },
};

// Telegram HTML поддерживает только: b, i, u, s, code, pre, tg-spoiler, a, strong, em.
// Экранирует все остальные теги для предотвращения 400-ошибок Telegram API.
function sanitizeTelegramHtml(text) {
  return text.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g, (match, slash, tag) => {
    const allowed = new Set([
      "b", "i", "u", "s", "code", "pre", "tg-spoiler", "a", "strong", "em",
    ]);
    if (allowed.has(tag.toLowerCase())) return match;
    // Для недопустимых тегов — экранируем угловые скобки
    return `&lt;${slash}${tag}${match.slice(1 + slash.length + tag.length, match.length - 1)}&gt;`;
  });
}

async function replyMsg(ctx, text, extra = {}) {
  try {
    const sent = await ctx.reply(sanitizeTelegramHtml(text), {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      ...extra,
    });
    return sent.message_id;
  } catch (e) {
    // Fallback: если Telegram не смог распарсить HTML — отправляем plain text
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
const KEYBOARD_YES_NO = (toolName) =>
  new InlineKeyboard()
    .text("✅ YES", `approve_${toolName}`)
    .text("❌ NO", `deny_${toolName}`);
const KEYBOARD_EMPTY = () => ({ inline_keyboard: [] });

async function sendDraft(ctx, text, extra = {}) {
  const sent = await ctx.reply(sanitizeTelegramHtml(text), { ...REPLY_OPTS, ...extra });
  return sent.message_id;
}

async function sendTyping(ctx) {
  try {
    await ctx.replyWithChatAction("typing");
  } catch (_) {}
}

async function editMsg(ctx, msgId, text, extra = {}) {
  try {
    await ctx.api.editMessageText(ctx.chat.id, msgId, sanitizeTelegramHtml(text), {
      ...REPLY_OPTS,
      ...extra,
    });
  } catch (e) {
    const ignore = [
      "message is not modified",
      "Bad Request: message to edit not found",
      "inline keyboard expected",
    ];
    if (!ignore.some((i) => e.message?.includes(i))) {
      console.error("Edit message error:", e.message);
    }
  }
}

async function sendOrEdit(ctx, msgId, text, extra = {}) {
  if (msgId !== null) {
    await editMsg(ctx, msgId, text, extra);
    return msgId;
  }
  const sent = await ctx.reply(sanitizeTelegramHtml(text), { ...REPLY_OPTS, ...extra });
  return sent.message_id;
}

async function clearButtons(ctx) {
  try {
    await ctx.api.editMessageReplyMarkup(
      ctx.chat.id,
      ctx.callbackQuery.message.message_id,
      { reply_markup: { inline_keyboard: [] } },
    );
  } catch (e) {
    const ignore = ["message to edit not found", "message is not modified"];
    if (!ignore.some((i) => e.message?.includes(i))) {
      console.error("Clear buttons error:", e.message);
    }
  }
}

bot.on("message", async (ctx) => {
  const message = ctx.message?.text || ctx.message?.caption;
  if (!message) {
    ctx.reply("Только текст.", REPLY_OPTS);
    return;
  }

  if (message === "✅ YES" || message === "❌ NO") {
    return;
  }
  if (message === "YES" || message === "NO") {
    return;
  }

  const chatId = ctx.chat.id.toString();
  addLog(
    `Message from ${ctx.chat.username || chatId}: ${message.substring(0, 50)}...`,
    "info",
  );
  addLog(
    `Pending approvals: ${[...pendingApprovals.keys()].join(", ") || "none"}`,
    "info",
  );
  stats.requests++;

  try {
    await sendTyping(ctx);
    const draft = await sendDraft(ctx, "⏳ Analyzing request...");

    let history = chatHistories.get(chatId) || [];
    let result = await agentLoopStep(message, chatId, history);
    addLog(
      `agentLoopStep: requiresApproval=${result.requiresApproval}, error=${!!result.error}, response=${result.response?.substring?.(0, 30)}`,
      "info",
    );

    if (result.requiresApproval) {
      pendingApprovals.set(chatId, {
        toolName: result.toolName,
        args: result.args,
        toolCallId: result.toolCallId, // ← ДОБАВИТЬ
        messages: result.messages,
      });
      chatHistories.set(chatId, result.messages.slice(-20));
      await replyMsg(
        ctx,
        `⚠️ Confirmation needed:\n\n📦 <b>${result.toolName}</b>\nParams: <code>${JSON.stringify(result.args)}</code>`,
        { reply_markup: KEYBOARD_YES_NO(result.toolName) },
      );
      return;
    }

    if (result.error) {
      // 🧹 Очищаем последние битые сообщения из истории
      const cleanHistory = (chatHistories.get(chatId) || []).filter(
        (m) =>
          !m.content?.includes("[TOOL APPROVAL REQUIRED]") && m.role !== "tool",
      );
      chatHistories.set(chatId, cleanHistory.slice(-10));

      await replyMsg(ctx, `❌ Error: ${result.error}`);
      return;
    }

    if (result.response !== undefined && result.response !== "continue") {
      if (result.messages)
        chatHistories.set(chatId, result.messages.slice(-20));
      const cleanResponse =
        result.response.replace(/\[TOOL APPROVAL REQUIRED\].*/gi, "").trim() ||
        result.response;
      await replyMsg(ctx, cleanResponse);
      return;
    }

    if (result.response === "continue" || result.messages) {
      history = result.messages || history;
      result = await agentLoopStep("", chatId, history);
      addLog(
        `agentLoopStep (retry): requiresApproval=${result.requiresApproval}`,
        "info",
      );
      if (result.requiresApproval) {
        pendingApprovals.set(chatId, {
          toolName: result.toolName,
          args: result.args,
          messages: result.messages,
        });
        chatHistories.set(chatId, result.messages.slice(-20));
        await replyMsg(
          ctx,
          `⚠️ Confirmation needed:\n\n📦 <b>${result.toolName}</b>\nParams: <code>${JSON.stringify(result.args)}</code>`,
          { reply_markup: KEYBOARD_YES_NO(result.toolName) },
        );
        return;
      }
      if (result.error) {
        // 🧹 Очищаем последние битые сообщения из истории
        const cleanHistory = (chatHistories.get(chatId) || []).filter(
          (m) =>
            !m.content?.includes("[TOOL APPROVAL REQUIRED]") &&
            m.role !== "tool",
        );
        chatHistories.set(chatId, cleanHistory.slice(-10));

        await replyMsg(ctx, `❌ Error: ${result.error}`);
        return;
      }
      if (result.response) {
        if (result.messages)
          chatHistories.set(chatId, result.messages.slice(-20));
        const cleanResponse =
          result.response
            .replace(/\[TOOL APPROVAL REQUIRED\].*/gi, "")
            .trim() || result.response;
        await replyMsg(ctx, cleanResponse);
        return;
      }
    }

    await replyMsg(ctx, "Iteration limit reached");
  } catch (error) {
    await replyMsg(ctx, `❌ Error: ${error.message}`);
    addLog(`Bot error: ${error.message}`, "error");
  }
});

async function continueAfterApproval(ctx, pending) {
  console.log("[continueAfterApproval] Called:", {
    toolName: pending.toolName,
    toolCallId: pending.toolCallId,
    args: pending.args,
  });

  stats.tools++;
  const chatId = ctx.chat.id.toString();

  try {
    // 1. Выполняем инструмент
    const result = await executeTool(
      { name: pending.toolName, args: pending.args },
      { projectPath: config.projectPath },
    );

    await ctx.answerCallbackQuery(result.success ? "Done!" : "Error");
    addLog(
      `Tool executed: ${pending.toolName} = ${result.success ? "OK" : "FAIL:" + result.error}`,
      result.success ? "success" : "error",
    );

    if (!result.success) {
      await replyMsg(
        ctx,
        `❌ <b>${pending.toolName}</b> failed: ${result.error}`,
      );
      return;
    }

// 2. Формируем сообщение с результатом для модели
    // Экранируем HTML-сущности в tool-контенте, чтобы результат инструмента
    // (например, содержимое файла с <details>/<summary>) не ломал Telegram
    const toolMessage = {
      role: "tool",
      content: JSON.stringify(result).replace(/</g, "&lt;").replace(/>/g, "&gt;"),
    };
    if (pending.toolCallId) {
      toolMessage.tool_call_id = pending.toolCallId;
    }

    // 3. Подготовка определения инструментов
    const toolsDef = Object.values(TOOLS)
      .filter((t) => getToolConfig()[t.name]?.enabled !== false)
      .map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      }));

    // 4. Отправляем результат модели
    const history = chatHistories.get(chatId) || pending.messages || [];

    const response = await fetch(config.serverUrl + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + config.apiKey,
      },
      body: JSON.stringify({
        model: config.modelName,
        messages: [...history, toolMessage],
        max_tokens: config.maxTokens ?? 4096,
        temperature: config.temperature ?? 0.1,
        tools: toolsDef,
        tool_choice: "auto",
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();

    // 🎯 ВАЖНО: объявляем nextMessage СРАЗУ после получения данных
    const nextMessage = data.choices?.[0]?.message;
    const finishReason = data.choices?.[0]?.finish_reason;

    // 📊 Лог для отладки
    console.log("[agent] Model response:", {
      finishReason,
      hasToolCalls: !!nextMessage?.tool_calls?.length,
      contentLen: nextMessage?.content?.length,
    });

    // 🛡️ Защита от пустых/обрезанных ответов
    if (
      !nextMessage ||
      (!nextMessage.content?.trim() && !nextMessage.tool_calls?.length)
    ) {
      const reason =
        finishReason === "length"
          ? "Лимит токенов (max_tokens)"
          : "Ответ модели обрезан или невалиден";
      addLog(
        `Model response empty/invalid. finish_reason: ${finishReason}`,
        "warning",
      );
      await replyMsg(
        ctx,
        `⚠️ ${reason}. Модель не сгенерировала полный вызов инструмента. Попробуйте разбить задачу или увеличить MAX_TOKENS.`,
      );
      return;
    }

    if (
      (!nextMessage.content || nextMessage.content.trim() === "") &&
      (!nextMessage.tool_calls || nextMessage.tool_calls.length === 0)
    ) {
      if (finishReason === "length") {
        await replyMsg(
          ctx,
          "⚠️ Response was truncated (token limit). Try splitting the task or reducing file size.",
        );
      } else {
        await replyMsg(
          ctx,
          "⚠️ Model failed to generate a valid response or tool call. Please try again.",
        );
      }
      addLog(
        `Model response empty/truncated. finish_reason: ${finishReason}`,
        "warning",
      );
      return;
    }

    // Сохраняем в историю
    const newHistory = [...history, toolMessage, nextMessage].slice(-20);
    chatHistories.set(chatId, newHistory);

    // Если модель вернула новый tool_call — обрабатываем
    if (nextMessage.tool_calls?.length > 0) {
      const tc = nextMessage.tool_calls[0];
      const tn = tc.function.name;
      let ta;
      try {
        ta = JSON.parse(tc.function.arguments);
      } catch {
        throw new Error("Invalid JSON in tool call");
      }

      const ts = getToolConfig()[tn] || {};
      if (ts.permission === "ask") {
        // Требуется подтверждение — сохраняем и показываем кнопки
        pendingApprovals.set(chatId, {
          toolName: tn,
          args: ta,
          toolCallId: tc.id,
          messages: newHistory,
        });
        // Транкейция параметров: Telegram имеет лимит на длину сообщения
        const paramStr = JSON.stringify(ta);
        const displayParams =
          paramStr.length > 300 ? paramStr.substring(0, 300) + "… [truncated]" : paramStr;
        await replyMsg(
          ctx,
          `⚠️ Confirmation needed:\n\n📦 <b>${tn}</b>\nParams: <code>${displayParams}</code>`,
          { reply_markup: KEYBOARD_YES_NO(tn) },
        );
        return;
      }

      // Авто-выполнение следующего инструмента (рекурсия)
      await continueAfterApproval(ctx, {
        toolName: tn,
        args: ta,
        toolCallId: tc.id,
        messages: newHistory,
      });
      return;
    }

    // Финальный текст от модели
    const finalText = nextMessage.content || "✅ Готово.";
    await replyMsg(ctx, finalText);
  } catch (error) {
    addLog(`continueAfterApproval error: ${error.message}`, "error");
    console.error("[continueAfterApproval] Full error:", error);
    await replyMsg(ctx, `❌ Error continuing: ${error.message}`);
  }
}

bot.on("callback_query", async (ctx) => {
  console.log(
    `[🔔 CALLBACK] data="${ctx.callbackQuery.data}", chat=${ctx.chat.id}`,
  );
  const callbackData = ctx.callbackQuery.data;
  const chatId = ctx.chat.id.toString();
  addLog(`Callback: ${callbackData} from ${chatId}`, "info");

  if (callbackData.startsWith("approve_")) {
    const toolName = callbackData.replace("approve_", "");
    const pending = pendingApprovals.get(chatId);

    if (!pending || pending.toolName !== toolName) {
      addLog(
        `Stale approve: tool=${toolName}, pending=${pending?.toolName || "none"}`,
        "warning",
      );
      await ctx.answerCallbackQuery("❌ Request not found or outdated");
      return;
    }

    addLog(
      `Executing: ${toolName} with args=${JSON.stringify(pending.args)}`,
      "success",
    );
    await clearButtons(ctx);
    pendingApprovals.delete(chatId);
    await sendTyping(ctx);
    await continueAfterApproval(ctx, pending);
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
          tool_call_id: pending.toolCallId, // ← добавить, если есть
          content: JSON.stringify({ success: false, error: "denied by user" }),
        },
      ];
      deniedMessages.push({ role: "assistant", content: "" });
      chatHistories.set(chatId, deniedMessages.slice(-20));
    }

    await replyMsg(
      ctx,
      `❌ <b>${toolName}</b> cancelled. The tool was not executed.`,
    );
  }
});

bot.command("start", (ctx) => {
  updateStatus("running", "Работает");
  ctx.reply("🤖 AI Agent active!\nModel: " + config.modelName, REPLY_OPTS);
});

bot.command("help", (ctx) => {
  ctx.reply(
    "Commands:\n/start - Start\n/help - Help\n/model - Current model\n/clear - Clear history\n/tools - Tool list",
    REPLY_OPTS,
  );
});

bot.command("model", (ctx) => {
  ctx.reply(
    `Model: ${config.modelName}\nServer: ${config.serverUrl}`,
    REPLY_OPTS,
  );
});

bot.command("clear", (ctx) => {
  chatHistories.delete(ctx.chat.id.toString());
  ctx.reply("🗑️ History cleared!", REPLY_OPTS);
});

bot.command("tools", (ctx) => {
  const toolList = Object.entries(TOOLS)
    .map(([name, tool]) => `• <b>${name}</b>: ${tool.description}`)
    .join("\n");
  ctx.reply(`📦 Available tools:\n\n${toolList}`, {
    ...REPLY_OPTS,
    parse_mode: "HTML",
  });
});

bot.catch((err, ctx) => {
  addLog(`Bot error: ${err.message}`, "error");
  if (ctx) {
    ctx.reply(`❌ Error: ${err.message}`, REPLY_OPTS).catch(() => {});
  }
});

const PORT = process.env.API_PORT || 3000;
const server = createServer(app);

server.listen(PORT, () => {
  addLog(`Server running on port ${PORT}`, "system");
});

export { app, bot, server };
