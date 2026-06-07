/**
 * Health check endpoint (no auth required).
 * @module routes/health
 */
import { Router } from "express";
import { config } from "../lib/state.js";

/**
 * @param {Object} deps
 * @param {Object} deps.state - runtime state (botStatus, startTime)
 * @returns {Router}
 */
export function createHealthRouter(deps) {
  const router = Router();
  const { state } = deps;

  /**
   * GET /api/health — bot status + AI server reachability.
   * Returns { status: "healthy"|"degraded"|"unhealthy", bot: { isRunning, status, uptime }, aiServer: { reachable }, timestamp }.
   * For OpenRouter: sends HTTP-Referer + X-OpenRouter-Title headers alongside Bearer token.
   */
  router.get("/health", async (_req, res) => {
    const uptimeMs = state.startTime ? Date.now() - state.startTime : 0;
    const botRunning = state.botStatus === "running";

    const aiReachable = await checkAiServer();

    let status;
    if (botRunning && aiReachable) {
      status = "healthy";
    } else if (aiReachable) {
      status = "degraded";
    } else {
      status = "unhealthy";
    }

    res.json({
      status,
      bot: {
        isRunning: botRunning,
        status: state.botStatus,
        uptime: Math.floor(uptimeMs / 1000),
      },
      aiServer: { reachable: aiReachable },
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}

async function checkAiServer() {
  if (!config.serverUrl) return false;
  const isOpenRouter = config.serverUrl.includes("openrouter.ai");
  const headers = {};
  if (isOpenRouter) {
    headers["Authorization"] = `Bearer ${config.openrouterApiKey || ""}`;
    headers["HTTP-Referer"] = "https://agent-panel.local";
    headers["X-OpenRouter-Title"] = "AI Agent Panel";
  } else {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }
  try {
    const resp = await fetch(`${config.serverUrl}/models`, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(5000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}
