/**
 * Public entry point for the agent tool execution engine.
 *
 * This file preserves the historical public API. The implementation is
 * split into per-tool modules under `./tools/`. See `./tools/index.js`
 * for the dispatcher, `./tools/registry.js` for definitions, and the
 * per-tool files (`read.js`, `write.js`, etc.) for handlers.
 * @module executeTool
 */

export { TOOLS, DEFAULT_TOOL_CONFIG, toolConfig, getToolConfig, updateToolConfig } from "./tools/registry.js";
export { activeProcesses } from "./tools/execute.js";
export { executeTool, getToolModelOutput } from "./tools/index.js";
export { waitForTask, cancelTask, getActiveTasks } from "./tools/tasks.js";
export { formatValue, rejectReDoS } from "./tools/format.js";
export { sanitizeCommand, BLOCKED_PATTERNS } from "./tools/sanitize.js";
