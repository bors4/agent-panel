/**
 * Filesystem traversal helpers used by list_dir and search tools.
 * @module filesystem
 */
import fs from "fs";
import path from "path";

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".ico",
  ".webp",
  ".mp3",
  ".mp4",
  ".avi",
  ".mov",
  ".wav",
  ".flac",
  ".ogg",
  ".zip",
  ".tar",
  ".gz",
  ".rar",
  ".7z",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".o",
  ".a",
  ".lib",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".bin",
  ".dat",
  ".db",
  ".sqlite",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".otf",
  ".wasm",
  ".class",
  ".pyc",
  ".cur",
]);

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "venv", "__pycache__"]);

/**
 * Рекурсивно обходит директорию, возвращая плоский массив отформатированных строк.
 * Пропускает скрытые файлы, node_modules, .git и другие стандартные исключения.
 * @param {string} dirPath - Путь к директории
 * @param {number} maxDepth - Максимальная глубина обхода
 * @param {number} [currentDepth=0] - Текущая глубина (для рекурсии)
 * @returns {Promise<string[]>} Массив строк вида "📁 src/" / "📄 file.js"
 */
export async function listDirectoryFlat(dirPath, maxDepth, currentDepth = 0) {
  if (currentDepth >= maxDepth) return [];

  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const result = [];

    for (const entry of entries) {
      if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) {
        continue;
      }

      const icon = entry.isDirectory() ? "📁" : "📄";
      const suffix = entry.isDirectory() ? "/" : "";
      result.push(`${icon} ${entry.name}${suffix}`);

      if (entry.isDirectory() && currentDepth + 1 < maxDepth) {
        const subPath = path.join(dirPath, entry.name);
        const subEntries = await listDirectoryFlat(subPath, maxDepth, currentDepth + 1);
        result.push(...subEntries.map((s) => "  " + s));
      }
    }

    return result;
  } catch (e) {
    console.warn(`[listDirectoryFlat] Error reading ${dirPath}:`, e.message);
    return [];
  }
}

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
export async function searchDirectory(
  dirPath,
  pattern,
  results,
  depth,
  extension,
  maxResults,
  projectPath,
  maxSearchFileSize,
  maxFileChars
) {
  if (depth > 5 || results.length >= maxResults) return;

  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (results.length >= maxResults) break;
      if (SKIP_DIRS.has(entry.name)) continue;

      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        await searchDirectory(
          fullPath,
          pattern,
          results,
          depth + 1,
          extension,
          maxResults,
          projectPath,
          maxSearchFileSize,
          maxFileChars
        );
      } else if (entry.isFile()) {
        if (extension && !entry.name.endsWith(extension.replace("*", ""))) continue;

        const ext = path.extname(entry.name).toLowerCase();
        if (BINARY_EXTENSIONS.has(ext)) continue;

        try {
          const stat = await fs.promises.stat(fullPath);
          if (stat.size > maxSearchFileSize) continue;

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
