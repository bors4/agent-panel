/**
 * Logs endpoints: GET recent logs, DELETE all logs.
 * @module routes/logs
 */
import { Router } from "express";

/**
 * @param {Object} deps
 * @param {Array} deps.agentLogs - shared logs array
 * @returns {Router}
 */
export function createLogsRouter(deps) {
  const router = Router();
  const { agentLogs } = deps;

  /**
   * GET /api/logs?limit=N — recent logs (default 50).
   */
  router.get("/logs", (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    res.json({
      success: true,
      logs: agentLogs.slice(-limit).map((l) => ({ ...l, time: new Date(l.time).toLocaleTimeString() })),
    });
  });

  /**
   * DELETE /api/logs — clear all logs.
   */
  router.delete("/logs", (_req, res) => {
    agentLogs.length = 0;
    res.json({ success: true, message: "Logs cleared" });
  });

  return router;
}
