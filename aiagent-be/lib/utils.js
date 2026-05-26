/**
 * Утилиты для безопасной работы с путями и парсинга вызовов инструментов.
 * @module utils
 */

import path from "path";
import crypto from "crypto";

/**
 * Безопасно разрешить пользовательский путь относительно корня проекта.
 * Предотвращает path traversal атаки.
 * @param {string} userPath - Путь от пользователя (относительный или абсолютный)
 * @param {string} projectRoot - Корневой путь проекта
 * @returns {string} Разрешённый абсолютный путь (с forward slashes)
 * @throws {Error} Если путь выходит за пределы проекта или содержит null bytes
 * @description
 *   - Относительные пути разрешаются относительно projectRoot
 *   - Абсолютные пути проверяются на вхождение в projectRoot
 *   - Нормализует к forward slashes для сравнения
 */
export function safePath(userPath, projectRoot) {
  // Trim projectRoot to handle trailing whitespace/newlines from env
  const trimmedRoot = projectRoot.trim();
  const cleanPath = userPath.replace(/^\.\//, "").trim();

  // Reject null bytes
  if (cleanPath.includes("\0")) {
    throw new Error("Path contains null bytes");
  }

  const resolvedRoot = path.resolve(trimmedRoot);
  const normalizedRoot = resolvedRoot.replace(/\\/g, "/").toLowerCase();

  // If userPath is absolute, check if it's within the project root
  const resolvedPath = path.isAbsolute(cleanPath) ? path.resolve(cleanPath) : path.resolve(trimmedRoot, cleanPath);

  // Normalize to forward slashes for consistent comparison and output
  const normalizedPath = resolvedPath.replace(/\\/g, "/").toLowerCase();

  if (normalizedPath !== normalizedRoot && !normalizedPath.startsWith(normalizedRoot + "/")) {
    throw new Error(`Path outside project is forbidden: ${normalizedPath} (root: ${normalizedRoot})`);
  }
  return resolvedPath.replace(/\\/g, "/");
}

/**
 * Извлекает полный JSON-блок из строки, начиная с указанного индекса.
 * Использует подсчёт фигурных скобок для обработки вложенных объектов.
 * @param {string} str - Исходная строка
 * @param {number} startIdx - Индекс открывающей скобки {
 * @returns {string|null} Извлечённый JSON или null при ошибке
 */
function extractJsonBlock(str, startIdx) {
  let depth = 0, i = startIdx;
  const len = str.length;

  for (; i < len; i++) {
    if (str[i] === "{") depth++;
    else if (str[i] === "}") {
      depth--;
      if (depth === 0) return str.substring(startIdx, i + 1);
    }
  }
  return null; // unmatched braces
}

/**
 * Распознать вызов инструмента из текста ответа модели.
 * Поддерживает три формата: XML function tags, JSON objects, и tool tags.
 * @param {string|null} text - Текст от модели
 * @returns {Object|null} Распознанный вызов {name: string, args: Object, id: string} или null
 */
export function parseToolCall(text) {
  if (!text) return null;

  const cleaned = text.replace(/>\s+</g, "><").replace(/\s+/g, " ").trim();

  // Format 1: <function=name><parameter=key>value</parameter>...</function>
  let match = cleaned.match(/<function=(\w+)>([\s\S]*?)<\/function>/i);
  if (match) {
    const funcName = match[1];
    const paramsText = match[2];
    const args = {};
    const pm = paramsText.matchAll(/<parameter=(\w+)>([\s\S]*?)<\/parameter>/gis);
    for (const m of pm) {
      let value = m[2].trim();
      // Конвертация типов: boolean / number / string
      if (value === "true") value = true;
      else if (value === "false") value = false;
      else if (value !== "" && !isNaN(value)) value = Number(value);
      args[m[1]] = value;
    }
    return {
      name: funcName,
      args,
      id: `parsed_${crypto.randomUUID()}`,
    };
  }

  // Format 2: {"name": "...", "arguments"/"args": {...}}
  // Supports nested objects via brace counting
  const jsonStart = cleaned.indexOf("{");
  if (jsonStart !== -1) {
    const jsonBlock = extractJsonBlock(cleaned, jsonStart);
    if (jsonBlock) {
      try {
        const obj = JSON.parse(jsonBlock);
        if (obj.name) {
          return {
            name: obj.name,
            args: obj.arguments || obj.args || {},
            id: `parsed_${crypto.randomUUID()}`,
          };
        }
      } catch (e) {
        console.warn(`[parseToolCall] JSON parse error: ${e.message}`);
      }
    }
  }

  // Format 3: <tool>{...}</tool>
  match = cleaned.match(/<tool>\s*([\s\S]*?)\s*<\/tool>/i);
  if (match) {
    try {
      const obj = JSON.parse(match[1]);
      return {
        name: obj.name,
        args: obj.args || obj.arguments || {},
        id: `parsed_${crypto.randomUUID()}`,
      };
    } catch (e) {
      console.warn(`[parseToolCall] <tool> JSON error: ${e.message}`);
    }
  }

  return null;
}
