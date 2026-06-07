/**
 * Управление аккаунтами пользователей и правами доступа к инструментам.
 * Аккаунты хранятся в accounts.json в корне проекта.
 * @module accounts
 */

import path from "path";
import fs from "fs";

/** Список всех доступных инструментов агента. @type {string[]} */
const ALL_TOOLS = ["read", "write", "search", "list_dir", "execute", "create_dir", "delete", "move", "copy"];

/** Разрешения по умолчанию для каждой роли. @type {Object.<string, Object.<string, boolean>>} */
const ROLE_DEFAULTS = {
  system: ALL_TOOLS.reduce((m, t) => ({ ...m, [t]: true }), {}),
  user: { read: true, write: true, list_dir: true, search: true, create_dir: true },
  guest: { read: true },
};

/** Текущий список загруженных аккаунтов. @type {Array} */
let accounts = [];

/**
 * Загрузить аккаунты из accounts.json в корне проекта.
 * @param {string} projectPath - Путь к проекту
 */
export function loadAccounts(projectPath) {
  if (!projectPath) return;
  const filePath = path.join(projectPath, "accounts.json");
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    const loaded = parsed.accounts || [];
    accounts = loaded.map(sanitizeAccount);
  } catch (e) {
    if (e.code === "ENOENT") {
      // File doesn't exist - graceful no-op (accounts remain unchanged)
      return;
    }
    // Handle other errors (corrupted JSON, permissions, etc.)
    const backupPath = filePath + `.bak.${Date.now()}`;
    try {
      fs.renameSync(filePath, backupPath);
    } catch {}
    console.error(`[accounts] Corrupted ${filePath}, backed up to ${backupPath}:`, e.message);
    accounts = [];
  }
}

/**
 * Drop unknown permission keys so stale `accounts.json` (e.g. after tool
 * removal/rename) cannot grant access to non-existent tools.
 * @param {Object} account
 * @returns {Object}
 */
function sanitizeAccount(account) {
  if (!account || typeof account !== "object" || !account.permissions) return account;
  const cleaned = {};
  for (const [tool, allowed] of Object.entries(account.permissions)) {
    if (ALL_TOOLS.includes(tool)) {
      cleaned[tool] = allowed;
    } else {
      console.warn(`[accounts] Dropped unknown permission '${tool}' for @${account.username || "?"}`);
    }
  }
  return { ...account, permissions: cleaned };
}

/**
 * Сохранить аккаунты в accounts.json в корне проекта.
 * @param {string} projectPath - Путь к проекту
 * @param {Array} data - Массив аккаунтов
 */
export function saveAccounts(projectPath, data) {
  if (!projectPath) return;
  const filePath = path.join(projectPath, "accounts.json");
  fs.writeFileSync(filePath, JSON.stringify({ accounts: data }, null, 2), "utf-8");
  accounts = data;
}

/**
 * Получить копию списка аккаунтов.
 * @returns {Array} Копия массива аккаунтов
 */
export function getAccounts() {
  return [...accounts];
}

/**
 * Найти аккаунт по Telegram username.
 * @param {string} username - Имя пользователя (с @ или без)
 * @returns {Object|null} Найденный аккаунт или null
 */
export function getAccountByUsername(username) {
  if (!username) return null;
  const normalized = username.replace(/^@/, "");
  return accounts.find((a) => (a.username || "").replace(/^@/, "") === normalized) || null;
}

/**
 * Получить разрешения по умолчанию для указанной роли.
 * @param {string} role - Роль (system, user, guest)
 * @returns {Object.<string, boolean>} Разрешения
 */
export function getRoleDefaultPermissions(role) {
  return { ...(ROLE_DEFAULTS[role] || ROLE_DEFAULTS.guest) };
}

/**
 * Проверить разрешение инструмента для аккаунта.
 * @param {Object} account - Аккаунт пользователя
 * @param {string} toolName - Название инструмента
 * @param {Object} args - Аргументы инструмента
 * @param {string} projectPath - Путь к проекту
 * @returns {Object} {allowed: boolean, reason?: string}
 * @description
 *   Проверяет:
 *   1. Явный запрет инструмента в account.permissions
 *   2. include_paths — если заданы, путь инструмента должен быть внутри одной из директорий
 *   3. Для инструмента "execute" с include_paths требуется роль "system"
 *      (shell-команды не имеют надёжного пути для проверки границ директорий)
 */
export function checkAccountToolPermission(account, toolName, args, projectPath) {
  if (!account) return { allowed: true };

  if (account.permissions && account.permissions[toolName] === false) {
    return { allowed: false, reason: `Tool '${toolName}' is not available for your account` };
  }

  if (toolName === "execute" && account.role !== "system" && account.include_paths?.length > 0) {
    return {
      allowed: false,
      reason: 'Tool "execute" is not available with include_paths for non-system accounts',
    };
  }

  if (account.include_paths?.length > 0) {
    const toolPath = args.filePath || args.path || args.source || args.destination || "";
    if (toolPath) {
      const resolved = path.resolve(projectPath, toolPath);
      const isWindows = process.platform === "win32";
      const normalize = (p) => (isWindows ? p.toLowerCase().replace(/\\/g, "/") : p.replace(/\\/g, "/"));
      const normalizedResolved = normalize(resolved);

      const allowed = account.include_paths.some((p) => {
        const norm = path.resolve(p);
        const normalizedNorm = normalize(norm);

        // Containment check: resolved must be inside norm
        const rootPrefix = normalizedNorm.endsWith("/") ? normalizedNorm : normalizedNorm + "/";
        return normalizedResolved === normalizedNorm || normalizedResolved.startsWith(rootPrefix);
      });
      if (!allowed) {
        return { allowed: false, reason: "Path not in allowed directories" };
      }
    }
  }

  return { allowed: true };
}

/**
 * Проверить, включён ли инструмент для аккаунта (учитывая глобальную конфигурацию).
 * @param {Object|null} account - Аккаунт пользователя
 * @param {string} toolName - Название инструмента
 * @param {Object} globalToolConfig - Глобальная конфигурация инструментов
 * @returns {boolean} Доступен ли инструмент
 */
export function isToolEnabledForAccount(account, toolName, globalToolConfig) {
  const globalEnabled = globalToolConfig?.[toolName]?.enabled !== false;
  const accountEnabled = account ? account.permissions?.[toolName] !== false : true;
  return globalEnabled && accountEnabled;
}
