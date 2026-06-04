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
import path from "path";
import os from "os";
import crypto from "node:crypto";
import { Bot, InlineKeyboard } from "grammy";
import { stream } from "@grammyjs/stream";
import { autoRetry } from "@grammyjs/auto-retry";
import dotenv from "dotenv";
import { configDefaults } from "./lib/configDefaults.js";
import { transcribeViaAsrServer as transcribeAsr } from "./lib/asrClient.js";

dotenv.config();

// ─── Инициализация Express и Telegram бота ─────────────────────────────────

const app = express();

/**
 * Экземпляр Telegram Bot (GrammY). Может быть null до первого запуска или сброса.
 * Создаётся через initBot(token). Заменяется при смене токена через API.
 * @type {Bot|null}
 */
let bot = null;

/**
 * Найти ffmpeg в системном PATH или стандартных путях.
 * @returns {string|null} Путь к ffmpeg или null
 */
async function findFfmpeg() {
  // 1. Переменная среды FFMPEG_PATH (приоритет)
  const envPath = process.env.FFMPEG_PATH;
  if (envPath && fs.existsSync(envPath)) {
    return envPath;
  }
  // 2. Поиск в PATH
  const { execSync } = await import("node:child_process");
  const isWin = os.platform() === "win32";
  try {
    const cmd = isWin ? "where ffmpeg" : "which ffmpeg";
    const result = execSync(cmd, { encoding: "utf-8", timeout: 5000, stdio: "pipe" });
    return result.trim().split("\n")[0].trim();
  } catch {
    return null;
  }
}

/**
 * Безопасно удалить временные файлы.
 * @param  {...string} files
 */
function cleanupTmp(...files) {
  for (const f of files) {
    try { if (f && fs.existsSync(f)) fs.unlinkSync(f); } catch {}
  }
}

/**
 * Санитизировать ошибку для отправки пользователю.
 * Никогда не отдаёт полный текст ошибки в Telegram (м.б. пути, токены, стек).
 * Деталь всегда пишется в addLog с category "error".
 *
 * @param {Error|string|unknown} e - Исходная ошибка
 * @param {string} userHint - Короткое, безопасное сообщение для пользователя (RU/EN, ≤120 chars)
 * @returns {string} Текст для отправки в Telegram
 */
function safeErrorMessage(e, userHint) {
  const detail = String(e?.message || e || "unknown").slice(0, 200);
  addLog(`safeErrorMessage detail: ${detail}`, "error");
  return userHint;
}

/**
 * Отправить длинное сообщение в Telegram с автоматической разбивкой на чанки ≤ MAX_LEN.
 * Telegram лимит: 4096 символов на сообщение. Использует существующий `chunkText` (мягкая
 * разбивка по границе слова). Если текст короче лимита — отправляется одним сообщением.
 *
 * @param {Object} ctx - GrammY контекст
 * @param {string} text - Полный текст
 * @param {Object} [extra] - Доп. опции (например, reply_markup)
 * @returns {Promise<number[]>} Массив message_id отправленных сообщений
 */
async function sendLongMessage(ctx, text, extra = {}) {
  const MAX_LEN = 4096;
  const ids = [];
  if (!text) return ids;
  if (text.length <= MAX_LEN) {
    const sent = await replyMsg(ctx, text, extra);
    if (sent?.message_id) ids.push(sent.message_id);
    return ids;
  }
  for await (const chunk of chunkText(text)) {
    if (!chunk) continue;
    let part = chunk;
    if (part.length > MAX_LEN) {
      part = part.substring(0, MAX_LEN);
    }
    const sent = await replyMsg(ctx, part, extra);
    if (sent?.message_id) ids.push(sent.message_id);
  }
  return ids;
}

/**
 * Фабрика создания GrammY Bot с полным набором хендлеров.
 * Создаёт экземпляр Bot, подключает middleware (autoRetry, stream), account check,
 * команды (/start, /help, /model, /clear, /tools, /tasks, /cancel, /mode),
 * обработчик сообщений (agent loop) и callback query handler (approve/deny).
 * @param {string} token - Telegram Bot API токен
 * @returns {Bot|null} Экземпляр GrammY Bot с хендлерами или null если token пустой
 */
