/**
 * create_dir tool: create a new directory (recursive).
 * @module tool/create_dir
 */
import { safePath } from "../../utils.js";

/**
 * @param {Object} args - {path}
 * @param {string} projectPath
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function createDir(args, projectPath) {
  const fs = await import("fs/promises");
  const dirPath = safePath(args.path, projectPath);
  await fs.mkdir(dirPath, { recursive: true });
  return { success: true, data: { path: dirPath } };
}
