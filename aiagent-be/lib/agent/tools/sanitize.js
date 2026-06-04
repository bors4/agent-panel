/**
 * Shell command safety patterns and sanitizer.
 * @module sanitize
 */

/** Паттерны опасных конструкций shell для блокировки command injection. */
export const BLOCKED_PATTERNS = [
  { pattern: /;\s*\S/, description: "command chaining with semicolon" },
  { pattern: /&&\s*\S/, description: "conditional chaining with &&" },
  { pattern: /\|\s*\S/, description: "pipe" },
  { pattern: /\$\(.*\)/, description: "subshell $()" },
  { pattern: /`[^`]+`/, description: "backtick subshell" },
  { pattern: />>?\s*\S/, description: "redirect output" },
  { pattern: /<\s*\S/, description: "input redirect" },
  { pattern: /rm\s+-rf\s+[/~]/i, description: "recursive delete from root" },
  { pattern: /del\s+\/[fqs]/i, description: "Windows force delete" },
  { pattern: /format\s+[a-zA-Z]:/i, description: "disk format" },
  { pattern: /shutdown|reboot|halt|poweroff/i, description: "system power" },
  { pattern: /mkfs|dd\s+if=/i, description: "disk write" },
  { pattern: /:\(\)\s*\{/, description: "fork bomb" },
  { pattern: /Remove-Item\s+-Recurse\s+-Force/i, description: "PowerShell recursive force delete" },
  { pattern: /rm\s+-rf\s+\S*\$/, description: "recursive delete with variable expansion" },
  { pattern: /Clear-Item|Clear-Content|rm\s+-recurse/i, description: "PowerShell content removal" },
  { pattern: /Format-Volume|Format-C/i, description: "PowerShell disk format" },
];

/**
 * Проверить команду на наличие опасных паттернов.
 * @param {string} command - Shell команда
 * @returns {{blocked: boolean, reason?: string}}
 */
export function sanitizeCommand(command) {
  for (const { pattern, description } of BLOCKED_PATTERNS) {
    if (pattern.test(command)) {
      return { blocked: true, reason: `Blocked: ${description}` };
    }
  }
  return { blocked: false };
}
