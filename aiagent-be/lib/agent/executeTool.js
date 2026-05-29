/**
 * Tool execution engine for AI agent.
 * Handles file operations, search, and system commands.
 * @module executeTool
 */

/**
 * Конфигурация инструмента по умолчанию.
 * @typedef {Object} ToolConfig
 * @property {boolean} enabled - Включён ли инструмент
 * @property {"ask"|"always"|"deny"} permission - Режим подтверждения
 * @property {string[]} exclude_paths - Исключённые пути
 */

/**
 * Результат выполнения инструмента.
 * @typedef {Object} ToolResult
 * @property {boolean} success - Успешность выполнения
 * @property {Object} [data] - Данные результата
 * @property {string} [error] - Текст ошибки
 * @property {boolean} [requiresApproval] - Требуется ли подтверждение
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";
import { safePath } from "../utils.js";
import { checkAccountToolPermission } from "../accounts.js";
import { configDefaults } from "../configDefaults.js";
import { logInfo } from "../logger.js";

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp",
  ".mp3", ".mp4", ".avi", ".mov", ".wav", ".flac", ".ogg",
  ".zip", ".tar", ".gz", ".rar", ".7z",
  ".exe", ".dll", ".so", ".dylib", ".o", ".a", ".lib",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".bin", ".dat", ".db", ".sqlite",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  ".wasm", ".class", ".pyc", ".cur",
]);

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/** Значения конфигурации инструмента по умолчанию. */
export const DEFAULT_TOOL_CONFIG = {
  enabled: true,
  permission: "ask",
  exclude_paths: [],
};

/**
 * Активные дочерние процессы (длительные команды execute).
 * @type {Map<string, {child: ChildProcess, pid: number, taskId: string, command: string, startTime: number, status: string, stdout: string, stderr: string, exitCode: number|null, error: string|null, promise: Promise, completedAt: number|null}>}
 */
export const activeProcesses = new Map();

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

/**
 * Определения всех доступных инструментов AI агента.
 * Каждый инструмент содержит name, description, category, examples и input_schema.
 * @type {Object.<string, {name: string, description: string, category: string, examples: string[], input_schema: Object}>}
 */
export const TOOLS = {
  read: {
    name: "read",
    description: "Read file contents from the project directory",
    category: "file",
    examples: ['<tool>{"name": "read", "args": {"filePath": "src/main.js"}}</tool>'],
    input_schema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "Path to file relative to project",
        },
      },
      required: ["filePath"],
    },
  },
  write: {
    name: "write",
    description: "Create or overwrite a file with content",
    category: "file",
    examples: ['<tool>{"name": "write", "args": {"filePath": "output.txt", "content": "Hello World"}}</tool>'],
    input_schema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "Path to file relative to project",
        },
        content: { type: "string", description: "Raw file content saved as-is. Match format to file extension (.json -> JSON, .html -> HTML, .js -> JS, etc.). Do NOT wrap in response objects like {success, data, content}." },
      },
      required: ["filePath", "content"],
    },
  },
  search: {
    name: "search",
    description: "Search for pattern in all files recursively",
    category: "search",
    examples: ['<tool>{"name": "search", "args": {"pattern": "TODO", "include": "*.js"}}</tool>'],
    input_schema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Regex pattern to search" },
        include: { type: "string", description: "File filter, e.g. *.js" },
      },
      required: ["pattern"],
    },
  },
  list_dir: {
    name: "list_dir",
    description: "List directory contents as flat list",
    category: "file",
    examples: ['<tool>{"name": "list_dir", "args": {"path": ".", "depth": 1}}</tool>'],
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Directory path relative to project",
        },
        depth: { type: "number", description: "Max depth (1-3)" },
      },
    },
  },
  execute: {
    name: "execute",
    description: "Execute a shell command. Error output (stderr) is returned on failure — learn from it. Prefer simple, direct commands.",
    category: "system",
    examples: ['<tool>{"name": "execute", "args": {"command": "npm install", "timeout": 60}}</tool>'],
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command to execute. Prefer simple one-line commands." },
        timeout: {
          type: "number",
          description: "Timeout in seconds (max 120)",
        },
      },
      required: ["command"],
    },
  },
  create_dir: {
    name: "create_dir",
    description: "Create a new directory",
    category: "file",
    examples: ['<tool>{"name": "create_dir", "args": {"path": "new-folder"}}</tool>'],
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Directory path relative to project",
        },
      },
      required: ["path"],
    },
  },
  delete: {
    name: "delete",
    description: "Delete a file or directory",
    category: "file",
    examples: ['<tool>{"name": "delete", "args": {"path": "temp/file.txt"}}</tool>'],
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to file or directory" },
      },
      required: ["path"],
    },
  },
  move: {
    name: "move",
    description: "Move or rename a file or directory",
    category: "file",
    examples: ['<tool>{"name": "move", "args": {"source": "old.txt", "destination": "new.txt"}}</tool>'],
    input_schema: {
      type: "object",
      properties: {
        source: { type: "string", description: "Source path" },
        destination: { type: "string", description: "Destination path" },
      },
      required: ["source", "destination"],
    },
  },
  copy: {
    name: "copy",
    description: "Copy a file",
    category: "file",
    examples: ['<tool>{"name": "copy", "args": {"source": "file.txt", "destination": "file.bak"}}</tool>'],
    input_schema: {
      type: "object",
      properties: {
        source: { type: "string", description: "Source file path" },
        destination: { type: "string", description: "Destination file path" },
      },
      required: ["source", "destination"],
    },
  },
};

