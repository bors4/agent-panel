/**
 * InstructionLoader — загружает и кэширует инструкции из файлов.
 * Собирает системный промпт из модульных инструкций.
 * @module instructionLoader
 */

import fs from "fs";
import path from "path";
import { logInfo } from "./logger.js";

/** Singleton-экземпляр загрузчика. @type {InstructionLoader|null} */
let instance = null;

export class InstructionLoader {
  /**
   * @param {string} instructionsDir — путь к директории instructions/
   */
  constructor(instructionsDir) {
    this.dir = instructionsDir;
    this.cache = new Map();
    this.loadAll();
  }

  /**
   * Загрузить все инструкции в кэш.
   */
  loadAll() {
    this.cache.clear();

    this.cache.set("core", this._read("core.md"));
    this.cache.set("paths", this._read("paths.md"));
    this.cache.set("file_format", this._read("file_format.md"));

    // Tools
    const toolsDir = path.join(this.dir, "tools");
    if (fs.existsSync(toolsDir)) {
      for (const f of fs.readdirSync(toolsDir)) {
        if (f.endsWith(".md")) {
          this.cache.set("tool:" + f.replace(".md", ""), this._read("tools/" + f));
        }
      }
    }

    // OS
    this.cache.set("os:windows", this._read("os/windows.md"));
    this.cache.set("os:linux", this._read("os/linux.md"));

    // Security
    this.cache.set("security:permissions", this._read("security/permissions.md"));
  }

  /**
   * Прочитать файл инструкции.
   * @param {string} relativePath — относительный путь от instructionsDir
   * @returns {string|null}
   */
  _read(relativePath) {
    const fullPath = path.join(this.dir, relativePath);
    try {
      return fs.readFileSync(fullPath, "utf-8").trim();
    } catch {
      return null;
    }
  }

  /**
   * Получить инструкцию по ключу.
   * @param {string} key
   * @returns {string}
   */
  get(key) {
    return this.cache.get(key) || "";
  }

  /**
   * Загрузить project-specific инструкции из INSTRUCTIONS.md в корне проекта.
   * @param {string} projectPath
   * @returns {string}
   */
  getProjectInstructions(projectPath) {
    if (!projectPath) return "";
    const instrFile = path.join(projectPath, "INSTRUCTIONS.md");
    try {
      return fs.readFileSync(instrFile, "utf-8").trim();
    } catch {
      return "";
    }
  }

  /**
   * Собрать полный системный промпт из модульных инструкций.
   * @param {Object} opts
   * @param {string} opts.projectPath — путь к проекту
   * @param {string} opts.systemPrompt — кастомный промпт из UI
   * @param {boolean} opts.useFunctionCalling — использовать function calling
   * @param {Object|null} opts.account — аккаунт пользователя
   * @param {Object} opts.toolConfig — конфигурация инструментов
   * @returns {string}
   */
  buildSystemPrompt({ projectPath, systemPrompt, useFunctionCalling, account, toolConfig }) {
    const parts = [];

    // 1. Core
    const core = this.get("core");
    if (core) parts.push(core);

    // 2. Paths
    const paths = this.get("paths");
    if (paths) parts.push(paths);

    // 3. File format
    const fileFormat = this.get("file_format");
    if (fileFormat) parts.push(fileFormat);

    // 4. OS-specific
    const osType = process.platform === "win32" ? "windows" : "linux";
    const osInstr = this.get("os:" + osType);
    if (osInstr) parts.push(osInstr);

    // 5. Tools (enabled only)
    if (toolConfig) {
      for (const [name, tool] of Object.entries(toolConfig)) {
        if (tool.enabled !== false) {
          const toolInstr = this.get("tool:" + name);
          if (toolInstr) parts.push(toolInstr);
        }
      }
    }

    // 6. Security
    const security = this.get("security:permissions");
    if (security) parts.push(security);

    // 7. Project path
    if (projectPath) {
      parts.push("# Working Directory\n\nYou are working in: " + projectPath);
      parts.push("Use ONLY RELATIVE paths in tool calls.");
    }

    // 8. Project-specific instructions (INSTRUCTIONS.md)
    const projectInstr = this.getProjectInstructions(projectPath);
    if (projectInstr) parts.push(projectInstr);

    // 9. Account
    if (account) {
      let accountSection = "# Account\n\nRole: " + account.role;
      if (account.include_paths?.length > 0) {
        accountSection += "\nAllowed directories: " + account.include_paths.join(", ");
      }
      parts.push(accountSection);
    }

    // 10. Custom prompt
    if (systemPrompt) parts.push(systemPrompt);

    // 11. Tool calling mode
    if (useFunctionCalling) {
      parts.push("Use function calling.");
    } else {
      parts.push(
        'Use: \u003ctool_call\u003e\u003cfunction\u003emove\u003c/function\u003e\u003cparameter name="source"\u003etest.txt'
      );
    }

    return parts.join("\n\n");
  }
}

/**
 * Получить или создать singleton-экземпляр InstructionLoader.
 * @param {string} [instructionsDir] — путь к директории инструкций
 * @returns {InstructionLoader}
 */
export function getInstructionLoader(instructionsDir) {
  if (!instance) {
    const dir =
      instructionsDir ||
      path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..", "instructions");
    instance = new InstructionLoader(dir);
    logInfo("[InstructionLoader] Loaded instructions from: " + dir);
  }
  return instance;
}

/**
 * Сбросить singleton (для тестов).
 */
export function resetInstructionLoader() {
  instance = null;
}
