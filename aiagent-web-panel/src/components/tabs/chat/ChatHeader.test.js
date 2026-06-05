/**
 * Тесты для ChatHeader.
 */

import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ChatHeader from "@/components/tabs/chat/ChatHeader.vue";

describe("ChatHeader", () => {
  it("shows ONLINE when isActive=true", () => {
    const wrapper = mount(ChatHeader, { props: { isActive: true } });
    expect(wrapper.find(".chat-status.active").exists()).toBe(true);
    expect(wrapper.text()).toContain("ONLINE");
  });

  it("shows OFFLINE when isActive=false", () => {
    const wrapper = mount(ChatHeader, { props: { isActive: false } });
    expect(wrapper.find(".chat-status.active").exists()).toBe(false);
    expect(wrapper.text()).toContain("OFFLINE");
  });

  it("shows VERBOSE badge when verbose=true", () => {
    const wrapper = mount(ChatHeader, { props: { verbose: true } });
    expect(wrapper.find(".verbose-badge").exists()).toBe(true);
  });

  it("hides VERBOSE badge when verbose=false", () => {
    const wrapper = mount(ChatHeader, { props: { verbose: false } });
    expect(wrapper.find(".verbose-badge").exists()).toBe(false);
  });

  it("emits toggle-reasoning when REASONING checkbox changes", async () => {
    const wrapper = mount(ChatHeader, { props: { showReasoning: true } });
    const checkboxes = wrapper.findAll('input[type="checkbox"]');
    await checkboxes[0].setValue(false);
    expect(wrapper.emitted("toggle-reasoning")).toBeTruthy();
  });

  it("emits toggle-agent when AGENT checkbox changes", async () => {
    const wrapper = mount(ChatHeader, { props: { agentMode: true } });
    const checkboxes = wrapper.findAll('input[type="checkbox"]');
    await checkboxes[1].setValue(false);
    expect(wrapper.emitted("toggle-agent")).toBeTruthy();
  });
});
