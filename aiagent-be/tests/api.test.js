import path from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import supertest from "supertest";
import express from "express";
import { createApiRouter } from "../routes/api.js";

function createMockDeps() {
  const config = {
    serverUrl: "http://test:8080/v1",
    modelName: "test-model",
    projectPath: "/tmp/test-project",
    systemPrompt: "You are test bot",
    apiKey: "test-key",
    maxTokens: 4096,
    temperature: 0.1,
    timeout: 30000,
    maxFileChars: 2000,
    maxHistoryPairs: 5,
    maxSearchResults: 15,
    maxFilesInPrompt: 2,
  };
  const stats = { requests: 0, tools: 0, errors: 0 };
  return {
    config,
    stats,
    chatHistories: new Map(),
    pendingApprovals: new Map(),
    agentLogs: [],
    tokenUsage: { prompt: 0, completion: 0, total: 0, cached: 0 },
    state: { botStatus: "idle", botStatusMessage: "", startTime: Date.now() },
    bot: { start: vi.fn(), stop: vi.fn() },
    addLog: vi.fn(),
    updateAgentConfig: vi.fn(),
    updateStatus: vi.fn(),
    resetStats: vi.fn(),
    resetTokenUsage: vi.fn(),
    wsBroadcast: vi.fn(),
  };
}

