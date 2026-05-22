/**
 * Тесты для модуля agent loop.
 */

import { describe, it, expect } from "vitest";
import { updateAgentConfig, getAgentConfig, buildSystemMessage } from "../lib/agent/agentLoop.js";

describe("agent config", () => {
  it("returns default config", () => {
    const config = getAgentConfig();
    expect(config).toHaveProperty("serverUrl");
    expect(config).toHaveProperty("modelName");
    expect(config).toHaveProperty("projectPath");
    expect(config).toHaveProperty("apiKey");
    expect(config).toHaveProperty("maxFileChars");
    expect(config).toHaveProperty("maxHistoryPairs");
    expect(config).toHaveProperty("maxSearchResults");
    expect(config).toHaveProperty("maxFilesInPrompt");
  });

  it("updates config with limit values", () => {
    updateAgentConfig({
      maxFileChars: 5000,
      maxHistoryPairs: 10,
      maxSearchResults: 25,
      maxFilesInPrompt: 5,
    });
    const config = getAgentConfig();
    expect(config.maxFileChars).toBe(5000);
    expect(config.maxHistoryPairs).toBe(10);
    expect(config.maxSearchResults).toBe(25);
    expect(config.maxFilesInPrompt).toBe(5);
  });

  it("updates config with new values", () => {
    updateAgentConfig({
      serverUrl: "http://test:1234/v1",
      modelName: "test-model",
    });
    const config = getAgentConfig();
    expect(config.serverUrl).toBe("http://test:1234/v1");
    expect(config.modelName).toBe("test-model");
  });

  it("preserves unchanged fields on update", () => {
    const before = getAgentConfig();
    updateAgentConfig({ modelName: "new-model" });
    const after = getAgentConfig();
    expect(after.serverUrl).toBe(before.serverUrl);
    expect(after.modelName).toBe("new-model");
  });
});

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
    expect(msg).toContain("Your role: user");
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
    expect(msg).toContain('GOOD: "test.txt"');
    expect(msg).toContain('BAD: "E:\\');
  });

  it("includes Windows rules", () => {
    const msg = buildSystemMessage(projectPath, "", true);
    expect(msg).toContain("WINDOWS RULES");
    expect(msg).toContain("PowerShell");
  });
});
