/**
 * Composable для управления состоянием агента (статус, статистика, логи).
 * Использует WebSocket для обновлений в реальном времени.
 * @module composables/useAgent
 */

import { ref } from "vue";
import { useWebSocket } from "./useWebSocket.js";
import { useToast } from "./useToast.js";
import {
  getStatus as apiGetStatus,
  getLogs,
  clearLogs as apiClearLogs,
  startBot as apiStartBot,
  stopBot as apiStopBot,
  restartBot as apiRestartBot,
} from "../api/client.js";

export function useAgent() {
  const ws = useWebSocket();

  const isProcessing = ref(false);
  const currentChatId = ref(null);
  const toast = useToast();

  const { status, isRunning, stats, logs, tokenUsage } = ws;

  const uptime = ref(0);

  async function clearLogsAction() {
    try {
      await apiClearLogs();
      logs.value = [];
    } catch (e) {
      console.error("[useAgent] Failed to clear logs:", e);
      throw e;
    }
  }

  async function refreshStatus() {
    try {
      const statusData = await apiGetStatus();
      status.value = statusData.status || "idle";
      isRunning.value = statusData.isRunning || false;
      stats.value = statusData.stats || {};
      uptime.value = statusData.uptime || 0;
      if (statusData.tokenUsage) {
        tokenUsage.value = statusData.tokenUsage;
      }

      try {
        const logsData = await getLogs();
        if (logsData?.logs) {
          logs.value = logsData.logs;
        }
      } catch (e) {
        console.debug("[useAgent] Logs fetch skipped");
      }
    } catch (error) {
      status.value = "error";
    }
  }

  async function startAgent() {
    isProcessing.value = true;
    try {
      const result = await apiStartBot();
      return result;
    } finally {
      isProcessing.value = false;
    }
  }

  async function stopAgent() {
    isProcessing.value = true;
    try {
      const result = await apiStopBot();
      return result;
    } finally {
      isProcessing.value = false;
    }
  }

  async function restartAgent() {
    isProcessing.value = true;
    try {
      const result = await apiRestartBot();
      return result;
    } finally {
      isProcessing.value = false;
    }
  }

  return {
    status,
    isRunning,
    stats,
    uptime,
    logs,
    tokenUsage,
    isProcessing,
    currentChatId,
    refreshStatus,
    startAgent,
    stopAgent,
    restartAgent,
    clearLogs: clearLogsAction,
    wsConnected: ws.connected,
  };
}
