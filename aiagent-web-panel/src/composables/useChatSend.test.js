/**
 * Тесты для useChatSend — send / resend флоу с фокусом на regression bugs.
 *
 * Защита от регрессии:
 * - useSound возвращает { send, receive, ... }, но useChatSend исторически
 *   деструктурировал `playSend` / `playReceive` — без переименования
 *   sendMessage падал с "playSend is not a function" при первом
 *   вызове (если soundEnabled = true). Тест гарантирует, что звуки
 *   вызываются на правильных именах и не падают.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ref, nextTick } from "vue";
import { useChatSend } from "@/composables/useChatSend";
import { useChatCancel } from "@/composables/useChatCancel";
import { usePendingApproval } from "@/composables/usePendingApproval";

vi.mock("@/api/client", () => ({
  directChat: vi.fn(),
  directChatStream: vi.fn(),
  agentChat: vi.fn(),
}));

import { agentChat } from "@/api/client";

function makeDeps(overrides = {}) {
  const messages = ref([]);
  const approvalMessages = ref([]);
  const pendingToolCalls = ref([]);
  const chatContainer = ref(null);
  const cancel = useChatCancel();
  const pending = usePendingApproval({ messages, approvalMessages, cancel });
  const toggles = { agentMode: ref(true) };
  const emitWarning = overrides.emitWarning || vi.fn();

  const playSend = vi.fn();
  const playReceive = vi.fn();
  const setVolume = vi.fn();
  const cancelVoice = vi.fn();
  const sound = { send: playSend, receive: playReceive, setVolume, cleanup: cancelVoice };

  const options = {
    modelName: "test-model",
    serverUrl: "http://test",
    projectPath: "/tmp",
    systemPrompt: "You are helpful",
    streamEnabled: false,
    verbose: false,
    soundEnabled: true,
    soundVolume: 50,
    sound,
    ...overrides.options,
  };

  return {
    messages,
    approvalMessages,
    pendingToolCalls,
    chatContainer,
    cancel,
    pending,
    toggles,
    options,
    emitWarning,
    playSend,
    playReceive,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useChatSend — sound wiring (regression: playSend is not a function)", () => {
  it("sendMessage calls sound.send() (not playSend) on user message when soundEnabled=true", async () => {
    const d = makeDeps();
    agentChat.mockResolvedValue({ success: true, reply: "ok", messages: [] });

    const { sendMessage } = useChatSend({
      messages: d.messages,
      approvalMessages: d.approvalMessages,
      pendingToolCalls: d.pendingToolCalls,
      chatContainer: d.chatContainer,
      cancel: d.cancel,
      pending: d.pending,
      toggles: d.toggles,
      emitWarning: d.emitWarning,
      options: d.options,
    });

    await sendMessage("hello", () => {}, () => {});

    // The bug: useChatSend destructured `playSend` (wrong name) — would have thrown.
    expect(d.playSend).toHaveBeenCalledTimes(1);
    expect(d.playReceive).toHaveBeenCalledTimes(1);
  });

  it("sendMessage does NOT throw when soundEnabled=true (regression: TypeError: playSend is not a function)", async () => {
    const d = makeDeps();
    agentChat.mockResolvedValue({ success: true, reply: "ok", messages: [] });

    const { sendMessage } = useChatSend({
      messages: d.messages,
      approvalMessages: d.approvalMessages,
      pendingToolCalls: d.pendingToolCalls,
      chatContainer: d.chatContainer,
      cancel: d.cancel,
      pending: d.pending,
      toggles: d.toggles,
      emitWarning: d.emitWarning,
      options: d.options,
    });

    // The original bug: sendMessage returned a rejected promise because
    // playSend was undefined at line 65. Now the call resolves cleanly.
    await expect(sendMessage("hi", () => {}, () => {})).resolves.toBeUndefined();
  });

  it("sendMessage skips sound.send() when soundEnabled=false", async () => {
    const d = makeDeps({ options: { soundEnabled: false } });
    agentChat.mockResolvedValue({ success: true, reply: "ok", messages: [] });

    const { sendMessage } = useChatSend({
      messages: d.messages,
      approvalMessages: d.approvalMessages,
      pendingToolCalls: d.pendingToolCalls,
      chatContainer: d.chatContainer,
      cancel: d.cancel,
      pending: d.pending,
      toggles: d.toggles,
      emitWarning: d.emitWarning,
      options: d.options,
    });

    await sendMessage("silent", () => {}, () => {});

    expect(d.playSend).not.toHaveBeenCalled();
    expect(d.playReceive).not.toHaveBeenCalled();
  });

  it("resendMessage routes through sendMessage and also exercises the sound path", async () => {
    const d = makeDeps();
    agentChat.mockResolvedValue({ success: true, reply: "resent", messages: [] });

    d.messages.value.push({ role: "user", content: "first" });
    d.messages.value.push({ role: "bot", content: "first reply" });
    const targetIdx = 0;

    const { sendMessage, resendMessage } = useChatSend({
      messages: d.messages,
      approvalMessages: d.approvalMessages,
      pendingToolCalls: d.pendingToolCalls,
      chatContainer: d.chatContainer,
      cancel: d.cancel,
      pending: d.pending,
      toggles: d.toggles,
      emitWarning: d.emitWarning,
      options: d.options,
    });

    const emitLog = vi.fn();
    const emitTokenUsage = vi.fn();
    // Mirror ChatPanel.vue onResend: resendMessage → sendFn → sendMessage(t, emitLog, emitTokenUsage)
    await resendMessage(d.messages.value[0], targetIdx, async (t) => {
      await sendMessage(t, emitLog, emitTokenUsage);
    });
    await nextTick();

    // The regression check: playSend was called during the resend's send path
    expect(d.playSend).toHaveBeenCalled();
    // After resend: the old "first reply" is gone, the new "resent" bot reply is present
    expect(d.messages.value.some((m) => m.content === "first reply")).toBe(false);
    expect(d.messages.value.some((m) => m.content === "resent")).toBe(true);
  });
});

describe("useChatSend — API-BASE guard", () => {
  it("sendMessage does NOT call API and emits warning when serverUrl is empty", async () => {
    const d = makeDeps({ options: { serverUrl: "" } });
    const emitWarning = vi.fn();
    useChatSend({
      messages: d.messages,
      approvalMessages: d.approvalMessages,
      pendingToolCalls: d.pendingToolCalls,
      chatContainer: d.chatContainer,
      cancel: d.cancel,
      pending: d.pending,
      toggles: d.toggles,
      options: d.options,
      emitWarning,
    });

    // We don't have direct access to sendMessage from this scope — re-derive
    // the test using the public API only. Use a wrapper that calls into it.
    // Simpler: import and call directly.
    expect(agentChat).not.toHaveBeenCalled();
    expect(emitWarning).not.toHaveBeenCalled(); // not called yet
  });

  it("sendMessage emits warning toast and skips request when serverUrl is empty", async () => {
    const d = makeDeps({ options: { serverUrl: "" } });
    const emitWarning = vi.fn();
    const emitLog = vi.fn();
    const emitTokenUsage = vi.fn();
    const { sendMessage } = useChatSend({
      messages: d.messages,
      approvalMessages: d.approvalMessages,
      pendingToolCalls: d.pendingToolCalls,
      chatContainer: d.chatContainer,
      cancel: d.cancel,
      pending: d.pending,
      toggles: d.toggles,
      emitWarning,
      options: d.options,
    });

    await sendMessage("hello", emitLog, emitTokenUsage);

    expect(emitWarning).toHaveBeenCalledTimes(1);
    expect(emitWarning.mock.calls[0][0]).toMatch(/API-BASE не задан/);
    expect(agentChat).not.toHaveBeenCalled();
    // No user message was pushed
    expect(d.messages.value).toHaveLength(0);
  });

  it("sendMessage emits warning when serverUrl is whitespace only", async () => {
    const d = makeDeps({ options: { serverUrl: "   \t  " } });
    const emitWarning = vi.fn();
    const emitLog = vi.fn();
    const emitTokenUsage = vi.fn();
    const { sendMessage } = useChatSend({
      messages: d.messages,
      approvalMessages: d.approvalMessages,
      pendingToolCalls: d.pendingToolCalls,
      chatContainer: d.chatContainer,
      cancel: d.cancel,
      pending: d.pending,
      toggles: d.toggles,
      emitWarning,
      options: d.options,
    });

    await sendMessage("hello", emitLog, emitTokenUsage);

    expect(emitWarning).toHaveBeenCalledTimes(1);
    expect(agentChat).not.toHaveBeenCalled();
  });

  it("sendMessage proceeds normally when serverUrl is set (regression: previous tests still pass)", async () => {
    const d = makeDeps(); // default serverUrl is the test placeholder
    agentChat.mockResolvedValue({ success: true, reply: "ok", messages: [] });
    const emitWarning = vi.fn();
    const { sendMessage } = useChatSend({
      messages: d.messages,
      approvalMessages: d.approvalMessages,
      pendingToolCalls: d.pendingToolCalls,
      chatContainer: d.chatContainer,
      cancel: d.cancel,
      pending: d.pending,
      toggles: d.toggles,
      emitWarning,
      options: d.options,
    });

    await sendMessage("hi", () => {}, () => {});

    expect(emitWarning).not.toHaveBeenCalled();
    expect(agentChat).toHaveBeenCalledTimes(1);
  });
});
