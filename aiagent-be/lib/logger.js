/**
 * Улучшенный логгер с поддержкой уровней, файлового вывода и ротации.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LOG_LEVEL = (process.env.LOG_LEVEL || "info").toLowerCase();
const MIN_LEVEL = LOG_LEVELS[LOG_LEVEL] ?? LOG_LEVELS.info;

const LOG_DIR = path.resolve(__dirname, "..", "logs");
const LOG_FILE = path.join(LOG_DIR, "app.log");
const ERROR_LOG_FILE = path.join(LOG_DIR, "error.log");
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_LOG_FILES = 5;

// ─── Утилиты ротации ────────────────────────────────────────────

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function rotateIfNeeded(filePath) {
  if (!fs.existsSync(filePath)) return;
  try {
    const stat = fs.statSync(filePath);
    if (stat.size < MAX_LOG_SIZE) return;

    // Сдвигаем старые файлы: app.log.4 → удаляется, app.log.3 → app.log.4, ...
    for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
      const oldPath = `${filePath}.${i}`;
      const newPath = `${filePath}.${i + 1}`;
      if (fs.existsSync(oldPath)) {
        if (i + 1 >= MAX_LOG_FILES) {
          fs.unlinkSync(oldPath);
        } else {
          fs.renameSync(oldPath, newPath);
        }
      }
    }
    fs.renameSync(filePath, `${filePath}.1`);
  } catch (e) {
    console.error("[Logger] Rotation error:", e.message);
  }
}

// ─── Форматирование ─────────────────────────────────────────────

function formatTimestamp() {
  return new Date().toISOString();
}

function formatLog(level, message, meta) {
  const entry = {
    ts: formatTimestamp(),
    level,
    msg: message,
  };
  if (meta) {
    entry.meta =
      meta instanceof Error
        ? { message: meta.message, stack: meta.stack?.split("\n").slice(0, 5).join("\n") }
        : typeof meta === "object"
          ? meta
          : { detail: String(meta) };
  }
  return JSON.stringify(entry);
}

// ─── Запись в файл ───────────────────────────────────────────────

function writeToFile(filePath, line) {
  try {
    ensureLogDir();
    rotateIfNeeded(filePath);
    fs.appendFileSync(filePath, line + "\n", "utf-8");
  } catch (e) {
    console.error("[Logger] File write error:", e.message);
  }
}

// ─── Публичный API ──────────────────────────────────────────────

export function logDebug(message, meta) {
  if (MIN_LEVEL > LOG_LEVELS.debug) return;
  const line = formatLog("debug", message, meta);
  console.debug(`[DEBUG] ${message}`, meta || "");
  writeToFile(LOG_FILE, line);
}

export function logInfo(message, meta) {
  if (MIN_LEVEL > LOG_LEVELS.info) return;
  const line = formatLog("info", message, meta);
  console.log(`[INFO] ${message}`);
  writeToFile(LOG_FILE, line);
}

export function logWarn(message, meta) {
  if (MIN_LEVEL > LOG_LEVELS.warn) return;
  const line = formatLog("warn", message, meta);
  console.warn(`[WARN] ${message}`, meta || "");
  writeToFile(LOG_FILE, line);
  writeToFile(ERROR_LOG_FILE, line);
}

export function logError(message, meta) {
  if (MIN_LEVEL > LOG_LEVELS.error) return;
  const line = formatLog("error", message, meta);
  console.error(`[ERROR] ${message}`, meta || "");
  writeToFile(LOG_FILE, line);
  writeToFile(ERROR_LOG_FILE, line);
}

// ─── Express middleware ──────────────────────────────────────────

export function requestLogger(req, res, next) {
  const start = Date.now();
  const id = crypto.randomUUID().slice(0, 8);

  res.on("finish", () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
    const logFn = level === "error" ? logError : level === "warn" ? logWarn : logInfo;
    logFn(`${req.method} ${req.originalUrl} → ${status} (${duration}ms)`, {
      requestId: id,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });
  });

  req.requestId = id;
  next();
}

// ─── Инициализация ──────────────────────────────────────────────

ensureLogDir();
logInfo("Logger initialized", { level: LOG_LEVEL, dir: LOG_DIR });

export default { logDebug, logInfo, logWarn, logError, requestLogger };