// ============================================================================
// CONFIGURATION STORE
// ============================================================================

/**
 * Текущая конфигурация инструментов (мутабельная, инициализируется при старте).
 * @type {Object.<string, {enabled: boolean, permission: string, exclude_paths: string[]}>}
 */
export const toolConfig = {};

/** Инициализировать toolConfig значениями по умолчанию для всех инструментов. */
(function seedToolConfig() {
  for (const name of Object.keys(TOOLS)) {
    toolConfig[name] = { ...DEFAULT_TOOL_CONFIG };
  }
})();

/**
 * Обновить конфигурацию конкретного инструмента.
 * @param {string} name - Название инструмента
 * @param {Object} settings - Новые настройки (enabled, permission, exclude_paths)
 */
export function updateToolConfig(name, settings) {
  if (!toolConfig[name]) {
    toolConfig[name] = { ...DEFAULT_TOOL_CONFIG };
  }
  const blockedKeys = ["__proto__", "constructor", "prototype"];
  for (const key of Object.keys(settings)) {
    if (!blockedKeys.includes(key)) {
      toolConfig[name][key] = settings[key];
    }
  }
  configDirty = true;
}

/** @type {Object|null} */
let cachedConfig = null;
/** @type {boolean} */
let configDirty = true;

/**
 * Получить полную конфигурацию всех инструментов.
 * Сливает DEFAULT_TOOL_CONFIG с текущими настройками и метаданными из TOOLS.
 * Результат кэшируется до следующего updateToolConfig.
 * @returns {Object.<string, Object>} Конфигурация всех инструментов
 */
export function getToolConfig() {
  if (!configDirty && cachedConfig) return cachedConfig;
  const config = {};
  for (const [name, tool] of Object.entries(TOOLS)) {
    config[name] = {
      ...DEFAULT_TOOL_CONFIG,
      ...(toolConfig[name] || {}),
      name: tool.name,
      description: tool.description,
      category: tool.category,
      examples: tool.examples,
      input_schema: tool.input_schema,
    };
  }
  configDirty = false;
  cachedConfig = config;
  return config;
}

// ============================================================================
// PERMISSION CHECK
// ============================================================================