function initBot(token) {
  if (!token) return null;
  const b = new Bot(token);
  b.api.config.use(autoRetry());
  b.use(stream());
  b.use(async (ctx, next) => {
    const username = ctx.chat?.username;
    const account = getAccountByUsername(username);
    if (!account) {
      await replyMsg(
        ctx,
        `❌ <b>Access denied</b>\n\nYour account (@${username || "unknown"}) is not registered.\nContact the administrator to get access.`
      );
      return;
    }
    ctx.account = account;
    await next();
  });

  // ─── Telegram Commands ─────────────────────────────────────────────────
  b.command("start", (ctx) => {
    if (config.modelName === "Имя модели") {
      ctx.reply("⚠️ Модель не выбрана. Настройте модель в веб-интерфейсе.", REPLY_OPTS);
      return;
    }
    updateStatus("running", "Работает");
    const asrInfo = config.asrServerUrl ? `🎤 ASR: ${config.asrServerUrl} (${config.asrLanguage || "ru"})` : "🎤 ASR: local whisper";
    ctx.reply(
      `🤖 <b>AI Agent active!</b>\n\n` +
        `Model: <code>${config.modelName}</code>\n` +
        `Server: <code>${config.serverUrl}</code>\n` +
        `${asrInfo}\n` +
        `Mode: <b>${config.chatMode ? "chat" : "project"}</b>\n\n` +
        `Type /help for commands.`,
      REPLY_OPTS
    );
  });

  b.command("help", (ctx) => {
    ctx.reply(
      `📖 <b>Commands</b>\n\n` +
        `/start — Welcome + current config\n` +
        `/status — Bot state, model, tokens, tools\n` +
        `/help — This message\n` +
        `/model — Current model + server\n` +
        `/tools — Tools available for you\n` +
        `/tasks — Active background tasks\n` +
        `/reset — Clear conversation history\n` +
        `/cancel — Cancel current request\n` +
        `/mode chat|project — Switch context mode\n\n` +
        `💬 Text and 🎤 voice messages are both supported.`,
      REPLY_OPTS
    );
  });

  b.command("status", (ctx) => {
    const uptime = stats.startTime ? Math.floor((Date.now() - stats.startTime) / 1000) : 0;
    const hh = Math.floor(uptime / 3600);
    const mm = Math.floor((uptime % 3600) / 60);
    const ss = uptime % 60;
    const uptimeStr = `${hh}h ${mm}m ${ss}s`;
    const totalTools = Object.keys(TOOLS).length;
    ctx.reply(
      `🤖 <b>Agent Panel — Status</b>\n\n` +
        `Bot: ${config.botStatus || "idle"}\n` +
        `Model: <code>${config.modelName}</code>\n` +
        `Mode: <b>${config.chatMode ? "chat" : "project"}</b>\n` +
        `ASR: ${config.asrServerUrl ? `<code>${config.asrServerUrl}</code>` : "local whisper"}\n` +
        `Tools: ${totalTools} available\n` +
        `Stats: ${stats.requests} requests, ${stats.tools} tool calls, ${stats.errors} errors\n` +
        `Tokens: ${tokenUsage.total} total (${tokenUsage.prompt} prompt, ${tokenUsage.completion} completion)\n` +
        `Uptime: ${uptimeStr}`,
      REPLY_OPTS
    );
  });

  b.command("model", (ctx) => {
    ctx.reply(
      `Model: <code>${config.modelName}</code>\nServer: <code>${config.serverUrl}</code>\nASR: <code>${config.asrServerUrl || "local whisper"}</code>`,
      REPLY_OPTS
    );
  });

  b.command("clear", (ctx) => {
    chatHistories.delete(ctx.chat.id.toString());
    ctx.reply("🗑️ History cleared!", REPLY_OPTS);
  });

  b.command("reset", (ctx) => {
    const chatId = ctx.chat.id.toString();
    const had = chatHistories.has(chatId);
    chatHistories.delete(chatId);
    const controller = activeAgentControllers.get(chatId);
    if (controller && !controller.signal.aborted) {
      controller.abort();
      activeAgentControllers.delete(chatId);
    }
    const pending = pendingApprovals.get(chatId);
    if (pending) pendingApprovals.delete(chatId);
    if (!had) {
      ctx.reply("ℹ️ Nothing to reset — history was already empty.", REPLY_OPTS);
    } else {
      ctx.reply("✅ <b>Reset complete.</b>\n• History cleared\n• Active request cancelled\n• Pending approval removed", REPLY_OPTS);
    }
  });

  b.command("tools", async (ctx) => {
    const account = ctx.account;
    const toolList = Object.entries(TOOLS)
      .map(([name, tool]) => {
        const enabled = account.permissions?.[name] !== false;
        const icon = enabled ? "✅" : "❌";
        return `${icon} <b>${name}</b>: ${tool.description}`;
      })
      .join("\n");
    ctx.reply(`📦 Tools for @${ctx.chat.username} (${account.role}):\n\n${toolList}`, REPLY_OPTS);
  });

  b.command("tasks", (ctx) => {
    const tasks = getActiveTasks();
    if (tasks.length === 0) {
      ctx.reply("No active tasks.", REPLY_OPTS);
      return;
    }
    const lines = tasks.map((t) => {
      const uptime = Math.floor(t.uptime / 1000);
      return `• <code>${t.taskId.substring(0, 8)}</code> <b>${t.command}</b> (${uptime}s)`;
    });
    ctx.reply(`⏳ Active tasks:\n${lines.join("\n")}`, REPLY_OPTS);
  });

  b.command("cancel", async (ctx) => {
    const chatId = ctx.chat.id.toString();
    const text = ctx.message?.text || "";
    const parts = text.trim().split(/\s+/);
    const taskIdArg = parts[1];

    // Если есть активный agent loop для этого чата — отменяем его
    const agentController = activeAgentControllers.get(chatId);
    if (agentController && !agentController.signal.aborted) {
      agentController.abort();
      // Identity check: удаляем только если это всё ещё тот же контроллер
      if (activeAgentControllers.get(chatId) === agentController) {
        activeAgentControllers.delete(chatId);
      }
      // Также убиваем активные subprocess-таски (если они есть)
      const tasks = getActiveTasks();
      const killed = tasks.filter((t) => cancelTask(t.taskId));
      const tail = killed.length > 0 ? `\nKilled ${killed.length} subprocess task(s).` : "";
      await replyMsg(ctx, `❌ Cancelled.${tail}`);
      return;
    }

    // Отменяем ожидающее подтверждение инструмента
    const pending = pendingApprovals.get(chatId);
    if (pending) {
      pendingApprovals.delete(chatId);
      await replyMsg(ctx, `❌ Cancelled pending approval for ${pending.toolName}.`);
      return;
    }

    // Если передан taskId — отменяем execute-таск (старое поведение)
    if (taskIdArg) {
      const tasks = getActiveTasks();
      const match = tasks.find((t) => t.taskId.startsWith(taskIdArg));
      if (!match) {
        await replyMsg(ctx, `❌ Task not found: ${taskIdArg}`);
        return;
      }
      if (cancelTask(match.taskId)) {
        await replyMsg(ctx, `❌ Cancelled task <code>${match.taskId.substring(0, 8)}</code>`);
      } else {
        await replyMsg(ctx, `⚠️ Task ${taskIdArg} is no longer running.`);
      }
      return;
    }

    // Нет ни активного agent loop, ни taskId
    await replyMsg(ctx, "No active request to cancel.");
  });

  b.command("mode", (ctx) => {
    const text = ctx.message?.text || "";
    const parts = text.trim().split(/\s+/);
    const mode = parts[1];
    if (mode === "chat") {
      config.chatMode = true;
      ctx.reply("✅ Chat mode enabled. No project context.", REPLY_OPTS);
    } else if (mode === "project") {
      config.chatMode = false;
      ctx.reply("✅ Project mode enabled.", REPLY_OPTS);
    } else {
      ctx.reply(
        `Current mode: <b>${config.chatMode ? "chat" : "project"}</b>\n\nUsage: /mode chat | /mode project`,
        REPLY_OPTS
      );
    }
  });

  // ─── Voice Message Handler ─────────────────────────────────────────────
  b.on("message:voice", async (ctx) => {
    const voice = ctx.message?.voice;
    if (!voice) return;

    if (!config.projectPath) {
      await replyMsg(ctx, "⚠️ <b>Project path not configured</b>\n\nAsk the admin to set it in Settings or PROJECT_PATH in .env");
      return;
    }

    // Жёсткий лимит: Telegram voice ≤ 30 мин, но 5 мин — разумный предел (≈50 МБ OGG → 1.7 МБ/мин WAV).
    const MAX_VOICE_DURATION = 300; // секунд
    if (voice.duration && voice.duration > MAX_VOICE_DURATION) {
      const got = Math.floor(voice.duration / 60);
      const sec = voice.duration % 60;
      await replyMsg(
        ctx,
        `⏱ <b>Voice too long</b>\n\nGot: ${got}m ${sec}s\nMax: ${MAX_VOICE_DURATION / 60} min\n\nPlease send a shorter clip.`,
        REPLY_OPTS
      );
      return;
    }
    if (voice.file_size && voice.file_size > 25 * 1024 * 1024) {
      await replyMsg(ctx, "⏱ Файл слишком большой (макс. 25 МБ). Отправьте более короткое сообщение.", REPLY_OPTS);
      return;
    }
    if (voice.mime_type && voice.mime_type !== "audio/ogg") {
      await replyMsg(ctx, "⚠️ Поддерживается только OGG формат. Отправьте как голосовое сообщение Telegram.", REPLY_OPTS);
      return;
    }

    const account = ctx.account;
    const chatId = ctx.chat.id.toString();
    if (!recordAndCheckRateLimit(chatId)) {
      await replyMsg(ctx, "⏳ Too many requests. Please wait and try again.");
      return;
    }

    addLog(`Voice message from ${ctx.chat.username || chatId}`, "info");
    stats.requests++;
    wsBroadcast("stats", { requests: stats.requests, tools: stats.tools, errors: stats.errors });

    await sendTyping(ctx);
    const draftMsgId = await sendDraft(ctx, "🎤 Распознавание речи...");

    // Уникальные ID для tmp файлов (защита от race conditions при concurrent messages)
    const fileId = `${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const tmpDir = os.tmpdir();
    const oggPath = path.join(tmpDir, `voice_${fileId}.ogg`);
    const wavPath = path.join(tmpDir, `voice_${fileId}.wav`);

    try {
      // 1. Download voice file from Telegram
      const fileInfo = await ctx.api.getFile(voice.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${fileInfo.file_path}`;
      const resp = await fetch(fileUrl);
      if (!resp.ok) throw new Error(`Failed to download voice: ${resp.status}`);

      const arrayBuf = await resp.arrayBuffer();
      await fs.promises.writeFile(oggPath, Buffer.from(arrayBuf));

      // 2. Convert OGG → WAV 16kHz mono via ffmpeg (async, no shell)
      const ffmpegPath = await findFfmpeg();
      if (!ffmpegPath) {
        await editDraftMessage(ctx, draftMsgId, "❌ ffmpeg не найден. Установите ffmpeg для обработки голосовых.");
        return;
      }

      const { execFile } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const execFileAsync = promisify(execFile);

      // Typing indicator — обновляется каждые 4с, пока ffmpeg + whisper работают.
      // Telegram "typing…" badge пропадает через 5с, поэтому interval < 5с.
      // .unref() — таймер не блокирует выход процесса. try/finally гарантирует очистку.
      const typingTimer = setInterval(() => {
        sendTyping(ctx).catch(() => {});
      }, 4000);
      typingTimer.unref();
      let transcript = "";

      try {
        try {
          await execFileAsync(
            ffmpegPath,
            ["-y", "-i", oggPath, "-ar", "16000", "-ac", "1", "-f", "wav", wavPath],
            { timeout: 15000, windowsHide: true }
          );
        } catch (_e) {
          await editDraftMessage(ctx, draftMsgId, "❌ Ошибка конвертации аудио.");
          return;
        }

        // 3. Transcribe with Whisper
        await editDraftMessage(ctx, draftMsgId, "🎤 Распознавание...");
        try {
          if (config.asrServerUrl) {
            // Remote ASR server (whisper.cpp / faster-whisper)
            transcript = await transcribeAsr({
              wavPath,
              asrServerUrl: config.asrServerUrl,
              language: config.asrLanguage,
            });
          } else {
            // Local whisper-cpp-node fallback
            const { transcribeFile } = await import("./lib/whisper.js");
            transcript = await transcribeFile(wavPath, "large-v3-turbo", config.asrLanguage);
          }
        } catch (e) {
          addLog(`Whisper error: ${e.message}`, "error");
          // Не показываем полный текст ошибки (м.б. пути/токены) — generic сообщение
          const safeMsg = String(e.message || "unknown").slice(0, 100);
          await editDraftMessage(ctx, draftMsgId, `❌ Ошибка распознавания. Попробуйте ещё раз или укоротите сообщение.`);
          addLog(`Whisper error detail: ${safeMsg}`, "error");
          return;
        }

        if (!transcript || transcript.trim().length === 0) {
          await editDraftMessage(ctx, draftMsgId, "🎤 Речь не распознана. Попробуйте ещё раз.");
          return;
        }
      } finally {
        clearInterval(typingTimer);
      }

      addLog(`Voice transcript: ${transcript.substring(0, 100)}`, "info");

      // 4. Process through agent loop (same as text message)
      await editDraftMessage(ctx, draftMsgId, `🎤 "${transcript}"\n\n⏳ Analyzing request...`);

      const history = chatHistories.get(chatId) || [];
      let accumulatedContent = "";
      let lastEditTime = 0;
      const MIN_EDIT_INTERVAL = 1000;

      const prevController = activeAgentControllers.get(chatId);
      if (prevController && !prevController.signal.aborted) prevController.abort();

      const safeCleanup = (ctrl) => {
        if (activeAgentControllers.get(chatId) === ctrl) {
          activeAgentControllers.delete(chatId);
        }
      };

      const abortController = new AbortController();
      activeAgentControllers.set(chatId, abortController);

      agentLoopStep(transcript, chatId, history, config, MAX_AGENT_ITERATIONS, account, async (progress) => {
        try {
          if (progress.type === "reasoning") {
            const now = Date.now();
            if (now - lastEditTime >= MIN_EDIT_INTERVAL) {
              lastEditTime = now;
              const snippet = progress.accumulated.length > 200
                ? progress.accumulated.substring(0, 200) + "..."
                : progress.accumulated;
              await editDraftMessage(ctx, draftMsgId, `💭 ${snippet}`);
            }
          } else if (progress.type === "reasoning_done") {
            await editDraftMessage(ctx, draftMsgId, "💭 Reasoning complete");
          } else if (progress.type === "content") {
            accumulatedContent = progress.accumulated;
            const now = Date.now();
            if (now - lastEditTime >= MIN_EDIT_INTERVAL && accumulatedContent.length > 0) {
              lastEditTime = now;
              const display = accumulatedContent.length > 300
                ? accumulatedContent.substring(0, 300) + "..."
                : accumulatedContent;
              await editDraftMessage(ctx, draftMsgId, `💬 ${display}`);
            }
          } else if (progress.type === "tool_start") {
            await editDraftMessage(ctx, draftMsgId, `🔧 ${progress.toolName}...`);
          } else if (progress.type === "tool_complete") {
            await editDraftMessage(ctx, draftMsgId, `✅ ${progress.toolName} done`);
          } else if (progress.type === "needs_approval") {
            await replyMsg(
              ctx,
              `⚠️ Tool <b>${progress.toolName}</b> needs approval:\n<pre>${JSON.stringify(progress.args, null, 2)}</pre>`,
              { ...REPLY_OPTS, reply_markup: KEYBOARD_YES_NO(progress.toolName) }
            );
          }
        } catch (e) {
          addLog(`Voice progress callback error: ${e.message}`, "error");
        }
      }, abortController.signal).then((result) => {
        safeCleanup(abortController);

        if (result.tokenUsage) {
          tokenUsage.prompt += result.tokenUsage.prompt || 0;
          tokenUsage.completion += result.tokenUsage.completion || 0;
          tokenUsage.total += result.tokenUsage.total || 0;
          tokenUsage.cached += result.tokenUsage.cached || 0;
          if (result.timings?.tokens_cached) tokenUsage.tokensCached = result.timings.tokens_cached;
          wsBroadcast("tokenUsage", { ...tokenUsage });
        }
        if (result.timings) {
          wsBroadcast("perfStats", buildPerfStats(result.timings));
        }

        if (result.cancelled) {
          addLog("Voice agent loop cancelled by user", "warning");
          return;
        }

        addLog(
          `agentLoopStep (voice): requiresApproval=${result.requiresApproval}, error=${!!result.error}, response=${result.response?.substring?.(0, 30)}`,
          "info"
        );

        handleAgentResult(ctx, chatId, result, account, draftMsgId, abortController.signal).catch((err) => {
          addLog(`Voice handleAgentResult error: ${err.message}`, "error");
        });
      }).catch((e) => {
        safeCleanup(abortController);
        if (e.name === "AbortError") return;
        addLog(`Voice agent loop error: ${e.message}`, "error");
        if (typeof draftMsgId === "number") ctx.api.deleteMessage(ctx.chat.id, draftMsgId).catch(() => {});
        replyMsg(ctx, safeErrorMessage(e, "❌ Ошибка при обработке запроса. Попробуйте позже.")).catch(() => {});
      });

    } catch (e) {
      addLog(`Voice message handler error: ${e.message}`, "error");
      try { await editDraftMessage(ctx, draftMsgId, "❌ Ошибка обработки голосового сообщения."); } catch {}
      try { await replyMsg(ctx, safeErrorMessage(e, "❌ Не удалось обработать голосовое сообщение.")); } catch {}
    } finally {
      // Гарантированная очистка tmp файлов на ВСЕХ путях
      cleanupTmp(oggPath, wavPath);
    }
  });

  // ─── Message Handler ───────────────────────────────────────────────────
  b.on("message", async (ctx) => {
    const message = ctx.message?.text || ctx.message?.caption;
    if (!message) {
      ctx.reply("Только текст.", REPLY_OPTS);
      return;
    }

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

    const account = ctx.account;
    const chatId = ctx.chat.id.toString();
    if (!recordAndCheckRateLimit(chatId)) {
      await replyMsg(ctx, "⏳ Too many requests. Please wait and try again.");
      return;
    }
    addLog(`Message from ${ctx.chat.username || chatId}: ${message.substring(0, 50)}...`, "info");
    stats.requests++;
    wsBroadcast("stats", { requests: stats.requests, tools: stats.tools, errors: stats.errors });

    let draftMsgId;
    let safeCleanup;
    let abortController;
    try {
      await sendTyping(ctx);
      draftMsgId = await sendDraft(ctx, "⏳ Analyzing request...");

      const history = chatHistories.get(chatId) || [];
      let accumulatedContent = "";
      let lastEditTime = 0;
      const MIN_EDIT_INTERVAL = 1000;

      // Если был предыдущий активный запрос для этого чата — отменяем его
      const prevController = activeAgentControllers.get(chatId);
      if (prevController && !prevController.signal.aborted) prevController.abort();

      // Функция безопасного удаления контроллера из мапы (должна быть объявлена до set)
      safeCleanup = (ctrl) => {
        if (activeAgentControllers.get(chatId) === ctrl) {
          activeAgentControllers.delete(chatId);
        }
      };

      // Регистрируем AbortController для /cancel
      abortController = new AbortController();
      activeAgentControllers.set(chatId, abortController);

      // НЕ await — запускаем в фоне, чтобы GrammY мог обработать /cancel
      agentLoopStep(message, chatId, history, config, MAX_AGENT_ITERATIONS, account, async (progress) => {
        try {
          if (progress.type === "reasoning") {
            const now = Date.now();
            if (now - lastEditTime >= MIN_EDIT_INTERVAL) {
              lastEditTime = now;
              const snippet = progress.accumulated.length > 200
                ? progress.accumulated.substring(0, 200) + "..."
                : progress.accumulated;
              await editDraftMessage(ctx, draftMsgId, `💭 ${snippet}`);
            }
          } else if (progress.type === "reasoning_done") {
            await editDraftMessage(ctx, draftMsgId, "💭 Reasoning complete");
          } else if (progress.type === "content") {
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
        } catch (e) {
          addLog(`Progress update error: ${e.message}`, "error");
        }
      }, abortController.signal)
        .then((result) => {
          safeCleanup(abortController);
          if (result.tokenUsage) {
            tokenUsage.prompt += result.tokenUsage.prompt || 0;
            tokenUsage.completion += result.tokenUsage.completion || 0;
            tokenUsage.total += result.tokenUsage.total || 0;
            tokenUsage.cached += result.tokenUsage.cached || 0;
            if (result.timings?.tokens_cached) tokenUsage.tokensCached = result.timings.tokens_cached;
            wsBroadcast("tokenUsage", { ...tokenUsage });
          }
          if (result.timings) {
            wsBroadcast("perfStats", buildPerfStats(result.timings));
          }
          // Если отменено через /cancel — не шлём ответ (cancel handler уже ответил)
          if (result.cancelled) {
            addLog("Agent loop cancelled by user", "warning");
            return;
          }
          addLog(
            `agentLoopStep: requiresApproval=${result.requiresApproval}, error=${!!result.error}, response=${result.response?.substring?.(0, 30)}`,
            "info"
          );
          handleAgentResult(ctx, chatId, result, account, draftMsgId, abortController.signal).catch((err) => {
            addLog(`handleAgentResult error: ${err.message}`, "error");
          });
        })
        .catch((error) => {
          safeCleanup(abortController);
          addLog(`Bot error: ${error.message}`, "error");
          if (typeof draftMsgId === "number") ctx.api.deleteMessage(ctx.chat.id, draftMsgId).catch(() => {});
          replyMsg(ctx, safeErrorMessage(error, "❌ Ошибка при обработке запроса. Попробуйте позже.")).catch(() => {});
        });

      // Возвращаемся — GrammY может обработать следующий апдейт (например, /cancel)
    } catch (error) {
      if (typeof draftMsgId === "number") ctx.api.deleteMessage(ctx.chat.id, draftMsgId).catch(() => {});
      safeCleanup?.(abortController);
      await replyMsg(ctx, safeErrorMessage(error, "❌ Ошибка при обработке сообщения."));
      addLog(`Bot error: ${error.message}`, "error");
    }
  });

  // ─── Callback Handler ──────────────────────────────────────────────────
  b.on("callback_query", async (ctx) => {
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

      // Регистрируем AbortController, чтобы /cancel мог прервать продолжение
      const prevController = activeAgentControllers.get(chatId);
      if (prevController && !prevController.signal.aborted) prevController.abort();
      const approvalAbortController = new AbortController();
      activeAgentControllers.set(chatId, approvalAbortController);

      continueAfterApproval(ctx, pending, 0, approvalAbortController.signal)
        .catch((err) => {
          addLog(`continueAfterApproval (async) error: ${err.message}`, "error");
        })
        .finally(() => {
          if (activeAgentControllers.get(chatId) === approvalAbortController) {
            activeAgentControllers.delete(chatId);
          }
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
        chatHistories.set(chatId, deniedMessages.filter((m) => m.role !== "system").slice(-(config.maxHistoryPairs * 2)));
      }

      await replyMsg(ctx, `❌ <b>${toolName}</b> cancelled. The tool was not executed.`);
    }
  });

  b.catch((err, ctx) => {
    addLog(`Bot error: ${err.message}`, "error");
    if (ctx) {
      ctx.reply(safeErrorMessage(err, "❌ Внутренняя ошибка бота."), REPLY_OPTS).catch(() => {});
    }
  });

  return b;
}

