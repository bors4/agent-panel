/**
 * Тесты для компонента TabBar.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import TabBar from "@/components/layout/TabBar.vue";

const TABS = [
  { id: "a", label: "Section A", symbol: ">" },
  { id: "b", label: "Section B", symbol: "#" },
  { id: "c", label: "Section C", symbol: "@" },
];

describe("TabBar", () => {
  beforeEach(() => {});

  it("renders a button per tab with the symbol indicator and label", () => {
    const wrapper = mount(TabBar, { props: { tabs: TABS, activeTab: "a" } });
    const buttons = wrapper.findAll('[role="tab"]');
    expect(buttons).toHaveLength(3);
    expect(buttons[0].text()).toContain(">");
    expect(buttons[0].text()).toContain("Section A");
    expect(buttons[2].text()).toContain("@");
  });

  it("marks the active tab with the active class and aria-selected=true", () => {
    const wrapper = mount(TabBar, { props: { tabs: TABS, activeTab: "b" } });
    const buttons = wrapper.findAll('[role="tab"]');
    expect(buttons[0].classes()).not.toContain("active");
    expect(buttons[0].attributes("aria-selected")).toBe("false");
    expect(buttons[1].classes()).toContain("active");
    expect(buttons[1].attributes("aria-selected")).toBe("true");
  });

  it("emits update:activeTab with the tab id on click", async () => {
    const wrapper = mount(TabBar, { props: { tabs: TABS, activeTab: "a" } });
    await wrapper.findAll('[role="tab"]')[2].trigger("click");
    expect(wrapper.emitted("update:activeTab")).toEqual([["c"]]);
  });
});
