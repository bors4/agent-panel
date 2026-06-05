/**
 * Тесты для MessageBubble.
 */

import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import MessageBubble from "@/components/tabs/chat/MessageBubble.vue";

describe("MessageBubble", () => {
  it("renders user message with user class", () => {
    const wrapper = mount(MessageBubble, {
      props: { msg: { role: "user", content: "Hi there" } },
    });
    expect(wrapper.find(".chat-msg.user").exists()).toBe(true);
    expect(wrapper.text()).toContain("Hi there");
  });

  it("renders bot message with bot class", () => {
    const wrapper = mount(MessageBubble, {
      props: { msg: { role: "bot", content: "Hello!" } },
    });
    expect(wrapper.find(".chat-msg.bot").exists()).toBe(true);
    expect(wrapper.text()).toContain("Hello!");
  });

  it("shows resend button only for user when not typing/streaming", () => {
    const wrapper = mount(MessageBubble, {
      props: { msg: { role: "user", content: "Q" } },
    });
    expect(wrapper.find(".msg-action-btn").exists()).toBe(true);
  });

  it("hides resend button when isTyping", () => {
    const wrapper = mount(MessageBubble, {
      props: { msg: { role: "user", content: "Q" }, isTyping: true },
    });
    expect(wrapper.find(".msg-action-btn").exists()).toBe(false);
  });

  it("hides resend button for bot", () => {
    const wrapper = mount(MessageBubble, {
      props: { msg: { role: "bot", content: "A" } },
    });
    expect(wrapper.find(".msg-action-btn").exists()).toBe(false);
  });

  it("emits resend with msg when resend button is clicked", async () => {
    const msg = { role: "user", content: "redo me" };
    const wrapper = mount(MessageBubble, { props: { msg } });
    await wrapper.find(".msg-action-btn").trigger("click");
    expect(wrapper.emitted("resend")).toBeTruthy();
    expect(wrapper.emitted("resend")[0][0]).toEqual(msg);
  });

  it("shows token info when showTokens=true and msg.usage present", () => {
    const wrapper = mount(MessageBubble, {
      props: {
        msg: { role: "bot", content: "X", usage: { total: 100, prompt: 30, completion: 70 } },
        showTokens: true,
      },
    });
    expect(wrapper.find(".token-info").exists()).toBe(true);
    expect(wrapper.text()).toContain("100 tokens");
  });

  it("hides token info when showTokens=false", () => {
    const wrapper = mount(MessageBubble, {
      props: {
        msg: { role: "bot", content: "X", usage: { total: 100, prompt: 30, completion: 70 } },
        showTokens: false,
      },
    });
    expect(wrapper.find(".token-info").exists()).toBe(false);
  });

  it("hides token info when msg has no usage", () => {
    const wrapper = mount(MessageBubble, {
      props: { msg: { role: "bot", content: "X" }, showTokens: true },
    });
    expect(wrapper.find(".token-info").exists()).toBe(false);
  });

  it("renders reasoning block when showReasoning=true and msg.reasoning exists", () => {
    const wrapper = mount(MessageBubble, {
      props: {
        msg: { role: "bot", content: "X", reasoning: "thinking...", reasoningExpanded: true },
        showReasoning: true,
      },
    });
    expect(wrapper.find(".reasoning-block").exists()).toBe(true);
  });

  it("clicking reasoning header toggles reasoningExpanded on the msg", async () => {
    const msg = { role: "bot", content: "X", reasoning: "thought", reasoningExpanded: false };
    const wrapper = mount(MessageBubble, { props: { msg, showReasoning: true } });
    await wrapper.find(".reasoning-header").trigger("click");
    expect(msg.reasoningExpanded).toBe(true);
  });

  it("renders streaming cursor when msg.streaming=true and content present", () => {
    const wrapper = mount(MessageBubble, {
      props: { msg: { role: "bot", content: "partial", streaming: true } },
    });
    expect(wrapper.find(".cursor-blink").exists()).toBe(true);
    expect(wrapper.find(".chat-bubble.streaming").exists()).toBe(true);
  });
});
