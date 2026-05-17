/**
 * Управление аккаунтами пользователей и правами доступа к инструментам.
 * Аккаунты хранятся в accounts.json в корне проекта.
 * @module accounts
 */

import path from "path";
import fs from "fs";

const ALL_TOOLS = [
  "read", "write", "search", "list_dir", "execute",
  "create_dir", "delete", "move", "copy",
];

const ROLE_DEFAULTS = {
  system: ALL_TOOLS.reduce((m, t) => ({ ...m, [t]: true }), {}),
  user:   { read: true, write: true, list_dir: true, search: true, create_dir: true },
  guest:  { read: true },
};

let accounts = [];

export function loadAccounts(projectPath) {
  if (!projectPath) return;
  const filePath = path.join(projectPath, "accounts.json");
  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    accounts = parsed.accounts || [];
  }
}

export function saveAccounts(projectPath, data) {
  if (!projectPath) return;
  const filePath = path.join(projectPath, "accounts.json");
  fs.writeFileSync(filePath, JSON.stringify({ accounts: data }, null, 2), "utf-8");
  accounts = data;
}

export function getAccounts() {
  return [...accounts];
}

export function getAccountByUsername(username) {
  if (!username) return null;
  const normalized = username.replace(/^@/, "");
  return accounts.find(a => (a.username || "").replace(/^@/, "") === normalized) || null;
}

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
 *      - Корневые пути дисков (E:\) разрешают доступ ко всему на этом диске
 *      - Обычные пути (E:\Git) ограничивают доступ этой директорией и вложенными
 *   3. Для инструмента "execute" проверка include_paths не применяется
 */
export function checkAccountToolPermission(account, toolName, args, projectPath) {
  if (!account) return { allowed: true };

  if (account.permissions && account.permissions[toolName] === false) {
    return { allowed: false, reason: `Tool '${toolName}' is not available for your account` };
  }

  if (toolName !== "execute" && account.include_paths?.length > 0) {
    const toolPath = args.filePath || args.path || args.source || args.destination || "";
    if (toolPath) {
      const resolved = path.resolve(projectPath, toolPath);
      const allowed = account.include_paths.some(p => {
        const norm = path.resolve(p);
        // For root drive paths (E:\) — allow everything on that drive
        const isRootDrive = norm.length === 3 && norm[1] === ":" && norm[2] === path.sep;
        if (isRootDrive) {
          return resolved.startsWith(norm);
        }
        return resolved === norm || resolved.startsWith(norm + path.sep);
      });
      if (!allowed) {
        return { allowed: false, reason: "Path not in allowed directories" };
      }
    }
  }

  return { allowed: true };
}

export function isToolEnabledForAccount(account, toolName, globalToolConfig) {
  const globalEnabled = globalToolConfig?.[toolName]?.enabled !== false;
  const accountEnabled = account ? account.permissions?.[toolName] !== false : true;
  return globalEnabled && accountEnabled;
}
