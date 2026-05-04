import { ref, computed } from "vue";

const API_BASE = "http://127.0.0.1:3000/api";
const API_KEY = "agent-secret-key";

export function useAgent() {
  const status = ref("stopped");
  const isRunning = computed(() => status.value === "running");
  const isLaunching = ref(false);
  const stats = ref({ requests: 0, tools: 0, errors: 0 });
  const uptime = ref("--:--:--");
  const config = ref({});
  const logs = ref([]);

  let uptimeInterval = null;
  let logInterval = null;

  async function apiFetch(endpoint, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      ...options.headers,
    };

    const resp = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }));
      throw new Error(err.error || `HTTP ${resp.status}`);
    }

    return resp.json();
  }

  async function refreshStatus() {
    try {
      const data = await apiFetch("/status");
      status.value = data.running ? "running" : "stopped";
      stats.value = data.stats || {};
      config.value = data.config || {};

      if (data.running) {
        startUptimeTimer(data.uptime);
      } else {
        stopUptimeTimer();
      }
    } catch (e) {
      if (status.value === "running") {
        status.value = "stopped";
      }
    }
  }

  function startUptimeTimer(initialMs) {
    if (uptimeInterval) clearInterval(uptimeInterval);
    const start = Date.now() - (initialMs || 0);
    uptimeInterval = setInterval(() => {
      const elapsed = Date.now() - start;
      const h = Math.floor(elapsed / 3600000);
      const m = Math.floor((elapsed % 3600000) / 60000);
      const s = Math.floor((elapsed % 60000) / 1000);
      uptime.value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }, 1000);
  }

  function stopUptimeTimer() {
    if (uptimeInterval) clearInterval(uptimeInterval);
    uptimeInterval = null;
    uptime.value = "--:--:--";
  }

  async function startAgent() {
    try {
      isLaunching.value = true;
      status.value = "checking";

      await apiFetch("/start", { method: "POST" });

      // Poll for status
      let attempts = 0;
      const checkInterval = setInterval(async () => {
        attempts++;
        try {
          const data = await apiFetch("/status");
          if (data.running) {
            status.value = "running";
            clearInterval(checkInterval);
            isLaunching.value = false;
            startLogPolling();
          } else if (attempts >= 15) {
            clearInterval(checkInterval);
            isLaunching.value = false;
          }
        } catch {
          if (attempts >= 15) {
            clearInterval(checkInterval);
            isLaunching.value = false;
          }
        }
      }, 1000);
    } catch (e) {
      isLaunching.value = false;
      status.value = "error";
      throw e;
    }
  }

  async function stopAgent() {
    try {
      await apiFetch("/stop", { method: "POST" });
      status.value = "stopped";
      stopLogPolling();
    } catch (e) {
      status.value = "error";
      throw e;
    }
  }

  async function restartAgent() {
    try {
      await apiFetch("/restart", { method: "POST" });
      status.value = "checking";

      let attempts = 0;
      const checkInterval = setInterval(async () => {
        attempts++;
        try {
          const data = await apiFetch("/status");
          if (data.running) {
            status.value = "running";
            clearInterval(checkInterval);
            startLogPolling();
          } else if (attempts >= 15) {
            clearInterval(checkInterval);
          }
        } catch {
          if (attempts >= 15) clearInterval(checkInterval);
        }
      }, 1000);
    } catch (e) {
      status.value = "error";
      throw e;
    }
  }

  function startLogPolling() {
    if (logInterval) clearInterval(logInterval);
    pollLogs();
    logInterval = setInterval(pollLogs, 3000);
  }

  function stopLogPolling() {
    if (logInterval) clearInterval(logInterval);
    logInterval = null;
  }

  async function pollLogs() {
    try {
      const newLogs = await apiFetch("/logs?limit=50");
      logs.value = newLogs.reverse();
    } catch {}
  }

  async function saveConfig(newConfig) {
    await apiFetch("/config", {
      method: "POST",
      body: JSON.stringify(newConfig),
    });
    config.value = newConfig;
  }

  async function sendChatMessage(message) {
    const resp = await apiFetch("/chat", {
      method: "POST",
      body: JSON.stringify({ message }),
    });
    stats.value = resp.stats || stats.value;
    return resp.reply;
  }

  // Cleanup on unmount
  function cleanup() {
    stopUptimeTimer();
    stopLogPolling();
  }

  return {
    status,
    isRunning,
    isLaunching,
    stats,
    uptime,
    config,
    logs,
    refreshStatus,
    startAgent,
    stopAgent,
    restartAgent,
    saveConfig,
    sendChatMessage,
    cleanup,
  };
}
