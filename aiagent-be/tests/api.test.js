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
    telegramToken: "test-token",
    asrServerUrl: "",
    asrLanguage: "ru",
  };
  const stats = { requests: 0, tools: 0, errors: 0 };
  return {
    config,
    stats,
    chatHistories: new Map(),
    pendingApprovals: new Map(),
    activeAgentControllers: new Map(),
    agentLogs: [],
    tokenUsage: { prompt: 0, completion: 0, total: 0, cached: 0 },
    state: { botStatus: "idle", botStatusMessage: "", startTime: Date.now() },
    bot: { start: vi.fn(), stop: vi.fn() },
    initBot: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), use: vi.fn(), api: { config: { use: vi.fn() } } })),
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

    it("includes hasToken flag and token field", async () => {
      const res = await authGet("/api/config");
      expect(res.body.config).toHaveProperty("hasToken");
      expect(res.body.config).toHaveProperty("token");
    });

    it("strips secret fields from response", async () => {
      const res = await authGet("/api/config");
      expect(res.body.config.apiKey).toBeUndefined();
      expect(res.body.config.openrouterApiKey).toBeUndefined();
      expect(res.body.config.telegramToken).toBeUndefined();
    });

    it("hasToken true when telegramToken exists", async () => {
      const res = await authGet("/api/config");
      expect(res.body.config.hasToken).toBe(true);
      expect(res.body.config.token).toBe("test-token");
    });

    it("hasToken false when no telegramToken", async () => {
      deps.config.telegramToken = "";
      const res = await authGet("/api/config");
      expect(res.body.config.hasToken).toBe(false);
      expect(res.body.config.token).toBe("");
    });
  });

  describe("POST /api/config", () => {
    it("updates config fields", async () => {
      const res = await authPost("/api/config").send({ modelName: "new-model", serverUrl: "http://new:8080/v1" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(deps.config.modelName).toBe("new-model");
    });

    it("resolves projectPath with path.resolve", async () => {
      const res = await authPost("/api/config").send({ projectPath: process.cwd() });
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

    it("handles openrouterApiKey field", async () => {
      const res = await authPost("/api/config").send({ openrouterApiKey: "sk-or-v1-test" });
      expect(res.status).toBe(200);
      expect(deps.config.openrouterApiKey).toBe("sk-or-v1-test");
    });

    it("accepts valid asrServerUrl (public hostname)", async () => {
      const res = await authPost("/api/config").send({ asrServerUrl: "https://asr.example.com:8081" });
      expect(res.status).toBe(200);
      expect(deps.config.asrServerUrl).toBe("https://asr.example.com:8081");
    });

    it("accepts private LAN IP asrServerUrl", async () => {
      const res = await authPost("/api/config").send({ asrServerUrl: "http://192.168.1.103:8081" });
      expect(res.status).toBe(200);
      expect(deps.config.asrServerUrl).toBe("http://192.168.1.103:8081");
    });

    it("rejects asrServerUrl pointing to localhost (SSRF)", async () => {
      const res = await authPost("/api/config").send({ asrServerUrl: "http://localhost:8081" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid asrServerUrl/);
      expect(deps.config.asrServerUrl).toBe(""); // unchanged
    });

    it("rejects asrServerUrl with 127.0.0.1 (SSRF)", async () => {
      const res = await authPost("/api/config").send({ asrServerUrl: "http://127.0.0.1:8081" });
      expect(res.status).toBe(400);
    });

    it("rejects asrServerUrl with AWS metadata IP 169.254.169.254 (SSRF)", async () => {
      const res = await authPost("/api/config").send({ asrServerUrl: "http://169.254.169.254/latest" });
      expect(res.status).toBe(400);
    });

    it("rejects asrServerUrl with credentials (SSRF)", async () => {
      const res = await authPost("/api/config").send({ asrServerUrl: "https://user:pass@asr.example.com" });
      expect(res.status).toBe(400);
    });

    it("rejects asrServerUrl with non-http(s) protocol", async () => {
      const res = await authPost("/api/config").send({ asrServerUrl: "ftp://asr.example.com" });
      expect(res.status).toBe(400);
    });

    it("clears asrServerUrl when set to empty string", async () => {
      deps.config.asrServerUrl = "http://previous:8081";
      const res = await authPost("/api/config").send({ asrServerUrl: "" });
      expect(res.status).toBe(200);
      expect(deps.config.asrServerUrl).toBeNull();
    });

    it("accepts asrLanguage field", async () => {
      const res = await authPost("/api/config").send({ asrLanguage: "en-US" });
      expect(res.status).toBe(200);
      expect(deps.config.asrLanguage).toBe("en-US");
    });

    it("sanitizes invalid asrLanguage to 'ru'", async () => {
      const res = await authPost("/api/config").send({ asrLanguage: "../../etc" });
      expect(res.status).toBe(200);
      expect(deps.config.asrLanguage).toBe("ru");
    });

    it("rejects empty projectPath", async () => {
      await authPost("/api/config").send({ projectPath: "" });
      expect(deps.addLog).toHaveBeenCalledWith(expect.stringContaining("skipped"), "warning");
    });

    it("blocks prototype pollution via constructor key", async () => {
      const res = await authPost("/api/config").send({ constructor: { pollute: true } });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid config keys");
    });

    it("blocks prototype pollution via prototype key", async () => {
      const res = await authPost("/api/config").send({ prototype: { pollute: true } });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid config keys");
    });

    it("reinitializes bot when token changes", async () => {
      const oldBot = { start: vi.fn(), stop: vi.fn(), use: vi.fn(), api: { config: { use: vi.fn() } } };
      deps.bot = oldBot;
      const res = await authPost("/api/config").send({ token: "new-token" });
      expect(res.status).toBe(200);
      expect(res.body.tokenChanged).toBe(true);
      expect(oldBot.stop).toHaveBeenCalled();
      expect(deps.initBot).toHaveBeenCalledWith("new-token");
      expect(deps.config.telegramToken).toBe("new-token");
      expect(process.env.TELEGRAM_BOT_TOKEN).toBe("new-token");
    });

    it("clears bot when token set to empty", async () => {
      const oldBot = { start: vi.fn(), stop: vi.fn(), use: vi.fn(), api: { config: { use: vi.fn() } } };
      deps.bot = oldBot;
      const res = await authPost("/api/config").send({ token: "" });
      expect(res.status).toBe(200);
      expect(oldBot.stop).toHaveBeenCalled();
      expect(deps.bot).toBeNull();
    });

    it("does not reinit bot when token unchanged", async () => {
      const oldBot = { start: vi.fn(), stop: vi.fn() };
      deps.bot = oldBot;
      const res = await authPost("/api/config").send({ token: "test-token" });
      expect(res.status).toBe(200);
      expect(res.body.tokenChanged).toBe(false);
      expect(oldBot.stop).not.toHaveBeenCalled();
      expect(deps.initBot).not.toHaveBeenCalled();
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
      const res = await authPost("/api/tools").send({ name: "read", enabled: false });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("rejects unknown tool name", async () => {
      const res = await authPost("/api/tools").send({ name: "nonexistent" });
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

    it("returns error when token not configured", async () => {
      deps.config.telegramToken = "";
      const res = await authPost("/api/start");
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Telegram token not configured");
    });

    it("returns early when bot already running", async () => {
      deps.state.botStatus = "running";
      const res = await authPost("/api/start");
      expect(res.status).toBe(200);
      expect(res.body.message).toContain("already running");
    });

    it("lazy-initializes bot when null", async () => {
      deps.bot = null;
      deps.state.botStatus = "idle";
      const res = await authPost("/api/start");
      expect(res.status).toBe(200);
      expect(deps.initBot).toHaveBeenCalled();
      expect(deps.updateStatus).toHaveBeenCalledWith("running", "Работает");
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

    it("returns error when token not configured", async () => {
      deps.config.telegramToken = "";
      const res = await authPost("/api/restart");
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Telegram token not configured");
    });

    it("lazy-initializes bot when null", async () => {
      deps.bot = null;
      const res = await authPost("/api/restart");
      expect(res.status).toBe(200);
      expect(deps.initBot).toHaveBeenCalled();
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
        { time: Date.now(), message: "test2", type: "info" }
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
      const res = await authPost("/api/agent/tool").send({ toolCall: {} });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/chat", () => {
    it("requires message field", async () => {
      const res = await authPost("/api/chat").send({});
      expect(res.status).toBe(400);
    });

    it("requires message to be non-empty", async () => {
      const res = await authPost("/api/chat").send({ message: "" });
      expect(res.status).toBe(400);
    });

    it("handles fetch error gracefully (not TypeError)", async () => {
      const origFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValue(new Error("fetch failed"));
      const res = await authPost("/api/chat").send({ message: "hello" });
      global.fetch = origFetch;
      expect(res.status).toBe(500);
      expect(res.body.error).not.toContain("undefined");
      expect(res.body.error).not.toContain("TypeError");
    });
  });

  describe("GET /api/models", () => {
    let fetchMock;

    beforeEach(() => {
      fetchMock = vi.spyOn(global, "fetch");
    });

    afterEach(() => {
      fetchMock.mockRestore();
    });

    it("returns models from local server with Authorization header", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: "model-1", name: "Model 1", object: "model", owned_by: "test" }],
        }),
      });
      const res = await authGet("/api/models");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.models).toHaveLength(1);
      expect(res.body.models[0].id).toBe("model-1");
      expect(res.body.source).toBe("local");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/models"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-key",
          }),
        })
      );
    });

    it("uses serverUrl query param to override config", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });
      await authGet("/api/models?serverUrl=http://custom:8080/v1");
      expect(fetchMock).toHaveBeenCalledWith("http://custom:8080/v1/models", expect.any(Object));
    });

    it("sends OpenRouter headers when URL contains openrouter.ai", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });
      deps.config.serverUrl = "https://openrouter.ai/api/v1";
      deps.config.openrouterApiKey = "sk-or-v1-test";
      const res = await authGet("/api/models");
      expect(res.status).toBe(200);
      expect(res.body.source).toBe("openrouter");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("openrouter.ai"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer sk-or-v1-test",
            "HTTP-Referer": "https://agent-panel.local",
            "X-OpenRouter-Title": "AI Agent Panel",
          }),
        })
      );
    });

    it("uses x-openrouter-key header over config.openrouterApiKey", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });
      deps.config.serverUrl = "https://openrouter.ai/api/v1";
      deps.config.openrouterApiKey = "config-key";
      const res = await authGet("/api/models").set("x-openrouter-key", "header-key");
      expect(res.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer header-key",
          }),
        })
      );
    });

    it("maps model fields including max_context_length and pricing", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "gpt-4",
              name: "GPT-4",
              object: "model",
              owned_by: "openai",
              max_context_length: 8192,
              pricing: { prompt: 0.01, completion: 0.03 },
            },
          ],
        }),
      });
      const res = await authGet("/api/models");
      expect(res.body.models[0]).toEqual({
        id: "gpt-4",
        name: "GPT-4",
        object: "model",
        owned_by: "openai",
        max_context_length: 8192,
        pricing: { prompt: 0.01, completion: 0.03 },
      });
    });

    it("handles non-ok response from AI server", async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500 });
      const res = await authGet("/api/models");
      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to fetch models");
    });

    it("handles fetch rejection (timeout / network error)", async () => {
      fetchMock.mockRejectedValue(new Error("Network error"));
      const res = await authGet("/api/models");
      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to fetch models");
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
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("healthy");
      expect(res.body.bot.isRunning).toBe(true);
      expect(res.body.aiServer.reachable).toBe(true);
      expect(res.body.bot.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe("POST /api/asr/transcribe", () => {
    let fetchMock;
    beforeEach(() => {
      fetchMock = vi.spyOn(global, "fetch");
    });
    afterEach(() => {
      fetchMock.mockRestore();
    });

    it("returns 400 when asrServerUrl is not configured", async () => {
      deps.config.asrServerUrl = "";
      const res = await authPost("/api/asr/transcribe").attach("file", Buffer.from("fake"), "audio.wav");
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not configured/);
    });

    it("returns 400 when no file is provided", async () => {
      deps.config.asrServerUrl = "http://asr:8081";
      const res = await authPost("/api/asr/transcribe").field("language", "ru");
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/file/i);
    });

    it("forwards audio to ASR server and returns transcribed text", async () => {
      deps.config.asrServerUrl = "http://asr:8081";
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ text: "привет" }) });
      const res = await authPost("/api/asr/transcribe")
        .attach("file", Buffer.from("RIFFfake"), "test.wav")
        .field("language", "ru");
      expect(res.status).toBe(200);
      expect(res.body.text).toBe("привет");
      expect(fetchMock).toHaveBeenCalledWith("http://asr:8081/inference", expect.objectContaining({ method: "POST" }));
    });

    it("returns 502 when ASR server returns non-ok", async () => {
      deps.config.asrServerUrl = "http://asr:8081";
      fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => "err" });
      const res = await authPost("/api/asr/transcribe").attach("file", Buffer.from("x"), "a.wav");
      expect(res.status).toBe(502);
    });

    it("returns 500 on network error", async () => {
      deps.config.asrServerUrl = "http://asr:8081";
      fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
      const res = await authPost("/api/asr/transcribe").attach("file", Buffer.from("x"), "a.wav");
      expect(res.status).toBe(500);
    });

    it("returns empty text when ASR response has no text field", async () => {
      deps.config.asrServerUrl = "http://asr:8081";
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
      const res = await authPost("/api/asr/transcribe").attach("file", Buffer.from("x"), "a.wav");
      expect(res.status).toBe(200);
      expect(res.body.text).toBe("");
    });
  });

  describe("GET /api/asr/status", () => {
    let fetchMock;
    beforeEach(() => {
      fetchMock = vi.spyOn(global, "fetch");
    });
    afterEach(() => {
      fetchMock.mockRestore();
    });

    it("returns not-configured when URL is empty", async () => {
      deps.config.asrServerUrl = "";
      const res = await authGet("/api/asr/status");
      expect(res.body.configured).toBe(false);
      expect(res.body.reachable).toBe(false);
      expect(res.body.url).toBe("");
    });

    it("reports reachable=true on 200 response", async () => {
      deps.config.asrServerUrl = "http://asr:8081";
      fetchMock.mockResolvedValue({ ok: true, status: 200 });
      const res = await authGet("/api/asr/status");
      expect(res.body.configured).toBe(true);
      expect(res.body.reachable).toBe(true);
    });

    it("reports reachable=false on 500 (no false positives)", async () => {
      deps.config.asrServerUrl = "http://asr:8081";
      fetchMock.mockResolvedValue({ ok: false, status: 500 });
      const res = await authGet("/api/asr/status");
      expect(res.body.reachable).toBe(false);
    });

    it("reports reachable=false on network error", async () => {
      deps.config.asrServerUrl = "http://asr:8081";
      fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
      const res = await authGet("/api/asr/status");
      expect(res.body.reachable).toBe(false);
    });
  });
});
