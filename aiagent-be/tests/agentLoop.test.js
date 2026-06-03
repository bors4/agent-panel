/**
 * Тесты для модуля agent loop.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildSystemMessage, agentLoopStep } from "../lib/agent/agentLoop.js";

describe("buildSystemMessage", () => {
  const projectPath = "/home/user/project";
  const systemPrompt = "You are a helpful assistant.";

  it("includes project path in system message", () => {
    const msg = buildSystemMessage(projectPath, "", true);
    expect(msg).toContain(projectPath);
  });

  it("includes custom system prompt", () => {
    const msg = buildSystemMessage(projectPath, systemPrompt, true);
    expect(msg).toContain(systemPrompt);
  });

  it("includes tool descriptions", () => {
    const msg = buildSystemMessage(projectPath, "", true);
    expect(msg).toContain("Available tools");
  });

  it("adds function calling hint when useFunctionCalling is true", () => {
    const msg = buildSystemMessage(projectPath, "", true);
    expect(msg).toContain("Use function calling");
  });

  it("adds XML tool call hint when useFunctionCalling is false", () => {
    const msg = buildSystemMessage(projectPath, "", false);
    expect(msg).toContain("<function>");
  });

  it("includes account role when provided", () => {
    const account = { role: "user" };
    const msg = buildSystemMessage(projectPath, "", true, account);
    expect(msg).toContain("Role: user");
  });

  it("includes allowed directories from account", () => {
    const account = {
      role: "user",
      include_paths: ["/home/user/project/src"],
    };
    const msg = buildSystemMessage(projectPath, "", true, account);
    expect(msg).toContain("Allowed directories");
  });

  it("emphasizes relative paths only", () => {
    const msg = buildSystemMessage(projectPath, "", true);
    expect(msg).toContain("RELATIVE");
    expect(msg).toContain("relative");
  });

  it("includes Windows rules", () => {
    const msg = buildSystemMessage(projectPath, "", true);
    expect(msg).toContain("Windows Rules");
    expect(msg).toContain("PowerShell");
  });
});

// ═════════════════════════════════════════════════════════════════
// agentLoopStep — OpenRouter headers
// ═════════════════════════════════════════════════════════════════
describe("agentLoopStep OpenRouter headers", () => {
  /** @type {import("vitest").MockInstance} */
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Hello!", role: "assistant" } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    });
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  const baseCfg = {
    serverUrl: "http://localhost:8080/v1",
    modelName: "test-model",
    apiKey: "local-key",
    openrouterApiKey: "",
    maxTokens: 1024,
    temperature: 0.1,
    timeout: 30000,
    stream: false,
    projectPath: "/tmp/test",
    systemPrompt: "",
    chatMode: false,
    maxHistoryPairs: 5,
    insertUserAfterTool: false,
  };

  it("uses openrouterApiKey when serverUrl contains openrouter.ai", async () => {
    const cfg = {
      ...baseCfg,
      serverUrl: "https://openrouter.ai/api/v1",
      openrouterApiKey: "sk-or-v1-agent-loop",
    };

    await agentLoopStep("hello", "test-chat", [], cfg, 1, null, null);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("openrouter.ai"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer sk-or-v1-agent-loop",
          "HTTP-Referer": "https://agent-panel.local",
          "X-OpenRouter-Title": "AI Agent Panel",
        }),
      }),
    );
  });

  it("uses apiKey for local server (no OpenRouter headers)", async () => {
    await agentLoopStep("hello", "test-chat", [], baseCfg, 1, null, null);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("localhost"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer local-key",
        }),
      }),
    );
    // Should NOT have OpenRouter-specific headers
    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[1].headers["HTTP-Referer"]).toBeUndefined();
    expect(callArgs[1].headers["X-OpenRouter-Title"]).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════════
// agentLoopStep — Result shape contract (regression for voice handler crash)
// ═════════════════════════════════════════════════════════════════
describe("agentLoopStep result shape contract", () => {
  const baseCfg = {
    serverUrl: "http://localhost:8080/v1",
    modelName: "test-model",
    apiKey: "local-key",
    openrouterApiKey: "",
    maxTokens: 1024,
    temperature: 0.1,
    timeout: 30000,
    stream: false,
    projectPath: "/tmp/test",
    systemPrompt: "",
    chatMode: false,
    maxHistoryPairs: 5,
    insertUserAfterTool: false,
  };

  /** @type {import("vitest").MockInstance} */
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it("returns { requiresApproval, toolName, args, messages } WITHOUT response when tool needs approval (default permission is 'ask')", async () => {
    // Mock fetch to return a tool_call. Default tool permission is "ask" → returns requiresApproval
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "tc_1",
                  type: "function",
                  function: { name: "read", arguments: JSON.stringify({ path: "test.txt" }) },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    });

    const result = await agentLoopStep("read the file", "test-chat", [], baseCfg, 1);

    // Critical assertions — the bug was crashing on result.response.replace() when undefined
    expect(result.requiresApproval).toBe(true);
    expect(result.toolName).toBe("read");
    expect(result.args).toEqual({ path: "test.txt" });
    expect(result.messages).toBeDefined();
    expect(Array.isArray(result.messages)).toBe(true);

    // The crash trigger: result.response MUST be undefined
    expect(result.response).toBeUndefined();
    // And result.error MUST be undefined (not an error path)
    expect(result.error).toBeUndefined();
  });

  it("returns { response } on successful content response (no tool call)", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { role: "assistant", content: "Hello there!", tool_calls: null } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    });

    const result = await agentLoopStep("greet me", "test-chat", [], baseCfg, 1);

    expect(typeof result.response).toBe("string");
    expect(result.response).toBe("Hello there!");
    expect(result.error).toBeUndefined();
    expect(result.requiresApproval).toBeFalsy();
  });

  it("returns { error } on fetch network failure WITHOUT response field", async () => {
    fetchMock.mockRejectedValue(new Error("Network unreachable"));

    const result = await agentLoopStep("hello", "test-chat", [], baseCfg, 1);

    expect(result.error).toBeDefined();
    expect(result.error).toContain("Network unreachable");
    // Critical: error path must not include response
    expect(result.response).toBeUndefined();
    expect(result.requiresApproval).toBeFalsy();
  });

  it("returns { error } on non-2xx response WITHOUT response field", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => ({ error: { message: "Internal server error" } }),
    });

    const result = await agentLoopStep("hello", "test-chat", [], baseCfg, 1);

    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/AI error|500/);
    expect(result.response).toBeUndefined();
  });
});
