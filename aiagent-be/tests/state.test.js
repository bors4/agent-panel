/**
 * Tests for shared state initialization and lifecycle.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  config,
  stats,
  tokenUsage,
  chatHistories,
  pendingApprovals,
  activeAgentControllers,
  agentLogs,
  rateLimitMap,
  resetStats,
  resetTokenUsage,
} from "../lib/state.js";

describe("state defaults", () => {
  it("config has expected fields", () => {
    expect(config).toHaveProperty("serverUrl");
    expect(config).toHaveProperty("modelName");
    expect(config).toHaveProperty("projectPath");
  });

  it("stats starts at zero", () => {
    expect(stats.requests).toBe(0);
    expect(stats.tools).toBe(0);
    expect(stats.errors).toBe(0);
  });

  it("tokenUsage starts at zero", () => {
    expect(tokenUsage.prompt).toBe(0);
    expect(tokenUsage.completion).toBe(0);
    expect(tokenUsage.total).toBe(0);
    expect(tokenUsage.cached).toBe(0);
  });

  it("maps are instantiated as Map instances", () => {
    expect(chatHistories).toBeInstanceOf(Map);
    expect(pendingApprovals).toBeInstanceOf(Map);
    expect(activeAgentControllers).toBeInstanceOf(Map);
    expect(rateLimitMap).toBeInstanceOf(Map);
  });

  it("agentLogs is an array", () => {
    expect(Array.isArray(agentLogs)).toBe(true);
  });
});

describe("state mutators", () => {
  beforeEach(() => {
    stats.requests = 5;
    stats.tools = 3;
    stats.errors = 1;
    tokenUsage.prompt = 100;
    tokenUsage.completion = 50;
    tokenUsage.total = 150;
  });

  it("resetStats zeros all counters", () => {
    resetStats();
    expect(stats.requests).toBe(0);
    expect(stats.tools).toBe(0);
    expect(stats.errors).toBe(0);
  });

  it("resetTokenUsage zeros all token fields", () => {
    resetTokenUsage();
    expect(tokenUsage.prompt).toBe(0);
    expect(tokenUsage.completion).toBe(0);
    expect(tokenUsage.total).toBe(0);
    expect(tokenUsage.cached).toBe(0);
    expect(tokenUsage.tokensCached).toBe(0);
  });
});

describe("map mutability", () => {
  it("chatHistories is shared by reference across imports", () => {
    const id = "test-chat-1";
    chatHistories.set(id, [{ role: "user", content: "hi" }]);
    expect(chatHistories.get(id)).toEqual([{ role: "user", content: "hi" }]);
    chatHistories.delete(id);
    expect(chatHistories.has(id)).toBe(false);
  });

  it("pendingApprovals can store objects with createdAt", () => {
    const id = "test-pending-1";
    pendingApprovals.set(id, { toolName: "write", createdAt: Date.now() });
    expect(pendingApprovals.get(id).toolName).toBe("write");
    pendingApprovals.delete(id);
  });
});
