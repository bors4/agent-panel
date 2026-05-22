import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import ChatTab from "@/components/tabs/ChatTab.vue";

describe("ChatTab", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows placeholder when no messages and agent is active", () => {
    const wrapper = mount(ChatTab, {
      props: { isActive: true, modelName: "test", serverUrl: "http://test:8080/v1" },
    });
    expect(wrapper.text()).toContain("Введите сообщение для начала диалога");
  });

  it("shows placeholder when no messages and agent is inactive", () => {
    const wrapper = mount(ChatTab, {
      props: { isActive: false, modelName: "test", serverUrl: "http://test:8080/v1" },
    });
    expect(wrapper.text()).toContain("Запустите агента для начала общения");
  });

  it("renders input field", () => {
    const wrapper = mount(ChatTab, {
      props: { isActive: true, modelName: "test", serverUrl: "http://test:8080/v1" },
    });
    expect(wrapper.find("input").exists()).toBe(true);
  });

  it("has send button", () => {
    const wrapper = mount(ChatTab, {
      props: { isActive: true, modelName: "test", serverUrl: "http://test:8080/v1" },
    });
    const sendBtn = wrapper.find("button");
    expect(sendBtn.exists()).toBe(true);
  });
});
