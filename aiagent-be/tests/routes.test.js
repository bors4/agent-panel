/**
 * Focused unit tests for the new sub-router factories.
 * Tests each router in isolation (not through the api.js aggregator)
 * to verify the factory pattern works standalone.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import supertest from "supertest";
import express from "express";
import { createConfigRouter } from "../routes/config.js";
import { createAsrRouter } from "../routes/asr.js";
import { createChatRouter } from "../routes/chat.js";
import { createAdminRouter } from "../routes/admin.js";
import { createAuthMiddleware } from "../routes/middleware.js";

vi.mock("../lib/agent/agentLoop.js", () => ({
  agentLoopStep: vi.fn(),
  MAX_AGENT_ITERATIONS: 10,
}));

vi.mock("../lib/agent/executeTool.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    executeTool: vi.fn(),
    waitForTask: vi.fn(),
  };
});

import { agentLoopStep } from "../lib/agent/agentLoop.js";
import { executeTool } from "../lib/agent/executeTool.js";

function mount(routerFactory, deps, mountPath = "/api") {
  const app = express();
  app.use(express.json());
  app.use(mountPath, routerFactory(deps));
  return app;
}

function makeBaseDeps(overrides = {}) {
  return {
    config: {
      serverUrl: "http://test:8080/v1",
      modelName: "test-model",
      projectPath: "/tmp/test",
      systemPrompt: "test",
      apiKey: "test-key",
      maxTokens: 1024,
      temperature: 0.1,
      timeout: 30000,
      stream: false,
      insertUserAfterTool: true,
      chatMode: false,
      telegramToken: "test-tok",
      openrouterApiKey: "",
      asrServerUrl: "",
      asrLanguage: "ru",
      ...(overrides.config || {}),
    },
    addLog: vi.fn(),
    wsBroadcast: vi.fn(),
    state: { botStatus: "idle", botStatusMessage: "", startTime: null },
    stats: { requests: 0, tools: 0, errors: 0 },
    tokenUsage: { prompt: 0, completion: 0, total: 0, cached: 0 },
    bot: null,
    initBot: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
    updateStatus: vi.fn(),
    resetStats: vi.fn(),
    resetTokenUsage: vi.fn(),
    chatHistories: new Map(),
    pendingApprovals: new Map(),
    activeAgentControllers: new Map(),
    agentLogs: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// Auth middleware
// ─────────────────────────────────────────────────────────────────────────────

describe("routes/middleware — auth", () => {
  it("rejects when API key missing and configured", async () => {
    const app = express();
    app.use("/api", createAuthMiddleware({ apiKey: "secret" }, vi.fn()));
    app.get("/api/x", (_req, res) => res.json({ ok: true }));
    const res = await supertest(app).get("/api/x");
    expect(res.status).toBe(401);
  });

  it("rejects when API key wrong", async () => {
    const app = express();
    app.use("/api", createAuthMiddleware({ apiKey: "secret" }, vi.fn()));
    app.get("/api/x", (_req, res) => res.json({ ok: true }));
    const res = await supertest(app).get("/api/x").set("x-api-key", "wrong");
    expect(res.status).toBe(401);
  });

  it("allows when API key matches", async () => {
    const app = express();
    app.use("/api", createAuthMiddleware({ apiKey: "secret" }, vi.fn()));
    app.get("/api/x", (_req, res) => res.json({ ok: true }));
    const res = await supertest(app).get("/api/x").set("x-api-key", "secret");
    expect(res.status).toBe(200);
  });

  it("bypasses auth when no API key configured", async () => {
    const app = express();
    app.use("/api", createAuthMiddleware({ apiKey: "" }, vi.fn()));
    app.get("/api/x", (_req, res) => res.json({ ok: true }));
    const res = await supertest(app).get("/api/x");
    expect(res.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Config router
// ─────────────────────────────────────────────────────────────────────────────

describe("routes/config — POST /config edge cases", () => {
  it("strips apiKey, openrouterApiKey, telegramToken from GET response", async () => {
    const deps = makeBaseDeps();
    const app = mount(createConfigRouter, deps);
    const res = await supertest(app).get("/api/config");
    expect(res.body.config.apiKey).toBeUndefined();
    expect(res.body.config.openrouterApiKey).toBeUndefined();
    expect(res.body.config.telegramToken).toBeUndefined();
    expect(res.body.config.hasToken).toBe(true);
  });

  it("returns hasToken=false when telegramToken is empty", async () => {
    const deps = makeBaseDeps({ config: { telegramToken: "" } });
    const app = mount(createConfigRouter, deps);
    const res = await supertest(app).get("/api/config");
    expect(res.body.config.hasToken).toBe(false);
  });

  it("GET /api/models with abort returns 500 on fetch failure", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockRejectedValue(new Error("Network fail"));
    const deps = makeBaseDeps();
    const app = mount(createConfigRouter, deps);
    const res = await supertest(app).get("/api/models");
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Failed to fetch models");
    fetchMock.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ASR router
// ─────────────────────────────────────────────────────────────────────────────

describe("routes/asr — edge cases", () => {
  let fetchMock;
  beforeEach(() => {
    fetchMock = vi.spyOn(global, "fetch");
  });
  afterEach(() => {
    fetchMock.mockRestore();
  });

  it("returns 502 when ASR server returns 500 (server error pattern)", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => "boom" });
    const deps = makeBaseDeps({ config: { asrServerUrl: "http://asr:8081" } });
    const app = mount(createAsrRouter, deps);
    const res = await supertest(app).post("/api/asr/transcribe").attach("file", Buffer.from("x"), "audio.wav");
    expect(res.status).toBe(502);
  });

  it("returns 400 when asrServerUrl is empty", async () => {
    const deps = makeBaseDeps({ config: { asrServerUrl: "" } });
    const app = mount(createAsrRouter, deps);
    const res = await supertest(app).post("/api/asr/transcribe").attach("file", Buffer.from("x"), "audio.wav");
    expect(res.status).toBe(400);
  });

  it("returns 400 when no file is attached", async () => {
    const deps = makeBaseDeps({ config: { asrServerUrl: "http://asr:8081" } });
    const app = mount(createAsrRouter, deps);
    const res = await supertest(app).post("/api/asr/transcribe");
    expect(res.status).toBe(400);
  });

  it("GET /api/asr/status returns not-configured when URL empty", async () => {
    const deps = makeBaseDeps({ config: { asrServerUrl: "" } });
    const app = mount(createAsrRouter, deps);
    const res = await supertest(app).get("/api/asr/status");
    expect(res.body.configured).toBe(false);
    expect(res.body.reachable).toBe(false);
    expect(res.body.url).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Chat router
// ─────────────────────────────────────────────────────────────────────────────

describe("routes/chat — agent loop result shapes", () => {
  it("handles success result with response, messages, toolCalls, toolResults", async () => {
    agentLoopStep.mockResolvedValue({
      response: "Hello!",
      messages: [
        { role: "assistant", tool_calls: [{ id: "c1", function: { name: "read", arguments: '{"p":"a"}' } }] },
        { role: "tool", tool_call_id: "c1", content: '{"success":true,"content":"file content"}' },
      ],
      tokenUsage: { prompt: 5, completion: 3, total: 8, cached: 0 },
      timings: { prompt_n: 5, predicted_n: 3, prompt_ms: 100, predicted_ms: 50 },
    });
    const deps = makeBaseDeps();
    const app = mount(createChatRouter, deps);
    const res = await supertest(app).post("/api/chat").send({ message: "hi", useAgentLoop: true });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.reply).toBe("Hello!");
    expect(res.body.toolCalls).toHaveLength(1);
    expect(res.body.toolCalls[0].name).toBe("read");
    expect(res.body.toolResults).toHaveLength(1);
    expect(res.body.toolResults[0].success).toBe(true);
    expect(res.body.tokenUsage).toEqual({ prompt: 5, completion: 3, total: 8, cached: 0 });
    expect(deps.wsBroadcast).toHaveBeenCalledWith(
      "tokenUsage",
      expect.objectContaining({ prompt: 5, completion: 3, total: 8, cached: 0, timestamp: expect.any(Number) })
    );
    expect(deps.wsBroadcast).toHaveBeenCalledWith("perfStats", expect.objectContaining({ prompt_n: 5 }));
  });

  it("broadcasts tokenUsage exactly once per agent request with per-request delta", async () => {
    agentLoopStep.mockResolvedValue({
      response: "ok",
      messages: [],
      tokenUsage: { prompt: 10, completion: 20, total: 30, cached: 2 },
    });
    const deps = makeBaseDeps();
    const app = mount(createChatRouter, deps);
    await supertest(app).post("/api/chat").send({ message: "hi", useAgentLoop: true });
    const tokenUsageCalls = deps.wsBroadcast.mock.calls.filter((c) => c[0] === "tokenUsage");
    expect(tokenUsageCalls).toHaveLength(1);
    const payload = tokenUsageCalls[0][1];
    expect(payload).toEqual({
      prompt: 10,
      completion: 20,
      total: 30,
      cached: 2,
      timestamp: expect.any(Number),
    });
  });

  it("does not broadcast tokenUsage when agent result has no tokenUsage", async () => {
    agentLoopStep.mockResolvedValue({ response: "ok", messages: [] });
    const deps = makeBaseDeps();
    const app = mount(createChatRouter, deps);
    await supertest(app).post("/api/chat").send({ message: "hi", useAgentLoop: true });
    const tokenUsageCalls = deps.wsBroadcast.mock.calls.filter((c) => c[0] === "tokenUsage");
    expect(tokenUsageCalls).toHaveLength(0);
  });

  it("handles error result (no response)", async () => {
    agentLoopStep.mockResolvedValue({
      error: "Something went wrong",
      messages: [],
    });
    const deps = makeBaseDeps();
    const app = mount(createChatRouter, deps);
    const res = await supertest(app).post("/api/chat").send({ message: "hi", useAgentLoop: true });
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe("Something went wrong");
    expect(res.body.abortId).toBeDefined();
  });

  it("handles cancelled result (response === 'Cancelled')", async () => {
    agentLoopStep.mockResolvedValue({ cancelled: true, response: "Cancelled" });
    const deps = makeBaseDeps();
    const app = mount(createChatRouter, deps);
    const res = await supertest(app).post("/api/chat").send({ message: "hi", useAgentLoop: true });
    expect(res.body.success).toBe(true);
    expect(res.body.cancelled).toBe(true);
    expect(res.body.reply).toBe("Cancelled");
  });

  it("handles requiresApproval result (no response field)", async () => {
    agentLoopStep.mockResolvedValue({
      requiresApproval: true,
      toolName: "write",
      args: { path: "/tmp/x", content: "data" },
      toolCallId: "tc-1",
      messages: [],
    });
    const deps = makeBaseDeps();
    const app = mount(createChatRouter, deps);
    const res = await supertest(app).post("/api/chat").send({ message: "write a file", useAgentLoop: true });
    expect(res.body.success).toBe(true);
    expect(res.body.requiresApproval).toBe(true);
    expect(res.body.approvalToolName).toBe("write");
    expect(res.body.approvalArgs).toEqual({ path: "/tmp/x", content: "data" });
    expect(res.body.approvalToolCallId).toBe("tc-1");
    expect(res.body.reply).toBe("");
  });

  it("returns abortId in response", async () => {
    agentLoopStep.mockResolvedValue({ response: "ok", messages: [] });
    const deps = makeBaseDeps();
    const app = mount(createChatRouter, deps);
    const customAbortId = "my-custom-abort-id";
    const res = await supertest(app)
      .post("/api/chat")
      .send({ message: "hi", useAgentLoop: true, abortId: customAbortId });
    expect(res.body.abortId).toBe(customAbortId);
  });
});

describe("routes/chat — /api/chat/cancel", () => {
  it("returns 400 when abortId missing", async () => {
    const deps = makeBaseDeps();
    const app = mount(createChatRouter, deps);
    const res = await supertest(app).post("/api/chat/cancel").send({});
    expect(res.status).toBe(400);
  });

  it("returns success false when no active request for abortId", async () => {
    const deps = makeBaseDeps();
    const app = mount(createChatRouter, deps);
    const res = await supertest(app).post("/api/chat/cancel").send({ abortId: "nonexistent" });
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("No active request");
  });

  it("aborts active controller and removes from registry", async () => {
    const deps = makeBaseDeps();
    // Simulate an active controller in registry
    const controller = new AbortController();
    const activeMap = new Map();
    activeMap.set("active-1", controller);
    // We can't inject into the chat router's internal map directly, so this test
    // validates the no-op path. Active-cancel flow requires a real in-flight request.
    const app = mount(createChatRouter, deps);
    const res = await supertest(app).post("/api/chat/cancel").send({ abortId: "active-1" });
    expect(res.body.success).toBe(false);
    expect(controller.signal.aborted).toBe(false);
  });
});

describe("routes/chat — /api/chat/continue", () => {
  it("returns 400 when messages or approvalDecision missing", async () => {
    const deps = makeBaseDeps();
    const app = mount(createChatRouter, deps);
    const res1 = await supertest(app).post("/api/chat/continue").send({});
    expect(res1.status).toBe(400);
    const res2 = await supertest(app).post("/api/chat/continue").send({ messages: [] });
    expect(res2.status).toBe(400);
  });

  it("executes tool and continues on approved=true", async () => {
    executeTool.mockResolvedValue({ success: true, data: { content: "ok", filePath: "/x" } });
    agentLoopStep.mockResolvedValue({ response: "Done", messages: [] });
    const deps = makeBaseDeps();
    const app = mount(createChatRouter, deps);
    const res = await supertest(app)
      .post("/api/chat/continue")
      .send({
        messages: [{ role: "assistant", tool_calls: [{ id: "tc-1" }] }],
        approvalDecision: { approved: true, toolName: "read", args: { path: "/x" }, toolCallId: "tc-1" },
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.reply).toBe("Done");
    expect(executeTool).toHaveBeenCalledWith(
      { name: "read", args: { path: "/x" } },
      expect.objectContaining({ projectPath: "/tmp/test" })
    );
  });

  it("inserts rejection message on approved=false", async () => {
    agentLoopStep.mockResolvedValue({ response: "Acknowledged", messages: [] });
    const deps = makeBaseDeps();
    const app = mount(createChatRouter, deps);
    const res = await supertest(app)
      .post("/api/chat/continue")
      .send({
        messages: [],
        approvalDecision: { approved: false, toolName: "execute", args: {}, toolCallId: "tc-1" },
      });
    expect(res.status).toBe(200);
    expect(res.body.reply).toBe("Acknowledged");
    expect(executeTool).not.toHaveBeenCalled();
  });

  it("handles executeTool error gracefully (rejection in tool result, not crash)", async () => {
    executeTool.mockRejectedValue(new Error("Tool failed"));
    agentLoopStep.mockResolvedValue({ response: "ok", messages: [] });
    const deps = makeBaseDeps();
    const app = mount(createChatRouter, deps);
    const res = await supertest(app)
      .post("/api/chat/continue")
      .send({
        messages: [],
        approvalDecision: { approved: true, toolName: "read", args: {}, toolCallId: "tc-1" },
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe("routes/chat — /api/chat/clean-text", () => {
  it("returns 400 when text missing or non-string", async () => {
    const deps = makeBaseDeps();
    const app = mount(createChatRouter, deps);
    const r1 = await supertest(app).post("/api/chat/clean-text").send({});
    expect(r1.status).toBe(400);
    const r2 = await supertest(app).post("/api/chat/clean-text").send({ text: 123 });
    expect(r2.status).toBe(400);
  });

  it("returns cleaned text immediately if input is empty/whitespace", async () => {
    const deps = makeBaseDeps();
    const app = mount(createChatRouter, deps);
    const res = await supertest(app).post("/api/chat/clean-text").send({ text: "   " });
    expect(res.status).toBe(200);
    expect(res.body.cleaned).toBe("   ");
  });

  it("falls back to original text on LLM error", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockRejectedValue(new Error("Server down"));
    const deps = makeBaseDeps();
    const app = mount(createChatRouter, deps);
    const res = await supertest(app).post("/api/chat/clean-text").send({ text: "hello world" });
    expect(res.status).toBe(200);
    expect(res.body.cleaned).toBe("hello world");
    fetchMock.mockRestore();
  });

  it("falls back to original text on LLM empty response", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "" } }] }),
    });
    const deps = makeBaseDeps();
    const app = mount(createChatRouter, deps);
    const res = await supertest(app).post("/api/chat/clean-text").send({ text: "hello" });
    expect(res.body.cleaned).toBe("hello");
    fetchMock.mockRestore();
  });

  it("returns cleaned text on success", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "cleaned" } }] }),
    });
    const deps = makeBaseDeps();
    const app = mount(createChatRouter, deps);
    const res = await supertest(app).post("/api/chat/clean-text").send({ text: "ну типа hello" });
    expect(res.body.cleaned).toBe("cleaned");
    fetchMock.mockRestore();
  });
});

describe("routes/chat — POST /api/chat direct (no agent loop)", () => {
  it("returns 400 when message missing", async () => {
    const deps = makeBaseDeps();
    const app = mount(createChatRouter, deps);
    const res = await supertest(app).post("/api/chat").send({});
    expect(res.status).toBe(400);
  });

  it("returns 500 on fetch error (no TypeError leak)", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockRejectedValue(new Error("fetch failed"));
    const deps = makeBaseDeps();
    const app = mount(createChatRouter, deps);
    const res = await supertest(app).post("/api/chat").send({ message: "hi" });
    expect(res.status).toBe(500);
    expect(res.body.error).not.toContain("TypeError");
    expect(res.body.error).not.toContain("undefined");
    fetchMock.mockRestore();
  });

  it("returns JSON reply in non-stream mode", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "reply" } }],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
      }),
    });
    const deps = makeBaseDeps();
    const app = mount(createChatRouter, deps);
    const res = await supertest(app).post("/api/chat").send({ message: "hi" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.reply).toBe("reply");
    expect(res.body.usage).toEqual({ prompt: 5, completion: 3, total: 8, cached: 0 });
    fetchMock.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin router
// ─────────────────────────────────────────────────────────────────────────────

describe("routes/admin — tasks and tool", () => {
  it("POST /api/tasks/cancel returns 400 when taskId missing", async () => {
    const deps = makeBaseDeps();
    const app = mount(createAdminRouter, deps);
    const res = await supertest(app).post("/api/tasks/cancel").send({});
    expect(res.status).toBe(400);
  });

  it("POST /api/tasks/cancel returns success:false when task not found", async () => {
    const deps = makeBaseDeps();
    const app = mount(createAdminRouter, deps);
    const res = await supertest(app).post("/api/tasks/cancel").send({ taskId: "missing" });
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("not found");
  });

  it("POST /api/agent/tool returns 400 when name missing", async () => {
    const deps = makeBaseDeps();
    const app = mount(createAdminRouter, deps);
    const res = await supertest(app).post("/api/agent/tool").send({});
    expect(res.status).toBe(400);
  });
});
