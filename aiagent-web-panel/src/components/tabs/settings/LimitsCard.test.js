/**
 * Тесты для components/tabs/settings/LimitsCard.vue.
 */

import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { reactive } from "vue";
import LimitsCard from "@/components/tabs/settings/LimitsCard.vue";

function makeWrapper(overrides = {}) {
  const config = reactive({
    maxFileChars: 2000,
    maxHistoryPairs: 5,
    maxSearchResults: 15,
    maxSearchFileSize: 1048576,
    maxFilesInPrompt: 2,
    maxTokens: 1024,
    timeout: 300000,
    temperature: 0.1,
    ...overrides.config,
  });
  return { wrapper: mount(LimitsCard, { props: { config } }), config };
}

describe("LimitsCard", () => {
  it("renders all numeric labels and the temperature range", () => {
    const { wrapper } = makeWrapper();
    expect(wrapper.text()).toContain("MAX_FILE_CHARS");
    expect(wrapper.text()).toContain("MAX_HISTORY_PAIRS");
    expect(wrapper.text()).toContain("MAX_SEARCH_RESULTS");
    expect(wrapper.text()).toContain("MAX_SEARCH_FILE_SIZE");
    expect(wrapper.text()).toContain("MAX_FILES_IN_PROMPT");
    expect(wrapper.text()).toContain("TIMEOUT");
    expect(wrapper.text()).toContain("MAX_TOKENS");
    expect(wrapper.text()).toContain("TEMPERATURE");
  });

  it("emits adjust-tokens with -4096 on −4K button click", async () => {
    const { wrapper } = makeWrapper();
    const btn = wrapper.findAll("button").find((b) => b.text() === "−4K");
    await btn.trigger("click");
    expect(wrapper.emitted("adjust-tokens")).toEqual([[-4096]]);
  });

  it("emits adjust-tokens with +4096 on +4K button click", async () => {
    const { wrapper } = makeWrapper();
    const btn = wrapper.findAll("button").find((b) => b.text() === "+4K");
    await btn.trigger("click");
    expect(wrapper.emitted("adjust-tokens")).toEqual([[4096]]);
  });

  it("updates temperature when range input changes", async () => {
    const { wrapper, config } = makeWrapper();
    const range = wrapper.find('input[type="range"]');
    await range.setValue("0.7");
    expect(config.temperature).toBe(0.7);
    expect(wrapper.text()).toContain("0.70");
  });

  it("updates maxTokens when number input changes", async () => {
    const { wrapper, config } = makeWrapper();
    const numberInputs = wrapper.findAll('input[type="number"]');
    const tokensInput = numberInputs[numberInputs.length - 1];
    await tokensInput.setValue("8192");
    expect(config.maxTokens).toBe(8192);
  });
});
