/**
 * Tool permission check: combines account-level and global config rules.
 * @module permissions
 */
import path from "path";
import { checkAccountToolPermission } from "../../accounts.js";
import { DEFAULT_TOOL_CONFIG, toolConfig } from "./registry.js";

/**
 * Проверить, разрешено ли использование инструмента с указанными аргументами.
 * Учитывает глобальный конфиг инструмента (enabled, permission, exclude_paths) и права аккаунта.
 * @param {string} toolName - Название инструмента
 * @param {Object} args - Аргументы вызова
 * @param {string} projectPath - Путь к проекту
 * @param {Object} [account] - Аккаунт пользователя
 * @returns {Object} Результат проверки вида {allowed: boolean, reason?: string}
 */
export function checkToolPermission(toolName, args, projectPath, account) {
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
