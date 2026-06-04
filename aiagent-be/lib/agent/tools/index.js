/**
 * Tool dispatcher: validates project context + permissions, then routes
 * to the appropriate per-tool handler.
 * @module dispatcher
 */
import fs from "fs";
import path from "path";
import { logInfo } from "../../logger.js";
import { configDefaults } from "../../configDefaults.js";
import { TOOLS, getToolConfig } from "./registry.js";
import { checkToolPermission } from "./permissions.js";
import * as readTool from "./read.js";
import * as writeTool from "./write.js";
import * as searchTool from "./search.js";
import * as listDirTool from "./list_dir.js";
import * as executeHandler from "./execute.js";
import * as createDirTool from "./create_dir.js";
import * as deleteTool from "./delete.js";
import * as moveTool from "./move.js";
import * as copyTool from "./copy.js";

const HANDLERS = {
  read: readTool.read,
  write: writeTool.write,
  search: searchTool.search,
  list_dir: listDirTool.listDir,
  execute: executeHandler.execute,
  create_dir: createDirTool.createDir,
  delete: deleteTool.deletePath,
  move: moveTool.move,
  copy: copyTool.copy,
};

/**
 * @typedef {Object} ToolResult
 * @property {boolean} success
 * @property {Object} [data]
 * @property {string} [error]
 * @property {boolean} [requiresApproval]
 */

/**
 * Выполнить инструмент AI агента.
 * @param {Object} toolCall - {name, args}
 * @param {Object} config - {projectPath, account, chatMode, maxSearchResults, maxSearchFileSize, maxFileChars, maxFilesInPrompt, filesRead, executeTimeout}
 * @returns {Promise<ToolResult>}
 */
export async function executeTool(toolCall, config = {}) {
  const { name, args = {} } = toolCall;
  const account = config.account;
  const chatMode = config.chatMode || false;

  let resolvedPath;
  if (chatMode) {
    resolvedPath = account?.include_paths?.[0] || "";
  } else {
    resolvedPath = config.projectPath || "";
  }

  if (!resolvedPath) {
    return {
      success: false,
      error: "Project path is not configured. Set it in Settings or PROJECT_PATH in .env",
    };
  }
  const projectPath = path.resolve(resolvedPath);
  const maxResults = config.maxSearchResults ?? configDefaults.maxSearchResults;
  const maxSearchFileSize = config.maxSearchFileSize ?? configDefaults.maxSearchFileSize;
  const maxFileChars = config.maxFileChars ?? configDefaults.maxFileChars;

  try {
    const projectStat = await fs.promises.stat(projectPath);
    if (!projectStat.isDirectory()) {
      return { success: false, error: `Project path is not a directory: ${projectPath}` };
    }
  } catch {
    return { success: false, error: `Project directory does not exist: ${projectPath}` };
  }

  if (!TOOLS[name]) {
    return { success: false, error: `Unknown tool: ${name}` };
  }

  const permission = checkToolPermission(name, args, projectPath, account);
  if (!permission.allowed) {
    const toolCfg = getToolConfig()[name] || {};
    return { success: false, error: permission.reason, requiresApproval: toolCfg.permission === "ask" };
  }

  logInfo(`execute: ${name}`, { args: JSON.stringify(args).slice(0, 200), projectPath });

  const handler = HANDLERS[name];
  if (!handler) {
    return { success: false, error: `Tool ${name} not implemented` };
  }

  try {
    return await handler(args, projectPath, {
      maxSearchResults: maxResults,
      maxSearchFileSize,
      maxFileChars,
      maxFilesInPrompt: config.maxFilesInPrompt ?? configDefaults.maxFilesInPrompt,
      filesRead: config.filesRead,
      executeTimeout: config.executeTimeout,
    });
  } catch (e) {
    console.error(`[executeTool] Error in ${name}:`, e);
    return { success: false, error: e.message };
  }
}
