/**
 * write tool: create or overwrite a file with content.
 * @module tool/write
 */
import fs from "fs";
import path from "path";
import { safePath } from "../../utils.js";

/**
 * @param {Object} args - {filePath, content}
 * @param {string} projectPath
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function write(args, projectPath) {
  const filePath = safePath(args.filePath, projectPath);
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, args.content, "utf-8");
  return {
    success: true,
    data: { path: filePath, size: args.content.length },
  };
}
