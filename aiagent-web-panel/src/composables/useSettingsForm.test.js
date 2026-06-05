/**
 * Тесты для composable useSettingsForm.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { reactive } from "vue";
import { useSettingsForm } from "@/composables/useSettingsForm";
import * as client from "@/api/client";

vi.mock("@/composables/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

function makeProps(overrides = {}) {
  const config = reactive({
    token: "tok",
    projectPath: "C:\\proj",
    maxFileChars: 2000,
    maxHistoryPairs: 5,
    maxSearchResults: 15,
    maxSearchFileSize: 1048576,
    maxFilesInPrompt: 2,
    maxTokens: 1024,
    timeout: 300000,
    temperature: 0.1,
    stream: true,
    insertUserAfterTool: true,
    chatMode: false,
    openrouterApiKey: "",
    autoSave: true,
    verbose: false,
    autoStart: false,
    showTokens: true,
    soundEnabled: true,
    soundVolume: 50,
    asrServerUrl: "",
    hasToken: true,
    ...overrides.config,
  });
  const apiBases = overrides.apiBases || [{ url: "http://test:8080/v1", connected: true }];
  const modelName = overrides.modelName || "model-1";
  const serverUrl = overrides.serverUrl || "http://test:8080/v1";
  const availableModels = overrides.availableModels || [{ id: "model-1", source: "http://test:8080/v1" }];

  const props = { config, apiBases, modelName, serverUrl, availableModels };
  const emit = vi.fn();
  return { props, emit };
}

describe("useSettingsForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initialises configCopy from props.config with defaults", () => {
    const { props, emit } = makeProps({ config: { maxTokens: 8192, temperature: 0.5, stream: false } });
    const s = useSettingsForm(props, emit);
    expect(s.configCopy.maxTokens).toBe(8192);
    expect(s.configCopy.temperature).toBe(0.5);
    expect(s.configCopy.stream).toBe(false);
    expect(s.configCopy.projectPath).toBe("C:\\proj");
  });

  it("hasToken is true when local token OR backend hasToken", () => {
    const { props, emit } = makeProps({ config: { token: "abc", hasToken: false } });
    const s = useSettingsForm(props, emit);
    expect(s.hasToken.value).toBe(true);
  });

  it("hasToken is false when both empty", () => {
    const { props, emit } = makeProps({ config: { token: "", hasToken: false } });
    const s = useSettingsForm(props, emit);
    expect(s.hasToken.value).toBe(false);
  });

  it("filteredModels filters by id or source case-insensitively", () => {
    const { props, emit } = makeProps({
      availableModels: [
        { id: "Qwen-2.5", source: "http://a" },
        { id: "llama-3", source: "http://b" },
      ],
    });
    const s = useSettingsForm(props, emit);
    s.modelFilter.value = "qwen";
    expect(s.filteredModels.value.map((m) => m.id)).toEqual(["Qwen-2.5"]);
    s.modelFilter.value = "HTTP://B";
    expect(s.filteredModels.value.map((m) => m.id)).toEqual(["llama-3"]);
    s.modelFilter.value = "";
    expect(s.filteredModels.value).toHaveLength(2);
  });

  it("adjustTokens clamps to [256, 65536]", () => {
    const { props, emit } = makeProps({ config: { maxTokens: 1024 } });
    const s = useSettingsForm(props, emit);
    s.adjustTokens(200000);
    expect(s.configCopy.maxTokens).toBe(65536);
    s.adjustTokens(-100000);
    expect(s.configCopy.maxTokens).toBe(256);
  });

  it("addApiBase / removeApiBase mutate the local copy", () => {
    const { props, emit } = makeProps();
    const s = useSettingsForm(props, emit);
    s.addApiBase();
    expect(s.apiBasesCopy.value).toHaveLength(2);
    s.removeApiBase(0);
    expect(s.apiBasesCopy.value).toHaveLength(1);
  });

  it("handleReset emits 'reset' and toggles loading flag", async () => {
    vi.useFakeTimers();
    const { props, emit } = makeProps();
    const s = useSettingsForm(props, emit);
    s.handleReset();
    expect(emit).toHaveBeenCalledWith("reset");
    expect(s.loadingStates.value.reset).toBe(true);
    vi.advanceTimersByTime(500);
    expect(s.loadingStates.value.reset).toBe(false);
    vi.useRealTimers();
  });

  it("handleRefreshModels emits 'models-updated' and toggles loading", () => {
    vi.useFakeTimers();
    const { props, emit } = makeProps();
    const s = useSettingsForm(props, emit);
    s.handleRefreshModels();
    expect(emit).toHaveBeenCalledWith("models-updated");
    expect(s.loadingStates.value.models).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(s.loadingStates.value.models).toBe(false);
    vi.useRealTimers();
  });

  it("handleLoadOpenRouterModels emits with URL and key", () => {
    vi.useFakeTimers();
    const { props, emit } = makeProps({ config: { openrouterApiKey: "or-key" } });
    const s = useSettingsForm(props, emit);
    s.handleLoadOpenRouterModels();
    expect(emit).toHaveBeenCalledWith("models-updated", "https://openrouter.ai/api/v1", "or-key");
    vi.advanceTimersByTime(1000);
    expect(s.loadingStates.value.openrouterModels).toBe(false);
    vi.useRealTimers();
  });

  it("syncApiBases calls autoSave and emits models-updated", () => {
    vi.useFakeTimers();
    const { props, emit } = makeProps();
    const s = useSettingsForm(props, emit);
    s.syncApiBases();
    expect(emit).toHaveBeenCalledWith("models-updated");
    vi.advanceTimersByTime(400);
    expect(emit).toHaveBeenCalledWith("save", expect.objectContaining({ apiBases: expect.any(Array) }));
    vi.useRealTimers();
  });

  it("browseDirectory populates projectPathDraft on success", async () => {
    vi.spyOn(client, "browseFolder").mockResolvedValue({ path: "D:\\picked" });
    const { props, emit } = makeProps();
    const s = useSettingsForm(props, emit);
    await s.browseDirectory();
    expect(s.projectPathDraft.value).toBe("D:\\picked");
    expect(s.pathError.value).toBe("");
  });

  it("browseDirectory sets pathError on failure", async () => {
    vi.spyOn(client, "browseFolder").mockRejectedValue(new Error("boom"));
    const { props, emit } = makeProps();
    const s = useSettingsForm(props, emit);
    await s.browseDirectory();
    expect(s.pathError.value).toContain("Failed to open folder picker");
  });

  it("testAsrServer stores reachable status on success", async () => {
    vi.spyOn(client, "testAsrConnection").mockResolvedValue({ configured: true, reachable: true, url: "x" });
    const { props, emit } = makeProps();
    const s = useSettingsForm(props, emit);
    await s.testAsrServer();
    expect(s.asrStatus.value).toEqual({ configured: true, reachable: true, url: "x" });
    expect(s.loadingStates.value.asrTest).toBe(false);
  });

  it("testAsrServer stores unreachable status on failure", async () => {
    vi.spyOn(client, "testAsrConnection").mockRejectedValue(new Error("boom"));
    const { props, emit } = makeProps({ config: { asrServerUrl: "http://broken" } });
    const s = useSettingsForm(props, emit);
    await s.testAsrServer();
    expect(s.asrStatus.value.reachable).toBe(false);
    expect(s.asrStatus.value.url).toBe("http://broken");
  });

  it("checkProjectPath clears error for root drives on Windows", async () => {
    Object.defineProperty(navigator, "userAgent", { value: "Mozilla/5.0 (Windows NT 10.0)", configurable: true });
    const { props, emit } = makeProps();
    const s = useSettingsForm(props, emit);
    s.projectPathDraft.value = "C:\\";
    await s.checkProjectPath();
    expect(s.pathError.value).toBe("");
  });

  it("checkProjectPath sets error when API says invalid", async () => {
    vi.spyOn(client, "checkPath").mockResolvedValue({ valid: false, exists: false, isDirectory: false });
    const { props, emit } = makeProps();
    const s = useSettingsForm(props, emit);
    s.projectPathDraft.value = "Z:\\nope";
    await s.checkProjectPath();
    expect(s.pathError.value).toContain("does not exist");
  });

  it("checkProjectPath sets generic error when API throws", async () => {
    vi.spyOn(client, "checkPath").mockRejectedValue(new Error("net"));
    const { props, emit } = makeProps();
    const s = useSettingsForm(props, emit);
    s.projectPathDraft.value = "Z:\\nope";
    await s.checkProjectPath();
    expect(s.pathError.value).toContain("Cannot validate path");
  });

  it("handleSave emits payload with sanitised token (ASCII only)", async () => {
    vi.spyOn(client, "checkPath").mockResolvedValue({ valid: true, exists: true, isDirectory: true });
    const { props, emit } = makeProps({ config: { token: "  abc—def  " } });
    const s = useSettingsForm(props, emit);
    await s.handleSave();
    const lastCall = emit.mock.calls.find((c) => c[0] === "save");
    expect(lastCall).toBeDefined();
    expect(lastCall[1].config.token).toBe("abcdef");
  });

  it("handleSaveProjectPath emits save-path with current draft", async () => {
    vi.spyOn(client, "checkPath").mockResolvedValue({ valid: true, exists: true, isDirectory: true });
    const { props, emit } = makeProps();
    const s = useSettingsForm(props, emit);
    s.projectPathDraft.value = "E:\\code";
    await s.handleSaveProjectPath();
    expect(emit).toHaveBeenCalledWith("save-path", { projectPath: "E:\\code" });
    expect(s.configCopy.projectPath).toBe("E:\\code");
  });

  it("handleSave aborts when checkProjectPath fails", async () => {
    vi.spyOn(client, "checkPath").mockResolvedValue({ valid: false, exists: false, isDirectory: false });
    const { props, emit } = makeProps();
    const s = useSettingsForm(props, emit);
    s.projectPathDraft.value = "Z:\\nope";
    await s.handleSave();
    expect(emit).not.toHaveBeenCalledWith("save", expect.anything());
  });
});
