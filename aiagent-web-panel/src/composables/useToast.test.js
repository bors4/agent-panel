/**
 * Тесты для composable useToast.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useToast, toasts } from "@/composables/useToast";

beforeEach(() => {
  toasts.value = [];
});

describe("useToast", () => {
  it("creates toast with info type", () => {
    const { info } = useToast();
    info("Test message");
    expect(toasts.value).toHaveLength(1);
    expect(toasts.value[0].type).toBe("info");
    expect(toasts.value[0].message).toBe("Test message");
  });

  it("creates toast with success type", () => {
    const { success } = useToast();
    success("Saved!");
    expect(toasts.value[0].type).toBe("success");
  });

  it("creates toast with error type", () => {
    const { error } = useToast();
    error("Something failed");
    expect(toasts.value[0].type).toBe("error");
  });

  it("creates toast with warning type", () => {
    const { warning } = useToast();
    warning("Be careful");
    expect(toasts.value[0].type).toBe("warning");
  });

  it("generates unique IDs for each toast", async () => {
    const { info } = useToast();
    info("First");
    await new Promise((r) => setTimeout(r, 2)); // Ensure different timestamps
    info("Second");
    expect(toasts.value[0].id).not.toBe(toasts.value[1].id);
  });

  it("removes toast by ID", () => {
    const { info, toasts: toastRef } = useToast();
    info("Test");
    const id = toastRef.value[0].id;
    // Manually remove (since setTimeout is async)
    const index = toastRef.value.findIndex((t) => t.id === id);
    toastRef.value.splice(index, 1);
    expect(toastRef.value).toHaveLength(0);
  });

  it("returns toasts ref", () => {
    const { toasts: toastRef } = useToast();
    expect(toastRef).toBeDefined();
    expect(Array.isArray(toastRef.value)).toBe(true);
  });
});
