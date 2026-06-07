/**
 * Тесты для StatsPanel: проверяет что внутренние секции
 * (Last Request, Telemetry, Context, Performance) сворачиваются независимо
 * по клику на заголовок. Раньше был баг — props были захардкожены `:collapsed="false"`.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import StatsPanel from "@/components/stats/StatsPanel.vue";

const stubs = {
  LastRequestCard: { template: '<div data-test="last-request-stub" />' },
  TelemetryGrid: { template: '<div data-test="telemetry-grid-stub" />' },
  ContextDonutCard: { template: '<div data-test="context-donut-stub" />' },
  PerformanceCard: { template: '<div data-test="performance-stub" />' },
};

const defaultProps = () => ({
  stats: { requests: 5, errors: 1, tools: 3 },
  uptime: 3600,
  tokenUsage: { total: 100 },
  perfStats: {},
  maxTokens: 1000,
  lastRequestTokens: { prompt: 10, completion: 20, total: 30, cached: 5 },
  lastRequestTimestamp: "2026-01-01T00:00:00Z",
  collapsed: false,
});

describe("StatsPanel — per-section collapse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders all four sections expanded by default", () => {
    const wrapper = mount(StatsPanel, { props: defaultProps(), stubs });
    const headers = wrapper.findAll(".section__header--btn");
    expect(headers).toHaveLength(4);
    for (const h of headers) {
      expect(h.attributes("aria-expanded")).toBe("true");
    }
  });

  it("collapses the Telemetry section when its header is clicked", async () => {
    const wrapper = mount(StatsPanel, { props: defaultProps(), stubs });
    const headers = wrapper.findAll(".section__header--btn");
    await headers[1].trigger("click");
    expect(headers[1].attributes("aria-expanded")).toBe("false");
    expect(headers[0].attributes("aria-expanded")).toBe("true");
    expect(headers[2].attributes("aria-expanded")).toBe("true");
    expect(headers[3].attributes("aria-expanded")).toBe("true");
  });

  it("toggles the same section back open on second click", async () => {
    const wrapper = mount(StatsPanel, { props: defaultProps(), stubs });
    const headers = wrapper.findAll(".section__header--btn");
    await headers[2].trigger("click");
    expect(headers[2].attributes("aria-expanded")).toBe("false");
    await headers[2].trigger("click");
    expect(headers[2].attributes("aria-expanded")).toBe("true");
  });

  it("collapses multiple sections independently", async () => {
    const wrapper = mount(StatsPanel, { props: defaultProps(), stubs });
    const headers = wrapper.findAll(".section__header--btn");
    await headers[0].trigger("click");
    await headers[3].trigger("click");
    expect(headers[0].attributes("aria-expanded")).toBe("false");
    expect(headers[1].attributes("aria-expanded")).toBe("true");
    expect(headers[2].attributes("aria-expanded")).toBe("true");
    expect(headers[3].attributes("aria-expanded")).toBe("false");
  });

  it("hides the body content when a section is collapsed (v-show)", async () => {
    const wrapper = mount(StatsPanel, { props: defaultProps(), stubs });
    const headers = wrapper.findAll(".section__header--btn");
    await headers[0].trigger("click");
    const sectionBodies = wrapper.findAll(".section__body");
    expect(sectionBodies[0].element.style.display).toBe("none");
    await headers[0].trigger("click");
    expect(sectionBodies[0].element.style.display).not.toBe("none");
  });

  it("emits 'collapse' to the AppShell when the panel-level chevron is clicked", async () => {
    const wrapper = mount(StatsPanel, { props: defaultProps(), stubs });
    await wrapper.find(".stats-panel__collapse").trigger("click");
    expect(wrapper.emitted("collapse")).toBeTruthy();
  });

  it("emits 'expand' from the rail button when the panel is collapsed", async () => {
    const wrapper = mount(StatsPanel, {
      props: { ...defaultProps(), collapsed: true },
      stubs,
    });
    await wrapper.find(".stats-panel__expand").trigger("click");
    expect(wrapper.emitted("expand")).toBeTruthy();
  });

  it("does not render the inner body when the panel itself is collapsed", () => {
    const wrapper = mount(StatsPanel, {
      props: { ...defaultProps(), collapsed: true },
      stubs,
    });
    expect(wrapper.find(".stats-panel__body").exists()).toBe(false);
    expect(wrapper.find(".stats-panel__rail").exists()).toBe(true);
  });
});
