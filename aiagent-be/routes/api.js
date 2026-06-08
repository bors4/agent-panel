/**
 * API route aggregator. Mounts all sub-routers under /api and applies auth middleware.
 *
 * Module structure:
 *   routes/middleware.js — x-api-key auth (excludes /health)
 *   routes/health.js     — GET /api/health (no auth)
 *   routes/status.js     — GET /api/status
 *   routes/logs.js       — GET/DELETE /api/logs
 *   routes/tools.js      — GET/POST /api/tools
 *   routes/accounts.js   — GET/POST /api/accounts, POST /api/accounts/import
 *   routes/paths.js      — GET /api/validate-path, /api/directories, /api/browse-folder
 *   routes/admin.js      — POST /api/start, /api/stop, /api/restart, /api/agent/tool, /api/tasks, /api/tasks/cancel
 *   routes/config.js     — GET/POST /api/config, GET /api/models
 *   routes/asr.js        — POST /api/asr/transcribe, GET /api/asr/status
 *   routes/chat.js       — POST /api/chat, /api/chat/cancel, /api/chat/continue, /api/chat/clean-text
 *   routes/fetch.js      — POST /api/fetch
 *
 * @module routes/api
 */
import { Router } from "express";
import { createAuthMiddleware } from "./middleware.js";
import { createHealthRouter } from "./health.js";
import { createStatusRouter } from "./status.js";
import { createLogsRouter } from "./logs.js";
import { createToolsRouter } from "./tools.js";
import { createAccountsRouter } from "./accounts.js";
import { createPathsRouter } from "./paths.js";
import { createAdminRouter } from "./admin.js";
import { createConfigRouter } from "./config.js";
import { createAsrRouter } from "./asr.js";
import { createChatRouter } from "./chat.js";
import { createFetchRouter } from "./fetch.js";

/**
 * Создаёт Express Router с API маршрутами.
 * @param {Object} deps - Зависимости из сервера
 * @returns {Router} Express Router
 */
export function createApiRouter(deps) {
  const router = Router();
  const { config, addLog } = deps;

  router.use(createAuthMiddleware(config, addLog));
  router.use(createHealthRouter(deps));
  router.use(createStatusRouter(deps));
  router.use(createLogsRouter(deps));
  router.use(createToolsRouter());
  router.use(createAccountsRouter(deps));
  router.use(createPathsRouter(deps));
  router.use(createAdminRouter(deps));
  router.use(createConfigRouter(deps));
  router.use(createAsrRouter(deps));
  router.use(createChatRouter(deps));
  router.use(createFetchRouter());

  return router;
}
