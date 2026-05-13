import { ref, onMounted, onUnmounted } from "vue";
import { useToast } from "./useToast.js";
import {
  getStatus as apiGetStatus,
  getLogs,
  startBot as apiStartBot,
  stopBot as apiStopBot,
  restartBot as apiRestartBot,
  isConnectionActive, // ← новая утилита из client.js
} from "../api/client.js";

export function useAgent() {
  const isProcessing = ref(false);
  const currentChatId = ref(null);

  const status = ref("idle");
  const isRunning = ref(false);
  const stats = ref({});
  const uptime = ref(0);
  const logs = ref([]);

  const toast = useToast();

  // ─────────────────────────────────────────────────────
  // 🔁 Интервал обновления статуса
  // ─────────────────────────────────────────────────────
  let statusInterval = null;
  const REFRESH_INTERVAL = 5000; // 5 секунд

  async function refreshStatus() {
    // 🛡️ Пропускаем запрос, если соединение потеряно
    // (ошибка уже залогирована в client.js)
    if (!isConnectionActive()) {
      console.debug("[useAgent] Skipping refresh — connection lost");
      return;
    }

    try {
      const statusData = await apiGetStatus();
      status.value = statusData.status || "idle";
      isRunning.value = statusData.isRunning || false;
      stats.value = statusData.stats || {};
      uptime.value = statusData.uptime || 0;

      // Логи загружаем отдельно — их ошибка не критична
      try {
        const logsData = await getLogs();
        if (logsData?.logs) {
          logs.value = logsData.logs;
        }
      } catch (e) {
        // Тихо игнорируем ошибки загрузки логов
        console.debug("[useAgent] Logs fetch skipped");
      }
    } catch (error) {
      // ❗ Ошибка уже залогирована в client.js как "Connection lost"
      // Здесь только обновляем статус для UI
      status.value = "error";
    }
  }

  // ─────────────────────────────────────────────────────
  // 🎮 Управление агентом (с ручной остановкой интервала)
  // ─────────────────────────────────────────────────────
  async function startAgent() {
    isProcessing.value = true;
    try {
      const result = await apiStartBot();
      await refreshStatus(); // немедленное обновление
      toast.success("Агент запущен");
      return result;
    } finally {
      isProcessing.value = false;
    }
  }

  async function stopAgent() {
    isProcessing.value = true;
    try {
      const result = await apiStopBot();
      await refreshStatus();
      toast.warning("Агент остановлен");
      return result;
    } finally {
      isProcessing.value = false;
    }
  }

  async function restartAgent() {
    isProcessing.value = true;
    try {
      const result = await apiRestartBot();
      await refreshStatus();
      toast.success("Агент перезапущен");
      return result;
    } finally {
      isProcessing.value = false;
    }
  }

  // ─────────────────────────────────────────────────────
  // 🔄 Lifecycle: автозапуск интервала при монтировании
  // ─────────────────────────────────────────────────────
  onMounted(() => {
    // Первый запрос сразу
    refreshStatus();

    // Интервал повторных запросов
    statusInterval = setInterval(refreshStatus, REFRESH_INTERVAL);
  });

  onUnmounted(() => {
    // 🔥 Очистка: останавливаем интервал при размонтировании
    if (statusInterval) {
      clearInterval(statusInterval);
      statusInterval = null;
    }
  });

  // ─────────────────────────────────────────────────────
  // 📦 Публичный API хука
  // ─────────────────────────────────────────────────────
  return {
    status,
    isRunning,
    stats,
    uptime,
    logs,
    isProcessing,
    currentChatId,
    refreshStatus, // для ручного обновления
    startAgent,
    stopAgent,
    restartAgent,
  };
}
