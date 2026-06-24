/**
 * API клиент для взаимодействия с backend сервером.
 * С поддержкой экспоненциальной задержки при потере соединения.
 * @module api/client
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const API_KEY = import.meta.env.VITE_API_KEY;

// Проверяем наличие API_KEY
if (!API_KEY) {
  console.error("[api] VITE_API_KEY не задан в окружении! Фронтенд не будет отправлять API ключ.");
  // Для удобства разработки можно вернуть null, чтобы запросы просто отправлялись без заголовка
  // В проде лучше выбрасывать ошибку: throw new Error("API_KEY обязателен");
}

// ─────────────────────────────────────────────────────
// 🔄 Состояние подключения и повторных попыток
// ─────────────────────────────────────────────────────
let isConnected = true;
let reconnectAttempt = 0;
let reconnectTimeout = null;
const MAX_RECONNECT_DELAY = 5000; // 5 секунд максимум
const BASE_RECONNECT_DELAY = 1000; // 1 секунда старт

// ─────────────────────────────────────────────────────
// 🛡️ Утилита: экспоненциальная задержка
// ─────────────────────────────────────────────────────
function getReconnectDelay() {
  const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempt), MAX_RECONNECT_DELAY);
  reconnectAttempt = Math.min(reconnectAttempt + 1, 4); // не больше 4 шагов
  return delay;
}

function resetReconnectState() {
  reconnectAttempt = 0;
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
}

// ─────────────────────────────────────────────────────
// 🔌 Основная функция запроса с повторными попытками
// ─────────────────────────────────────────────────────
/**
 * Базовый HTTP-запрос к API с экспоненциальной задержкой при потере соединения.
 * Автоматически добавляет Content-Type: application/json и x-api-key.
 * При ошибке ответа пытается извлечь тело ошибки JSON (body.error) для лучшего сообщения.
 * При потере соединения включает повторные попытки с экспоненциальной задержкой (до 5с).
 * @param {string} endpoint - Путь API (например, "/status")
 * @param {Object} [options] - Опции fetch (method, body, headers)
 * @param {boolean} [retry=true] - Включить автоматические повторные попытки
 * @returns {Promise<Response>} Ответ fetch
 * @throws {Error} С сообщением из body.error или статусом HTTP
 */
async function apiFetch(endpoint, options = {}, retry = true) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...(API_KEY && { "x-api-key": API_KEY }),
    ...options.headers,
  };

  if (!API_KEY) {
    console.warn("[api] VITE_API_KEY не задан — запрос отправляется без API ключа");
  }

  try {
    const response = await fetch(url, { ...options, headers });

    // ✅ Соединение восстановлено
    if (!isConnected) {
      console.log("[api] ✓ Connection restored");
      isConnected = true;
      resetReconnectState();
    }

    if (!response.ok) {
      let errorMsg = `API error ${response.status}: ${response.statusText}`;
      try {
        const body = await response.json();
        if (body.error) errorMsg = body.error;
      } catch {}
      throw new Error(errorMsg);
    }

    return response;
  } catch (error) {
    // 🚫 AbortError — пользователь отменил запрос, никогда не повторяем
    if (error.name === "AbortError") {
      throw error;
    }

    // 🚫 При первой ошибке — включаем короткое подавление "шума"
    if (isConnected) {
      window.__apiConnectionLost = true;
      window.__apiConnectionLostTime = Date.now();
      console.warn(`[api] ✗ Connection lost: ${error.message}`);
      isConnected = false;
    }

    // Если повторные попытки включены — планируем следующую
    if (retry && !reconnectTimeout) {
      const delay = getReconnectDelay();
      console.debug(`[api] Retrying in ${delay}ms... (attempt ${reconnectAttempt})`);

      reconnectTimeout = setTimeout(() => {
        reconnectTimeout = null;
        // Рекурсивно пробуем ещё раз (без флага retry, чтобы не зациклить)
        apiFetch(endpoint, options, false).catch(() => {
          // Ошибка уже залогирована, просто продолжаем
        });
      }, delay);
    }

    throw error; // Пробрасываем, чтобы вызывающий код мог обработать
  }
}

