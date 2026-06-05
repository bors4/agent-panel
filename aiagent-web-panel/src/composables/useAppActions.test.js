/**
 * Тесты для composable useAppActions.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ref } from "vue";
import { useAppActions } from "@/composables/useAppActions";

function makeOverrides() {
  return {
    logs: ref([]),
    tokenUsage: ref({ prompt: 0, completion: 0, total: 0, cached: 0 }),
    startAgent: vi.fn().mockResolvedValue({ ok: true }),
    stopAgent: vi.fn().mockResolvedValue({ ok: true }),
    restartAgent: vi.fn().mockResolvedValue({ ok: true }),
    clearLogs: vi.fn().mockResolvedValue({ ok: true }),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  };
}

describe("useAppActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("addLog pushes entries with timestamp and trims beyond 200", () => {
    const o = makeOverrides();
    const a = useAppActions(o);
    a.addLog("hello");
    a.addLog("world", "success");
    expect(o.logs.value).toHaveLength(2);
    expect(o.logs.value[0]).toMatchObject({ message: "hello", type: "info" });
    expect(o.logs.value[0].time).toMatch(/^\d{2}:\d{2}:\d{2}/);
    expect(o.logs.value[1].type).toBe("success");
    for (let i = 0; i < 250; i++) a.addLog("entry");
    expect(o.logs.value.length).toBeLessThanOrEqual(200);
  });

  it("handleStart calls startAgent and toasts success", async () => {
    const o = makeOverrides();
    const a = useAppActions(o);
    await a.handleStart();
    expect(o.startAgent).toHaveBeenCalledOnce();
    expect(o.success).toHaveBeenCalledWith("Агент запущен");
  });

  it("handleStart toasts error on failure", async () => {
    const o = makeOverrides();
    o.startAgent.mockRejectedValue(new Error("boom"));
    const a = useAppActions(o);
    await a.handleStart();
    expect(o.error).toHaveBeenCalledWith("boom");
  });

  it("handleStop calls stopAgent and toasts warning", async () => {
    const o = makeOverrides();
    const a = useAppActions(o);
    await a.handleStop();
    expect(o.stopAgent).toHaveBeenCalledOnce();
    expect(o.warning).toHaveBeenCalledWith("Агент остановлен");
  });

  it("handleRestart calls restartAgent and toasts success", async () => {
    const o = makeOverrides();
    const a = useAppActions(o);
    await a.handleRestart();
    expect(o.restartAgent).toHaveBeenCalledOnce();
    expect(o.success).toHaveBeenCalledWith("Агент перезапущен");
  });

  it("handleClearLogs calls clearLogs and toasts success", async () => {
    const o = makeOverrides();
    const a = useAppActions(o);
    await a.handleClearLogs();
    expect(o.clearLogs).toHaveBeenCalledOnce();
    expect(o.success).toHaveBeenCalledWith("Логи очищены");
  });

  it("handleClearLogs toasts error on failure", async () => {
    const o = makeOverrides();
    o.clearLogs.mockRejectedValue(new Error("nope"));
    const a = useAppActions(o);
    await a.handleClearLogs();
    expect(o.error).toHaveBeenCalledWith("Не удалось очистить логи");
  });

  it("handleTokenUsage accumulates prompt/completion/total", () => {
    const o = makeOverrides();
    const a = useAppActions(o);
    a.handleTokenUsage({ prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 });
    expect(o.tokenUsage.value).toEqual({ prompt: 10, completion: 20, total: 30, cached: 0 });
    a.handleTokenUsage({ prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 });
    expect(o.tokenUsage.value).toEqual({ prompt: 15, completion: 30, total: 45, cached: 0 });
  });

  it("handleTokenUsage accumulates cached_tokens from prompt_tokens_details", () => {
    const o = makeOverrides();
    const a = useAppActions(o);
    a.handleTokenUsage({ prompt_tokens: 100, prompt_tokens_details: { cached_tokens: 40 } });
    expect(o.tokenUsage.value.cached).toBe(40);
  });

  it("handleTokenUsage is a no-op when usage is null", () => {
    const o = makeOverrides();
    const a = useAppActions(o);
    a.handleTokenUsage(null);
    expect(o.tokenUsage.value).toEqual({ prompt: 0, completion: 0, total: 0, cached: 0 });
  });

  it("formatPrompt collapses 3+ newlines and \\r\\n", () => {
    const o = makeOverrides();
    const a = useAppActions(o);
    const prompt = ref("line1\r\n\r\n\r\nline2\n\n\n\nline3");
    a.formatPrompt(prompt);
    expect(prompt.value).toBe("line1\n\nline2\n\nline3");
    expect(o.success).toHaveBeenCalledWith("Отформатировано");
  });

  it("copyPrompt writes to clipboard and toasts", async () => {
    const o = makeOverrides();
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true, writable: true });
    const a = useAppActions(o);
    const prompt = ref("hello world");
    await a.copyPrompt(prompt);
    expect(writeText).toHaveBeenCalledWith("hello world");
    expect(o.success).toHaveBeenCalledWith("Скопировано");
  });

  it("copyPrompt toasts error when clipboard rejects", async () => {
    const o = makeOverrides();
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true, writable: true });
    const a = useAppActions(o);
    const prompt = ref("hello");
    await a.copyPrompt(prompt);
    expect(writeText).toHaveBeenCalledWith("hello");
    expect(o.error).toHaveBeenCalledWith(expect.stringContaining("denied"));
    expect(o.success).not.toHaveBeenCalled();
  });
});
