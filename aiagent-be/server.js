/**
 * Application entry point: Express + Telegram bot + WebSocket.
 * Module structure:
 *   lib/state.js                — shared runtime state
 *   lib/telegram/bot.js         — initBot factory
 *   lib/telegram/commands.js    — command handlers
 *   lib/telegram/voice.js       — voice message handler
 *   lib/telegram/text.js        — text message handler
 *   lib/telegram/callback.js    — approve/deny callback handler
 *   lib/telegram/approval.js    — continueAfterApproval
 *   lib/telegram/handleAgentResult.js — channel-agnostic result handler
 *   lib/telegram/reply.js       — reply/draft/sanitize helpers
 *   lib/telegram/util.js        — safe error, ffmpeg, rate limit, perf
 *   lib/telegram/log.js         — addLog, wsBroadcast, updateStatus
 *   routes/api.js               — REST API
 * @module server
 */
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import fs from "fs";
import dotenv from "dotenv";
import {
  config,
  runtime,
  stats,
  tokenUsage,
  chatHistories,
  pendingApprovals,
  agentLogs,
  rateLimitMap,
  setWss,
  resetStats,
  resetTokenUsage,
} from "./lib/state.js";
import { initBot } from "./lib/telegram/bot.js";
import { addLog, updateStatus, wsBroadcast } from "./lib/telegram/log.js";
import { loadAccounts, getAccounts } from "./lib/accounts.js";
import { requestLogger } from "./lib/logger.js";
import { createApiRouter } from "./routes/api.js";

dotenv.config();

const app = express();

/**
 * Live alias for `runtime.bot` — exported so callers can access the
 * current Bot instance. ESM exports are live bindings, so reassignment
 * of `runtime.bot` (e.g. via the API) is reflected here.
 * @type {Object|null}
 */
let bot = null;

if (process.env.TELEGRAM_BOT_TOKEN) {
  bot = initBot(process.env.TELEGRAM_BOT_TOKEN);
  runtime.bot = bot;
} else {
  console.warn("[server] TELEGRAM_BOT_TOKEN not set — use web panel to configure");
}

// ─── Accounts loading ────────────────────────────────────────────────────────

loadAccounts(process.cwd());
const initialAccounts = getAccounts().length;
if (initialAccounts > 0) {
  addLog(`Accounts loaded from project root: ${initialAccounts}`, "info");
}

if (config.projectPath && config.projectPath !== process.cwd() && fs.existsSync(config.projectPath)) {
  loadAccounts(config.projectPath);
  const more = getAccounts().length;
  addLog(`Project path: ${config.projectPath}, accounts: ${more}`, "info");
} else if (!config.projectPath) {
  config.projectPath = "";
  addLog("Project path is not configured. Agent blocked until path is set via API or .env", "warning");
}

// ─── Express middleware ──────────────────────────────────────────────────────

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(requestLogger);

// ─── Periodic cleanup: stale rate-limit entries and expired approvals ────────

const APPROVAL_TTL = 10 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [chatId, entry] of rateLimitMap) {
    if (now - entry.windowStart > 60_000 * 2) {
      rateLimitMap.delete(chatId);
    }
  }
  for (const [chatId, entry] of pendingApprovals) {
    if (now - entry.createdAt > APPROVAL_TTL) {
      pendingApprovals.delete(chatId);
    }
  }
}, 5 * 60_000).unref();

// ─── API Routes ──────────────────────────────────────────────────────────────

const apiRouter = createApiRouter({
  config,
  get bot() {
    return runtime.bot;
  },
  set bot(v) {
    runtime.bot = v;
    bot = v;
  },
  initBot,
  stats,
  chatHistories,
  pendingApprovals,
  addLog,
  wsBroadcast,
  state: runtime,
  agentLogs,
  updateStatus,
  tokenUsage,
  resetStats,
  resetTokenUsage,
});
app.use("/api", apiRouter);

// ─── Server + WebSocket ──────────────────────────────────────────────────────

const PORT = process.env.API_PORT || 3000;
const server = createServer(app);

const wss = new WebSocketServer({ noServer: true });
setWss(wss);

server.on("upgrade", (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  if (pathname === "/ws") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  }
});

// Heartbeat
setInterval(() => {
  wss.clients.forEach((client) => {
    if (client.isAlive === false) return client.terminate();
    client.isAlive = false;
    client.ping();
  });
}, 30000);

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });
});

server.listen(PORT, () => {
  addLog(`Server running on port ${PORT}`, "system");
});

export { app, bot, server };
