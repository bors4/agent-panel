import fs from "fs";
import path from "path";
import { safePath } from "../../utils.js";
import micromatch from "micromatch";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "venv", "__pycache__"]);

function walk(dirPath, pattern, results, limit, relativeTo, depth) {
  if (depth > 6 || results.length >= limit) return;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (results.length >= limit) break;
      if (entry.name.startsWith(".")) continue;
      if (SKIP_DIRS.has(entry.name)) continue;
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        if (micromatch.isMatch(entry.name + "/", pattern)) {
          results.push(path.relative(relativeTo, fullPath).replace(/\\/g, "/") + "/");
        }
        walk(fullPath, pattern, results, limit, relativeTo, depth + 1);
      } else if (entry.isFile()) {
        if (micromatch.isMatch(entry.name, pattern)) {
          results.push(path.relative(relativeTo, fullPath).replace(/\\/g, "/"));
        }
      }
    }
  } catch {
    /* skip inaccessible */
  }
}

function walkAll(dirPath, results, limit, relativeTo, depth) {
  if (depth > 6 || results.length >= limit) return;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (results.length >= limit) break;
      if (entry.name.startsWith(".")) continue;
      if (SKIP_DIRS.has(entry.name)) continue;
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        walkAll(fullPath, results, limit, relativeTo, depth + 1);
      } else {
        results.push(path.relative(relativeTo, fullPath).replace(/\\/g, "/"));
      }
    }
  } catch {
    /* skip inaccessible */
  }
}

export async function glob(args, projectPath) {
  const dirPath = args.path ? safePath(args.path, projectPath) : projectPath;
  const pattern = args.pattern || "**/*";
  const limit = args.limit || 200;

  try {
    await fs.promises.access(dirPath);
  } catch {
    return { success: false, error: `Directory not found: ${path.relative(projectPath, dirPath)}` };
  }

  const results = [];
  if (pattern === "**/*" || pattern === "*") {
    walkAll(dirPath, results, limit, projectPath, 0);
  } else {
    walk(dirPath, pattern, results, limit, projectPath, 0);
  }

  const truncated = results.length >= limit;
  return {
    success: true,
    data: { results, total: results.length, truncated },
  };
}

export function toModelOutput(result) {
  if (!result.success) return `Glob failed: ${result.error}`;
  const lines = result.data.results.length === 0
    ? ["No files found"]
    : result.data.results.map((r) => r);
  if (result.data.truncated) {
    lines.push("", `(Results are truncated: showing first ${result.data.results.length}. Consider a more specific pattern.)`);
  }
  return lines.join("\n");
}
