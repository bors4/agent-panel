/**
 * Тесты для composable useChatHistory.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { nextTick } from "vue";

vi.mock("@/api/client", () => ({
  cancelChat: vi.fn().mockResolvedValue({ success: true }),
}));

import { useChatHistory } from "@/composables/useChatHistory";

const HISTORY_KEY = "agent-chat-history";
const APPROVAL_KEY = "agent-approval-messages";
const MAX_HISTORY_LENGTH = 50;

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe("useChatHistory", () => {
  it("starts with empty messages and approvalMessages", () => {
    const { messages, approvalMessages } = useChatHistory();
    expect(messages.value).toEqual([]);
    expect(approvalMessages.value).toEqual([]);
  });

  it("loads valid history from localStorage on init", () => {
    const saved = [
      { role: "user", content: "Hi" },
      { role: "bot", content: "Hello!" },
    ];
    localStorage.setItem(HISTORY_KEY, JSON.stringify(saved));
    const { messages } = useChatHistory();
    expect(messages.value).toEqual(saved);
  });

  it("rejects malformed history (no role/content) and keeps empty", () => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify([{ role: "user" /* no content */ }]));
    const { messages } = useChatHistory();
    expect(messages.value).toEqual([]);
  });

  it("truncates history to MAX_HISTORY_LENGTH on load", () => {
    const huge = Array.from({ length: MAX_HISTORY_LENGTH + 10 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "bot",
      content: `msg-${i}`,
    }));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(huge));
    const { messages } = useChatHistory();
    expect(messages.value).toHaveLength(MAX_HISTORY_LENGTH);
    expect(messages.value[0].content).toBe("msg-10");
  });

  it("loads approval messages from localStorage", () => {
    const saved = [
      { role: "user", content: "x" },
      { role: "assistant", content: "y" },
    ];
    localStorage.setItem(APPROVAL_KEY, JSON.stringify(saved));
    const { approvalMessages } = useChatHistory();
    expect(approvalMessages.value).toEqual(saved);
  });

  it("debounced auto-save: writes to localStorage after 500ms", async () => {
    vi.useFakeTimers();
    const { messages } = useChatHistory();
    messages.value.push({ role: "user", content: "hello" });
    expect(localStorage.getItem(HISTORY_KEY)).toBeNull();
    await vi.advanceTimersByTimeAsync(500);
    expect(JSON.parse(localStorage.getItem(HISTORY_KEY))).toEqual([{ role: "user", content: "hello" }]);
  });

  it("saveAll persists both messages and approvalMessages", () => {
    const { messages, approvalMessages, saveAll } = useChatHistory();
    messages.value = [{ role: "user", content: "x" }];
    approvalMessages.value = [{ role: "user", content: "a" }];
    saveAll();
    expect(JSON.parse(localStorage.getItem(HISTORY_KEY))).toEqual([{ role: "user", content: "x" }]);
    expect(JSON.parse(localStorage.getItem(APPROVAL_KEY))).toEqual([{ role: "user", content: "a" }]);
  });

  it("clearAll empties refs and localStorage", () => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify([{ role: "user", content: "x" }]));
    localStorage.setItem(APPROVAL_KEY, JSON.stringify([{ role: "user", content: "a" }]));
    const { messages, approvalMessages, clearAll } = useChatHistory();
    expect(messages.value.length).toBe(1);
    clearAll();
    expect(messages.value).toEqual([]);
    expect(approvalMessages.value).toEqual([]);
    expect(localStorage.getItem(HISTORY_KEY)).toBeNull();
    expect(localStorage.getItem(APPROVAL_KEY)).toBeNull();
  });

  it("cross-tab sync: storage event updates messages", async () => {
    const { messages } = useChatHistory();
    const newHistory = [{ role: "user", content: "from other tab" }];
    const ev = new StorageEvent("storage", {
      key: HISTORY_KEY,
      newValue: JSON.stringify(newHistory),
    });
    window.dispatchEvent(ev);
    await nextTick();
    expect(messages.value).toEqual(newHistory);
  });
});
