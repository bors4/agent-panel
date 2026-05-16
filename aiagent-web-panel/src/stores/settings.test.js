/**
 * Тесты для Pinia store settings.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useSettingsStore } from "@/stores/settings";

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
});

describe("useSettingsStore", () => {
  it("initializes with default config", () => {
    const store = useSettingsStore();
    expect(store.config).toHaveProperty("serverUrl");
    expect(store.config).toHaveProperty("modelName");
    expect(store.config).toHaveProperty("projectPath");
  });

  it("initializes with default quick settings", () => {
    const store = useSettingsStore();
    expect(store.quickSettings.autoSave).toBe(true);
    expect(store.quickSettings.verbose).toBe(false);
    expect(store.quickSettings.autoStart).toBe(false);
    expect(store.quickSettings.showTokens).toBe(true);
  });

  it("initializes with empty system prompt", () => {
    const store = useSettingsStore();
    expect(store.systemPrompt).toBe("");
  });

  it("initializes with default API bases", () => {
    const store = useSettingsStore();
    expect(store.apiBases).toHaveLength(2);
    expect(store.apiBases[0].url).toBe("http://192.168.1.101:8080/v1");
  });

  it("loads saved config from localStorage", () => {
    const savedData = {
      serverUrl: "http://custom:8080/v1",
      modelName: "custom-model",
      systemPrompt: "Custom prompt",
      autoSave: false,
    };
    localStorage.setItem("agent-config", JSON.stringify(savedData));

    const store = useSettingsStore();
    store.loadSaved();

    expect(store.config.serverUrl).toBe("http://custom:8080/v1");
    expect(store.modelName).toBe("custom-model");
    expect(store.systemPrompt).toBe("Custom prompt");
    expect(store.quickSettings.autoSave).toBe(false);
  });

  it("saves config to localStorage", () => {
    const store = useSettingsStore();
    store.modelName = "test-model";
    store.save();

    const saved = JSON.parse(localStorage.getItem("agent-config"));
    expect(saved.modelName).toBe("test-model");
  });

  it("resets config, quickSettings, and systemPrompt", () => {
    const store = useSettingsStore();
    store.config.modelName = "changed";
    store.systemPrompt = "changed";
    store.quickSettings.verbose = true;
    store.reset();

    expect(store.config.modelName).toBe("gemma-4.gguf");
    expect(store.systemPrompt).toBe("");
    expect(store.quickSettings.verbose).toBe(false);
    expect(localStorage.getItem("agent-config")).toBeNull();
  });

  it("handles invalid localStorage data gracefully", () => {
    localStorage.setItem("agent-config", "invalid json");

    const store = useSettingsStore();
    expect(() => store.loadSaved()).not.toThrow();
  });
});