const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
if (telegramToken) {
  bot = initBot(telegramToken);
} else {
  console.warn("[server] TELEGRAM_BOT_TOKEN not set — use web panel to configure");
}

// ─── Состояние приложения ──────────────────────────────────────────────────

/**
 * Конфигурация приложения. Обновляется через API /api/config.
 * Все дефолтные значения — в lib/configDefaults.js.
 * .env используется только для TELEGRAM_BOT_TOKEN, API_KEY и OPENROUTER_API_KEY.
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
 * @property {number} maxSearchFileSize - Макс. размер файла для поиска (байт)
 * @property {boolean} stream - Потоковый вывод SSE
 * @property {boolean} insertUserAfterTool - Вставлять "Continue" после tool-сообщений
 * @property {boolean} chatMode - Режим простого чата без проектного контекста
 * @property {string} openrouterApiKey - API ключ OpenRouter (из .env или UI)
 * @property {string} telegramToken - Telegram Bot токен (из .env или UI)
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
  maxSearchFileSize: configDefaults.maxSearchFileSize,
  stream: configDefaults.stream,
  insertUserAfterTool: configDefaults.insertUserAfterTool,
  openrouterApiKey: process.env.OPENROUTER_API_KEY || configDefaults.openrouterApiKey,
  asrServerUrl: process.env.ASR_SERVER_URL || configDefaults.asrServerUrl,
  asrLanguage: configDefaults.asrLanguage,
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || "",
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

const APPROVAL_TTL = 10 * 60 * 1000; // 10 minutes

// Periodic cleanup: remove stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [chatId, entry] of rateLimitMap) {
    if (now - entry.windowStart > RATE_WINDOW * 2) {
      rateLimitMap.delete(chatId);
    }
  }
  for (const [chatId, entry] of pendingApprovals) {
    if (now - entry.createdAt > APPROVAL_TTL) {
      pendingApprovals.delete(chatId);
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

/** @type {Map<string, AbortController>} — реестр agent loop запросов для Telegram /cancel */
const activeAgentControllers = new Map();

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

