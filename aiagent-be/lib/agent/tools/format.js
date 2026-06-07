/**
 * Display and regex-safety helpers shared by tool handlers.
 * @module format
 */

/**
 * Recursively format a value for safe Telegram display.
 * Handles nested objects, arrays, and file/directory structures.
 * Guards against circular references.
 * @param {*} v - Value to format
 * @param {number} [depth=0] - Current recursion depth
 * @param {Set<Object>} [visited=new Set()] - Visited-object set for cycle detection
 * @returns {string} Formatted string
 */
export function formatValue(v, depth = 0, visited = new Set()) {
  if (v === null || v === undefined) return "N/A";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;

  if (typeof v === "object") {
    if (visited.has(v)) {
      return "[Circular]";
    }
    visited.add(v);
  }

  if (Array.isArray(v)) {
    if (depth > 2) return `[${v.length} items]`;
    return v
      .map((item) => {
        const formatted = formatValue(item, depth + 1, visited);
        return Array.isArray(item) ? `\n${formatted}` : formatted;
      })
      .join("\n  ");
  }

  if (typeof v === "object") {
    if (v.name && (v.type || v.isDirectory !== undefined)) {
      const icon = v.type === "directory" || v.isDirectory ? "📁" : "📄";
      return `${icon} ${v.name}`;
    }
    if (depth > 1) return JSON.stringify(v);
    return Object.entries(v)
      .map(([key, val]) => `  • ${key}: ${formatValue(val, depth + 1, visited)}`)
      .join("\n");
  }

  return String(v);
}

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
    } else if ((c === "+" || c === "*" || c === "?" || c === "{") && pattern[i - 1] !== "\\" && depth > 0) {
      depthHasQuantifier.add(depth);
    }
  }
  return false;
}
