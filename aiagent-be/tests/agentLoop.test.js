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