import { agentLoopStep, MAX_AGENT_ITERATIONS } from "./lib/agent/agentLoop.js";

import { executeTool, waitForTask, cancelTask, getActiveTasks, getToolConfig, TOOLS } from "./lib/agent/executeTool.js";

import { loadAccounts, getAccounts, getAccountByUsername } from "./lib/accounts.js";
import { logInfo, logWarn, logError, requestLogger } from "./lib/logger.js";
import { createApiRouter } from "./routes/api.js";

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
  get bot() { return bot; },
  set bot(v) { bot = v; },
  initBot,
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
 * Telegram поддерживает только ограниченный набор тегов:
 * b, i, u, s, code, pre, tg-spoiler, a, strong, em.
 * Остальные теги (включая произвольные, script, style и т.д.) заменяются
 * на HTML-сущности (&lt;tag&gt;), что предотвращает ошибку
 * "can't parse entities" от Telegram API.
 *
 * Использует регулярное выражение для обнаружения любых HTML-подобных тегов
 * и сверяет имя тега (регистронезависимо) со списком разрешённых.
 *
 * @param {string} text - Исходный текст, который может содержать HTML-теги
 * @returns {string} Текст, где неразрешённые теги экранированы в HTML-сущности
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
 *
 * Сначала пытается отправить HTML-сообщение через `ctx.reply()`.
 * Если Telegram возвращает ошибку "can't parse entities" или "Bad Request"
 * (невалидный HTML), удаляет все HTML-теги и отправляет обычный текст.
 * Все ошибки перехватываются и логируются в консоль — метод никогда
 * не выбрасывает исключений наружу.
 *
 * @param {Object} ctx - GrammY контекст (содержит chat, api и методы reply)
 * @param {string} text - Текст сообщения (может содержать HTML-теги)
 * @param {Object} extra - Дополнительные опции Telegram (reply_markup и т.д.)
 * @returns {Promise<number|null>} ID отправленного сообщения или null при ошибке
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
 * Генерирует части длиной от 80 до 150 символов, стараясь не разрывать слова
 * (разделяет по границе последнего пробела перед лимитом).
 *
 * Поведение:
 * - Если остаток текста ≤ 150 символов — отдаёт его целиком и завершает итерацию.
 * - Если граница слова найдена на расстоянии > 80 символов от начала — режет по ней.
 * - Если граница слова не найдена — режет ровно на 150 символов.
 * - Разделитель (пробел) не включается в следующий чанк (start = end + 1).
 *
 * @param {string} text - Исходный текст для разбиения
 * @returns {AsyncGenerator<string>} Асинхронный генератор чанков текста
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

