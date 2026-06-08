/**
 * copy tool: duplicate a file to a new path.
 * @module tool/copy
 */
import path from "path";
import fs from "fs/promises";
import { safePath } from "../../utils.js";

/**
 * @param {Object} args - {source, destination}
 * @param {string} projectPath
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function copy(args, projectPath) {
  const source = safePath(args.source, projectPath);
  try {
    await fs.access(source);
  } catch {
    return {
      success: false,
      error: `Source not found: ${path.relative(projectPath, source)}`,
    };
  }
  const destination = safePath(args.destination, projectPath);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(source, destination);
  return { success: true, data: { source, destination } };
}

export function toModelOutput(result) {
  if (!result.success) return `Copy failed: ${result.error}`;
  return `Copied: ${result.data.source} -> ${result.data.destination}`;
}