describe("API Routes", () => {
  let app;
  let deps;
  const API_KEY = "test-key";

  function authGet(path) {
    return supertest(app).get(path).set("x-api-key", API_KEY);
  }
  function authPost(path) {
    return supertest(app).post(path).set("x-api-key", API_KEY);
  }
  function authDelete(path) {
    return supertest(app).delete(path).set("x-api-key", API_KEY);
  }

  beforeEach(() => {
    deps = createMockDeps();
    const router = createApiRouter(deps);
    app = express();
    app.use(express.json());
    app.use("/api", router);
  });

  describe("GET /api/config", () => {
    it("returns current configuration", async () => {
      const res = await authGet("/api/config");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.config.modelName).toBe("test-model");
    });

    it("includes hasToken flag (not raw token)", async () => {
      const res = await authGet("/api/config");
      expect(res.body.config).toHaveProperty("hasToken");
      expect(res.body.config).not.toHaveProperty("token");
    });
  });

  describe("POST /api/config", () => {
    it("updates config fields", async () => {
      const res = await authPost("/api/config")
        .send({ modelName: "new-model", serverUrl: "http://new:8080/v1" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(deps.config.modelName).toBe("new-model");
    });

    it("resolves projectPath with path.resolve", async () => {
      const res = await authPost("/api/config")
        .send({ projectPath: process.cwd() });
      expect(res.status).toBe(200);
      expect(deps.config.projectPath).toBe(path.resolve(process.cwd()));
    });

    it("directly mutates config object", async () => {
      await authPost("/api/config").send({ modelName: "x" });
      expect(deps.config.modelName).toBe("x");
    });

    it("handles chatMode field", async () => {
      const res = await authPost("/api/config").send({ chatMode: true });
      expect(res.status).toBe(200);
      expect(deps.config.chatMode).toBe(true);
    });

    it("rejects empty projectPath", async () => {
      await authPost("/api/config")
        .send({ projectPath: "" });
      expect(deps.addLog).toHaveBeenCalledWith(expect.stringContaining("skipped"), "warning");
    });
  });

  describe("GET /api/status", () => {
    it("returns idle status by default", async () => {
      const res = await authGet("/api/status");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("idle");
      expect(res.body.isRunning).toBe(false);
    });

    it("returns stats", async () => {
      const res = await authGet("/api/status");
      expect(res.body.stats).toHaveProperty("requests");
      expect(res.body.stats).toHaveProperty("errors");
    });

    it("returns non-negative uptime", async () => {
      const res = await authGet("/api/status");
      expect(res.body.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe("GET /api/tools", () => {
    it("returns tool definitions and config", async () => {
      const res = await authGet("/api/tools");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.tools).toHaveProperty("read");
      expect(res.body.tools).toHaveProperty("write");
      expect(res.body.config).toBeDefined();
    });
  });

  describe("POST /api/tools", () => {
    it("updates tool config", async () => {
      const res = await authPost("/api/tools")
        .send({ name: "read", enabled: false });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("rejects unknown tool name", async () => {
      const res = await authPost("/api/tools")
        .send({ name: "nonexistent" });
      expect(res.status).toBe(404);
    });

    it("requires name field", async () => {
      const res = await authPost("/api/tools").send({});
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/start", () => {
    it("starts the bot", async () => {
      const res = await authPost("/api/start");
      expect(res.status).toBe(200);
    });
  });

  describe("POST /api/stop", () => {
    it("stops the bot and clears state", async () => {
      const res = await authPost("/api/stop");
      expect(res.status).toBe(200);
      expect(deps.chatHistories.size).toBe(0);
    });
  });

  describe("POST /api/restart", () => {
    it("restarts the bot", async () => {
      const res = await authPost("/api/restart");
      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/logs", () => {
    it("returns empty logs initially", async () => {
      const res = await authGet("/api/logs");
      expect(res.status).toBe(200);
      expect(res.body.logs).toEqual([]);
    });

    it("returns logs up to limit", async () => {
      deps.agentLogs.push(
        { time: Date.now(), message: "test1", type: "info" },
        { time: Date.now(), message: "test2", type: "info" },
      );
      const res = await authGet("/api/logs?limit=1");
      expect(res.body.logs.length).toBe(1);
    });
  });

  describe("DELETE /api/logs", () => {
    it("clears all logs", async () => {
      deps.agentLogs.push({ time: Date.now(), message: "test", type: "info" });
      await authDelete("/api/logs");
      expect(deps.agentLogs.length).toBe(0);
    });
  });

  describe("GET /api/accounts", () => {
    it("returns accounts list", async () => {
      const res = await authGet("/api/accounts");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("POST /api/accounts", () => {
    it("requires accounts array", async () => {
      const res = await authPost("/api/accounts").send({});
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/accounts/import", () => {
    it("requires accounts array", async () => {
      const res = await authPost("/api/accounts/import").send({});
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/agent/tool", () => {
    it("requires toolCall.name", async () => {
      const res = await authPost("/api/agent/tool")
        .send({ toolCall: {} });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/chat", () => {
    it("requires message field", async () => {
      const res = await authPost("/api/chat").send({});
      expect(res.status).toBe(400);
    });

    it("requires message to be non-empty", async () => {
      const res = await authPost("/api/chat")
        .send({ message: "" });
      expect(res.status).toBe(400);
    });

    it("handles fetch error gracefully (not TypeError)", async () => {
      const origFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValue(new Error("fetch failed"));
      const res = await authPost("/api/chat")
        .send({ message: "hello" });
      global.fetch = origFetch;
      expect(res.status).toBe(500);
      expect(res.body.error).not.toContain("undefined");
      expect(res.body.error).not.toContain("TypeError");
    });
  });

  describe("GET /api/health", () => {
    let fetchMock;

    beforeEach(() => {
      fetchMock = vi.spyOn(global, "fetch");
    });

    afterEach(() => {
      fetchMock.mockRestore();
    });

    it("returns bot and aiServer fields in response", async () => {
      fetchMock.mockResolvedValue({ ok: true });
      const res = await supertest(app).get("/api/health");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("status");
      expect(res.body).toHaveProperty("bot");
      expect(res.body).toHaveProperty("aiServer");
      expect(res.body).toHaveProperty("timestamp");
      expect(res.body.bot).toHaveProperty("isRunning");
      expect(res.body.bot).toHaveProperty("status");
      expect(res.body.bot).toHaveProperty("uptime");
      expect(res.body.aiServer).toHaveProperty("reachable");
    });

    it("reports degraded when bot idle and AI reachable", async () => {
      deps.state.botStatus = "idle";
      fetchMock.mockResolvedValue({ ok: true });
      const res = await supertest(app).get("/api/health");
      expect(res.body.status).toBe("degraded");
      expect(res.body.bot.isRunning).toBe(false);
      expect(res.body.aiServer.reachable).toBe(true);
    });

    it("reports unhealthy when AI server unreachable", async () => {
      fetchMock.mockRejectedValue(new Error("Connection refused"));
      const res = await supertest(app).get("/api/health");
      expect(res.body.status).toBe("unhealthy");
      expect(res.body.aiServer.reachable).toBe(false);
    });

    it("reports healthy when bot running and AI reachable", async () => {
      deps.state.botStatus = "running";
      deps.state.startTime = Date.now();
      fetchMock.mockResolvedValue({ ok: true });
      const res = await supertest(app).get("/api/health");
      expect(res.body.status).toBe("healthy");
      expect(res.body.bot.isRunning).toBe(true);
      expect(res.body.aiServer.reachable).toBe(true);
      expect(res.body.bot.uptime).toBeGreaterThanOrEqual(0);
    });
  });
});
