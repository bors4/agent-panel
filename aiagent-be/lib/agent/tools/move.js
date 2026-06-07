/**
 * move tool: rename or relocate a file or directory.
 * @module tool/move
 */
import path from "path";
import fs from "fs/promises";
import { safePath } from "../../utils.js";

/**
 * @param {Object} args - {source, destination}
 * @param {string} projectPath
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function move(args, projectPath) {
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
  await fs.rename(source, destination);
  return { success: true, data: { source, destination } };
}
