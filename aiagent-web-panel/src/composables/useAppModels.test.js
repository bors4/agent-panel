/**
 * Тесты для composable useAppModels.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ref } from "vue";
import { useAppModels } from "@/composables/useAppModels";
import * as client from "@/api/client";

function makeDeps(overrides = {}) {
  return {
    addLog: vi.fn(),
    success: vi.fn(),
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

  it("exposes initial state with defaults", () => {
    const m = useAppModels(makeDeps());
    expect(m.modelName.value).toBe("gemma-4-E4B-it-Q4_K_M.gguf");
    expect(m.serverUrl.value).toBe("http://192.168.1.101:8080/v1");
    expect(m.apiBases.value).toHaveLength(2);
    expect(m.availableModels.value).toEqual([]);
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
    await m.loadApiBases();
    expect(deps.addLog).toHaveBeenCalledWith(expect.stringContaining("Failed"), "error");
  });

  it("loadApiBases selects first available model if modelName is unknown", async () => {
    vi.spyOn(client, "getModels").mockResolvedValueOnce({ models: [{ id: "m1" }] });
    const m = useAppModels(makeDeps());
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
  });

  it("updateModels without URL clears availableModels and reloads local bases", async () => {
    vi.spyOn(client, "getModels").mockResolvedValueOnce({ models: [{ id: "m1" }] });
    const deps = makeDeps();
    const m = useAppModels(deps);
    m.availableModels.value = [{ id: "stale" }];
    await m.updateModels();
    expect(m.availableModels.value.find((x) => x.id === "stale")).toBeUndefined();
    expect(m.availableModels.value).toContainEqual(expect.objectContaining({ id: "m1" }));
    expect(deps.success).toHaveBeenCalledWith("Модели обновлены");
  });

  it("updateModels with OpenRouter URL logs error on failure", async () => {
    vi.spyOn(client, "getModels").mockRejectedValue(new Error("or-down"));
    const deps = makeDeps();
    const m = useAppModels(deps);
    await m.updateModels("https://openrouter.ai/api/v1", "k");
    expect(deps.addLog).toHaveBeenCalledWith(expect.stringContaining("OpenRouter"), "error");
    expect(deps.success).toHaveBeenCalledWith("Модели OpenRouter загружены");
  });
});
