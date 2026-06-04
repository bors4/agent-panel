/**
 * Tools endpoints: GET tool list + per-tool config, POST update config.
 * @module routes/tools
 */
import { Router } from "express";
import { TOOLS, getToolConfig, updateToolConfig } from "../lib/agent/executeTool.js";

/**
 * @returns {Router}
 */
export function createToolsRouter() {
  const router = Router();

  /**
   * GET /api/tools — list all tools with their config.
   */
  router.get("/tools", (_req, res) => {
    const toolDefs = {};
    for (const [name, tool] of Object.entries(TOOLS)) {
      toolDefs[name] = {
        name: tool.name,
        description: tool.description,
        category: tool.category,
        parameters: tool.input_schema,
        examples: tool.examples,
      };
    }
    res.json({ success: true, tools: toolDefs, config: getToolConfig() });
  });

  /**
   * POST /api/tools — update tool config. Body: { name, enabled?, permission?, exclude_paths? }
   */
  router.post("/tools", (req, res) => {
    const { name, ...settings } = req.body;
    if (!name) return res.status(400).json({ error: "Tool name required" });
    if (!TOOLS[name]) return res.status(404).json({ error: `Tool '${name}' not found` });
    updateToolConfig(name, settings);
    res.json({ success: true, config: getToolConfig()[name] });
  });

  return router;
}
