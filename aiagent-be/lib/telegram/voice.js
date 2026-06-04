/**
 * Voice message handler: OGG → WAV via ffmpeg, transcribe via remote ASR
 * or local whisper, then run the agent loop with the transcript.
 * @module telegram/voice
 */
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "node:crypto";
import { transcribeViaAsrServer as transcribeAsr } from "../asrClient.js";
import { agentLoopStep, MAX_AGENT_ITERATIONS } from "../agent/agentLoop.js";
import { config, chatHistories, activeAgentControllers, tokenUsage, stats } from "../state.js";
import { addLog, wsBroadcast } from "./log.js";
import { replyMsg, sendTyping, sendDraft, editDraftMessage, REPLY_OPTS, KEYBOARD_YES_NO } from "./reply.js";
import { safeErrorMessage, findFfmpeg, cleanupTmp, recordAndCheckRateLimit, buildPerfStats } from "./util.js";

const MAX_VOICE_DURATION = 300;
const MAX_VOICE_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME = "audio/ogg";
const MIN_EDIT_INTERVAL = 1000;

/**
 * Register the voice message handler on a Bot instance.
 * @param {Object} b - GrammY Bot instance
 * @param {Function} handleAgentResult - Channel-agnostic result handler
 */
export function registerVoiceHandler(b, handleAgentResult) {
  b.on("message:voice", async (ctx) => {
    const voice = ctx.message?.voice;
    if (!voice) return;

    if (!config.projectPath) {
      await replyMsg(ctx, "⚠️ <b>Project path not configured</b>\n\nAsk the admin to set it in Settings or PROJECT_PATH in .env");
      return;
    }

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
    if (voice.file_size && voice.file_size > MAX_VOICE_BYTES) {
      await replyMsg(ctx, "⏱ Файл слишком большой (макс. 25 МБ). Отправьте более короткое сообщение.", REPLY_OPTS);
      return;
    }
    if (voice.mime_type && voice.mime_type !== ALLOWED_MIME) {
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

    const fileId = `${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const tmpDir = os.tmpdir();
    const oggPath = path.join(tmpDir, `voice_${fileId}.ogg`);
    const wavPath = path.join(tmpDir, `voice_${fileId}.wav`);

    try {
      const fileInfo = await ctx.api.getFile(voice.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${ctx.bot.token}/${fileInfo.file_path}`;
      const resp = await fetch(fileUrl);
      if (!resp.ok) throw new Error(`Failed to download voice: ${resp.status}`);

      const arrayBuf = await resp.arrayBuffer();
      await fs.promises.writeFile(oggPath, Buffer.from(arrayBuf));

      const ffmpegPath = await findFfmpeg();
      if (!ffmpegPath) {
        await editDraftMessage(ctx, draftMsgId, "❌ ffmpeg не найден. Установите ffmpeg для обработки голосовых.");
        return;
      }

      const { execFile } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const execFileAsync = promisify(execFile);

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

        await editDraftMessage(ctx, draftMsgId, "🎤 Распознавание...");
        try {
          if (config.asrServerUrl) {
            transcript = await transcribeAsr({
              wavPath,
              asrServerUrl: config.asrServerUrl,
              language: config.asrLanguage,
            });
          } else {
            const { transcribeFile } = await import("../whisper.js");
            transcript = await transcribeFile(wavPath, "large-v3-turbo", config.asrLanguage);
          }
        } catch (e) {
          addLog(`Whisper error: ${e.message}`, "error");
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
      await editDraftMessage(ctx, draftMsgId, `🎤 "${transcript}"\n\n⏳ Analyzing request...`);

      const history = chatHistories.get(chatId) || [];
      let accumulatedContent = "";
      let lastEditTime = 0;

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
      cleanupTmp(oggPath, wavPath);
    }
  });
}
