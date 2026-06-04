/**
 * delete tool: remove a file or (optionally) a directory.
 * @module tool/delete
 */
import path from "path";
import fs from "fs/promises";
import { safePath } from "../../utils.js";

/**
 * @param {Object} args - {path, recursive}
 * @param {string} projectPath
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function deletePath(args, projectPath) {
  const targetPath = safePath(args.path, projectPath);
  let stats;
  try {
    stats = await fs.stat(targetPath);
  } catch {
    return {
      success: false,
      error: `Path not found: ${path.relative(projectPath, targetPath)}`,
    };
  }

  if (stats.isDirectory()) {
    if (args.recursive) {
      await fs.rm(targetPath, { recursive: true, force: true });
    } else {
      const entries = await fs.readdir(targetPath);
      if (entries.length > 0) {
        return {
          success: false,
          error: `Directory not empty: ${path.relative(projectPath, targetPath)}. Set recursive: true to delete.`,
        };
      }
      await fs.rm(targetPath, { recursive: false, force: false });
    }
  } else {
    await fs.unlink(targetPath);
  }
  return { success: true, data: { path: targetPath } };
}