/**
 * Проверить, разрешено ли использование инструмента с указанными аргументами.
 * Учитывает глобальный конфиг инструмента (enabled, permission, exclude_paths) и права аккаунта.
 * @param {string} toolName - Название инструмента
 * @param {Object} args - Аргументы вызова
 * @param {string} projectPath - Путь к проекту
 * @param {Object} [account] - Аккаунт пользователя
 * @returns {Object} Результат проверки вида {allowed: boolean, reason?: string}
 */
function checkToolPermission(toolName, args, projectPath, account) {
  const accountCheck = checkAccountToolPermission(account, toolName, args, projectPath);
  if (!accountCheck.allowed) return accountCheck;

  const config = toolConfig[toolName] || DEFAULT_TOOL_CONFIG;

  if (!config.enabled) {
    return { allowed: false, reason: "Tool is disabled" };
  }

  if (config.permission === "deny") {
    return { allowed: false, reason: "Tool is denied by configuration" };
  }

  const toolPath = args.filePath || args.path || args.source || args.destination || "";
  const normalizedPath = path.normalize(toolPath).replace(/\\/g, "/");

  if (config.exclude_paths) {
    const segments = normalizedPath.split("/");
    for (const exclude of config.exclude_paths) {
      if (segments.some((seg) => seg === exclude)) {
        return {
          allowed: false,
          reason: `Path matches exclude pattern: ${exclude}`,
        };
      }
    }
  }

  return { allowed: true };
}

// ============================================================================
// HELPER: FORMAT VALUE FOR TELEGRAM DISPLAY
// ============================================================================

/**
 * Рекурсивно форматирует любое значение для безопасного отображения в Telegram.
 * Обрабатывает вложенные объекты, массивы и структуры файлов/директорий.
 * Защищает от циклических ссылок.
 * @param {*} v - Значение для форматирования
 * @param {number} [depth=0] - Текущая глубина рекурсии
 * @param {Set<Object>} [visited=new Set()] - Набор посещенных объектов для защиты от циклов
 * @returns {string} Отформатированная строка
 */
export function formatValue(v, depth = 0, visited = new Set()) {
  // Handle primitives
  if (v === null || v === undefined) return "N/A";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;

  // Handle objects (including arrays) for circular reference check
  if (typeof v === "object") {
    // Check for circular reference
    if (visited.has(v)) {
      return "[Circular]";
    }
    
    // Add current object to visited set
    visited.add(v);
  }

  // Arrays: format each element with indentation
  if (Array.isArray(v)) {
    if (depth > 2) return `[${v.length} items]`;
    return v
      .map((item) => {
        const formatted = formatValue(item, depth + 1, visited);
        return Array.isArray(item) ? `\n${formatted}` : formatted;
      })
      .join("\n  ");
  }

  // Objects: special handling for file/directory entries
  if (typeof v === "object") {
    // File/directory format: { name, type } or { name, isDirectory }
    if (v.name && (v.type || v.isDirectory !== undefined)) {
      const icon = v.type === "directory" || v.isDirectory ? "📁" : "📄";
      return `${icon} ${v.name}`;
    }
    // Simple serialization for other objects
    if (depth > 1) return JSON.stringify(v);
    return Object.entries(v)
      .map(([key, val]) => `  • ${key}: ${formatValue(val, depth + 1, visited)}`)
      .join("\n");
  }

  return String(v);
}

// ============================================================================
// HELPER: LIST DIRECTORY AS FLAT ARRAY (for easy display)
// ============================================================================

/**
 * Рекурсивно обходит директорию, возвращая плоский массив отформатированных строк.
 * Пропускает скрытые файлы, node_modules, .git и другие стандартные исключения.
 * @param {string} dirPath - Путь к директории
 * @param {number} maxDepth - Максимальная глубина обхода
 * @param {number} [currentDepth=0] - Текущая глубина (для рекурсии)
 * @returns {Promise<string[]>} Массив строк вида "📁 src/" / "📄 file.js"
 */
