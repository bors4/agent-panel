/**
 * Тесты для StatsCard компонента.
 */

import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import StatsCard from "@/components/features/StatsCard.vue";

describe("StatsCard", () => {
  it("renders basic stats without token section when showTokens is false", () => {
    const wrapper = mount(StatsCard, {
      props: {
        uptime: 3661,
        stats: { requests: 10, tools: 5, errors: 1 },
        showTokens: false,
        tokenUsage: { prompt: 100, completion: 200, total: 300, cached: 50 },
        maxTokens: 8192,
      },
    });

    expect(wrapper.text()).toContain("UPTIME");
    expect(wrapper.text()).toContain("10");
    expect(wrapper.text()).toContain("5");
    expect(wrapper.text()).toContain("1");
    expect(wrapper.find(".tlm__donut").exists()).toBe(false);
  });

  it("renders token section when showTokens is true and tokenUsage exists", () => {
    const wrapper = mount(StatsCard, {
      props: {
        uptime: 0,
        stats: {},
        showTokens: true,
        tokenUsage: { prompt: 1000, completion: 500, total: 1500, cached: 200 },
        maxTokens: 8192,
      },
    });

    expect(wrapper.find(".tlm__donut").exists()).toBe(true);
    expect(wrapper.text()).toContain("CONTEXT");
    expect(wrapper.text()).toContain("1.5k");
    expect(wrapper.text()).toContain("8.2k");
  });

  it("shows N/A for cached when undefined", () => {
    const wrapper = mount(StatsCard, {
      props: {
        uptime: 0,
        stats: {},
        showTokens: true,
        tokenUsage: { prompt: 100, completion: 50, total: 150 },
        maxTokens: 8192,
      },
    });

    expect(wrapper.text()).toContain("N/A");
    expect(wrapper.find(".tlm__bar-na").exists()).toBe(true);
  });

  it("calculates context percentage correctly", () => {
    const wrapper = mount(StatsCard, {
      props: {
        uptime: 0,
        stats: {},
        showTokens: true,
        tokenUsage: { prompt: 4096, completion: 4096, total: 8192, cached: 0 },
        maxTokens: 8192,
      },
    });

    expect(wrapper.text()).toContain("100.0%");
  });

  it("does not render token section when tokenUsage is null", () => {
    const wrapper = mount(StatsCard, {
      props: {
        uptime: 0,
        stats: {},
        showTokens: true,
        tokenUsage: null,
        maxTokens: 8192,
      },
    });

    expect(wrapper.find(".tlm__donut").exists()).toBe(false);
  });
});
