/**
 * Logger facade: in-memory log buffer + WebSocket broadcast + file logger.
 * Depends on shared state (agentLogs, wss, runtime).
 * @module log
 */
import { logInfo, logWarn, logError } from "../logger.js";
import { agentLogs, runtime, wss } from "../state.js";

/**
 * Рассылает сообщение всем подключённым WebSocket клиентам.
 * @param {string} type - Тип события (status, stats, log, tokenUsage, perfStats)
 * @param {Object} data - Данные события
 */
export function wsBroadcast(type, data) {
  if (!wss) return;
  const msg = JSON.stringify({ type, data });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(msg);
  });
}

/**
 * Добавить запись в журнал агента.
 * @param {string} message - Текст сообщения
 * @param {"info"|"error"|"warning"|"warn"|"success"|"system"} type - Тип записи
 */
export function addLog(message, type = "info") {
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
export function updateStatus(newStatus, message = "") {
  runtime.botStatus = newStatus;
  runtime.botStatusMessage = message;
  if (newStatus === "running") runtime.startTime = Date.now();
  else runtime.startTime = null;
  addLog(`Status: ${message || newStatus}`, newStatus === "error" ? "error" : "info");
  const uptimeMs = runtime.startTime ? Date.now() - runtime.startTime : 0;
  wsBroadcast("status", {
    botStatus: newStatus,
    botStatusMessage: message,
    isRunning: newStatus === "running",
    startTime: runtime.startTime,
    uptime: Math.floor(uptimeMs / 1000),
  });
}
