/**
 * Тесты для composable usePendingApproval.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ref } from "vue";

vi.mock("@/api/client", () => ({
  cancelChat: vi.fn().mockResolvedValue({ success: true }),
  agentChatContinue: vi.fn(),
}));

import { usePendingApproval } from "@/composables/usePendingApproval";
import { useChatCancel } from "@/composables/useChatCancel";
import { agentChatContinue } from "@/api/client";

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

function setupDeps() {
  const messages = ref([]);
  const approvalMessages = ref([]);
  const cancel = useChatCancel();
  return { messages, approvalMessages, cancel, pending: usePendingApproval({ messages, approvalMessages, cancel }) };
}

describe("usePendingApproval", () => {
  it("addToolMessages: pushes tool_call messages", () => {
    const { messages, pending } = setupDeps();
    pending.addToolMessages([{ name: "read", args: '{"path":"/a"}', id: "tc-1" }], null, false);
    expect(messages.value).toHaveLength(1);
    expect(messages.value[0].type).toBe("tool_call");
    expect(messages.value[0].toolName).toBe("read");
    expect(messages.value[0].toolCallId).toBe("tc-1");
  });

  it("addToolMessages: pushes tool_result messages with success flag", () => {
    const { messages, pending } = setupDeps();
    pending.addToolMessages(
      null,
      [
        { success: true, output: "ok" },
        { success: false, output: "fail" },
      ],
      false
    );
    expect(messages.value).toHaveLength(2);
    expect(messages.value[0].success).toBe(true);
    expect(messages.value[1].success).toBe(false);
  });

  it("addToolMessages: requiresApproval pushes approval message + sets pendingApproval", () => {
    const { messages, pending } = setupDeps();
    pending.addToolMessages(null, null, true, "write", '{"path":"/b"}', "tc-2");
    expect(messages.value).toHaveLength(1);
    expect(messages.value[0].type).toBe("approval");
    expect(pending.pendingApproval.value).toEqual({
      toolName: "write",
      args: '{"path":"/b"}',
      toolCallId: "tc-2",
    });
  });

  it("addToolMessages: handles invalid JSON args gracefully", () => {
    const { messages, pending } = setupDeps();
    pending.addToolMessages([{ name: "x", args: "not json", id: "tc-3" }], null, false);
    expect(messages.value[0].toolArgsPretty).toBe("not json");
  });

  it("handleToolDecision returns null when no pending approval", async () => {
    const { pending } = setupDeps();
    const result = await pending.handleToolDecision({ role: "system", type: "approval" }, true, ref(false), () => {});
    expect(result).toBeNull();
    expect(agentChatContinue).not.toHaveBeenCalled();
  });

  it("handleToolDecision(approved=true) calls agentChatContinue and removes the msg", async () => {
    const { messages, pending } = setupDeps();
    agentChatContinue.mockResolvedValue({ success: true, reply: "Done", messages: [] });

    pending.addToolMessages(null, null, true, "read", '{"path":"/a"}', "tc-1");
    const approvalMsg = messages.value[0];
    expect(approvalMsg).toBeDefined();

    const isTyping = ref(false);
    await pending.handleToolDecision(approvalMsg, true, isTyping, () => {});

    expect(agentChatContinue).toHaveBeenCalledWith(
      expect.objectContaining({
        approvalDecision: expect.objectContaining({ approved: true, toolName: "read" }),
      }),
      expect.anything()
    );
    // Approval message removed
    expect(messages.value.find((m) => m.type === "approval")).toBeUndefined();
    // Bot reply pushed
    expect(messages.value[0].role).toBe("bot");
    expect(messages.value[0].content).toBe("Done");
    // pendingApproval cleared
    expect(pending.pendingApproval.value).toBeNull();
  });

  it("handleToolDecision on API error pushes 'Ошибка: ...' message", async () => {
    const { messages, pending } = setupDeps();
    agentChatContinue.mockResolvedValue({ success: false, error: "Boom" });

    pending.addToolMessages(null, null, true, "read", "{}", "tc-x");
    const approvalMsg = messages.value[0];

    await pending.handleToolDecision(approvalMsg, true, ref(false), () => {});

    expect(messages.value[0].content).toContain("❌ Ошибка: Boom");
  });

  it("handleToolDecision on AbortError pushes '🔴 Cancelled'", async () => {
    const { messages, pending } = setupDeps();
    const abortErr = new Error("aborted");
    abortErr.name = "AbortError";
    agentChatContinue.mockRejectedValue(abortErr);

    pending.addToolMessages(null, null, true, "read", "{}", "tc-x");
    const approvalMsg = messages.value[0];

    await pending.handleToolDecision(approvalMsg, true, ref(false), () => {});

    expect(messages.value[0].content).toBe("🔴 Cancelled");
  });

  it("load restores pendingApproval and pendingToolCalls from localStorage", () => {
    localStorage.setItem("agent-pending-approval", JSON.stringify({ toolName: "x", args: "y", toolCallId: "z" }));
    localStorage.setItem("agent-pending-tool-calls", JSON.stringify([{ id: "tc-a" }]));
    const { pending } = setupDeps();
    expect(pending.pendingApproval.value).toEqual({ toolName: "x", args: "y", toolCallId: "z" });
    expect(pending.pendingToolCalls.value).toEqual([{ id: "tc-a" }]);
  });

  it("clear() resets pending state and localStorage", () => {
    localStorage.setItem("agent-pending-approval", JSON.stringify({ toolName: "x" }));
    const { pending } = setupDeps();
    pending.clear();
    expect(pending.pendingApproval.value).toBeNull();
    expect(localStorage.getItem("agent-pending-approval")).toBeNull();
  });
});