async function listDirectoryFlat(dirPath, maxDepth, currentDepth = 0) {
  if (currentDepth >= maxDepth) return [];

  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const result = [];

    for (const entry of entries) {
      // Skip hidden files and common ignore patterns
      if (
        entry.name.startsWith(".") ||
        ["node_modules", ".git", "dist", "build", "venv", "__pycache__"].includes(entry.name)
      ) {
        continue;
      }

      const icon = entry.isDirectory() ? "📁" : "📄";
      const suffix = entry.isDirectory() ? "/" : "";
      result.push(`${icon} ${entry.name}${suffix}`);

      // Recurse into subdirectories if depth allows
      if (entry.isDirectory() && currentDepth + 1 < maxDepth) {
        const subPath = path.join(dirPath, entry.name);
        const subEntries = await listDirectoryFlat(subPath, maxDepth, currentDepth + 1);
        // Indent sub-entries for visual hierarchy
        result.push(...subEntries.map((s) => "  " + s));
      }
    }

    return result;
  } catch (e) {
    console.warn(`[listDirectoryFlat] Error reading ${dirPath}:`, e.message);
    return [];
  }
}

// ============================================================================
// HELPER: REDOS DETECTION
// ============================================================================

/**
 * Проверяет паттерн на ReDoS-потенциал: квантификатор снаружи группы,
 * внутри которой уже есть квантификатор (т.н. "nested quantifiers").
 * @param {string} pattern - Regex паттерн
 * @returns {boolean} true если паттерн потенциально опасен
 */
export function rejectReDoS(pattern) {
  let depth = 0;
  const depthHasQuantifier = new Set();

  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "(" && pattern[i - 1] !== "\\") {
      depth++;
    } else if (c === ")" && pattern[i - 1] !== "\\") {
      const hadQuantifier = depthHasQuantifier.has(depth);
      const next = pattern[i + 1];
      if (hadQuantifier && (next === "+" || next === "*" || next === "?" || next === "{")) {
        return true;
      }
      depthHasQuantifier.delete(depth);
      depth--;
      if (hadQuantifier && depth > 0) {
        depthHasQuantifier.add(depth);
      }
    } else if ((c === "+" || c === "*" || c === "?") && pattern[i - 1] !== "\\" && depth > 0) {
      depthHasQuantifier.add(depth);
    }
  }
  return false;
}

// ============================================================================
// HELPER: SEARCH DIRECTORY
// ============================================================================

/**
 * Рекурсивно обходит директорию в поиске файлов, соответствующих паттерну.
 * Мутирует переданный массив results, добавляя найденные совпадения.
 * @param {string} dirPath - Путь к директории
 * @param {RegExp} pattern - Regex для поиска
 * @param {Array} results - Массив для накопления результатов (мутируется)
 * @param {number} depth - Текущая глубина рекурсии
 * @param {string|null} extension - Фильтр по расширению (e.g. "*.js") или null
 * @param {number} maxResults - Максимальное количество результатов
 * @param {string} projectPath - Корень проекта для вычисления относительных путей
 * @param {number} maxSearchFileSize - Максимальный размер файла в байтах
 * @param {number} maxFileChars - Макс. символов для regex matching
 */
