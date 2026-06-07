/**
 * Status endpoint: bot runtime state, stats, uptime, token usage.
 * @module routes/status
 */
import { Router } from "express";
import { config, stats, tokenUsage } from "../lib/state.js";

/**
 * @param {Object} deps
 * @param {Object} deps.state - runtime state (botStatus, botStatusMessage, startTime)
 * @returns {Router}
 */
export function createStatusRouter(deps) {
  const router = Router();
  const { state } = deps;

  /**
   * GET /api/status — bot status, stats, uptime, token usage.
   * Returns { status, statusMessage, isRunning, configRequired?, configMessage?, stats: { requests, tools, errors }, uptime, startTime, tokenUsage }.
   */
  router.get("/status", (_req, res) => {
    const uptimeMs = state.startTime ? Date.now() - state.startTime : 0;
    res.json({
      success: true,
      status: state.botStatus,
      statusMessage: state.botStatusMessage,
      isRunning: state.botStatus === "running",
      configRequired: !config.projectPath,
      configMessage: !config.projectPath
        ? "Project path is not configured. Set it in Settings or PROJECT_PATH in .env"
        : undefined,
      stats: {
        requests: stats.requests,
        tools: stats.tools,
        errors: stats.errors,
      },
      uptime: Math.floor(uptimeMs / 1000),
      startTime: state.startTime,
      tokenUsage,
    });
  });

  return router;
}