// ─── Telegram Commands (registered inside initBot) ────────────────────────

// ─── Обработка сообщений от пользователей ───────────────────────────────────

/**
 * Обработать входящее сообщение от пользователя Telegram.
 * Маршрутизирует через agent loop и обрабатывает результат.
 * @param {Object} ctx - GrammY контекст сообщения
 * @returns {Promise<void>}
 */
// Handler registered inside initBot()

/**
 * Отправить черновик сообщения (используется для индикации прогресса).
 * Применяет санитизацию HTML через `sanitizeTelegramHtml()` и стандартные
 * опции `REPLY_OPTS` (HTML parse mode + отключённый превью ссылок).
 *
 * Внимание: в отличие от `replyMsg()`, этот метод НЕ перехватывает ошибки
 * Telegram API. При проблемах с отправкой (например, слишком длинный текст)
 * исключение пробрасывается наверх. Вызывающий код должен обрабатывать ошибки
 * самостоятельно (обычно в catch-блоке message handler).
 *
 * @param {Object} ctx - GrammY контекст
 * @param {string} text - Текст черновика
 * @param {Object} extra - Дополнительные опции Telegram (переопределяют REPLY_OPTS)
 * @returns {Promise<number>} ID отправленного сообщения
 */
async function sendDraft(ctx, text, extra = {}) {
  const sent = await ctx.reply(sanitizeTelegramHtml(text), {
    ...REPLY_OPTS,
    ...extra,
  });
  return sent.message_id;
}