// ─────────────────────────────────────────────────────
// 📡 Публичные методы API (без изменений сигнатур)
// ─────────────────────────────────────────────────────
export async function getStatus() {
  const response = await apiFetch("/status");
  return response.json();
}

export async function getLogs(limit = 50) {
  const response = await apiFetch(`/logs?limit=${limit}`);
  return response.json();
}

export async function clearLogs() {
  const response = await apiFetch("/logs", { method: "DELETE" });
  return response.json();
}

export async function getConfig() {
  const response = await apiFetch("/config");
  return response.json();
}

export async function updateConfig(config) {
  const response = await apiFetch("/config", {
    method: "POST",
    body: JSON.stringify(config),
  });
  return response.json();
}

export async function startBot(signal) {
  const response = await apiFetch("/start", { method: "POST", signal });
  return response.json();
}

export async function stopBot() {
  const response = await apiFetch("/stop", { method: "POST" });
  return response.json();
}

export async function restartBot() {
  const response = await apiFetch("/restart", { method: "POST" });
  return response.json();
}

export async function directChat(options, signal = null) {
  const body = typeof options === "string" ? { message: options } : options;
  const response = await apiFetch("/chat", {
    method: "POST",
    body: JSON.stringify(body),
    signal,
  });
  return response.json();
}

/**
 * Потоковый чат с AI (SSE). Принимает колбэки для real-time обновлений.
 * @param {Object|string} options - Опции запроса или строка сообщения
 * @param {Object} callbacks - Колбэки
 * @param {Function} [callbacks.onReasoning] - Вызывается при чанке reasoning (chunk, accumulated)
 * @param {Function} [callbacks.onReasoningDone] - Вызывается при завершении reasoning
 * @param {Function} [callbacks.onContent] - Вызывается при каждом чанке (chunk, accumulated)
 * @param {Function} [callbacks.onDone] - Вызывается при завершении (usage)
 * @param {Function} [callbacks.onError] - Вызывается при ошибке (error)
 * @returns {Promise<string>} Полный накопленный текст
 */
