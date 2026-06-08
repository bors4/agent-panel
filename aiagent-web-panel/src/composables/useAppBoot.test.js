/**
 * Тесты для composable useAppBoot.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ref } from "vue";
import { bootApp } from "@/composables/useAppBoot";
import * as client from "@/api/client";

function makeDeps(overrides = {}) {
  return {
    refreshStatus: vi.fn().mockResolvedValue(),
    handleStart: vi.fn().mockResolvedValue(),
    addLog: vi.fn(),
    warning: vi.fn(),
    loadApiBases: vi.fn().mockResolvedValue(),
    defaultConfig: overrides.defaultConfig ?? {
      token: "",
      projectPath: "",
      serverUrl: "",
      openrouterApiKey: "",
      maxTokens: 1024,
      temperature: 0.1,
      timeout: 300000,
      maxFileChars: 2000,
      maxHistoryPairs: 5,
      maxSearchResults: 15,
      maxFilesInPrompt: 2,
      stream: true,
    },
    refs: overrides.refs ?? {
      localConfig: ref({ projectPath: "", token: "", autoStart: false, ...overrides.localConfig }),
      systemPrompt: ref(overrides.systemPrompt ?? ""),
      apiBases: ref(overrides.apiBases ?? []),
      modelName: ref(overrides.modelName ?? "m1"),
      serverUrl: ref(overrides.serverUrl ?? "http://a/v1"),
    },
    ...overrides,
  };
}

describe("useAppBoot", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("calls refreshStatus, addLog, and loadApiBases in order on cold start", async () => {
    const order = [];
    const deps = makeDeps({
      refreshStatus: vi.fn().mockImplementation(() => {
        order.push("refresh");
        return Promise.resolve();
      }),
      loadApiBases: vi.fn().mockImplementation(() => {
        order.push("loadApiBases");
        return Promise.resolve();
      }),
      addLog: vi.fn((msg) => {
        if (msg === "App initialized") order.push("init");
      }),
    });
    await bootApp(deps);
    expect(order).toEqual(["refresh", "init", "loadApiBases"]);
    expect(deps.addLog).toHaveBeenCalledWith("App initialized", "system");
    expect(deps.warning).toHaveBeenCalledWith(expect.stringContaining("Путь к проекту"));
  });

  it("applies localStorage payload to refs", async () => {
    localStorage.setItem(
      "agent-config",
      JSON.stringify({
        projectPath: "C:\\from-ls",
        token: "tok-ls",
        systemPrompt: "ls-prompt",
        modelName: "ls-model",
        serverUrl: "http://ls/v1",
        apiBases: [{ url: "http://ls/v1", connected: true }],
        maxTokens: 4096,
      })
    );
    vi.spyOn(client, "getConfig").mockResolvedValue({ config: {} });
    const deps = makeDeps();
    await bootApp(deps);
    expect(deps.refs.localConfig.value.projectPath).toBe("C:\\from-ls");
    expect(deps.refs.localConfig.value.token).toBe("tok-ls");
    expect(deps.refs.localConfig.value.maxTokens).toBe(4096);
    expect(deps.refs.systemPrompt.value).toBe("ls-prompt");
    expect(deps.refs.modelName.value).toBe("ls-model");
    expect(deps.refs.serverUrl.value).toBe("http://ls/v1");
  });

  it("ignores localStorage when JSON is malformed and logs a warning", async () => {
    localStorage.setItem("agent-config", "not-json");
    vi.spyOn(client, "getConfig").mockResolvedValue({ config: {} });
    const deps = makeDeps();
    await bootApp(deps);
    expect(deps.addLog).toHaveBeenCalledWith("App initialized", "system");
    expect(deps.addLog).toHaveBeenCalledWith(expect.stringContaining("agent-config"), "warning");
  });

  it("loads projectPath from backend when not in localStorage", async () => {
    vi.spyOn(client, "getConfig").mockResolvedValue({ config: { projectPath: "D:\\from-be" } });
    vi.spyOn(client, "updateConfig").mockResolvedValue({ ok: true });
    const deps = makeDeps();
    await bootApp(deps);
    expect(deps.refs.localConfig.value.projectPath).toBe("D:\\from-be");
    expect(deps.addLog).toHaveBeenCalledWith(expect.stringContaining("backend"), "info");
  });

  it("loads backend token if local token is empty", async () => {
    vi.spyOn(client, "getConfig").mockResolvedValue({ config: { token: "be-tok" } });
    const deps = makeDeps();
    await bootApp(deps);
    expect(deps.refs.localConfig.value.token).toBe("be-tok");
    expect(deps.addLog).toHaveBeenCalledWith("Loaded Telegram token from backend", "info");
  });

  it("keeps local token if both backend and local have one", async () => {
    localStorage.setItem("agent-config", JSON.stringify({ token: "local-tok" }));
    vi.spyOn(client, "getConfig").mockResolvedValue({ config: { token: "be-tok" } });
    const deps = makeDeps({ localConfig: { token: "local-tok" } });
    await bootApp(deps);
    expect(deps.refs.localConfig.value.token).toBe("local-tok");
  });

  it("calls getConfig exactly once on cold start (no projectPath, no local token)", async () => {
    const getConfigSpy = vi.spyOn(client, "getConfig").mockResolvedValue({
      config: { projectPath: "C:\\be", token: "be-tok" },
    });
    vi.spyOn(client, "updateConfig").mockResolvedValue({ ok: true });
    const deps = makeDeps();
    await bootApp(deps);
    expect(getConfigSpy).toHaveBeenCalledTimes(1);
    expect(deps.refs.localConfig.value.projectPath).toBe("C:\\be");
    expect(deps.refs.localConfig.value.token).toBe("be-tok");
  });

  it("calls getConfig exactly once when only localStorage has projectPath (token still needs to load)", async () => {
    localStorage.setItem("agent-config", JSON.stringify({ projectPath: "C:\\from-ls" }));
    const getConfigSpy = vi.spyOn(client, "getConfig").mockResolvedValue({ config: { token: "be-tok" } });
    const deps = makeDeps();
    await bootApp(deps);
    expect(getConfigSpy).toHaveBeenCalledTimes(1);
    expect(deps.refs.localConfig.value.projectPath).toBe("C:\\from-ls");
    expect(deps.refs.localConfig.value.token).toBe("be-tok");
  });

  it("calls getConfig once on boot to check for additional backend fields (even when localStorage is fully populated)", async () => {
    localStorage.setItem("agent-config", JSON.stringify({ projectPath: "C:\\from-ls", token: "ls-tok" }));
    const getConfigSpy = vi.spyOn(client, "getConfig").mockResolvedValue({ config: {} });
    const deps = makeDeps();
    await bootApp(deps);
    expect(getConfigSpy).toHaveBeenCalledTimes(1);
  });

  it("does NOT sync to backend on boot when all critical fields are present in localStorage AND backend", async () => {
    const updateSpy = vi.spyOn(client, "updateConfig");
    vi.spyOn(client, "getConfig").mockResolvedValue({
      config: { projectPath: "C:\\proj", telegramToken: "be-tok", serverUrl: "http://be/v1", modelName: "be-model" },
    });
    const deps = makeDeps({ localConfig: { projectPath: "C:\\proj", token: "ls-tok" } });
    await bootApp(deps);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("syncs token to backend when backend has no token but localStorage does (regression: /api/start returned 400 after backend restart)", async () => {
    localStorage.setItem("agent-config", JSON.stringify({ token: "ls-tok" }));
    const updateSpy = vi.spyOn(client, "updateConfig").mockResolvedValue({ ok: true });
    vi.spyOn(client, "getConfig").mockResolvedValue({ config: {} });
    const deps = makeDeps();
    await bootApp(deps);
    expect(updateSpy).toHaveBeenCalledOnce();
    expect(updateSpy.mock.calls[0][0]).toEqual({ token: "ls-tok", serverUrl: "http://a/v1", modelName: "m1" });
    expect(deps.addLog).toHaveBeenCalledWith(expect.stringContaining("Synced to backend: token, serverUrl, modelName"), "info");
  });

  it("does NOT sync token when backend already has a token (preserves backend-configured values)", async () => {
    localStorage.setItem("agent-config", JSON.stringify({ token: "ls-tok" }));
    const updateSpy = vi.spyOn(client, "updateConfig").mockResolvedValue({ ok: true });
    vi.spyOn(client, "getConfig").mockResolvedValue({
      config: { telegramToken: "be-tok", serverUrl: "http://be/v1", modelName: "be-model" },
    });
    const deps = makeDeps();
    await bootApp(deps);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("does NOT sync empty token (avoids wiping backend's value with empty string)", async () => {
    localStorage.setItem("agent-config", JSON.stringify({ token: "" }));
    const updateSpy = vi.spyOn(client, "updateConfig").mockResolvedValue({ ok: true });
    vi.spyOn(client, "getConfig").mockResolvedValue({
      config: { serverUrl: "http://be/v1", modelName: "be-model" },
    });
    const deps = makeDeps();
    await bootApp(deps);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("syncs projectPath to backend when backend has no projectPath but localStorage does", async () => {
    localStorage.setItem("agent-config", JSON.stringify({ projectPath: "C:\\proj" }));
    const updateSpy = vi.spyOn(client, "updateConfig").mockResolvedValue({ ok: true });
    vi.spyOn(client, "getConfig").mockResolvedValue({ config: {} });
    const deps = makeDeps();
    await bootApp(deps);
    expect(updateSpy).toHaveBeenCalledOnce();
    expect(updateSpy.mock.calls[0][0]).toEqual({ projectPath: "C:\\proj", serverUrl: "http://a/v1", modelName: "m1" });
  });

  it("syncs multiple critical fields in one payload when all are missing in backend", async () => {
    localStorage.setItem(
      "agent-config",
      JSON.stringify({ token: "ls-tok", projectPath: "C:\\proj", openrouterApiKey: "or-key" })
    );
    const updateSpy = vi.spyOn(client, "updateConfig").mockResolvedValue({ ok: true });
    vi.spyOn(client, "getConfig").mockResolvedValue({ config: {} });
    const deps = makeDeps();
    await bootApp(deps);
    expect(updateSpy).toHaveBeenCalledOnce();
    expect(updateSpy.mock.calls[0][0]).toEqual({
      token: "ls-tok",
      projectPath: "C:\\proj",
      openrouterApiKey: "or-key",
      serverUrl: "http://a/v1",
      modelName: "m1",
    });
  });

  it("syncs serverUrl/modelName to backend when backend has neither", async () => {
    localStorage.setItem("agent-config", JSON.stringify({ serverUrl: "http://ls/v1", modelName: "ls-model" }));
    const updateSpy = vi.spyOn(client, "updateConfig").mockResolvedValue({ ok: true });
    vi.spyOn(client, "getConfig").mockResolvedValue({ config: {} });
    const deps = makeDeps();
    await bootApp(deps);
    expect(updateSpy).toHaveBeenCalledOnce();
    expect(updateSpy.mock.calls[0][0]).toEqual({
      serverUrl: "http://ls/v1",
      modelName: "ls-model",
    });
  });

  it("does NOT sync serverUrl/modelName when backend already has them", async () => {
    localStorage.setItem("agent-config", JSON.stringify({ serverUrl: "http://ls/v1", modelName: "ls-model" }));
    const updateSpy = vi.spyOn(client, "updateConfig").mockResolvedValue({ ok: true });
    vi.spyOn(client, "getConfig").mockResolvedValue({
      config: { serverUrl: "http://be/v1", modelName: "be-model" },
    });
    const deps = makeDeps();
    await bootApp(deps);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("syncToBackend failure is non-fatal — boot continues and logs a warning", async () => {
    vi.spyOn(client, "getConfig").mockResolvedValue({ config: {} });
    vi.spyOn(client, "updateConfig").mockRejectedValue(new Error("Network down"));
    localStorage.setItem("agent-config", JSON.stringify({ token: "ls-tok" }));
    const deps = makeDeps();
    await expect(bootApp(deps)).resolves.toBeUndefined();
    expect(deps.addLog).toHaveBeenCalledWith(expect.stringContaining("Failed to sync to backend"), "warning");
  });

  it("loads serverUrl and modelName from backend when localStorage is empty", async () => {
    vi.spyOn(client, "getConfig").mockResolvedValue({
      config: { serverUrl: "http://be/v1", modelName: "be-model" },
    });
    const deps = makeDeps();
    await bootApp(deps);
    expect(deps.refs.serverUrl.value).toBe("http://be/v1");
    expect(deps.refs.modelName.value).toBe("be-model");
    expect(deps.addLog).toHaveBeenCalledWith(expect.stringContaining("serverUrl from backend"), "info");
    expect(deps.addLog).toHaveBeenCalledWith(expect.stringContaining("modelName from backend"), "info");
  });

  it("keeps localStorage serverUrl and modelName when present (onlyIfMissing=true)", async () => {
    localStorage.setItem(
      "agent-config",
      JSON.stringify({ serverUrl: "http://ls/v1", modelName: "ls-model" })
    );
    vi.spyOn(client, "getConfig").mockResolvedValue({
      config: { serverUrl: "http://be/v1", modelName: "be-model" },
    });
    const deps = makeDeps();
    await bootApp(deps);
    expect(deps.refs.serverUrl.value).toBe("http://ls/v1");
    expect(deps.refs.modelName.value).toBe("ls-model");
  });

  it("adds backend serverUrl to apiBases when not already present (for model discovery)", async () => {
    vi.spyOn(client, "getConfig").mockResolvedValue({
      config: { serverUrl: "http://be/v1" },
    });
    const deps = makeDeps({ apiBases: [{ url: "http://default/v1", connected: true }] });
    await bootApp(deps);
    expect(deps.refs.apiBases.value).toContainEqual({ url: "http://be/v1", connected: true });
  });

  it("does not duplicate serverUrl in apiBases if already present", async () => {
    vi.spyOn(client, "getConfig").mockResolvedValue({
      config: { serverUrl: "http://be/v1" },
    });
    const deps = makeDeps({ apiBases: [{ url: "http://be/v1", connected: true }] });
    await bootApp(deps);
    const matches = deps.refs.apiBases.value.filter((a) => a.url === "http://be/v1");
    expect(matches).toHaveLength(1);
  });

  it("skips backend sync if no projectPath is known", async () => {
    const updateSpy = vi.spyOn(client, "updateConfig").mockResolvedValue({ ok: true });
    vi.spyOn(client, "getConfig").mockResolvedValue({ config: { serverUrl: "http://be/v1", modelName: "be-model" } });
    const deps = makeDeps();
    await bootApp(deps);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("triggers auto-start when autoStart, token, and projectPath are all set", async () => {
    vi.spyOn(client, "updateConfig").mockResolvedValue({ ok: true });
    const deps = makeDeps({ localConfig: { autoStart: true, token: "tok", projectPath: "C:\\proj" } });
    await bootApp(deps);
    expect(deps.handleStart).toHaveBeenCalledOnce();
    expect(deps.addLog).toHaveBeenCalledWith("AUTO START triggered — starting bot...", "system");
  });

  it("skips auto-start when token is missing and logs missing fields", async () => {
    vi.spyOn(client, "updateConfig").mockResolvedValue({ ok: true });
    const deps = makeDeps({ localConfig: { autoStart: true, projectPath: "C:\\proj" } });
    await bootApp(deps);
    expect(deps.handleStart).not.toHaveBeenCalled();
    expect(deps.addLog).toHaveBeenCalledWith("AUTO START skipped — missing: token", "warning");
  });

  it("does not call handleStart when autoStart is false", async () => {
    const deps = makeDeps({ localConfig: { autoStart: false, token: "tok", projectPath: "C:\\proj" } });
    await bootApp(deps);
    expect(deps.handleStart).not.toHaveBeenCalled();
  });
});