/**
 * Обновить существующее сообщение (для потокового вывода промежуточных результатов).
 *
 * Безопасный метод — перехватывает и игнорирует штатные ошибки Telegram API:
 * - "message is not modified" — контент не изменился;
 * - "message to edit not found" — сообщение удалено;
 * - "MESSAGE_ID_INVALID" — невалидный ID.
 * Все остальные ошибки выводятся в консоль, но не выбрасываются наружу.
 *
 * Если `messageId` не передан (falsy), метод сразу завершается без вызова API.
 *
 * @param {Object} ctx - GrammY контекст
 * @param {number} messageId - ID сообщения для обновления
 * @param {string} text - Новый текст (проходит через sanitizeTelegramHtml)
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
 *
 * Логика ветвления по полю `result`:
 * 1. `requiresApproval === true` — сохраняет в `pendingApprovals`, показывает
 *    inline-кнопки YES/NO, обновляет историю чата.
 * 2. `result.error` присутствует — показывает ошибку, очищает историю от
 *    tool-сообщений и маркеров подтверждения.
 * 3. `result.response` финальный (не "continue") — отправляет ответ пользователю
 *    (через editDraftMessage, replyWithStream или replyMsg), обновляет историю.
 * 4. `result.response === "continue"` — рекурсивно вызывает `agentLoopStep()` и
 *    снова обрабатывает результат (без черновика).
 * 5. Иначе — "Iteration limit reached".
 *
 * Побочные эффекты:
 * - Модифицирует `chatHistories` (очистка, обновление).
 * - Модифицирует `pendingApprovals` (сохранение для последующего подтверждения).
 * - Удаляет черновик через `ctx.api.deleteMessage()` при ошибке или лимите.
 *
 * @param {Object} ctx - GrammY контекст
 * @param {string} chatId - ID чата
 * @param {Object} result - Результат agentLoopStep
 * @param {boolean} result.requiresApproval - Требуется подтверждение пользователя
 * @param {string} [result.error] - Текст ошибки (если произошла)
 * @param {string} [result.response] - Финальный ответ модели или "continue"
 * @param {string} [result.toolName] - Имя инструмента (при requiresApproval)
 * @param {Object} [result.args] - Аргументы инструмента (при requiresApproval)
 * @param {string} [result.toolCallId] - ID вызова инструмента
 * @param {Array.<Object>} [result.messages] - Обновлённая история сообщений
 * @param {Object} [result.tokenUsage] - Счётчики токенов
 * @param {number} result.tokenUsage.prompt - Токены промпта
 * @param {number} result.tokenUsage.completion - Токены генерации
 * @param {number} result.tokenUsage.total - Всего токенов
 * @param {number} result.tokenUsage.cached - Кешированные токены
 * @param {Object} [result.timings] - Тайминги от llama.cpp
 * @param {Array.<Object>} [result.pendingToolCalls] - Очередь вызовов инструментов
 * @param {Object} account - Аккаунт пользователя (из getAccountByUsername)
 * @param {number} [draftMsgId] - ID черновика для обновления (streaming mode)
 * @returns {Promise<boolean>} true если обработка завершена (ответ отправлен пользователю)
 */