export async function directChatStream(options, callbacks = {}, signal = null) {
  const body = { ...(typeof options === "string" ? { message: options } : options), stream: true };
  const response = await apiFetch("/chat", {
    method: "POST",
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`API error ${response.status}: ${errText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullContent = "";
  let fullReasoning = "";

  // При отмене — закрываем reader
  if (signal) {
    if (signal.aborted) {
      reader.cancel().catch(() => {});
    } else {
      signal.addEventListener(
        "abort",
        () => {
          reader.cancel().catch(() => {});
        },
        { once: true }
      );
    }
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;

      const raw = trimmed.slice(6);
      if (raw === "[DONE]") continue;

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        console.warn("[directChatStream] Parse error, raw:", raw);
        continue;
      }

      if (parsed.error) {
        callbacks.onError?.(parsed.error);
        throw new Error(parsed.error);
      }
      if (parsed.reasoning) {
        fullReasoning += parsed.reasoning;
        callbacks.onReasoning?.(parsed.reasoning, fullReasoning);
      }
      if (parsed.reasoningDone) {
        callbacks.onReasoningDone?.();
      }
      if (parsed.reply) {
        fullContent += parsed.reply;
        callbacks.onContent?.(parsed.reply, fullContent);
      }
      if (parsed.done) {
        callbacks.onDone?.(parsed.usage || null, fullContent);
      }
    }
  }

  // Process remaining buffer
  if (buffer.trim()) {
    const trimmed = buffer.trim();
    if (trimmed.startsWith("data: ")) {
      const raw = trimmed.slice(6);
      if (raw !== "[DONE]") {
        try {
          const data = JSON.parse(raw);
          if (data.reasoning) fullReasoning += data.reasoning;
          if (data.reply) fullContent += data.reply;
          if (data.done) callbacks.onDone?.(data.usage || null, fullContent);
        } catch {}
      }
    }
  }

  return fullContent;
}

export async function updateTools(config) {
  const response = await apiFetch("/tools", {
    method: "POST",
    body: JSON.stringify(config),
  });
  return response.json();
}

/**
 * Agent loop чат — использует agentLoopStep с инструментами и правами аккаунта.
 * @param {Object} options - Параметры запроса
 * @param {string} options.message - Сообщение пользователя
 * @param {Array} [options.messages] - Предыдущие сообщения
 * @param {string} [options.accountName] - Имя аккаунта для прав доступа
 * @param {boolean} [options.useAgentLoop=true] - Флаг agent loop
 * @returns {Promise<Object>} Ответ с toolCalls, toolResults и reply
 */
export async function agentChat(options, signal = null, abortId = null) {
  const response = await apiFetch("/chat", {
    method: "POST",
    body: JSON.stringify({
      message: options.message,
      messages: options.messages || [],
      accountName: options.accountName || "",
      useAgentLoop: true,
      projectPath: options.projectPath,
      serverUrl: options.serverUrl,
      modelName: options.modelName,
      systemPrompt: options.systemPrompt,
      abortId,
    }),
    signal,
  });
  return response.json();
}

/**
 * Потоковый agent loop (SSE). Получает чанки ответа и финальный объект с toolCalls.
 * @param {Object} options
 * @param {Object} callbacks
 * @param {Function} [callbacks.onReasoning] - (chunk, accumulated) => void
 * @param {Function} [callbacks.onReasoningDone] - () => void
 * @param {Function} [callbacks.onContent] - (chunk, accumulated) => void
 * @param {Function} [callbacks.onDone] - (finalObject) => void
 * @param {Function} [callbacks.onError] - (error) => void
 * @param {AbortSignal} [signal]
 * @param {string} [abortId]
 * @returns {Promise<Object>} Финальный объект
 */
export async function agentChatStream(options, callbacks = {}, signal = null, abortId = null) {
  const response = await apiFetch("/chat", {
    method: "POST",
    body: JSON.stringify({
      message: options.message,
      messages: options.messages || [],
      accountName: options.accountName || "",
      useAgentLoop: true,
      stream: true,
      projectPath: options.projectPath,
      serverUrl: options.serverUrl,
      modelName: options.modelName,
      systemPrompt: options.systemPrompt,
      abortId,
    }),
    signal,
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult = null;

  if (signal) {
    if (signal.aborted) reader.cancel().catch(() => {});
    else signal.addEventListener("abort", () => reader.cancel().catch(() => {}), { once: true });
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;
      const raw = trimmed.slice(6);
      if (raw === "[DONE]") continue;

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }

      if (parsed.error) {
        callbacks.onError?.(parsed.error);
        finalResult = parsed;
        continue;
      }
      if (parsed.done) {
        finalResult = parsed;
        callbacks.onDone?.(parsed);
        continue;
      }
      if (parsed.reasoning) {
        callbacks.onReasoning?.(parsed.reasoning, parsed.accumulated);
      } else if (parsed.reasoningDone) {
        callbacks.onReasoningDone?.();
      } else if (parsed.reply !== undefined) {
        callbacks.onContent?.(parsed.reply, parsed.accumulated);
      }
    }
  }

  return finalResult || {};
}

/**
 * Продолжить agent loop после одобрения/отклонения инструмента.
 * @param {Object} options
 * @param {Array} options.messages - Текущие сообщения
 * @param {Object} options.approvalDecision - { approved, toolName, args, toolCallId }
 * @param {string} [options.accountName] - Имя аккаунта
 * @returns {Promise<Object>}
 */
export async function agentChatContinue(options, signal = null) {
  const response = await apiFetch("/chat/continue", {
    method: "POST",
    body: JSON.stringify({
      messages: options.messages,
      approvalDecision: options.approvalDecision,
      accountName: options.accountName || "",
      abortId: options.abortId,
    }),
    signal,
  });
  return response.json();
}

export async function getTools() {
  const response = await apiFetch("/tools");
  return response.json();
}

export async function getAccounts() {
  const response = await apiFetch("/accounts");
  return response.json();
}

export async function postAccounts(payload) {
  const response = await apiFetch("/accounts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function postImportAccounts(payload) {
  const response = await apiFetch("/accounts/import", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.json();
}

/**
 * Получить список доступных моделей с AI сервера.
 * Для OpenRouter опционально передаётся apiKey, который отправляется
 * как заголовок x-openrouter-key (не query-параметр).
 * @param {string} serverUrl - URL AI сервера (например, "http://192.168.1.101:8080/v1")
 * @param {string} [apiKey] - API ключ для OpenRouter (отправляется в заголовке x-openrouter-key)
 * @returns {Promise<{success: boolean, models: Array, source: "openrouter"|"local"}>}
 */
export async function getModels(serverUrl, apiKey) {
  const url = `/models?serverUrl=${encodeURIComponent(serverUrl)}`;
  const options = {};
  if (apiKey) options.headers = { "x-openrouter-key": apiKey };
  const response = await apiFetch(url, options);
  return response.json();
}

export async function checkPath(path) {
  const response = await apiFetch(`/validate-path?path=${encodeURIComponent(path)}`);
  return response.json();
}

export async function getDirectories(dirPath) {
  const response = await apiFetch(`/directories?path=${encodeURIComponent(dirPath || "")}`);
  return response.json();
}

export async function browseFolder() {
  const response = await apiFetch("/browse-folder");
  return response.json();
}

/**
 * Очистить текст от слов-паразитов через LLM.
 * @param {string} text - Исходный текст (после распознавания речи)
 * @param {AbortSignal} [signal] - Signal для отмены
 * @returns {Promise<{cleaned: string}>}
 */
export async function cleanText(text, signal) {
  const response = await apiFetch("/chat/clean-text", {
    method: "POST",
    body: JSON.stringify({ text }),
    signal,
  });
  return response.json();
}

/**
 * Отправить аудио на ASR сервер для транскрипции (whisper.cpp / faster-whisper).
 * @param {File|Blob} audioBlob - Аудио данные (WAV, OGG, WebM, etc.)
 * @param {string} [language="ru-RU"] - Код языка
 * @param {AbortSignal} [signal] - Signal для отмены
 * @returns {Promise<{text: string}>}
 */
export async function transcribeAudio(audioBlob, language = "ru-RU", signal) {
  const formData = new FormData();
  // Используем реальный MIME/extension от blob (audio/webm/ogg/wav)
  const mime = audioBlob.type || "audio/wav";
  const ext = mime.includes("webm") ? "webm" : mime.includes("ogg") ? "ogg" : "wav";
  formData.append("file", audioBlob, `audio.${ext}`);
  formData.append("language", language);
  const response = await apiFetch("/asr/transcribe", {
    method: "POST",
    body: formData,
    signal,
  });
  return response.json();
}

/**
 * Проверить доступность ASR сервера.
 * @returns {Promise<{configured: boolean, reachable: boolean, url: string, status?: number}>}
 */
export async function testAsrConnection() {
  const response = await apiFetch("/asr/status");
  return response.json();
}

/**
 * Отменить выполняющийся agent loop запрос.
 * @param {string} abortId - ID запроса из ответа agentChat
 * @returns {Promise<Object>}
 */
export async function cancelChat(abortId) {
  const response = await apiFetch("/chat/cancel", {
    method: "POST",
    body: JSON.stringify({ abortId }),
  });
  return response.json();
}

// ─────────────────────────────────────────────────────
// 🧭 Утилиты для внешней проверки состояния
// ─────────────────────────────────────────────────────
/**
 * Проверить, установлено ли соединение с сервером.
 * @returns {boolean}
 */
export function isConnectionActive() {
  return isConnected;
}

/**
 * Принудительно сбросить состояние подключения (для отладки).
 */
export function resetConnection() {
  isConnected = true;
  resetReconnectState();
}
