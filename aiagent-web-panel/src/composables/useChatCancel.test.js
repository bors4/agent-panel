/**
 * Тесты для composable useChatCancel.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/api/client", () => ({
  cancelChat: vi.fn().mockResolvedValue({ success: true }),
}));

import { useChatCancel } from "@/composables/useChatCancel";
import { cancelChat } from "@/api/client";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useChatCancel", () => {
  it("initial state: no controller, not cancelling, no abortId", () => {
    const { abortController, isCancelling, lastAbortId } = useChatCancel();
    expect(abortController.value).toBeNull();
    expect(isCancelling.value).toBe(false);
    expect(lastAbortId.value).toBeNull();
  });

  it("createController returns a new AbortController and stores it", () => {
    const { createController, abortController } = useChatCancel();
    const c = createController();
    expect(c).toBeInstanceOf(AbortController);
    expect(abortController.value).toBeInstanceOf(AbortController);
  });

  it("attachAbortId stores lastAbortId", () => {
    const { attachAbortId, lastAbortId } = useChatCancel();
    attachAbortId("abc-123");
    expect(lastAbortId.value).toBe("abc-123");
  });

  it("handleStop aborts the current controller and clears it", () => {
    const { createController, handleStop, abortController } = useChatCancel();
    const c = createController();
    handleStop();
    expect(c.signal.aborted).toBe(true);
    expect(abortController.value).toBeNull();
  });

  it("handleStop calls cancelChat on the backend with lastAbortId", async () => {
    const { createController, attachAbortId, handleStop } = useChatCancel();
    createController();
    attachAbortId("uuid-xyz");
    handleStop();
    // cancelChat is fire-and-forget — give it a tick
    await new Promise((r) => setTimeout(r, 0));
    expect(cancelChat).toHaveBeenCalledWith("uuid-xyz");
  });

  it("handleStop is a no-op when no controller exists", () => {
    const { handleStop, isCancelling, lastAbortId } = useChatCancel();
    handleStop();
    expect(isCancelling.value).toBe(false);
    expect(lastAbortId.value).toBeNull();
  });

  it("handleStop is a no-op when already cancelling", () => {
    const { createController, handleStop, isCancelling, abortController } = useChatCancel();
    createController();
    const controllerRef = abortController.value;
    isCancelling.value = true;
    handleStop();
    // abort should NOT have been called because we returned early
    expect(controllerRef.signal.aborted).toBe(false);
  });

  it("clearAbort only clears the matching controller (race-safe)", () => {
    const { createController, clearAbort, abortController } = useChatCancel();
    const c1 = createController();
    createController();
    expect(abortController.value).toBeInstanceOf(AbortController);
    clearAbort(c1);
    expect(abortController.value).toBeInstanceOf(AbortController);
    clearAbort(abortController.value);
    expect(abortController.value).toBeNull();
  });

  it("clearAbortId only clears matching id (race-safe)", () => {
    const { attachAbortId, clearAbortId, lastAbortId } = useChatCancel();
    attachAbortId("id-1");
    attachAbortId("id-2");
    expect(lastAbortId.value).toBe("id-2");
    clearAbortId("id-1");
    expect(lastAbortId.value).toBe("id-2");
    clearAbortId("id-2");
    expect(lastAbortId.value).toBeNull();
  });
});
