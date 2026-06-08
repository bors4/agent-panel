import fs from "fs";
import path from "path";
import { logInfo } from "../../logger.js";
import { configDefaults } from "../../configDefaults.js";
import { TOOLS, getToolConfig } from "./registry.js";
import { checkToolPermission } from "./permissions.js";
import { validateToolArgs } from "./validation.js";
import * as readTool from "./read.js";
import * as writeTool from "./write.js";
import * as searchTool from "./search.js";
import * as listDirTool from "./list_dir.js";
import * as executeHandler from "./execute.js";
import * as createDirTool from "./create_dir.js";
import * as deleteTool from "./delete.js";
import * as moveTool from "./move.js";
import * as copyTool from "./copy.js";
import * as editTool from "./edit.js";
import * as globTool from "./glob.js";
import * as grepTool from "./grep.js";
import * as questionTool from "./question.js";
import * as websearchTool from "./websearch.js";
import * as webfetchTool from "./webfetch.js";
import * as skillTool from "./skill.js";
import * as todowriteTool from "./todowrite.js";

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
  edit: editTool.edit,
  glob: globTool.glob,
  grep: grepTool.grep,
  question: questionTool.question,
  websearch: websearchTool.websearch,
  webfetch: webfetchTool.webfetch,
  skill: skillTool.skill,
  todowrite: todowriteTool.todowrite,
};

/** Tools that always require user approval (never auto-execute). */
const ALWAYS_ASK = new Set(["question"]);

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

  if (!TOOLS[name]) {
    return { success: false, error: `Unknown tool: ${name}` };
  }

  const schema = TOOLS[name].input_schema;
  const validation = validateToolArgs(name, args, schema);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  if (!ALWAYS_ASK.has(name)) {
    if (!resolvedPath) return { success: false, error: "Project path not configured" };
    try {
      const projectStat = await fs.promises.stat(projectPath);
      if (!projectStat.isDirectory()) {
        return { success: false, error: `Project path is not a directory: ${projectPath}` };
      }
    } catch {
      return { success: false, error: `Project directory does not exist: ${projectPath}` };
    }
  }

  const permission = checkToolPermission(name, args, projectPath, account);
  if (!permission.allowed) {
    const toolCfg = getToolConfig()[name] || {};
    const needsApproval = toolCfg.permission === "ask" || ALWAYS_ASK.has(name);
    return { success: false, error: permission.reason, requiresApproval: needsApproval };
  }

  logInfo(`execute: ${name}`, { args: JSON.stringify(args).slice(0, 200), projectPath });

  const handler = HANDLERS[name];
  if (!handler) {
    return { success: false, error: `Tool ${name} not implemented` };
  }

  try {
    const result = await handler(args, projectPath, {
      maxSearchResults: config.maxSearchResults ?? configDefaults.maxSearchResults,
      maxSearchFileSize: config.maxSearchFileSize ?? configDefaults.maxSearchFileSize,
      maxFileChars: config.maxFileChars ?? configDefaults.maxFileChars,
      maxFilesInPrompt: config.maxFilesInPrompt ?? configDefaults.maxFilesInPrompt,
      filesRead: config.filesRead,
      executeTimeout: config.executeTimeout,
    });
    return result;
  } catch (e) {
    console.error(`[executeTool] Error in ${name}:`, e);
    return { success: false, error: e.message };
  }
}

export function getToolModelOutput(name, result) {
  const map = {
    read: readTool,
    write: writeTool,
    search: searchTool,
    list_dir: listDirTool,
    execute: executeHandler,
    create_dir: createDirTool,
    delete: deleteTool,
    move: moveTool,
    copy: copyTool,
    edit: editTool,
    glob: globTool,
    grep: grepTool,
    question: questionTool,
    websearch: websearchTool,
    webfetch: webfetchTool,
    skill: skillTool,
    todowrite: todowriteTool,
  };
  const mod = map[name];
  if (mod && typeof mod.toModelOutput === "function") {
    const output = mod.toModelOutput(result);
    if (name === "webfetch" && result?.data?.content) {
      console.log(`[getToolModelOutput] webfetch: raw=${result.data.content.length} chars, output=${output.length} chars`);
    }
    return output;
  }
  console.log(`[getToolModelOutput] ${name}: no toModelOutput, falling back to JSON.stringify (${JSON.stringify(result).length} chars)`);
  return JSON.stringify(result);
}