async function handleAgentResult(ctx, chatId, result, account, draftMsgId, abortSignal) {
  // Отменено пользователем
  if (result.cancelled) {
    addLog("Agent loop cancelled during continuation", "warning");
    if (typeof draftMsgId === "number") ctx.api.deleteMessage(ctx.chat.id, draftMsgId).catch(() => {});
    return true;
  }

  // Требуется подтверждение
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
    chatHistories.set(chatId, result.messages.filter((m) => m.role !== "system" && !m.content?.includes("[TOOL APPROVAL REQUIRED]")).slice(-(config.maxHistoryPairs * 2)));
    const paramStr = JSON.stringify(result.args);
    const displayParams =
      result.toolName === "write" && result.args.content
        ? JSON.stringify({
            ...result.args,
            content:
              result.args.content.length > 200
                ? result.args.content.substring(0, 200) +
                  `… [content truncated: ${result.args.content.length} chars]`
                : result.args.content,
          })
        : paramStr.length > 300
          ? paramStr.substring(0, 300) + "… [truncated]"
          : paramStr;
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
    chatHistories.set(chatId, cleanHistory.slice(-(config.maxHistoryPairs * 2)));
    if (typeof draftMsgId === "number") ctx.api.deleteMessage(ctx.chat.id, draftMsgId).catch(() => {});
    await replyMsg(ctx, `❌ Error: ${result.error}`);
    return true;
  }

  // Финальный ответ
  if (result.response !== undefined && result.response !== "continue") {
    if (result.messages) chatHistories.set(chatId, result.messages.filter((m) => m.role !== "system").slice(-(config.maxHistoryPairs * 2)));
    let cleanResponse = result.response.replace(/\[TOOL APPROVAL REQUIRED\].*/gi, "").trim();
    if (!cleanResponse) cleanResponse = "✅ Done.";
    const hasReasoning = result.reasoning && result.reasoning.length > 0;
    const reasoningBlock = hasReasoning
      ? `💭 Reasoning:\n\`\`\`\n${result.reasoning}\n\`\`\`\n\n`
      : "";
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

  // Продолжение (нужен ещё один шаг)
  if (result.response === "continue") {
    const history = result.messages || chatHistories.get(chatId) || [];
    const retryResult = await agentLoopStep("", chatId, history, config, MAX_AGENT_ITERATIONS, account, null, abortSignal);
    addLog(`agentLoopStep (retry): requiresApproval=${retryResult.requiresApproval}`, "info");
    return await handleAgentResult(ctx, chatId, retryResult, account, undefined, abortSignal);
  }

  // Лимит итераций
  if (typeof draftMsgId === "number") ctx.api.deleteMessage(ctx.chat.id, draftMsgId).catch(() => {});
  await replyMsg(ctx, "Iteration limit reached");
  return true;
}

