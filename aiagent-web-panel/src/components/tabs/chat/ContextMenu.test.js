/**
 * Тесты для ContextMenu.
 */

import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ContextMenu from "@/components/tabs/chat/ContextMenu.vue";

describe("ContextMenu", () => {
  it("renders nothing when visible=false", () => {
    const wrapper = mount(ContextMenu, { props: { visible: false } });
    expect(wrapper.find(".context-menu").exists()).toBe(false);
  });

  it("renders menu at given x/y when visible=true", () => {
    const wrapper = mount(ContextMenu, { props: { visible: true, x: 100, y: 200 } });
    const menu = wrapper.find(".context-menu");
    expect(menu.exists()).toBe(true);
    expect(menu.attributes("style")).toContain("top: 200px");
    expect(menu.attributes("style")).toContain("left: 100px");
  });

  it("emits action('clear') on clear item click", async () => {
    const wrapper = mount(ContextMenu, { props: { visible: true, x: 0, y: 0 } });
    await wrapper.find(".context-menu-item").trigger("click");
    expect(wrapper.emitted("action")).toBeTruthy();
    expect(wrapper.emitted("action")[0][0]).toBe("clear");
  });
});
