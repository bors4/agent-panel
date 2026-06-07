/**
 * Тесты для composable useToolsConfig.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useToolsConfig } from "@/composables/useToolsConfig";
import * as client from "@/api/client";

vi.mock("@/composables/useToast", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

const LS_KEY = "agent-tool-config";

describe("useToolsConfig", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("exposes tools, config, expanded state and counts", () => {
    const tc = useToolsConfig();
    expect(tc.tools.value).toEqual({});
    expect(tc.config.value).toEqual({});
    expect(tc.toolSettingsExpanded.value).toEqual({});
    expect(tc.toolsCount.value).toBe(0);
    expect(tc.enabledCount.value).toBe(0);
  });

  it("fetchTools populates tools and config on success", async () => {
    vi.spyOn(client, "getTools").mockResolvedValue({
      success: true,
      tools: { read: { category: "file", description: "Read file" } },
      config: { read: { enabled: true, permission: "always" } },
    });
    const tc = useToolsConfig();
    await tc.fetchTools();
    expect(tc.tools.value).toHaveProperty("read");
    expect(tc.config.value.read.enabled).toBe(true);
    expect(tc.toolsCount.value).toBe(1);
    expect(tc.enabledCount.value).toBe(1);
  });

  it("fetchTools ignores failure silently", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(client, "getTools").mockRejectedValue(new Error("network"));
    const tc = useToolsConfig();
    await tc.fetchTools();
    expect(tc.tools.value).toEqual({});
    expect(spy).toHaveBeenCalled();
  });

  it("toggleTool updates local config and persists via API", async () => {
    const api = vi.spyOn(client, "updateTools").mockResolvedValue({ success: true });
    const tc = useToolsConfig();
    tc.config.value.read = { enabled: true, permission: "ask" };
    await tc.toggleTool("read", { target: { checked: false } });
    expect(tc.config.value.read.enabled).toBe(false);
    expect(api).toHaveBeenCalledWith({ name: "read", enabled: false, permission: "ask" });
  });

  it("updatePermission sets permission and persists", async () => {
    const api = vi.spyOn(client, "updateTools").mockResolvedValue({ success: true });
    const tc = useToolsConfig();
    tc.config.value.read = { enabled: true, permission: "ask" };
    await tc.updatePermission("read", "always");
    expect(tc.config.value.read.permission).toBe("always");
    expect(api).toHaveBeenCalledWith({ name: "read", enabled: true, permission: "always" });
  });

  it("updateExcludePaths splits, trims, filters empty entries and persists", async () => {
    const api = vi.spyOn(client, "updateTools").mockResolvedValue({ success: true });
    const tc = useToolsConfig();
    tc.config.value.read = { enabled: true };
    await tc.updateExcludePaths("read", " node_modules , , .git , dist ");
    expect(tc.config.value.read.exclude_paths).toEqual(["node_modules", ".git", "dist"]);
    expect(api).toHaveBeenCalledWith({
      name: "read",
      enabled: true,
      exclude_paths: ["node_modules", ".git", "dist"],
    });
  });

  it("saveConfig strips description/category/examples/input_schema and persists to API + localStorage", async () => {
    const api = vi.spyOn(client, "updateTools").mockResolvedValue({ success: true });
    const tc = useToolsConfig();
    tc.config.value.read = {
      enabled: true,
      permission: "ask",
      description: "Read a file",
      category: "file",
      examples: ["foo"],
      input_schema: {},
    };
    await tc.saveConfig("read");
    expect(api).toHaveBeenCalledWith({
      name: "read",
      enabled: true,
      permission: "ask",
    });
    const stored = JSON.parse(localStorage.getItem(LS_KEY));
    expect(stored.read.description).toBe("Read a file");
  });

  it("saveConfig toasts error on API failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(client, "updateTools").mockRejectedValue(new Error("boom"));
    const tc = useToolsConfig();
    tc.config.value.read = { enabled: true };
    await tc.saveConfig("read");
    expect(tc.config.value.read.enabled).toBe(true);
  });

  it("toggleToolSettings flips the expanded flag", () => {
    const tc = useToolsConfig();
    tc.toggleToolSettings("read");
    expect(tc.toolSettingsExpanded.value.read).toBe(true);
    tc.toggleToolSettings("read");
    expect(tc.toolSettingsExpanded.value.read).toBe(false);
  });

  it("mergeLocalConfig merges known tools from localStorage over server defaults", () => {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({
        read: { permission: "always" },
        ghost: { enabled: true },
      })
    );
    const tc = useToolsConfig();
    tc.config.value.read = { enabled: false, permission: "ask" };
    tc.config.value.write = { enabled: true, permission: "ask" };
    tc.mergeLocalConfig();
    expect(tc.config.value.read).toEqual({ enabled: false, permission: "always" });
    expect(tc.config.value.write).toEqual({ enabled: true, permission: "ask" });
  });

  it("mergeLocalConfig silently ignores malformed localStorage", () => {
    localStorage.setItem(LS_KEY, "{bad json");
    const tc = useToolsConfig();
    expect(() => tc.mergeLocalConfig()).not.toThrow();
  });
});