async function searchDirectory(dirPath, pattern, results, depth, extension, maxResults, projectPath, maxSearchFileSize, maxFileChars) {
  if (depth > 5 || results.length >= maxResults) return;

  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (results.length >= maxResults) break;
      if (["node_modules", ".git", "dist", "build", "venv", "__pycache__"].includes(entry.name)) continue;

      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        await searchDirectory(fullPath, pattern, results, depth + 1, extension, maxResults, projectPath, maxSearchFileSize, maxFileChars);
      } else if (entry.isFile()) {
        // Filter by extension if specified
        if (extension && !entry.name.endsWith(extension.replace("*", ""))) continue;

        // Skip known binary extensions
        const ext = path.extname(entry.name).toLowerCase();
        if (BINARY_EXTENSIONS.has(ext)) continue;

        try {
          // Check file size before reading
          const stat = await fs.promises.stat(fullPath);
          if (stat.size > maxSearchFileSize) continue;

          // Null-byte sniff on first 512 bytes, then full read via same handle
          let filehandle;
          try {
            filehandle = await fs.promises.open(fullPath, "r");
            const buf = Buffer.alloc(512);
            const { bytesRead } = await filehandle.read(buf, 0, 512, 0);
            if (bytesRead > 0 && buf.subarray(0, bytesRead).includes(0)) continue;

            const content = await filehandle.readFile("utf-8");
            const searchContent = content.slice(0, maxFileChars);
            const matches = searchContent.match(pattern);
            if (matches && results.length < maxResults) {
              const relativePath = path.relative(projectPath, fullPath).replace(/\\/g, "/");
              results.push({
                file: relativePath,
                matches: matches.length,
                preview: content
                  .substring(
                    Math.max(0, content.indexOf(matches[0]) - 50),
                    Math.min(content.length, content.indexOf(matches[0]) + 100)
                  )
                  .replace(/\n/g, " "),
              });
            }
          } finally {
            if (filehandle) await filehandle.close().catch(() => {});
          }
        } catch (_e) {
          /* skip unreadable files */
        }
      }
    }
  } catch (_e) {
    /* skip inaccessible directories */
  }
}

// ============================================================================
// MAIN: EXECUTE TOOL
// ============================================================================

/**
 * Выполнить инструмент AI агента.
 * Выполняет файловые операции, поиск и системные команды с проверкой прав.
 * @param {Object} toolCall - Вызов инструмента
 * @param {string} toolCall.name - Название инструмента
 * @param {Object} toolCall.args - Аргументы инструмента
 * @param {Object} config - Конфигурация выполнения
 * @param {string} config.projectPath - Путь к проекту
 * @param {Object} [config.account] - Аккаунт пользователя
 * @param {number} [config.maxSearchResults=15] - Макс. результатов поиска
 * @param {number} [config.maxSearchFileSize=1048576] - Макс. размер файла для поиска (байт)
 * @param {number} [config.maxFileChars=2000] - Макс. символов при чтении файла
 * @param {number} [config.maxFilesInPrompt=2] - Макс. файлов в промпте
 * @param {number} [config.filesRead=0] - Счётчик прочитанных файлов
 * @returns {Promise<ToolResult>} Результат выполнения
 */
