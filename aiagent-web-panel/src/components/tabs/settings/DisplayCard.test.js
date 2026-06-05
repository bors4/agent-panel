/**
 * Тесты для components/tabs/settings/DisplayCard.vue.
 */

import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { reactive } from "vue";
import DisplayCard from "@/components/tabs/settings/DisplayCard.vue";

function makeWrapper(initial = {}) {
  const config = reactive({
    showTokens: true,
    soundEnabled: true,
    soundVolume: 50,
    ...initial,
  });
  return { wrapper: mount(DisplayCard, { props: { config } }), config };
}

describe("DisplayCard", () => {
  it("renders SHOW TOKENS and SOUND labels", () => {
    const { wrapper } = makeWrapper();
    expect(wrapper.text()).toContain("SHOW TOKENS");
    expect(wrapper.text()).toContain("SOUND");
  });

  it("hides volume range when soundEnabled is false", () => {
    const { wrapper } = makeWrapper({ soundEnabled: false });
    expect(wrapper.text()).not.toContain("VOLUME");
  });

  it("shows volume range with current value when soundEnabled is true", () => {
    const { wrapper } = makeWrapper({ soundEnabled: true, soundVolume: 75 });
    expect(wrapper.text()).toContain("VOLUME");
    expect(wrapper.text()).toContain("75%");
  });

  it("toggles showTokens on checkbox change", async () => {
    const { wrapper, config } = makeWrapper();
    const cb = wrapper.find('input[type="checkbox"]');
    await cb.setValue(false);
    expect(config.showTokens).toBe(false);
  });

  it("toggles soundEnabled and hides/shows volume range", async () => {
    const { wrapper, config } = makeWrapper();
    const checkboxes = wrapper.findAll('input[type="checkbox"]');
    await checkboxes[1].setValue(false);
    expect(config.soundEnabled).toBe(false);
    expect(wrapper.text()).not.toContain("VOLUME");
  });

  it("updates soundVolume when range changes", async () => {
    const { wrapper, config } = makeWrapper({ soundVolume: 50 });
    const range = wrapper.find('input[type="range"]');
    await range.setValue("80");
    expect(config.soundVolume).toBe(80);
  });
});
