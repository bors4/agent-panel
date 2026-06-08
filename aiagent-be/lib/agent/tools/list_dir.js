/**
 * list_dir tool: list directory contents as a flat, indented string array.
 * @module tool/list_dir
 */
import fs from "fs";
import path from "path";
import { safePath } from "../../utils.js";
import { listDirectoryFlat } from "./filesystem.js";

/**
 * @param {Object} args - {path, depth}
 * @param {string} projectPath
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function listDir(args, projectPath) {
  const dirPath = args.path ? safePath(args.path, projectPath) : projectPath;
  const depth = Math.min(args.depth || 1, 3);

  try {
    await fs.promises.access(dirPath);
  } catch {
    return {
      success: false,
      error: `Directory not found: ${path.relative(projectPath, dirPath)}`,
    };
  }

  const tree = await listDirectoryFlat(dirPath, depth, 0);

  return {
    success: true,
    data: { tree, path: dirPath },
  };
}

export function toModelOutput(result) {
  if (!result.success) return `List dir failed: ${result.error}`;
  return result.data.tree.join("\n");
}
