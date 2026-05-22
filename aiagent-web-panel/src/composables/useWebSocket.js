/**
 * Composable для WebSocket подключения к серверу.
 * Получает обновления статуса, логов, статистики и tokenUsage в реальном времени.
 * @module composables/useWebSocket
 */

import { ref, onMounted, onUnmounted } from "vue";
import { getStatus, getLogs } from "../api/client.js";

const WS_URL = "ws://127.0.0.1:3000/ws";

export function useWebSocket() {
  const connected = ref(false);
  const status = ref("idle");
  const isRunning = ref(false);
  const stats = ref({ requests: 0, tools: 0, errors: 0, uptime: 0 });
  const logs = ref([]);
  const tokenUsage = ref({ prompt: 0, completion: 0, total: 0, cached: 0 });
  const statusMessage = ref("");
  const startTime = ref(null);

  let ws = null;
  let reconnectTimer = null;
  let reconnectAttempt = 0;
  let uptimeTimer = null;

  function getDelay() {
    return Math.min(1000 * Math.pow(2, reconnectAttempt), 10000);
  }

  function connect() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      connected.value = true;
      reconnectAttempt = 0;
      loadInitialState();
    };

    ws.onclose = () => {
      connected.value = false;
      scheduleReconnect();
    };

    ws.onerror = () => {
      ws.close();
    };

    ws.onmessage = (event) => {
      try {
        const { type, data } = JSON.parse(event.data);
        switch (type) {
          case "status":
            status.value = data.botStatus;
            isRunning.value = data.isRunning;
            statusMessage.value = data.botStatusMessage;
            startTime.value = data.startTime;
            if (data.uptime !== undefined) {
              stats.value.uptime = data.uptime;
            }
            break;
          case "stats":
            stats.value = { ...stats.value, ...data };
            break;
          case "log":
            logs.value.push(data);
            if (logs.value.length > 200) logs.value.shift();
            break;
          case "tokenUsage":
            tokenUsage.value = { ...data };
            break;
        }
      } catch (e) {
        console.error("[useWebSocket] Parse error:", e);
      }
    };
  }

  async function loadInitialState() {
    try {
      const statusData = await getStatus();
      status.value = statusData.status || "idle";
      isRunning.value = statusData.isRunning || false;
      stats.value = { ...statusData.stats, uptime: statusData.uptime || 0 };
      startTime.value =
        statusData.startTime ||
        (statusData.uptime ? Date.now() - statusData.uptime * 1000 : null);
      if (statusData.tokenUsage) {
        tokenUsage.value = statusData.tokenUsage;
      }
    } catch (e) {
      console.error("[useWebSocket] Initial state load failed:", e);
    }
    try {
      const logsData = await getLogs();
      if (logsData?.logs) logs.value = logsData.logs;
    } catch (_e) {
      console.debug("[useWebSocket] Logs load skipped");
    }
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    const delay = getDelay();
    reconnectAttempt = Math.min(reconnectAttempt + 1, 5);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  function startUptimeTicker() {
    uptimeTimer = setInterval(() => {
      if (startTime.value) {
        stats.value.uptime = Math.floor((Date.now() - startTime.value) / 1000);
      }
    }, 1000);
  }

  onMounted(() => {
    connect();
    startUptimeTicker();
  });

  onUnmounted(() => {
    if (ws) ws.close();
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (uptimeTimer) clearInterval(uptimeTimer);
  });

  return {
    connected,
    status,
    isRunning,
    stats,
    logs,
    tokenUsage,
    statusMessage,
    startTime,
  };
}
