/**
 * Utility helpers: error sanitization, long-message splitting, ffmpeg
 * discovery, temp file cleanup, perf stats, rate limiting.
 * @module telegram/util
 */
import fs from "fs";
import os from "os";
import { addLog } from "./log.js";
import { rateLimitMap } from "../state.js";
import { chunkText, replyMsg } from "./reply.js";

/**
 * Санитизировать ошибку для отправки пользователю.
 * Никогда не отдаёт полный текст ошибки в Telegram (м.б. пути, токены, стек).
 * Деталь всегда пишется в addLog с category "error".
 * @param {Error|string|unknown} e - Исходная ошибка
 * @param {string} userHint - Безопасное сообщение для пользователя (RU/EN, ≤120 chars)
 * @returns {string} Текст для отправки в Telegram
 */
export function safeErrorMessage(e, userHint) {
  const detail = String(e?.message || e || "unknown").slice(0, 200);
  addLog(`safeErrorMessage detail: ${detail}`, "error");
  return userHint;
}

/**
 * Отправить длинное сообщение в Telegram с автоматической разбивкой на чанки ≤ 4096 символов.
 * @param {Object} ctx - GrammY контекст
 * @param {string} text - Полный текст
 * @param {Object} [extra] - Доп. опции (reply_markup)
 * @returns {Promise<number[]>} Массив message_id отправленных сообщений
 */
export async function sendLongMessage(ctx, text, extra = {}) {
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
 * Найти ffmpeg в системном PATH или стандартных путях.
 * @returns {Promise<string|null>} Путь к ffmpeg или null
 */
export async function findFfmpeg() {
  const envPath = process.env.FFMPEG_PATH;
  if (envPath && fs.existsSync(envPath)) {
    return envPath;
  }
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
export function cleanupTmp(...files) {
  for (const f of files) {
    try {
      if (f && fs.existsSync(f)) fs.unlinkSync(f);
    } catch {}
  }
}

/**
 * Преобразует сырые timings от llama.cpp в объект perfStats для WebSocket.
 * @param {Object} timings - Сырые timings из ответа llama.cpp
 * @returns {Object} Нормализованный объект статистики
 */
export function buildPerfStats(timings) {
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

/** Rate limiter settings: 10 requests per 60s window. */
export const RATE_LIMIT = 10;
export const RATE_WINDOW = 60_000;

/**
 * Проверить, не превысил ли chatId rate limit.
 * @param {string} chatId
 * @returns {boolean} true если запрос можно обработать
 */
export function recordAndCheckRateLimit(chatId) {
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
