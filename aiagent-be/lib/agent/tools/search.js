/**
 * search tool: regex search across project files.
 * @module tool/search
 */
import { rejectReDoS } from "./format.js";
import { searchDirectory } from "./filesystem.js";

/**
 * @param {Object} args - {pattern, include}
 * @param {string} projectPath
 * @param {Object} [config] - {maxSearchResults, maxSearchFileSize, maxFileChars}
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function search(args, projectPath, config = {}) {
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

  const results = [];
  const include = args.include || null;
  const maxResults = config.maxSearchResults;
  const maxSearchFileSize = config.maxSearchFileSize;
  const maxFileChars = config.maxFileChars;

  await searchDirectory(
    projectPath,
    regex,
    results,
    0,
    include,
    maxResults,
    projectPath,
    maxSearchFileSize,
    maxFileChars
  );

  return {
    success: true,
    data: {
      results: results.slice(0, maxResults),
      total: results.length,
    },
  };
}
