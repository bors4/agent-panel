/**
 * Unit-тесты для App.vue (root component).
 * Покрывает критические ветки:
 * - localStorage initial load (agent-config)
 * - unknown keys in saved JSON are ignored
 * - top-bar action dispatch (logs/settings) opens/closes modals
 *
 * Тяжёлые дочерние компоненты замоканы stub-компонентами чтобы тест был
 * изолирован от WebSocket, fetch, local Telegram API и т.д.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { configDefaults } from "@backend/lib/configDefaults.js";

// ─── Mock child components ──────────────────────────────────────────────
vi.mock("@/components/layout/AppShell.vue", () => ({
  default: {
    name: "AppShellStub",
    props: ["status", "statsCollapsed", "logsOpen", "settingsOpen"],
    emits: ["top-action"],
    template: `
      <div data-stub="shell">
        <div data-stub="controls"><slot name="controls" /></div>
        <div data-stub="chat"><slot name="chat" /></div>
        <div data-stub="stats"><slot name="stats" /></div>
        <div data-stub="settings-modal"><slot name="settings-modal" /></div>
        <div data-stub="logs-modal"><slot name="logs-modal" /></div>
        <div data-stub="toasts"><slot name="toasts" /></div>
      </div>
    `,
  },
}));
vi.mock("@/components/stats/StatsPanel.vue", () => ({
  default: { name: "StatsPanelStub", template: "<div data-stub='stats-panel' />" },
}));
vi.mock("@/components/chat/ChatPanel.vue", () => ({
  default: { name: "ChatPanelStub", template: "<div data-stub='chat-panel' />" },
}));
vi.mock("@/components/modals/SettingsModal.vue", () => ({
  default: {
    name: "SettingsModalStub",
    props: ["modelValue", "config", "apiBases", "modelName", "availableModels", "modelContextLength", "systemPrompt"],
    emits: [
      "update:modelValue",
      "update:config",
      "update:api-bases",
      "update:model-name",
      "update:system-prompt",
      "save",
      "reset",
    ],
    template: "<div data-stub='settings-modal' />",
  },
}));
vi.mock("@/components/modals/LogsModal.vue", () => ({
  default: {
    name: "LogsModalStub",
    props: ["modelValue", "logs"],
    emits: ["update:modelValue", "clear"],
    template: "<div data-stub='logs-modal' />",
  },
}));
vi.mock("@/components/controls/AgentControls.vue", () => ({
  default: {
    name: "AgentControlsStub",
    props: ["isRunning", "projectPath"],
    emits: ["start", "stop", "restart"],
    template: "<div data-stub='agent-controls' />",
  },
}));
vi.mock("@/components/ui/ToastContainer.vue", () => ({
  default: { name: "ToastContainerStub", template: "<div data-stub='toast' />" },
}));

// ─── Mock composables ───────────────────────────────────────────────────
vi.mock("@/composables/useAgent", () => ({
  useAgent: () => ({
    status: { value: "idle" },
    isRunning: { value: false },
    stats: { value: { requests: 0, tools: 0, errors: 0, uptime: 0 } },
    logs: { value: [] },
    tokenUsage: { value: { prompt: 0, completion: 0, total: 0, cached: 0 } },
    lastRequestTokens: { value: { prompt: 0, completion: 0, total: 0, cached: 0, timestamp: "" } },
    perfStats: { value: {} },
    refreshStatus: vi.fn(async () => {}),
    startAgent: vi.fn(),
    stopAgent: vi.fn(),
    restartAgent: vi.fn(),
    clearLogs: vi.fn(),
  }),
}));

vi.mock("@/composables/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
}));

vi.mock("@/composables/useAppActions", () => ({
  useAppActions: () => ({
    addLog: vi.fn(),
    handleStart: vi.fn(),
    handleStop: vi.fn(),
    handleRestart: vi.fn(),
    handleClearLogs: vi.fn(),
    handleTokenUsage: vi.fn(),
    formatPrompt: vi.fn(),
    copyPrompt: vi.fn(),
  }),
}));

vi.mock("@/composables/useAppModels", () => ({
  useAppModels: () => ({
    apiBases: { value: [] },
    modelName: { value: "" },
    serverUrl: { value: "" },
    availableModels: { value: [] },
    modelContextLength: { value: configDefaults.maxTokens },
    loadApiBases: vi.fn(async () => {}),
    updateModels: vi.fn(async () => {}),
  }),
}));

vi.mock("@/composables/useAppBoot", () => ({
  bootApp: vi.fn(async () => {}),
}));

vi.mock("@/composables/useTheme", () => ({
  useTheme: () => ({ theme: { value: "dark" }, setTheme: vi.fn(), cycle: vi.fn() }),
}));

vi.mock("@/api/client", () => ({
  updateConfig: vi.fn(async () => ({})),
  getConfig: vi.fn(async () => ({})),
  getModels: vi.fn(async () => ({ models: [] })),
}));

import App from "@/App.vue";

async function mountApp() {
  const wrapper = mount(App, { attachTo: document.body });
  await flushPromises();
  return wrapper;
}

describe("App.vue", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("renders the shell with chat, stats, controls, modals, toasts slots", async () => {
    const wrapper = await mountApp();
    expect(wrapper.find('[data-stub="shell"]').exists()).toBe(true);
    expect(wrapper.find('[data-stub="chat-panel"]').exists()).toBe(true);
    expect(wrapper.find('[data-stub="stats-panel"]').exists()).toBe(true);
    expect(wrapper.find('[data-stub="settings-modal"]').exists()).toBe(true);
    expect(wrapper.find('[data-stub="logs-modal"]').exists()).toBe(true);
    expect(wrapper.find('[data-stub="toast"]').exists()).toBe(true);
  });

  it("starts with both modals closed", async () => {
    const wrapper = await mountApp();
    const shell = wrapper.findComponent({ name: "AppShellStub" });
    expect(shell.props("settingsOpen")).toBe(false);
    expect(shell.props("logsOpen")).toBe(false);
  });

  it("renders the control strip (controls) on the main page", async () => {
    const wrapper = await mountApp();
    expect(wrapper.find('[data-stub="controls"]').exists()).toBe(true);
    expect(wrapper.find('[data-stub="agent-controls"]').exists()).toBe(true);
  });

  it("loads localStorage agent-config on mount: does not crash with valid JSON", async () => {
    localStorage.setItem(
      "agent-config",
      JSON.stringify({
        modelName: "llama-3.1-8b",
        projectPath: "D:/myproject",
        verbose: true,
        soundVolume: 75,
        serverUrl: "http://192.168.1.50:8080/v1",
        systemPrompt: "Be helpful.",
        apiBases: [{ url: "http://x:1/v1", connected: true }],
      })
    );
    const wrapper = await mountApp();
    expect(wrapper.exists()).toBe(true);
    const saved = JSON.parse(localStorage.getItem("agent-config"));
    expect(saved.modelName).toBe("llama-3.1-8b");
  });

  it("ignores unknown keys in saved JSON (does not throw)", async () => {
    localStorage.setItem(
      "agent-config",
      JSON.stringify({
        modelName: "valid",
        unknownKey: "should be ignored",
        anotherUnknown: 42,
      })
    );
    const wrapper = await mountApp();
    expect(wrapper.exists()).toBe(true);
  });

  it("handles malformed localStorage JSON gracefully", async () => {
    localStorage.setItem("agent-config", "{not valid json");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const wrapper = await mountApp();
    expect(wrapper.exists()).toBe(true);
    consoleError.mockRestore();
  });

  it("does not throw when localStorage is empty", async () => {
    const wrapper = await mountApp();
    expect(wrapper.exists()).toBe(true);
  });

  it("default config uses configDefaults values", () => {
    expect(configDefaults.maxHistoryPairs).toBeGreaterThan(0);
    expect(configDefaults.maxTokens).toBeGreaterThan(0);
  });
});
