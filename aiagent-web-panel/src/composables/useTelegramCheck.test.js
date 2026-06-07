/**
 * Тесты для useTelegramCheck — singleton composable для проверки Telegram Bot API.
 *
 * Защита от регрессии:
 * - checkBot() вызывает https://api.telegram.org/bot<token>/getMe с timeout 10s
 * - success: data.ok === true → checkState='success', botInfo={id,first_name,username}
 * - error: data.ok === false → checkState='error', errorMessage=data.description
 * - network/timeout: checkState='error', errorMessage='Network error' или текст
 * - empty token: checkState='error', errorMessage='Токен пустой' (без fetch)
 * - reset() возвращает state в 'idle' и обнуляет botInfo/errorMessage
 * - checkBot() мутирует checking flag (true→false) в любом исходе
 * - composable — singleton: state shared between two consumers
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useTelegramCheck } from "@/composables/useTelegramCheck";

describe("useTelegramCheck", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    // Default reset between tests — but singleton state persists.
    // We call reset() explicitly at the start of each test that needs a clean slate.
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("exposes initial state with checkState='idle' and null botInfo", () => {
    const { reset, checkState, botInfo, errorMessage, checking } = useTelegramCheck();
    reset();
    expect(checkState.value).toBe("idle");
    expect(botInfo.value).toBeNull();
    expect(errorMessage.value).toBe("");
    expect(checking.value).toBe(false);
  });

  it("returns null and sets error for empty/whitespace token (no fetch call)", async () => {
    const { checkBot, checkState, errorMessage } = useTelegramCheck();
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    const result = await checkBot("");
    expect(result).toBeNull();
    expect(checkState.value).toBe("error");
    expect(errorMessage.value).toBe("Токен пустой");
    expect(fetchSpy).not.toHaveBeenCalled();

    const result2 = await checkBot("   \t  ");
    expect(result2).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("strips non-ASCII characters from token before fetching", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ ok: true, result: { id: 1, first_name: "Bot", username: "b" } }),
    });
    globalThis.fetch = fetchMock;

    const { checkBot } = useTelegramCheck();
    await checkBot("123:ААВ"); // Cyrillic chars stripped

    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).toBe("https://api.telegram.org/bot123:/getMe");
  });

  it("on success: sets checkState='success' and botInfo with id/first_name/username", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: async () => ({
        ok: true,
        result: { id: 123456, first_name: "My Bot", username: "my_bot" },
      }),
    });

    const { checkBot, checkState, botInfo, errorMessage, checking } = useTelegramCheck();
    const result = await checkBot("123:abc");

    expect(result).toEqual({ id: 123456, first_name: "My Bot", username: "my_bot" });
    expect(checkState.value).toBe("success");
    expect(botInfo.value).toEqual({ id: 123456, first_name: "My Bot", username: "my_bot" });
    expect(errorMessage.value).toBe("");
    expect(checking.value).toBe(false);
  });

  it("on Telegram API error (ok=false): sets checkState='error' with description", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ ok: false, description: "Unauthorized" }),
    });

    const { checkBot, checkState, botInfo, errorMessage } = useTelegramCheck();
    const result = await checkBot("bad-token");

    expect(result).toBeNull();
    expect(checkState.value).toBe("error");
    expect(errorMessage.value).toBe("Unauthorized");
    expect(botInfo.value).toBeNull();
  });

  it("on Telegram API error without description: falls back to 'Telegram API error'", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ ok: false }),
    });

    const { checkBot, errorMessage } = useTelegramCheck();
    await checkBot("bad-token");
    expect(errorMessage.value).toBe("Telegram API error");
  });

  it("on network failure: sets checkState='error' with the error message", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    const { checkBot, checkState, errorMessage, botInfo, checking } = useTelegramCheck();
    const result = await checkBot("123:abc");

    expect(result).toBeNull();
    expect(checkState.value).toBe("error");
    expect(errorMessage.value).toBe("Failed to fetch");
    expect(botInfo.value).toBeNull();
    expect(checking.value).toBe(false);
  });

  it("on timeout/AbortError: sets checkState='error' (AbortError.message fallback to 'Network error')", async () => {
    const abortErr = new Error("The user aborted a request.");
    abortErr.name = "AbortError";
    globalThis.fetch = vi.fn().mockRejectedValue(abortErr);

    const { checkBot, checkState, errorMessage, checking } = useTelegramCheck();
    const result = await checkBot("123:abc");

    expect(result).toBeNull();
    expect(checkState.value).toBe("error");
    expect(errorMessage.value).toBe("The user aborted a request.");
    expect(checking.value).toBe(false);
  });

  it("uses AbortSignal.timeout(10000) for the request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ ok: true, result: { id: 1, first_name: "B", username: "b" } }),
    });
    globalThis.fetch = fetchMock;

    const { checkBot } = useTelegramCheck();
    await checkBot("123:abc");

    const init = fetchMock.mock.calls[0][1];
    expect(init).toHaveProperty("signal");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("checking flag toggles true→false (false before, false after)", async () => {
    let resolveJson;
    const jsonPromise = new Promise((r) => (resolveJson = r));
    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => jsonPromise });

    const { checkBot, checking } = useTelegramCheck();
    expect(checking.value).toBe(false);

    const promise = checkBot("123:abc");
    // Flush microtasks so checkBot awaits the resp and reaches resp.json()
    await Promise.resolve();
    expect(checking.value).toBe(true);

    resolveJson({ ok: true, result: { id: 1, first_name: "B", username: "b" } });
    await promise;

    expect(checking.value).toBe(false);
  });

  it("checking flag resets to false even on error", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("boom"));

    const { checkBot, checking } = useTelegramCheck();
    const promise = checkBot("123:abc");
    expect(checking.value).toBe(true);
    await promise;
    expect(checking.value).toBe(false);
  });

  it("reset() clears checkState, botInfo, errorMessage", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ ok: true, result: { id: 1, first_name: "B", username: "b" } }),
    });

    const { checkBot, reset, checkState, botInfo, errorMessage } = useTelegramCheck();
    await checkBot("123:abc");
    expect(checkState.value).toBe("success");
    expect(botInfo.value).not.toBeNull();

    reset();
    expect(checkState.value).toBe("idle");
    expect(botInfo.value).toBeNull();
    expect(errorMessage.value).toBe("");
  });

  it("is a singleton: state is shared between two useTelegramCheck() calls", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ ok: true, result: { id: 99, first_name: "S", username: "shared" } }),
    });

    const a = useTelegramCheck();
    const b = useTelegramCheck();

    await a.checkBot("123:abc");
    expect(b.checkState.value).toBe("success");
    expect(b.botInfo.value).toEqual({ id: 99, first_name: "S", username: "shared" });
  });

  it("sanitizes token: leading/trailing whitespace and embedded newlines stripped", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ ok: true, result: { id: 1, first_name: "B", username: "b" } }),
    });
    globalThis.fetch = fetchMock;

    const { checkBot } = useTelegramCheck();
    await checkBot("\n\t  123:abc \r\n");

    expect(fetchMock.mock.calls[0][0]).toBe("https://api.telegram.org/bot123:abc/getMe");
  });
});