export async function executeTool(toolCall, config = {}) {
  const { name, args = {} } = toolCall;
  // Resolve projectPath: server passes it via config (from .env or API /api/config).
  const rawPath = config.projectPath || "";
  const account = config.account;
  const chatMode = config.chatMode || false;

  let resolvedPath = rawPath;
  if (!resolvedPath && chatMode && account?.include_paths?.length > 0) {
    resolvedPath = account.include_paths[0];
  }

  if (!resolvedPath) {
    return {
      success: false,
      error: "Project path is not configured. Set it in Settings or PROJECT_PATH in .env",
    };
  }
  const projectPath = path.resolve(resolvedPath);
  const maxResults = config.maxSearchResults ?? configDefaults.maxSearchResults;
  const maxSearchFileSize = config.maxSearchFileSize ?? configDefaults.maxSearchFileSize;
  const maxFileChars = config.maxFileChars ?? configDefaults.maxFileChars;

  // Validate project directory exists
  try {
    const projectStat = await fs.promises.stat(projectPath);
    if (!projectStat.isDirectory()) {
      return {
        success: false,
        error: `Project path is not a directory: ${projectPath}`,
      };
    }
  } catch {
    return {
      success: false,
      error: `Project directory does not exist: ${projectPath}`,
    };
  }

  // Validate tool exists
  if (!TOOLS[name]) {
    return { success: false, error: `Unknown tool: ${name}` };
  }

  // Check permissions
  const permission = checkToolPermission(name, args, projectPath, account);
  if (!permission.allowed) {
    const toolCfg = getToolConfig()[name] || {};
    return { success: false, error: permission.reason, requiresApproval: toolCfg.permission === "ask" };
  }

  logInfo(`execute: ${name}`, { args: JSON.stringify(args).slice(0, 200), projectPath });

  try {
    switch (name) {
      // ────────────────────────────────────────────────────────────────────
      case "read": {
        const maxFiles = config.maxFilesInPrompt ?? configDefaults.maxFilesInPrompt;
        if ((config.filesRead ?? 0) >= maxFiles) {
          return { success: true, data: { content: "[File omitted: max files in prompt reached]" } };
        }
        const filePath = safePath(args.filePath, projectPath);
        try {
          await fs.promises.access(filePath);
        } catch {
          return {
            success: false,
            error: `File not found: ${path.relative(projectPath, filePath)}`,
          };
        }
        const content = await fs.promises.readFile(filePath, "utf-8");
        const maxChars = config.maxFileChars ?? configDefaults.maxFileChars;
        const truncated =
          content.length > maxChars
            ? content.slice(0, maxChars) + `\n\n... [truncated, ${content.length - maxChars} more chars]`
            : content;
        return {
          success: true,
          data: { content: truncated, fullLength: content.length },
        };
      }

      // ────────────────────────────────────────────────────────────────────
      case "write": {
        const filePath = safePath(args.filePath, projectPath);
        await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
        await fs.promises.writeFile(filePath, args.content, "utf-8");
        return {
          success: true,
          data: { path: filePath, size: args.content.length },
        };
      }

      // ────────────────────────────────────────────────────────────────────
      case "search": {
        const pattern = args.pattern;
        if (pattern?.length > 200) {
          return { success: false, error: "Search pattern too long (max 200 chars)" };
        }
        let regex;
        try {
          regex = new RegExp(pattern, "gi");
        } catch (e) {
          return { success: false, error: `Invalid regex pattern: ${e.message}` };
        }
        if (rejectReDoS(pattern)) {
          return { success: false, error: "Search pattern rejected: too complex (nested quantifiers)" };
        }
        const results = [];
        const include = args.include || null;

        await searchDirectory(projectPath, regex, results, 0, include, maxResults, projectPath, maxSearchFileSize, maxFileChars);

        return {
          success: true,
          data: {
            results: results.slice(0, maxResults),
            total: results.length,
          },
        };
      }

      // ────────────────────────────────────────────────────────────────────
      case "list_dir": {
        const dirPath = args.path ? safePath(args.path, projectPath) : projectPath;
        const depth = Math.min(args.depth || 1, 3);

        try {
          await fs.promises.access(dirPath);
        } catch {
          return {
            success: false,
            error: `Directory not found: ${path.relative(projectPath, dirPath)}`,
          };
        }

        // Returns flat array: ["📁 src/", "  📄 file.js", ...]
        const tree = await listDirectoryFlat(dirPath, depth, 0);

        return {
          success: true,
          data: {
            tree, // ← Array of strings, not nested objects!
            path: dirPath,
          },
        };
      }

      // ────────────────────────────────────────────────────────────────────
      case "execute": {
        const taskId = crypto.randomUUID();
        const defaultTimeout = config.executeTimeout ?? configDefaults.executeTimeout;
        const timeoutSec = args.timeout !== undefined
          ? (args.timeout > 0 ? Math.min(args.timeout, 3600) : (args.timeout === 0 ? 0 : 1))
          : defaultTimeout;
        const isWin = process.platform === "win32";
        const trimmedCmd = args.command.trimStart();
        const isPwsh = /^powershell\b/i.test(trimmedCmd) || /^pwsh\b/i.test(trimmedCmd);

        let child;
        try {
          const { shell, shellArgs } = isWin && isPwsh
            ? (() => {
                const pwshCmd = trimmedCmd
                  .replace(/^(powershell|pwsh)\s+/i, "")
                  .replace(/^(-command|-c)\s+/i, "")
                  .trim()
                  .replace(/^["'](.*)["']\s*$/, "$1");
                return { shell: "powershell.exe", shellArgs: ["-NoLogo", "-NoProfile", "-Command", pwshCmd] };
              })()
            : isWin
              ? { shell: "cmd.exe", shellArgs: ["/d", "/c", args.command] }
              : { shell: "/bin/sh", shellArgs: ["-c", args.command] };

          child = spawn(shell, shellArgs, {
            cwd: projectPath,
            encoding: "utf-8",
            maxBuffer: 10 * 1024 * 1024,
            windowsHide: true,
            windowsVerbatimArguments: isWin,
          });
        } catch (e) {
          return { success: false, error: `Failed to spawn process: ${e.message}` };
        }

        const entry = {
          child,
          pid: child.pid,
          taskId,
          command: args.command,
          startTime: Date.now(),
          status: "running",
          stdout: "",
          stderr: "",
          exitCode: null,
          error: null,
        };
        activeProcesses.set(taskId, entry);

        entry.promise = new Promise((resolve) => {
          child.stdout.on("data", (data) => {
            entry.stdout += data.toString();
          });
          child.stderr.on("data", (data) => {
            entry.stderr += data.toString();
          });

          let timer;
          if (timeoutSec > 0) {
            timer = setTimeout(() => {
              if (process.platform === "win32") {
                child.kill();
              } else {
                child.kill("SIGTERM");
              }
              entry.status = "timeout";
              entry.completedAt = Date.now();
              resolve({ stdout: entry.stdout.trim(), stderr: entry.stderr.trim(), exitCode: null, error: `Command timed out after ${timeoutSec}s` });
            }, timeoutSec * 1000);
          }

          child.on("error", (err) => {
            clearTimeout(timer);
            entry.status = "error";
            entry.completedAt = Date.now();
            entry.error = err.message;
            resolve({ stdout: entry.stdout.trim(), stderr: entry.stderr.trim(), exitCode: 1, error: err.message });
          });

          child.on("close", (code, signal) => {
            clearTimeout(timer);
            entry.exitCode = code ?? (signal ? 1 : 0);
            entry.status = entry.exitCode === 0 ? "completed" : "failed";
            entry.completedAt = Date.now();
            resolve({ stdout: entry.stdout.trim(), stderr: entry.stderr.trim(), exitCode: entry.exitCode });
          });
        });

        // Clean up from active processes after 1 min
        entry.promise.then(() => {
          setTimeout(() => activeProcesses.delete(taskId), 60000);
        });

        return {
          success: true,
          data: { taskId, pid: child.pid, status: "running", command: args.command },
        };
      }

      // ────────────────────────────────────────────────────────────────────
      case "create_dir": {
        const dirPath = safePath(args.path, projectPath);
        await fs.promises.mkdir(dirPath, { recursive: true });
        return { success: true, data: { path: dirPath } };
      }

      // ────────────────────────────────────────────────────────────────────
      case "delete": {
        const targetPath = safePath(args.path, projectPath);
        let stats;
        try {
          stats = await fs.promises.stat(targetPath);
        } catch {
          return {
            success: false,
            error: `Path not found: ${path.relative(projectPath, targetPath)}`,
          };
        }

        if (stats.isDirectory()) {
          if (args.recursive) {
            await fs.promises.rm(targetPath, { recursive: true, force: true });
          } else {
            const entries = await fs.promises.readdir(targetPath);
            if (entries.length > 0) {
              return {
                success: false,
                error: `Directory not empty: ${path.relative(projectPath, targetPath)}. Set recursive: true to delete.`,
              };
            }
            await fs.promises.rm(targetPath, { recursive: false, force: false });
          }
        } else {
          await fs.promises.unlink(targetPath);
        }
        return { success: true, data: { path: targetPath } };
      }

      // ────────────────────────────────────────────────────────────────────
      case "move": {
        const source = safePath(args.source, projectPath);
        try {
          await fs.promises.access(source);
        } catch {
          return {
            success: false,
            error: `Source not found: ${path.relative(projectPath, source)}`,
          };
        }
        const destination = safePath(args.destination, projectPath);
        await fs.promises.mkdir(path.dirname(destination), { recursive: true });
        await fs.promises.rename(source, destination);
        return { success: true, data: { source, destination } };
      }

      // ────────────────────────────────────────────────────────────────────
      case "copy": {
        const source = safePath(args.source, projectPath);
        try {
          await fs.promises.access(source);
        } catch {
          return {
            success: false,
            error: `Source not found: ${path.relative(projectPath, source)}`,
          };
        }
        const destination = safePath(args.destination, projectPath);
        await fs.promises.mkdir(path.dirname(destination), { recursive: true });
        await fs.promises.copyFile(source, destination);
        return { success: true, data: { source, destination } };
      }

      // ────────────────────────────────────────────────────────────────────
      default:
        return { success: false, error: `Tool ${name} not implemented` };
    }
  } catch (e) {
    console.error(`[executeTool] Error in ${name}:`, e);
    return { success: false, error: e.message };
  }
}

// ============================================================================
// ASYNC TASK HELPERS
// ============================================================================

/**
 * Дождаться завершения фоновой задачи (execute).
 * @param {string} taskId - ID задачи из executeTool
 * @returns {Promise<{success: boolean, data: {stdout: string, stderr: string, exitCode: number}, error?: string}>}
 */
export async function waitForTask(taskId) {
  const entry = activeProcesses.get(taskId);
  if (!entry) throw new Error(`Task ${taskId} not found or expired`);

  let result;
  if (entry.status === "running") {
    // Wait for the promise, but also check if task might have been cleaned up during await
    try {
      result = await entry.promise;
    } catch (err) {
      // If promise was somehow corrupted or cleanup happened, use stored data
      result = { 
        stdout: entry.stdout.trim(), 
        stderr: entry.stderr.trim(), 
        exitCode: entry.exitCode || 1, 
        error: err.message || "Task execution failed" 
      };
    }
  } else {
    result = { stdout: entry.stdout.trim(), stderr: entry.stderr.trim(), exitCode: entry.exitCode, error: entry.error };
  }

  return {
    success: result.exitCode === 0,
    data: {
      stdout: result.stdout || "",
      stderr: result.stderr || "",
      exitCode: result.exitCode,
    },
    error: result.exitCode !== 0 ? (result.error || `Command exited with code ${result.exitCode}`) : undefined,
  };
}

/**
 * Отменить запущенную задачу.
 * @param {string} taskId - ID задачи
 * @returns {boolean} true если задача была отменена
 */
export function cancelTask(taskId) {
  const entry = activeProcesses.get(taskId);
  if (!entry || entry.status !== "running") return false;
  if (process.platform === "win32") {
    entry.child.kill();
  } else {
    entry.child.kill("SIGTERM");
  }
  entry.status = "cancelled";
  entry.completedAt = Date.now();
  return true;
}

/**
 * Получить список активных задач.
 * @returns {Array<{taskId: string, pid: number, command: string, startTime: number, uptime: number}>}
 */
export function getActiveTasks() {
  const tasks = [];
  for (const [, entry] of activeProcesses) {
    if (entry.status === "running") {
      tasks.push({
        taskId: entry.taskId,
        pid: entry.pid,
        command: entry.command.substring(0, 100),
        startTime: entry.startTime,
        uptime: Date.now() - entry.startTime,
      });
    }
  }
  return tasks;
}
