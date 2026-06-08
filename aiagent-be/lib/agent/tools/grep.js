import fs from "fs";
import path from "path";
import { safePath } from "../../utils.js";
import { rejectReDoS } from "./format.js";
import { searchDirectory } from "./filesystem.js";

export async function grep(args, projectPath, config = {}) {
  const pattern = args.pattern;
  if (pattern?.length > 200) {
    return { success: false, error: "Search pattern too long (max 200 chars)" };
  }
  let regex;
  try {
    regex = new RegExp(pattern, "gi");
  } catch (e) {
    return { success: false, error: `Invalid regex pattern: ${e.message}` };
  }
  if (rejectReDoS(pattern)) {
    return { success: false, error: "Search pattern rejected: too complex (nested quantifiers)" };
  }

  const dirPath = args.path ? safePath(args.path, projectPath) : projectPath;
  try {
    await fs.promises.access(dirPath);
  } catch {
    return { success: false, error: `Directory not found: ${path.relative(projectPath, dirPath)}` };
  }

  const results = [];
  const include = args.include || null;
  const maxResults = config.maxSearchResults ?? args.limit ?? 50;
  const maxSearchFileSize = config.maxSearchFileSize;
  const maxFileChars = config.maxFileChars;

  await searchDirectory(dirPath, regex, results, 0, include, maxResults, projectPath, maxSearchFileSize, maxFileChars);

  const truncated = results.length >= maxResults;
  return {
    success: true,
    data: { results, total: results.length, truncated },
  };
}

export function toModelOutput(result) {
  if (!result.success) return `Grep failed: ${result.error}`;
  if (result.data.results.length === 0) return "No matches found";
  const lines = [`Found ${result.data.total} matches`];
  let current = "";
  for (const match of result.data.results) {
    if (current !== match.file) {
      if (current) lines.push("");
      current = match.file;
      lines.push(`${match.file}:`);
    }
    lines.push(`  Line ${match.line || "?"}: ${match.preview}`);
  }
  if (result.data.truncated) {
    lines.push("", `(Results are truncated: showing first ${result.data.results.length}. Consider a more specific pattern.)`);
  }
  return lines.join("\n");
}
