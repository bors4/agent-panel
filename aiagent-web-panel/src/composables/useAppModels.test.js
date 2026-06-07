/**
 * Тесты для composable useAppModels.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ref } from "vue";
import { useAppModels } from "@/composables/useAppModels";
import * as client from "@/api/client";

const TEST_DEFAULT_API_BASES = [
  { url: "http://192.168.1.101:8080/v1", connected: true },
  { url: "http://192.168.1.101:1234/v1", connected: false },
];
const TEST_DEFAULT_MODEL = "gemma-4-E4B-it-Q4_K_M.gguf";
const TEST_DEFAULT_SERVER_URL = "http://192.168.1.101:8080/v1";

function makeDeps(overrides = {}) {
  return {
    addLog: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    maxTokensFallback: ref(overrides.maxTokens ?? 1024),
    ...overrides,
  };
}

describe("useAppModels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exposes initial state with empty defaults (production)", () => {
    const m = useAppModels(makeDeps());
    expect(m.modelName.value).toBe("");
    expect(m.serverUrl.value).toBe("");
    expect(m.apiBases.value).toEqual([]);
    expect(m.availableModels.value).toEqual([]);
  });

  it("can be initialized with test defaults", () => {
    const m = useAppModels(makeDeps());
    m.apiBases.value = [...TEST_DEFAULT_API_BASES];
    m.modelName.value = TEST_DEFAULT_MODEL;
    m.serverUrl.value = TEST_DEFAULT_SERVER_URL;
    expect(m.modelName.value).toBe(TEST_DEFAULT_MODEL);
    expect(m.serverUrl.value).toBe(TEST_DEFAULT_SERVER_URL);
    expect(m.apiBases.value).toHaveLength(TEST_DEFAULT_API_BASES.length);
  });

  it("selectedModel returns the model that matches modelName", () => {
    const m = useAppModels(makeDeps());
    m.availableModels.value = [
      { id: "x", source: "http://a" },
      { id: "y", source: "http://b" },
    ];
    m.modelName.value = "y";
    expect(m.selectedModel.value).toEqual({ id: "y", source: "http://b" });
  });

  it("modelContextLength prefers model.maxContextLength", () => {
    const m = useAppModels(makeDeps());
    m.availableModels.value = [{ id: "y", source: "http://b", maxContextLength: 32768 }];
    m.modelName.value = "y";
    expect(m.modelContextLength.value).toBe(32768);
  });

  it("modelContextLength falls back to maxTokensFallback", () => {
    const m = useAppModels(makeDeps({ maxTokens: 2048 }));
    m.availableModels.value = [{ id: "y", source: "http://b" }];
    m.modelName.value = "y";
    expect(m.modelContextLength.value).toBe(2048);
  });

  it("loadApiBases fetches models from connected bases and dedupes by id", async () => {
    vi.spyOn(client, "getModels")
      .mockResolvedValueOnce({ models: [{ id: "m1" }, { id: "m2" }] })
      .mockResolvedValueOnce({ models: [{ id: "m2" }, { id: "m3" }] });
    const deps = makeDeps();
    const m = useAppModels(deps);
    m.apiBases.value = [
      { url: "http://a/v1", connected: true },
      { url: "http://b/v1", connected: true },
    ];
    await m.loadApiBases();
    expect(m.availableModels.value.map((x) => x.id).sort()).toEqual(["m1", "m2", "m3"]);
    expect(deps.addLog).toHaveBeenCalledWith(expect.stringContaining("Connected to"), "success");
  });

  it("loadApiBases logs error when getModels rejects", async () => {
    vi.spyOn(client, "getModels").mockRejectedValue(new Error("down"));
    const deps = makeDeps();
    const m = useAppModels(deps);
    m.apiBases.value = [{ url: "http://a/v1", connected: true }];
    await m.loadApiBases();
    expect(deps.addLog).toHaveBeenCalledWith(expect.stringContaining("Failed"), "error");
  });

  it("loadApiBases selects first available model if modelName is unknown", async () => {
    vi.spyOn(client, "getModels").mockResolvedValueOnce({ models: [{ id: "m1" }] });
    const m = useAppModels(makeDeps());
    m.apiBases.value = [{ url: "http://a/v1", connected: true }];
    await m.loadApiBases();
    expect(m.modelName.value).toBe("m1");
  });

  it("loadApiBases keeps current modelName if it exists in availableModels", async () => {
    vi.spyOn(client, "getModels").mockResolvedValueOnce({ models: [{ id: "m1" }, { id: "preexisting" }] });
    const m = useAppModels(makeDeps());
    m.modelName.value = "preexisting";
    await m.loadApiBases();
    expect(m.modelName.value).toBe("preexisting");
  });

  it("updateModels with OpenRouter URL calls getModels with key and toasts success", async () => {
    vi.spyOn(client, "getModels").mockResolvedValueOnce({ models: [{ id: "or1" }] });
    const deps = makeDeps();
    const m = useAppModels(deps);
    await m.updateModels("https://openrouter.ai/api/v1", "or-key-123");
    expect(client.getModels).toHaveBeenCalledWith("https://openrouter.ai/api/v1", "or-key-123");
    expect(m.availableModels.value).toContainEqual(
      expect.objectContaining({ id: "or1", source: "https://openrouter.ai/api/v1" })
    );
    expect(deps.success).toHaveBeenCalledWith("Модели OpenRouter загружены");
    expect(deps.error).not.toHaveBeenCalled();
  });

  it("updateModels without URL clears availableModels and reloads local bases", async () => {
    vi.spyOn(client, "getModels").mockResolvedValueOnce({ models: [{ id: "m1" }] });
    const deps = makeDeps();
    const m = useAppModels(deps);
    m.apiBases.value = [{ url: "http://a/v1", connected: true }];
    m.availableModels.value = [{ id: "stale" }];
    await m.updateModels();
    expect(m.availableModels.value.find((x) => x.id === "stale")).toBeUndefined();
    expect(m.availableModels.value).toContainEqual(expect.objectContaining({ id: "m1" }));
    expect(deps.success).toHaveBeenCalledWith("Модели обновлены");
  });

  it("updateModels with OpenRouter URL does NOT toast success and does call error on failure", async () => {
    vi.spyOn(client, "getModels").mockRejectedValue(new Error("or-down"));
    const deps = makeDeps();
    const m = useAppModels(deps);
    await m.updateModels("https://openrouter.ai/api/v1", "k");
    expect(deps.addLog).toHaveBeenCalledWith(expect.stringContaining("OpenRouter"), "error");
    expect(deps.success).not.toHaveBeenCalled();
    expect(deps.error).toHaveBeenCalledWith(expect.stringContaining("or-down"));
  });

  it("updateModels with OpenRouter URL logs warning and skips success when no models returned", async () => {
    vi.spyOn(client, "getModels").mockResolvedValueOnce({ error: "rate-limited" });
    const deps = makeDeps();
    const m = useAppModels(deps);
    await m.updateModels("https://openrouter.ai/api/v1", "k");
    expect(deps.addLog).toHaveBeenCalledWith(expect.stringContaining("no models"), "warning");
    expect(deps.success).not.toHaveBeenCalled();
  });

  it("loadApiBases preserves user-typed modelName typed during in-flight fetch", async () => {
    let resolveFetch;
    vi.spyOn(client, "getModels").mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );
    const m = useAppModels(makeDeps());
    m.apiBases.value = [{ url: "http://a/v1", connected: true }];
    const promise = m.loadApiBases();
    m.modelName.value = "user-typed-during-fetch";
    resolveFetch({ models: [{ id: "m1" }] });
    await promise;
    expect(m.modelName.value).toBe("user-typed-during-fetch");
  });

  it("loadApiBases handles getModels returning no `models` array", async () => {
    vi.spyOn(client, "getModels").mockResolvedValueOnce({ error: "forbidden" });
    const deps = makeDeps();
    const m = useAppModels(deps);
    m.apiBases.value = [{ url: "http://a/v1", connected: true }];
    await m.loadApiBases();
    // No models pushed (data.models is undefined → falsy), no crash.
    // The error toast path is only triggered when getModels rejects — see
    // the dedicated 'logs error when getModels rejects' test below.
    expect(m.availableModels.value).toEqual([]);
    expect(m.modelName.value).toBe(""); // unchanged (no defaults in production)
  });

  it("dedupes large lists correctly (Set-based, O(n) not O(n²))", async () => {
    // Pre-populate with 100 existing models.
    const m = useAppModels(makeDeps());
    for (let i = 0; i < 100; i++) {
      m.availableModels.value.push({ id: `old-${i}`, source: "http://a" });
    }
    // Fetch returns 100 new + 20 overlapping with the existing list.
    const fetched = [];
    for (let i = 0; i < 100; i++) fetched.push({ id: `new-${i}` });
    for (let i = 0; i < 20; i++) fetched.push({ id: `old-${i}` });
    vi.spyOn(client, "getModels").mockResolvedValueOnce({ models: fetched });
    m.apiBases.value = [{ url: "http://b/v1", connected: true }];
    await m.loadApiBases();
    // Total = 100 old + 100 new = 200 (the 20 overlaps are dropped).
    expect(m.availableModels.value).toHaveLength(200);
    const ids = m.availableModels.value.map((x) => x.id);
    expect(new Set(ids).size).toBe(200); // no duplicates
  });

  describe("loadApiBases — serverUrl override behaviour (regression: user-saved IP is lost)", () => {
    it("keeps user-saved serverUrl when it matches an active apiBase (even if model is on multiple)", async () => {
      // Model is hosted on BOTH bases. Discovery will tag it with the FIRST
      // base (apiBases[0]). The user's saved serverUrl points to the SECOND
      // base — that value must survive loadApiBases.
      vi.spyOn(client, "getModels").mockImplementation(async (url) => {
        if (url === "http://192.168.1.101:8080/v1") return { models: [{ id: "qwen" }] };
        if (url === "http://192.168.1.103:8080/v1") return { models: [{ id: "qwen" }] };
        return { models: [] };
      });
      const m = useAppModels(makeDeps());
      m.modelName.value = "qwen";
      m.serverUrl.value = "http://192.168.1.103:8080/v1";
      m.apiBases.value = [
        { url: "http://192.168.1.101:8080/v1", connected: true },
        { url: "http://192.168.1.103:8080/v1", connected: true },
      ];
      await m.loadApiBases();
      expect(m.serverUrl.value).toBe("http://192.168.1.103:8080/v1");
    });

    it("falls back to discovery source when user-saved serverUrl is not in active apiBases", async () => {
      vi.spyOn(client, "getModels").mockResolvedValueOnce({ models: [{ id: "m1" }] });
      const m = useAppModels(makeDeps());
      m.modelName.value = "m1";
      m.serverUrl.value = "http://192.168.1.999:8080/v1"; // not in active list
      m.apiBases.value = [{ url: "http://192.168.1.101:8080/v1", connected: true }];
      await m.loadApiBases();
      expect(m.serverUrl.value).toBe("http://192.168.1.101:8080/v1");
    });

    it("falls back to discovery source when serverUrl is empty", async () => {
      vi.spyOn(client, "getModels").mockResolvedValueOnce({ models: [{ id: "m1" }] });
      const m = useAppModels(makeDeps());
      m.modelName.value = "m1";
      m.serverUrl.value = "";
      m.apiBases.value = [{ url: "http://192.168.1.101:8080/v1", connected: true }];
      await m.loadApiBases();
      expect(m.serverUrl.value).toBe("http://192.168.1.101:8080/v1");
    });
  });

  describe("setModel", () => {
    it("updates modelName and syncs serverUrl to the model's discovered source", async () => {
      vi.spyOn(client, "getModels").mockResolvedValueOnce({ models: [{ id: "m1" }, { id: "m2" }] });
      const m = useAppModels(makeDeps());
      m.apiBases.value = [{ url: "http://192.168.1.103:8080/v1", connected: true }];
      await m.loadApiBases();
      // Pre-state: m1 is current, source is 192.168.1.103
      m.modelName.value = "m1";
      m.serverUrl.value = "http://192.168.1.103:8080/v1";

      m.setModel("m2");
      expect(m.modelName.value).toBe("m2");
      // m2 is also on the same base, so URL should follow
      expect(m.serverUrl.value).toBe("http://192.168.1.103:8080/v1");
    });

    it("updates serverUrl when switching between models on different bases", async () => {
      // Two api bases, each hosts a different model
      vi.spyOn(client, "getModels").mockImplementation(async (url) => {
        if (url === "http://a/v1") return { models: [{ id: "modelA" }] };
        if (url === "http://b/v1") return { models: [{ id: "modelB" }] };
        return { models: [] };
      });
      const m = useAppModels(makeDeps());
      m.apiBases.value = [
        { url: "http://a/v1", connected: true },
        { url: "http://b/v1", connected: true },
      ];
      await m.loadApiBases();

      m.setModel("modelB");
      expect(m.modelName.value).toBe("modelB");
      expect(m.serverUrl.value).toBe("http://b/v1");
    });

    it("keeps serverUrl as-is if the new model is not in availableModels (validation will catch it later)", async () => {
      vi.spyOn(client, "getModels").mockResolvedValueOnce({ models: [{ id: "m1" }] });
      const m = useAppModels(makeDeps());
      m.apiBases.value = [{ url: "http://192.168.1.101:8080/v1", connected: true }];
      await m.loadApiBases();
      m.serverUrl.value = "http://custom:9000/v1";

      m.setModel("not-discovered");
      expect(m.modelName.value).toBe("not-discovered");
      expect(m.serverUrl.value).toBe("http://custom:9000/v1"); // unchanged
    });
  });
});
