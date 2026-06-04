/**
 * Unit-тесты для lib/telegram/handleAgentResult.js
 * Channel-agnostic handler — проверяем все 6 веток:
 * 1. cancelled
 * 2. requiresApproval (с write content truncation)
 * 3. error
 * 4. final response (draft / private stream / group long-message)
 * 5. continue (рекурсия через agentLoopStep)
 * 6. iteration limit
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHandleAgentResult } from "../lib/telegram/handleAgentResult.js";

function makeDeps(overrides = {}) {
  const config = { maxHistoryPairs: 5, ...(overrides.config || {}) };
  const chatHistories = new Map();
  const pendingApprovals = new Map();
  const addLog = overrides.addLog || vi.fn();
  const replyMsg = overrides.replyMsg || vi.fn(async () => ({ message_id: 1 }));
  const editDraftMessage = overrides.editDraftMessage || vi.fn(async () => {});
  const sendLongMessage = overrides.sendLongMessage || vi.fn(async () => [2, 3]);
  const chunkText = overrides.chunkText || (async function* () {
    yield "chunk1";
  });
  const KEYBOARD_YES_NO = overrides.KEYBOARD_YES_NO || vi.fn(() => ({ row: "mock" }));
  const agentLoopStep = overrides.agentLoopStep || vi.fn(async () => ({ response: "done" }));
  const MAX_AGENT_ITERATIONS = 10;
  return {
    config, chatHistories, pendingApprovals, addLog, replyMsg, editDraftMessage,
    sendLongMessage, chunkText, KEYBOARD_YES_NO, agentLoopStep, MAX_AGENT_ITERATIONS,
  };
}

function makeCtx() {
  return {
    chat: { id: 123, type: "private" },
    api: { deleteMessage: vi.fn(async () => {}), editMessageText: vi.fn(async () => {}) },
    reply: vi.fn(async () => ({ message_id: 1 })),
    replyWithStream: vi.fn(async () => {}),
  };
}

describe("createHandleAgentResult", () => {
  let deps;
  let handleAgentResult;

  beforeEach(() => {
    deps = makeDeps();
    handleAgentResult = createHandleAgentResult(deps);
  });

  it("1) cancelled: returns true, deletes draft, does not call reply", async () => {
    const ctx = makeCtx();
    const result = { cancelled: true };
    const r = await handleAgentResult(ctx, "123", result, {}, 999);
    expect(r).toBe(true);
    expect(ctx.api.deleteMessage).toHaveBeenCalledWith(123, 999);
    expect(deps.replyMsg).not.toHaveBeenCalled();
  });

  it("2a) requiresApproval: stores in pendingApprovals, shows keyboard, updates history", async () => {
    const ctx = makeCtx();
    const result = {
      requiresApproval: true,
      toolName: "execute",
      args: { command: "rm -rf /tmp/foo" },
      toolCallId: "tc1",
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "do it" },
        { role: "assistant", content: "[TOOL APPROVAL REQUIRED] execute" },
      ],
    };
    const account = { role: "system" };
    const r = await handleAgentResult(ctx, "123", result, account);
    expect(r).toBe(true);
    expect(deps.pendingApprovals.get("123").toolName).toBe("execute");
    expect(deps.pendingApprovals.get("123").args.command).toBe("rm -rf /tmp/foo");
    expect(deps.pendingApprovals.get("123").toolCallId).toBe("tc1");
    expect(deps.KEYBOARD_YES_NO).toHaveBeenCalledWith("execute");
    expect(deps.replyMsg).toHaveBeenCalled();
    // history should exclude system + TOOL APPROVAL marker
    const hist = deps.chatHistories.get("123");
    expect(hist.some((m) => m.role === "system")).toBe(false);
    expect(hist.some((m) => m.content?.includes("TOOL APPROVAL"))).toBe(false);
  });

  it("2b) requiresApproval: truncates write content >200 chars", async () => {
    const ctx = makeCtx();
    const longContent = "x".repeat(500);
    const result = {
      requiresApproval: true,
      toolName: "write",
      args: { path: "a.txt", content: longContent },
      toolCallId: "tc1",
      messages: [{ role: "user", content: "u" }],
    };
    await handleAgentResult(ctx, "123", result, {});
    const sentText = deps.replyMsg.mock.calls[0][1];
    expect(sentText).toContain("content truncated");
    expect(sentText).toContain("500 chars");
  });

  it("3) error: cleans history, deletes draft, shows error", async () => {
    const ctx = makeCtx();
    deps.chatHistories.set("123", [
      { role: "user", content: "u" },
      { role: "tool", content: "tool out" },
      { role: "assistant", content: "[TOOL APPROVAL REQUIRED] x" },
    ]);
    const r = await handleAgentResult(ctx, "123", { error: "boom" }, {}, 999);
    expect(r).toBe(true);
    const hist = deps.chatHistories.get("123");
    expect(hist.some((m) => m.role === "tool")).toBe(false);
    expect(hist.some((m) => m.role === "system")).toBe(false);
    expect(hist.some((m) => m.content?.includes("TOOL APPROVAL"))).toBe(false);
    expect(ctx.api.deleteMessage).toHaveBeenCalledWith(123, 999);
    expect(deps.replyMsg).toHaveBeenCalledWith(ctx, "❌ Error: boom");
  });

  it("4a) final response with draft: calls editDraftMessage", async () => {
    const ctx = makeCtx();
    const result = {
      response: "Hello there",
      messages: [{ role: "user", content: "u" }, { role: "assistant", content: "Hello there" }],
    };
    await handleAgentResult(ctx, "123", result, {}, 999);
    expect(deps.editDraftMessage).toHaveBeenCalledWith(ctx, 999, "Hello there");
    expect(deps.sendLongMessage).not.toHaveBeenCalled();
    expect(ctx.replyWithStream).not.toHaveBeenCalled();
  });

  it("4b) final response without draft, private chat: uses replyWithStream", async () => {
    const ctx = makeCtx(); // private
    const result = { response: "Streamed reply", messages: [] };
    await handleAgentResult(ctx, "123", result, {}, undefined);
    expect(ctx.replyWithStream).toHaveBeenCalled();
    expect(deps.editDraftMessage).not.toHaveBeenCalled();
  });

  it("4c) final response without draft, group chat: uses sendLongMessage", async () => {
    const ctx = makeCtx();
    ctx.chat.type = "group";
    const result = { response: "Group reply", messages: [] };
    await handleAgentResult(ctx, "123", result, {}, undefined);
    expect(deps.sendLongMessage).toHaveBeenCalledWith(ctx, "Group reply");
  });

  it("4d) final response with reasoning: shows reasoning in code block", async () => {
    const ctx = makeCtx();
    const result = {
      response: "Final answer",
      reasoning: "thinking process",
      messages: [],
    };
    await handleAgentResult(ctx, "123", result, {}, 999);
    const called = deps.editDraftMessage.mock.calls[0][2];
    expect(called).toContain("💭 Reasoning:");
    expect(called).toContain("thinking process");
    expect(called).toContain("Final answer");
  });

  it("4e) empty response: shows '✅ Done.'", async () => {
    const ctx = makeCtx();
    const result = { response: "[TOOL APPROVAL REQUIRED] x", messages: [] };
    await handleAgentResult(ctx, "123", result, {}, 999);
    const called = deps.editDraftMessage.mock.calls[0][2];
    expect(called).toBe("✅ Done.");
  });

  it("5) continue: recurses via agentLoopStep", async () => {
    const ctx = makeCtx();
    const localDeps = makeDeps({ agentLoopStep: vi.fn(async () => ({ response: "after retry" })) });
    const localHandler = createHandleAgentResult(localDeps);
    const result = { response: "continue", messages: [] };
    await localHandler(ctx, "123", result, {}, 999);
    expect(localDeps.agentLoopStep).toHaveBeenCalled();
    // Recursive call uses draftMsgId=undefined, so private chat goes via replyWithStream
    expect(ctx.replyWithStream).toHaveBeenCalled();
  });

  it("6) iteration limit: deletes draft, shows 'Iteration limit reached'", async () => {
    const ctx = makeCtx();
    // neither cancelled, requiresApproval, error, nor response → falls to limit
    const result = {};
    await handleAgentResult(ctx, "123", result, {}, 999);
    expect(ctx.api.deleteMessage).toHaveBeenCalledWith(123, 999);
    expect(deps.replyMsg).toHaveBeenCalledWith(ctx, "Iteration limit reached");
  });
});
