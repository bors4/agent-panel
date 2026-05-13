/**
 * Модуль управления сессиями пользователей и историей сообщений.
 */

const MAX_HISTORY_PAIRS = 5;

const sessions = new Map();

/**
 * Получить или создать сессию для указанного чата.
 * @param {number|string} chatId - Уникальный идентификатор чата Telegram
 * @returns {Object} Объект сессии с историей и pending actions
 */
export function getSession(chatId) {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, {
      history: [],
      pendingActions: new Map(),
    });
  }
  return sessions.get(chatId);
}

/**
 * Сохранить сообщение в историю сессии.
 * @param {number|string} chatId - Уникальный идентификатор чата Telegram
 * @param {{role: 'user'|'assistant', content: string}} message - Сообщение для сохранения
 */
export function saveSession(chatId, message) {
  const session = getSession(chatId);
  session.history.push(message);
  if (session.history.length > MAX_HISTORY_PAIRS * 2) {
    session.history = session.history.slice(-MAX_HISTORY_PAIRS * 2);
  }
}

/**
 * Добавить сообщение в историю сессии (существующая функция для обратной совместимости).
 * @param {Object} session - Объект сессии
 * @param {'user'|'assistant'} role - Роль отправителя сообщения
 * @param {string} content - Контент сообщения
 */
export function addToHistory(session, role, content) {
  session.history.push({ role, content });
  if (session.history.length > MAX_HISTORY_PAIRS * 2) {
    session.history = session.history.slice(-MAX_HISTORY_PAIRS * 2);
  }
}

/**
 * Очистить старые неактивные сессии.
 * @param {number} maxAgeMs - Максимальный возраст сессии в миллисекундах (по умолчанию 1 час)
 */
export function cleanupOldSessions(maxAgeMs = 3600000) {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (session.lastActivity && now - session.lastActivity > maxAgeMs) {
      sessions.delete(id);
    }
  }
}
