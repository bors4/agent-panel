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
import { spawn } from "child_process";
import { safePath } from "../utils.js";
import { checkAccountToolPermission } from "../accounts.js";
import { configDefaults } from "../configDefaults.js";

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/** Значения конфигурации инструмента по умолчанию. */
export const DEFAULT_TOOL_CONFIG = {
  enabled: true,
  permission: "ask",
  exclude_paths: [],
};

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
        content: { type: "string", description: "Content to write" },
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
    description: "Execute a shell command in the project directory",
    category: "system",
    examples: ['<tool>{"name": "execute", "args": {"command": "npm install", "timeout": 60}}</tool>'],
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command to execute" },
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
  Object.assign(toolConfig[name], settings);
}

/**
 * Получить полную конфигурацию всех инструментов.
 * Сливает DEFAULT_TOOL_CONFIG с текущими настройками и метаданными из TOOLS.
 * @returns {Object.<string, Object>} Конфигурация всех инструментов
 */
export function getToolConfig() {
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
 * @param {*} v - Значение для форматирования
 * @param {number} [depth=0] - Текущая глубина рекурсии
 * @returns {string} Отформатированная строка
 */
export function formatValue(v, depth = 0) {
  if (v === null || v === undefined) return "N/A";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;

  // Arrays: format each element with indentation
  if (Array.isArray(v)) {
    if (depth > 2) return `[${v.length} items]`;
    return v
      .map((item) => {
        const formatted = formatValue(item, depth + 1);
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
      .map(([key, val]) => `  • ${key}: ${formatValue(val, depth + 1)}`)
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
 */
async function searchDirectory(dirPath, pattern, results, depth, extension, maxResults, projectPath) {
  if (depth > 5 || results.length >= maxResults) return;

  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (results.length >= maxResults) break;
      if (["node_modules", ".git", "dist", "build", "venv", "__pycache__"].includes(entry.name)) continue;

      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        await searchDirectory(fullPath, pattern, results, depth + 1, extension, maxResults, projectPath);
      } else if (entry.isFile()) {
        // Filter by extension if specified
        if (extension && !entry.name.endsWith(extension.replace("*", ""))) continue;

        try {
          const content = await fs.promises.readFile(fullPath, "utf-8");
          const matches = content.match(pattern);
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
  // If no project path is configured at all, return a clear error
  if (!rawPath) {
    return {
      success: false,
      error: "Project path is not configured. Set it in Settings or PROJECT_PATH in .env",
    };
  }
  const projectPath = path.resolve(rawPath);
  const maxResults = config.maxSearchResults ?? configDefaults.maxSearchResults;

  // Validate project directory exists
  if (!fs.existsSync(projectPath)) {
    return {
      success: false,
      error: `Project directory does not exist: ${projectPath}`,
    };
  }
  if (!fs.statSync(projectPath).isDirectory()) {
    return {
      success: false,
      error: `Project path is not a directory: ${projectPath}`,
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

  console.log(`[executeTool] name=${name}, args=${JSON.stringify(args)}, projectPath="${projectPath}"`);

  try {
    switch (name) {
      // ────────────────────────────────────────────────────────────────────
      case "read": {
        const maxFiles = config.maxFilesInPrompt ?? configDefaults.maxFilesInPrompt;
        if ((config.filesRead ?? 0) >= maxFiles) {
          return { success: true, data: { content: "[File omitted: max files in prompt reached]" } };
        }
        const filePath = safePath(args.filePath, projectPath);
        if (!fs.existsSync(filePath)) {
          return {
            success: false,
            error: `File not found: ${path.relative(projectPath, filePath)}`,
          };
        }
        const content = fs.readFileSync(filePath, "utf-8");
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
        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, args.content, "utf-8");
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
        const results = [];
        const include = args.include || null;

        await searchDirectory(projectPath, regex, results, 0, include, maxResults, projectPath);

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

        if (!fs.existsSync(dirPath)) {
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
        const timeoutSec = Math.min(Math.max(args.timeout || 30, 1), 3600);
        const isWin = process.platform === "win32";
        const trimmedCmd = args.command.trimStart();
        const isPwsh = /^powershell\b/i.test(trimmedCmd) || /^pwsh\b/i.test(trimmedCmd);

        try {
          const result = await new Promise((resolve, reject) => {
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

            const child = spawn(shell, shellArgs, {
              cwd: projectPath,
              encoding: "utf-8",
              maxBuffer: 10 * 1024 * 1024,
              windowsHide: true,
              windowsVerbatimArguments: isWin,
            });

            let stdout = "";
            let stderr = "";

            child.stdout.on("data", (data) => {
              stdout += data.toString();
            });
            child.stderr.on("data", (data) => {
              stderr += data.toString();
            });

            const timer = setTimeout(() => {
              if (process.platform === "win32") {
                child.kill();
              } else {
                child.kill("SIGTERM");
              }
              reject(new Error(`Command timed out after ${timeoutSec}s`));
            }, timeoutSec * 1000);

            child.on("error", (err) => {
              clearTimeout(timer);
              reject(err);
            });

            child.on("close", (code, signal) => {
              clearTimeout(timer);
              const exitCode = code ?? (signal ? 1 : 0);
              resolve({
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                exitCode,
              });
            });
          });

          return {
            success: result.exitCode === 0,
            data: {
              stdout: result.stdout,
              stderr: result.stderr,
              exitCode: result.exitCode,
            },
            error: result.exitCode !== 0 ? `Command exited with code ${result.exitCode}` : undefined,
          };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }

      // ────────────────────────────────────────────────────────────────────
      case "create_dir": {
        const dirPath = safePath(args.path, projectPath);
        fs.mkdirSync(dirPath, { recursive: true });
        return { success: true, data: { path: dirPath } };
      }

      // ────────────────────────────────────────────────────────────────────
      case "delete": {
        const targetPath = safePath(args.path, projectPath);
        if (!fs.existsSync(targetPath)) {
          return {
            success: false,
            error: `Path not found: ${path.relative(projectPath, targetPath)}`,
          };
        }
        const stats = fs.statSync(targetPath);

        if (stats.isDirectory()) {
          if (args.recursive) {
            fs.rmSync(targetPath, { recursive: true, force: true });
          } else {
            const entries = fs.readdirSync(targetPath);
            if (entries.length > 0) {
              return {
                success: false,
                error: `Directory not empty: ${path.relative(projectPath, targetPath)}. Set recursive: true to delete.`,
              };
            }
            fs.rmSync(targetPath, { recursive: false, force: false });
          }
        } else {
          fs.unlinkSync(targetPath);
        }
        return { success: true, data: { path: targetPath } };
      }

      // ────────────────────────────────────────────────────────────────────
      case "move": {
        const source = safePath(args.source, projectPath);
        if (!fs.existsSync(source)) {
          return {
            success: false,
            error: `Source not found: ${path.relative(projectPath, source)}`,
          };
        }
        const destination = safePath(args.destination, projectPath);
        // Ensure destination directory exists
        const destDir = path.dirname(destination);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }
        fs.renameSync(source, destination);
        return { success: true, data: { source, destination } };
      }

      // ────────────────────────────────────────────────────────────────────
      case "copy": {
        const source = safePath(args.source, projectPath);
        if (!fs.existsSync(source)) {
          return {
            success: false,
            error: `Source not found: ${path.relative(projectPath, source)}`,
          };
        }
        const destination = safePath(args.destination, projectPath);
        const destDir = path.dirname(destination);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }
        fs.copyFileSync(source, destination);
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
