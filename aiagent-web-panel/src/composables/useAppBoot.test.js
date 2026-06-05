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

  it("does not call getConfig when localStorage has both projectPath and token", async () => {
    localStorage.setItem("agent-config", JSON.stringify({ projectPath: "C:\\from-ls", token: "ls-tok" }));
    const getConfigSpy = vi.spyOn(client, "getConfig");
    vi.spyOn(client, "updateConfig").mockResolvedValue({ ok: true });
    const deps = makeDeps();
    await bootApp(deps);
    expect(getConfigSpy).not.toHaveBeenCalled();
  });

  it("skips backend sync if no projectPath is known", async () => {
    const updateSpy = vi.spyOn(client, "updateConfig").mockResolvedValue({ ok: true });
    const deps = makeDeps();
    await bootApp(deps);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("syncs to backend when projectPath is present", async () => {
    const updateSpy = vi.spyOn(client, "updateConfig").mockResolvedValue({ ok: true });
    const deps = makeDeps({ localConfig: { projectPath: "C:\\proj" } });
    await bootApp(deps);
    expect(updateSpy).toHaveBeenCalledOnce();
    const payload = updateSpy.mock.calls[0][0];
    expect(payload.projectPath).toBe("C:\\proj");
    expect(payload.modelName).toBe("m1");
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
