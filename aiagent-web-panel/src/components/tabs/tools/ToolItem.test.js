/**
 * Тесты для components/tabs/tools/ToolItem.vue.
 */

import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ToolItem from "@/components/tabs/tools/ToolItem.vue";

const baseTool = {
  description: "Read a file",
  category: "file",
  examples: ["read src/index.js", "read README.md"],
};

const baseConfig = { read: { enabled: true, permission: "ask", exclude_paths: ["node_modules"] } };

describe("ToolItem", () => {
  it("renders the tool name and description", () => {
    const wrapper = mount(ToolItem, {
      props: { name: "read", tool: baseTool, config: baseConfig, isExpanded: false },
    });
    expect(wrapper.text()).toContain("read");
    expect(wrapper.text()).toContain("Read a file");
  });

  it("applies the disabled class when the tool is not enabled", () => {
    const wrapper = mount(ToolItem, {
      props: {
        name: "read",
        tool: baseTool,
        config: { read: { enabled: false, permission: "ask" } },
        isExpanded: false,
      },
    });
    expect(wrapper.find(".tool-item").classes()).toContain("disabled");
  });

  it("does not show settings or examples when collapsed", () => {
    const wrapper = mount(ToolItem, {
      props: { name: "read", tool: baseTool, config: baseConfig, isExpanded: false },
    });
    expect(wrapper.find(".tool-settings").attributes("style")).toContain("display: none");
    expect(wrapper.find(".tool-examples").attributes("style")).toContain("display: none");
  });

  it("shows settings and examples when expanded", () => {
    const wrapper = mount(ToolItem, {
      props: { name: "read", tool: baseTool, config: baseConfig, isExpanded: true },
    });
    const settingsStyle = wrapper.find(".tool-settings").attributes("style") || "";
    const examplesStyle = wrapper.find(".tool-examples").attributes("style") || "";
    expect(settingsStyle).not.toContain("display: none");
    expect(examplesStyle).not.toContain("display: none");
    expect(wrapper.text()).toContain("read src/index.js");
  });

  it("emits toggle-settings on header click", async () => {
    const wrapper = mount(ToolItem, {
      props: { name: "read", tool: baseTool, config: baseConfig, isExpanded: false },
    });
    await wrapper.find(".tool-info").trigger("click");
    expect(wrapper.emitted("toggle-settings")).toEqual([["read"]]);
  });

  it("emits toggle with the new checked value on checkbox change", async () => {
    const wrapper = mount(ToolItem, {
      props: { name: "read", tool: baseTool, config: baseConfig, isExpanded: false },
    });
    const checkbox = wrapper.find('input[type="checkbox"]');
    await checkbox.setValue(false);
    expect(wrapper.emitted("toggle")).toEqual([["read", expect.any(Event)]]);
  });

  it("emits update-permission on select change", async () => {
    const wrapper = mount(ToolItem, {
      props: { name: "read", tool: baseTool, config: baseConfig, isExpanded: true },
    });
    await wrapper.find("select").setValue("always");
    expect(wrapper.emitted("update-permission")).toEqual([["read", "always"]]);
  });

  it("emits update-exclude-paths on input change", async () => {
    const wrapper = mount(ToolItem, {
      props: { name: "read", tool: baseTool, config: baseConfig, isExpanded: true },
    });
    const input = wrapper.find('.setting-row input[type="text"]');
    await input.setValue("a, b");
    expect(wrapper.emitted("update-exclude-paths")).toEqual([["read", "a, b"]]);
  });
});
