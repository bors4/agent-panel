/**
 * API клиент для взаимодействия с backend сервером.
 * С поддержкой экспоненциальной задержки при потере соединения.
 * @module api/client
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:3000/api";
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
// 🛡️ Глобальная защита от "шквала ошибок" при обрыве связи
// ─────────────────────────────────────────────────────
(() => {
  let suppressUntil = 0;
  const SUPPRESS_DURATION = 3000; // подавлять 3 секунды после первой ошибки

  // Перехватываем ошибки "send was called before connect"
  const originalOnError = window.onerror;
  window.onerror = function (message, source, _lineno, _colno, _error) {
    if (message?.includes?.("send was called before connect") && source?.includes("client:")) {
      const now = Date.now();
      if (now < suppressUntil) {
        return true;
      }
      suppressUntil = now + SUPPRESS_DURATION;
      console.debug('[client] Suppressing "send before connect" errors...');
    }
    return originalOnError?.apply(this, arguments) ?? false;
  };

  // Перехватываем неуловимые Promise-ошибки
  window.addEventListener("unhandledrejection", (event) => {
    if (event.reason?.message?.includes("send was called before connect")) {
      event.preventDefault(); // не показывать в консоли
      const now = Date.now();
      if (now >= suppressUntil) {
        console.debug("[client] Suppressed unhandled promise rejection");
        suppressUntil = now + SUPPRESS_DURATION;
      }
    }
  });
})();

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
      throw new Error(`API error ${response.status}: ${response.statusText}`);
    }

    return response;
  } catch (error) {
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

export async function startBot() {
  const response = await apiFetch("/start", { method: "POST" });
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

export async function directChat(options) {
  const body = typeof options === "string" ? { message: options } : options;
  const response = await apiFetch("/chat", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return response.json();
}

/**
 * Потоковый чат с AI (SSE). Принимает колбэки для real-time обновлений.
 * @param {Object|string} options - Опции запроса или строка сообщения
 * @param {Object} callbacks - Колбэки
 * @param {Function} [callbacks.onContent] - Вызывается при каждом чанке (chunk, accumulated)
 * @param {Function} [callbacks.onDone] - Вызывается при завершении (usage)
 * @param {Function} [callbacks.onError] - Вызывается при ошибке (error)
 * @returns {Promise<string>} Полный накопленный текст
 */
export async function directChatStream(options, callbacks = {}) {
  const body = { ...(typeof options === "string" ? { message: options } : options), stream: true };
  const response = await apiFetch("/chat", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`API error ${response.status}: ${errText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullContent = "";

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

export async function getSession(chatId) {
  const response = await apiFetch(`/session/${chatId}`);
  return response.json();
}

export async function addToSession(chatId, role, content) {
  const response = await apiFetch(`/session/${chatId}`, {
    method: "POST",
    body: JSON.stringify({ role, content }),
  });
  return response.json();
}

export async function cleanupSessions(maxAgeMs = 3600000) {
  const response = await apiFetch("/session/cleanup", {
    method: "POST",
    body: JSON.stringify({ maxAgeMs }),
  });
  return response.json();
}

export async function runAgentLoop(agentState) {
  const response = await apiFetch("/agent/loop", {
    method: "POST",
    body: JSON.stringify(agentState),
  });
  return response.json();
}

export async function executeTool(toolCall) {
  const config = JSON.parse(localStorage.getItem("agent-config") || "{}");
  const response = await apiFetch("/agent/tool", {
    method: "POST",
    body: JSON.stringify({
      toolCall,
      projectPath: config.projectPath || undefined,
    }),
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

export async function getModels(serverUrl) {
  const response = await apiFetch(`/models?serverUrl=${encodeURIComponent(serverUrl)}`);
  return response.json();
}

export async function checkPath(path) {
  const response = await apiFetch(`/validate-path?path=${encodeURIComponent(path)}`);
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
