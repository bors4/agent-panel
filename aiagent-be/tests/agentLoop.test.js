/**
 * Тесты для модуля agent loop.
 */

import { describe, it, expect } from "vitest";
import { buildSystemMessage } from "../lib/agent/agentLoop.js";

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
