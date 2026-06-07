/**
 * Telegram reply helpers: HTML sanitization, message sending, draft editing,
 * typing indicator, chunked text. Used by both text and voice handlers.
 * @module telegram/reply
 */
import { InlineKeyboard } from "grammy";

/** Опции ответа по умолчанию для Telegram (HTML parse mode). @type {{parse_mode: string, link_preview_options: {is_disabled: boolean}}} */
export const REPLY_OPTS = {
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
 * @param {string} text - Исходный текст
 * @returns {string} Текст с экранированными неразрешёнными тегами
 */
export function sanitizeTelegramHtml(text) {
  return text.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g, (match, slash, tag) => {
    const allowed = new Set([
      "b",
      "i",
      "u",
      "s",
      "code",
      "pre",
      "tg-spoiler",
      "a",
      "strong",
      "em",
      "blockquote",
    ]);
    if (allowed.has(tag.toLowerCase())) return match;
    return `&lt;${slash}${tag}${match.slice(1 + slash.length + tag.length, match.length - 1)}&gt;`;
  });
}

/**
 * Отправить сообщение в Telegram с fallback на plain text.
 * @param {Object} ctx - GrammY контекст
 * @param {string} text - Текст сообщения
 * @param {Object} [extra] - Доп. опции (reply_markup и т.д.)
 * @returns {Promise<number|null>} ID отправленного сообщения
 */
export async function replyMsg(ctx, text, extra = {}) {
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
export const KEYBOARD_YES_NO = (toolName) =>
  new InlineKeyboard().text("✅ YES", `approve_${toolName}`).text("❌ NO", `deny_${toolName}`);

/**
 * Отправить сообщение с индикатором набора текста.
 * @param {Object} ctx - GrammY контекст
 * @returns {Promise<void>}
 */
export async function sendTyping(ctx) {
  try {
    await ctx.replyWithChatAction("typing");
  } catch {}
}

/**
 * Разбивает текст на чанки для streaming в Telegram.
 * Генерирует части длиной от 80 до 150 символов, стараясь не разрывать слова.
 * @param {string} text - Исходный текст
 * @returns {AsyncGenerator<string>} Асинхронный генератор чанков
 */
export async function* chunkText(text) {
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
export async function clearButtons(ctx) {
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

/**
 * Отправить черновик сообщения (для индикации прогресса).
 * @param {Object} ctx - GrammY контекст
 * @param {string} text - Текст черновика
 * @param {Object} [extra] - Доп. опции
 * @returns {Promise<number>} ID отправленного сообщения
 */
export async function sendDraft(ctx, text, extra = {}) {
  const sent = await ctx.reply(sanitizeTelegramHtml(text), {
    ...REPLY_OPTS,
    ...extra,
  });
  return sent.message_id;
}

/**
 * Обновить существующее сообщение (для потокового вывода).
 * @param {Object} ctx - GrammY контекст
 * @param {number} messageId - ID сообщения
 * @param {string} text - Новый текст
 * @returns {Promise<void>}
 */
export async function editDraftMessage(ctx, messageId, text) {
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