// ─── Обработка подтверждений (callback queries) ─────────────────────────────

/**
 * Продолжить выполнение после подтверждения пользователем (нажатие "✅ YES").
 *
 * Рекурсивный поток выполнения:
 * 1. Проверяет глубину рекурсии (`depth < MAX_APPROVAL_DEPTH`).
 * 2. Выполняет инструмент через `executeTool()`.
 * 3. Если инструмент асинхронный (возвращает `taskId`) — ждёт завершения
 *    через `waitForTask()`.
 * 4. Если инструмент завершился ошибкой — сохраняет результат в историю,
 *    показывает ошибку пользователю и завершается.
 * 5. Если успешно — формирует tool-сообщение, обрабатывает оставшиеся
 *    `pendingToolCalls` (для каждого проверяет `permission === "ask"` —
 *    если да, показывает новое подтверждение; иначе выполняет автоматически).
 * 6. После обработки всех вызовов запускает `agentLoopStep()` для генерации
 *    ответа модели и передаёт результат в `handleAgentResult()`.
 *
 * Побочные эффекты:
 * - Инкрементирует `stats.tools` и рассылает через WebSocket.
 * - Модифицирует `chatHistories` (добавляет результаты инструментов).
 * - Модифицирует `pendingApprovals` (при новом запросе подтверждения).
 * - Рассылает `tokenUsage` и `perfStats` через WebSocket.
 * - Логирует каждый шаг через `addLog()`.
 *
 * Обработка ошибок:
 * - Все исключения перехватываются внутри try/catch, логируются,
 *   пользователю отправляется сообщение об ошибке.
 * - При превышении лимита глубины (MAX_APPROVAL_DEPTH) выдаёт предупреждение.
 *
 * @param {Object} ctx - GrammY контекст
 * @param {Object} pending - Объект ожидающего подтверждения инструмента
 * @param {string} pending.toolName - Имя инструмента (read, write, execute, ...)
 * @param {Object} pending.args - Аргументы для выполнения инструмента
 * @param {string} pending.toolCallId - ID вызова инструмента для привязки результата
 * @param {Array.<Object>} pending.messages - История сообщений на момент запроса
 * @param {Object} pending.account - Аккаунт пользователя (роль, permissions)
 * @param {number} pending.createdAt - Timestamp создания (для TTL-очистки)
 * @param {Array.<Object>} [pending.pendingToolCalls] - Очередь дополнительных
 *   вызовов инструментов от модели (multi-tool), обрабатывается последовательно
 * @param {number} [depth=0] - Текущая глубина рекурсии (для защиты от циклов)
 * @returns {Promise<void>}
 */
const MAX_APPROVAL_DEPTH = 10;

async function continueAfterApproval(ctx, pending, depth = 0, abortSignal) {
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
    let result = await executeTool(
      { name: pending.toolName, args: pending.args },
      { projectPath: config.projectPath, account }
    );

    // Handle async execute: return taskId immediately, then await completion
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
        content: JSON.stringify(result).replace(/</g, "&lt;").replace(/>/g, "&gt;"),
      };
      const rawH = chatHistories.get(chatId) || pending.messages || [];
      const h = rawH.filter((m) => !m.content?.includes("[TOOL APPROVAL REQUIRED]"));
      const newHistory = [...h, errorToolMessage].filter((m) => m.role !== "system").slice(-(config.maxHistoryPairs * 2));
      chatHistories.set(chatId, newHistory);
      const stderr = result.data?.stderr?.trim();
      // Truncate to keep message size bounded: error ≤ 200 chars, stderr ≤ 300 chars.
      const errorShort = String(result.error || "unknown").slice(0, 200);
      const stderrShort = stderr ? stderr.slice(0, 300) : "";
      const errorMsg = errorShort + (stderrShort ? `\n\nstderr:\n\`\`\`\n${stderrShort}\n\`\`\`` : "");
      await sendLongMessage(ctx, `❌ <b>${pending.toolName}</b> failed: ${errorMsg}`);
      return;
    }

    const toolMessage = {
      role: "tool",
      content: JSON.stringify(result).replace(/</g, "&lt;").replace(/>/g, "&gt;"),
    };
    if (pending.toolCallId) {
      toolMessage.tool_call_id = pending.toolCallId;
    }

    const rawHistory = pending.messages || chatHistories.get(chatId) || [];
    const cleanHistory = rawHistory.filter(
      (m) => m.role !== "system" && !m.content?.includes("[TOOL APPROVAL REQUIRED]")
    );
    let newHistory = [...cleanHistory, toolMessage];

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
      let nextResult = await executeTool({ name: next.name, args: next.args }, { projectPath: config.projectPath, account });
      if (nextResult.data?.taskId) {
        nextResult = await waitForTask(nextResult.data.taskId);
      }
      addLog(`Tool executed (pending): ${next.name} = ${nextResult.success ? "OK" : "FAIL"}`, nextResult.success ? "success" : "error");
      newHistory.push({
        role: "tool",
        tool_call_id: next.id,
        content: JSON.stringify(nextResult).replace(/</g, "&lt;").replace(/>/g, "&gt;"),
      });
    }

    chatHistories.set(chatId, newHistory);

    const retryResult = await agentLoopStep("", chatId, newHistory, config, MAX_AGENT_ITERATIONS, account, null, abortSignal);
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

// ─── Callback Handler (registered inside initBot()) ────────────────────────

// ─── Error Handler (registered inside initBot()) ──────────────────────────

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
