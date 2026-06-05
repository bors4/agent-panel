/**
 * Тесты для components/tabs/settings/ConfigCard.vue.
 */

import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { reactive } from "vue";
import ConfigCard from "@/components/tabs/settings/ConfigCard.vue";

function makeWrapper(overrides = {}) {
  const config = reactive({ token: "tok", asrServerUrl: "", openrouterApiKey: "", ...overrides.config });
  const apiBases = overrides.apiBases || [{ url: "http://x:8080/v1", connected: false }];
  const modelName = overrides.modelName || "m1";
  const modelFilter = overrides.modelFilter || "";
  const filteredModels = overrides.filteredModels || [{ id: "m1", source: "http://x:8080/v1" }];
  const projectPathDraft = overrides.projectPathDraft || "C:\\";
  const pathError = overrides.pathError || "";
  const tokenVisible = false;
  const orKeyVisible = false;
  const hasToken = true;
  const loadingStates = { models: false, openrouterModels: false, asrTest: false };
  const asrStatus = overrides.asrStatus ?? null;

  const wrapper = mount(ConfigCard, {
    props: {
      config,
      apiBases,
      modelName,
      modelFilter,
      filteredModels,
      projectPathDraft,
      pathError,
      tokenVisible,
      orKeyVisible,
      hasToken,
      loadingStates,
      asrStatus,
    },
  });
  return { wrapper, config, apiBases, modelName, modelFilter };
}

describe("ConfigCard", () => {
  it("renders token, project path and model sections", () => {
    const { wrapper } = makeWrapper();
    expect(wrapper.text()).toContain("TELEGRAM_TOKEN");
    expect(wrapper.text()).toContain("PROJECT_PATH");
    expect(wrapper.text()).toContain("MODEL_NAME");
    expect(wrapper.text()).toContain("ASR_SERVER_URL");
  });

  it("emits 'browse' when BROWSE button is clicked", async () => {
    const { wrapper } = makeWrapper();
    const buttons = wrapper.findAll("button");
    const browseBtn = buttons.find((b) => b.text() === "BROWSE");
    await browseBtn.trigger("click");
    expect(wrapper.emitted("browse")).toBeTruthy();
  });

  it("emits 'save-path' when SAVE PATH button is clicked", async () => {
    const { wrapper } = makeWrapper();
    const savePathBtn = wrapper.findAll("button").find((b) => b.text() === "SAVE PATH");
    await savePathBtn.trigger("click");
    expect(wrapper.emitted("save-path")).toBeTruthy();
  });

  it("emits 'check-path' on project path input blur", async () => {
    const { wrapper } = makeWrapper();
    const pathInput = wrapper.find('.project-path-row input[type="text"]');
    await pathInput.trigger("blur");
    expect(wrapper.emitted("check-path")).toBeTruthy();
  });

  it("emits 'update:pathError' on project path input event", async () => {
    const { wrapper } = makeWrapper();
    const pathInput = wrapper.find('.project-path-row input[type="text"]');
    await pathInput.trigger("input");
    expect(wrapper.emitted("update:pathError")).toEqual([[""]]);
  });

  it("adds/removes api bases via add and remove events", async () => {
    const { wrapper } = makeWrapper();
    const addBtn = wrapper.find(".btn-add");
    await addBtn.trigger("click");
    expect(wrapper.emitted("add-api-base")).toBeTruthy();

    const removeBtn = wrapper.find(".btn-remove");
    await removeBtn.trigger("click");
    expect(wrapper.emitted("remove-api-base")).toEqual([[0]]);
  });

  it("emits 'sync-api-bases' on api url blur", async () => {
    const { wrapper } = makeWrapper();
    const urlInput = wrapper.find('.table-row input[type="text"]');
    await urlInput.trigger("blur");
    expect(wrapper.emitted("sync-api-bases")).toBeTruthy();
  });

  it("emits 'sync-api-bases' on connected checkbox change", async () => {
    const { wrapper } = makeWrapper();
    const checkbox = wrapper.find('.table-row input[type="checkbox"]');
    await checkbox.trigger("change");
    expect(wrapper.emitted("sync-api-bases")).toBeTruthy();
  });

  it("emits 'refresh-models' on REFRESH button", async () => {
    const { wrapper } = makeWrapper();
    const refreshBtn = wrapper.findAll("button").find((b) => b.text() === "REFRESH");
    await refreshBtn.trigger("click");
    expect(wrapper.emitted("refresh-models")).toBeTruthy();
  });

  it("emits 'load-openrouter' on LOAD OPENROUTER button", async () => {
    const { wrapper } = makeWrapper({ config: { openrouterApiKey: "or-key" } });
    const btn = wrapper.findAll("button").find((b) => b.text() === "LOAD OPENROUTER");
    await btn.trigger("click");
    expect(wrapper.emitted("load-openrouter")).toBeTruthy();
  });

  it("emits 'test-asr' on TEST button", async () => {
    const { wrapper } = makeWrapper({ config: { asrServerUrl: "http://x:8081" } });
    const btn = wrapper.findAll("button").find((b) => b.text() === "TEST");
    await btn.trigger("click");
    expect(wrapper.emitted("test-asr")).toBeTruthy();
  });

  it("toggles tokenVisible via token SHOW/HIDE button", async () => {
    const { wrapper } = makeWrapper();
    const tokenToggle = wrapper.find(".token-toggle");
    expect(tokenToggle.text()).toBe("SHOW");
    await tokenToggle.trigger("click");
    expect(wrapper.emitted("update:tokenVisible")).toEqual([[true]]);
  });

  it("shows ASR connected/unreachable status", () => {
    const { wrapper } = makeWrapper({ asrStatus: { reachable: true, url: "x" } });
    expect(wrapper.text()).toContain("[CONNECTED]");
  });

  it("shows model-error when filteredModels is empty", () => {
    const { wrapper } = makeWrapper({ filteredModels: [] });
    expect(wrapper.text()).toContain("Модели недоступны");
  });
});
