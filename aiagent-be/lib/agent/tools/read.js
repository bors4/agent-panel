/**
 * read tool: read a file from the project directory.
 * @module tool/read
 */
import fs from "fs";
import path from "path";
import { safePath } from "../../utils.js";
import { configDefaults } from "../../configDefaults.js";

/**
 * @param {Object} args - {filePath}
 * @param {string} projectPath
 * @param {Object} [config] - {maxFileChars, maxFilesInPrompt, filesRead}
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function read(args, projectPath, config = {}) {
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
