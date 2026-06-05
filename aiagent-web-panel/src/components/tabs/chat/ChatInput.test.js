/**
 * Тесты для ChatInput.
 */

import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ChatInput from "@/components/tabs/chat/ChatInput.vue";

const baseProps = {
  isActive: true,
  isTyping: false,
  isStreaming: false,
  isCancelling: false,
  messagesCount: 0,
  voiceSupported: false,
  inputMessage: "",
};

describe("ChatInput", () => {
  it("renders input field", () => {
    const wrapper = mount(ChatInput, { props: baseProps });
    expect(wrapper.find(".chat-input").exists()).toBe(true);
  });

  it("input is disabled when isActive=false", () => {
    const wrapper = mount(ChatInput, { props: { ...baseProps, isActive: false } });
    const input = wrapper.find(".chat-input");
    expect(input.attributes("disabled")).toBeDefined();
  });

  it("placeholder changes when isActive=false", () => {
    const wrapper = mount(ChatInput, { props: { ...baseProps, isActive: false } });
    expect(wrapper.find(".chat-input").attributes("placeholder")).toContain("Сначала запустите агента");
  });

  it("emits update:inputMessage on input", async () => {
    const wrapper = mount(ChatInput, { props: baseProps });
    await wrapper.find(".chat-input").setValue("hello");
    expect(wrapper.emitted("update:inputMessage")).toBeTruthy();
    expect(wrapper.emitted("update:inputMessage")[0][0]).toBe("hello");
  });

  it("emits send on Enter (without Shift)", async () => {
    const wrapper = mount(ChatInput, { props: baseProps });
    await wrapper.find(".chat-input").trigger("keypress", { key: "Enter", shiftKey: false });
    expect(wrapper.emitted("send")).toBeTruthy();
  });

  it("does NOT emit send on Shift+Enter", async () => {
    const wrapper = mount(ChatInput, { props: baseProps });
    await wrapper.find(".chat-input").trigger("keypress", { key: "Enter", shiftKey: true });
    expect(wrapper.emitted("send")).toBeFalsy();
  });

  it("send button is disabled when input is empty", () => {
    const wrapper = mount(ChatInput, { props: baseProps });
    const sendBtn = wrapper.find(".chat-send");
    expect(sendBtn.attributes("disabled")).toBeDefined();
  });

  it("send button is enabled when input has text and active", () => {
    const wrapper = mount(ChatInput, { props: { ...baseProps, inputMessage: "hi" } });
    const sendBtn = wrapper.find(".chat-send");
    expect(sendBtn.attributes("disabled")).toBeUndefined();
  });

  it("emits send on send button click", async () => {
    const wrapper = mount(ChatInput, { props: { ...baseProps, inputMessage: "hi" } });
    await wrapper.find(".chat-send").trigger("click");
    expect(wrapper.emitted("send")).toBeTruthy();
  });

  it("shows mic button when voiceSupported=true", () => {
    const wrapper = mount(ChatInput, { props: { ...baseProps, voiceSupported: true } });
    expect(wrapper.find(".chat-mic").exists()).toBe(true);
  });

  it("hides mic button when voiceSupported=false", () => {
    const wrapper = mount(ChatInput, { props: { ...baseProps, voiceSupported: false } });
    expect(wrapper.find(".chat-mic").exists()).toBe(false);
  });

  it("emits toggle-recording on mic click", async () => {
    const wrapper = mount(ChatInput, { props: { ...baseProps, voiceSupported: true } });
    await wrapper.find(".chat-mic").trigger("click");
    expect(wrapper.emitted("toggle-recording")).toBeTruthy();
  });

  it("shows stop button when isTyping", () => {
    const wrapper = mount(ChatInput, { props: { ...baseProps, isTyping: true } });
    expect(wrapper.find(".chat-stop").exists()).toBe(true);
  });

  it("emits stop on stop button click", async () => {
    const wrapper = mount(ChatInput, { props: { ...baseProps, isTyping: true } });
    await wrapper.find(".chat-stop").trigger("click");
    expect(wrapper.emitted("stop")).toBeTruthy();
  });

  it("clear button disabled when no messages", () => {
    const wrapper = mount(ChatInput, { props: { ...baseProps, messagesCount: 0 } });
    expect(wrapper.find(".chat-clear").attributes("disabled")).toBeDefined();
  });

  it("emits clear on clear button click", async () => {
    const wrapper = mount(ChatInput, { props: { ...baseProps, messagesCount: 3 } });
    await wrapper.find(".chat-clear").trigger("click");
    expect(wrapper.emitted("clear")).toBeTruthy();
  });

  it("shows voice-status when isRecording", () => {
    const wrapper = mount(ChatInput, { props: { ...baseProps, voiceSupported: true, isRecording: true } });
    expect(wrapper.find(".voice-status").exists()).toBe(true);
  });

  it("shows voice-error when voiceError is set", () => {
    const wrapper = mount(ChatInput, { props: { ...baseProps, voiceError: "Mic blocked" } });
    expect(wrapper.find(".voice-error").exists()).toBe(true);
    expect(wrapper.text()).toContain("Mic blocked");
  });
});
