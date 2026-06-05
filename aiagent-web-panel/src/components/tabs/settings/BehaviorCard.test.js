/**
 * Тесты для components/tabs/settings/BehaviorCard.vue.
 */

import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { reactive } from "vue";
import BehaviorCard from "@/components/tabs/settings/BehaviorCard.vue";

function makeWrapper(initial = {}) {
  const config = reactive({
    stream: true,
    insertUserAfterTool: true,
    chatMode: false,
    autoSave: true,
    verbose: false,
    autoStart: false,
    ...initial,
  });
  return { wrapper: mount(BehaviorCard, { props: { config } }), config };
}

describe("BehaviorCard", () => {
  it("renders all six toggle labels", () => {
    const { wrapper } = makeWrapper();
    expect(wrapper.text()).toContain("Потоковый вывод");
    expect(wrapper.text()).toContain("insertUserAfterTool");
    expect(wrapper.text()).toContain("CHAT MODE");
    expect(wrapper.text()).toContain("AUTO SAVE");
    expect(wrapper.text()).toContain("VERBOSE");
    expect(wrapper.text()).toContain("AUTO START");
  });

  it("toggles stream on checkbox change", async () => {
    const { wrapper, config } = makeWrapper();
    const checkboxes = wrapper.findAll('input[type="checkbox"]');
    await checkboxes[0].setValue(false);
    expect(config.stream).toBe(false);
  });

  it("toggles chatMode on checkbox change", async () => {
    const { wrapper, config } = makeWrapper();
    const checkboxes = wrapper.findAll('input[type="checkbox"]');
    await checkboxes[2].setValue(true);
    expect(config.chatMode).toBe(true);
  });

  it("toggles verbose on checkbox change", async () => {
    const { wrapper, config } = makeWrapper();
    const checkboxes = wrapper.findAll('input[type="checkbox"]');
    await checkboxes[4].setValue(true);
    expect(config.verbose).toBe(true);
  });

  it("toggles autoStart on checkbox change", async () => {
    const { wrapper, config } = makeWrapper();
    const checkboxes = wrapper.findAll('input[type="checkbox"]');
    await checkboxes[5].setValue(true);
    expect(config.autoStart).toBe(true);
  });
});
