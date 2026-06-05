/**
 * Тесты для composable useAppConfig.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { ref } from "vue";
import { useAppConfig, defaultConfig } from "@/composables/useAppConfig";
import * as client from "@/api/client";

vi.mock("@/composables/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

function makeDeps(overrides = {}) {
  return {
    systemPrompt: ref(overrides.systemPrompt ?? "you are a helpful agent"),
    apiBases: ref(overrides.apiBases ?? [{ url: "http://a/v1", connected: true }]),
    modelName: ref(overrides.modelName ?? "model-1"),
    serverUrl: ref(overrides.serverUrl ?? "http://a/v1"),
    addLog: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  };
}

describe("useAppConfig", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
    window.URL.createObjectURL = vi.fn(() => "blob:test");
    window.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("initialises localConfig from defaultConfig snapshot", () => {
    const c = useAppConfig(makeDeps());
    expect(c.localConfig.value.maxTokens).toBe(defaultConfig.maxTokens);
    expect(c.localConfig.value.temperature).toBe(defaultConfig.temperature);
    expect(c.localConfig.value.stream).toBe(defaultConfig.stream);
    expect(c.localConfig.value.autoSave).toBe(true);
  });

  it("returns the same defaultConfig reference", () => {
    const c = useAppConfig(makeDeps());
    expect(c.defaultConfig).toBe(defaultConfig);
  });

  it("saveSettings writes localStorage with all sections and updates backend", async () => {
    vi.spyOn(client, "updateConfig").mockResolvedValue({ success: true });
    const deps = makeDeps();
    const c = useAppConfig(deps);
    c.localConfig.value.projectPath = "C:\\proj";
    await c.saveSettings(false);
    const stored = JSON.parse(localStorage.getItem("agent-config"));
    expect(stored.projectPath).toBe("C:\\proj");
    expect(stored.systemPrompt).toBe("you are a helpful agent");
    expect(stored.modelName).toBe("model-1");
    expect(stored.serverUrl).toBe("http://a/v1");
    expect(client.updateConfig).toHaveBeenCalledOnce();
    const payload = client.updateConfig.mock.calls[0][0];
    expect(payload.projectPath).toBe("C:\\proj");
    expect(payload.modelName).toBe("model-1");
  });

  it("saveSettings shows success toast when showToast=true", async () => {
    vi.spyOn(client, "updateConfig").mockResolvedValue({ success: true });
    const deps = makeDeps();
    const c = useAppConfig(deps);
    await c.saveSettings(true);
    expect(deps.success).toHaveBeenCalledWith("Настройки сохранены");
  });

  it("saveSettings suppresses toast when showToast=false", async () => {
    vi.spyOn(client, "updateConfig").mockResolvedValue({ success: true });
    const deps = makeDeps();
    const c = useAppConfig(deps);
    await c.saveSettings(false);
    expect(deps.success).not.toHaveBeenCalled();
  });

  it("saveSettings toasts error when updateConfig rejects", async () => {
    vi.spyOn(client, "updateConfig").mockRejectedValue(new Error("backend down"));
    const deps = makeDeps();
    const c = useAppConfig(deps);
    await c.saveSettings(false);
    expect(deps.error).toHaveBeenCalledWith(expect.stringContaining("backend down"));
  });

  it("savePrompt writes localStorage only (no backend)", () => {
    const deps = makeDeps();
    const c = useAppConfig(deps);
    c.savePrompt();
    const stored = JSON.parse(localStorage.getItem("agent-config"));
    expect(stored.systemPrompt).toBe("you are a helpful agent");
    expect(deps.addLog).toHaveBeenCalledWith("Prompt saved", "success");
  });

  it("resetPrompt clears systemPrompt on confirm", () => {
    const deps = makeDeps();
    const c = useAppConfig(deps);
    c.resetPrompt();
    expect(deps.systemPrompt.value).toBe("");
    expect(deps.warning).toHaveBeenCalledWith("Промпт сброшен");
  });

  it("resetPrompt is a no-op on cancel", () => {
    window.confirm.mockReturnValue(false);
    const deps = makeDeps();
    const c = useAppConfig(deps);
    c.resetPrompt();
    expect(deps.systemPrompt.value).toBe("you are a helpful agent");
    expect(deps.warning).not.toHaveBeenCalled();
  });

  it("resetSettings restores defaultConfig and clears systemPrompt", () => {
    const deps = makeDeps();
    const c = useAppConfig(deps);
    c.localConfig.value.maxTokens = 99999;
    c.resetSettings();
    expect(c.localConfig.value.maxTokens).toBe(defaultConfig.maxTokens);
    expect(deps.systemPrompt.value).toBe("");
    expect(deps.warning).toHaveBeenCalledWith("Настройки сброшены");
  });

  it("exportConfig triggers a download with a JSON blob", () => {
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "a") return { click: vi.fn(), href: "", download: "" };
      return document.createElement(tag);
    });
    const deps = makeDeps();
    const c = useAppConfig(deps);
    c.exportConfig();
    expect(deps.success).toHaveBeenCalledWith("Конфигурация экспортирована");
    expect(deps.addLog).toHaveBeenCalledWith("Config exported", "success");
    createElementSpy.mockRestore();
  });

  it("exportConfig asks for confirmation when token is present", () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "a") return { click: vi.fn(), href: "", download: "" };
      return document.createElement(tag);
    });
    const deps = makeDeps();
    const c = useAppConfig(deps);
    c.localConfig.value.token = "secret-tok";
    confirmSpy.mockReturnValue(false);
    c.exportConfig();
    expect(confirmSpy).toHaveBeenCalled();
    expect(deps.success).not.toHaveBeenCalled();
    expect(deps.addLog).toHaveBeenCalledWith("Config export cancelled (secrets present)", "warning");
    confirmSpy.mockReturnValue(true);
    c.exportConfig();
    expect(deps.success).toHaveBeenCalledWith("Конфигурация экспортирована");
    createElementSpy.mockRestore();
  });

  it("exportConfig asks for confirmation when openrouterApiKey is present", () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "a") return { click: vi.fn(), href: "", download: "" };
      return document.createElement(tag);
    });
    const deps = makeDeps();
    const c = useAppConfig(deps);
    c.localConfig.value.openrouterApiKey = "or-key-xyz";
    confirmSpy.mockReturnValue(false);
    c.exportConfig();
    expect(confirmSpy).toHaveBeenCalled();
    expect(deps.addLog).toHaveBeenCalledWith("Config export cancelled (secrets present)", "warning");
    createElementSpy.mockRestore();
  });

  it("importConfig merges JSON into localConfig and systemPrompt", async () => {
    const importData = { token: "new-tok", projectPath: "D:\\new", maxTokens: 2048, systemPrompt: "imported" };
    const file = new File([JSON.stringify(importData)], "config.json", { type: "application/json" });
    const deps = makeDeps();
    const c = useAppConfig(deps);
    const origCreateElement = document.createElement;
    const inputEl = { type: "", accept: "", onchange: null, click: function () {}, files: [file] };
    vi.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "input") {
        setTimeout(() => inputEl.onchange?.({ target: inputEl }), 0);
        return inputEl;
      }
      return origCreateElement(tag);
    });
    c.importConfig();
    await new Promise((r) => setTimeout(r, 200));
    expect(deps.systemPrompt.value).toBe("imported");
    expect(c.localConfig.value.token).toBe("new-tok");
    expect(c.localConfig.value.projectPath).toBe("D:\\new");
    expect(c.localConfig.value.maxTokens).toBe(2048);
    expect(deps.success).toHaveBeenCalledWith("Конфигурация импортирована");
  });

  it("importConfig surfaces a toast on malformed JSON", async () => {
    const file = new File(["not-json"], "bad.json", { type: "application/json" });
    const deps = makeDeps();
    const c = useAppConfig(deps);
    const origCreateElement = document.createElement;
    const inputEl = { type: "", accept: "", onchange: null, click: function () {}, files: [file] };
    vi.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "input") {
        setTimeout(() => inputEl.onchange?.({ target: inputEl }), 0);
        return inputEl;
      }
      return origCreateElement(tag);
    });
    c.importConfig();
    await new Promise((r) => setTimeout(r, 200));
    expect(deps.error).toHaveBeenCalledWith("Ошибка JSON");
  });

  it("handleSettingsSave merges data and calls saveSettings with showToast=true", async () => {
    vi.spyOn(client, "updateConfig").mockResolvedValue({ success: true });
    const deps = makeDeps();
    const c = useAppConfig(deps);
    await c.handleSettingsSave({
      config: { maxTokens: 4096 },
      apiBases: [{ url: "http://new/v1", connected: true }],
      modelName: "new-model",
      serverUrl: "http://new/v1",
    });
    expect(c.localConfig.value.maxTokens).toBe(4096);
    expect(deps.apiBases.value[0].url).toBe("http://new/v1");
    expect(deps.modelName.value).toBe("new-model");
    expect(deps.serverUrl.value).toBe("http://new/v1");
    expect(deps.success).toHaveBeenCalledWith("Настройки сохранены");
  });

  it("handleSettingsSave accepts empty string modelName and serverUrl", async () => {
    vi.spyOn(client, "updateConfig").mockResolvedValue({ success: true });
    const deps = makeDeps();
    const c = useAppConfig(deps);
    await c.handleSettingsSave({ modelName: "", serverUrl: "" });
    expect(deps.modelName.value).toBe("");
    expect(deps.serverUrl.value).toBe("");
  });

  it("saveSettings sanitises non-ASCII characters from token and openrouterApiKey", async () => {
    vi.spyOn(client, "updateConfig").mockResolvedValue({ success: true });
    const deps = makeDeps();
    const c = useAppConfig(deps);
    c.localConfig.value.token = "  abc—def  ";
    c.localConfig.value.openrouterApiKey = "k—y";
    await c.saveSettings(false);
    const payload = client.updateConfig.mock.calls[0][0];
    expect(payload.token).toBe("abcdef");
    expect(payload.openrouterApiKey).toBe("ky");
    const stored = JSON.parse(localStorage.getItem("agent-config"));
    expect(stored.token).toBe("abcdef");
    expect(stored.openrouterApiKey).toBe("ky");
  });

  it("saveSettings shows quota-specific error when localStorage is full", async () => {
    const setItemSpy = vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      const err = new Error("quota exceeded");
      err.name = "QuotaExceededError";
      throw err;
    });
    const deps = makeDeps();
    const c = useAppConfig(deps);
    await c.saveSettings(false);
    expect(deps.error).toHaveBeenCalledWith(expect.stringContaining("переполнено"));
    setItemSpy.mockRestore();
  });

  it("saveSettings suppresses success toast when backend update fails", async () => {
    vi.spyOn(client, "updateConfig").mockRejectedValue(new Error("backend down"));
    const deps = makeDeps();
    const c = useAppConfig(deps);
    await c.saveSettings(true);
    expect(deps.error).toHaveBeenCalledWith(expect.stringContaining("backend down"));
    expect(deps.success).not.toHaveBeenCalled();
  });

  it("handleSaveProjectPath updates projectPath and saves with showToast=null", async () => {
    vi.spyOn(client, "updateConfig").mockResolvedValue({ success: true });
    const deps = makeDeps();
    const c = useAppConfig(deps);
    await c.handleSaveProjectPath({ projectPath: "E:\\data" });
    expect(c.localConfig.value.projectPath).toBe("E:\\data");
  });
});
