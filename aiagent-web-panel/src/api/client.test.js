/**
 * Тесты для API клиента.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isConnectionActive,
  resetConnection,
  getAccounts,
  postAccounts,
  postImportAccounts,
  getModels,
  checkPath,
} from "@/api/client";

describe("api/client connection state", () => {
  it("starts with connected state", () => {
    expect(isConnectionActive()).toBe(true);
  });

  it("resets connection state", () => {
    resetConnection();
    expect(isConnectionActive()).toBe(true);
  });
});

describe("api/client accounts", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  it("getAccounts calls GET /api/accounts", async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, accounts: [] }) });
    const result = await getAccounts();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/accounts"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "x-api-key": expect.any(String),
        }),
      })
    );
    expect(result.success).toBe(true);
  });

  it("postAccounts calls POST /api/accounts with payload", async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, accounts: [] }) });
    await postAccounts({ accounts: [{ username: "test" }] });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/accounts"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("test"),
      })
    );
  });

  it("postImportAccounts calls POST /api/accounts/import", async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, accounts: [] }) });
    await postImportAccounts({ accounts: [{ username: "imported" }] });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/accounts/import"),
      expect.objectContaining({ method: "POST" })
    );
  });
});

describe("api/client models", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  it("getModels calls GET /api/models with serverUrl param", async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({ models: [] }) });
    const result = await getModels("http://localhost:8080/v1");
    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining("/models?serverUrl="), expect.any(Object));
    expect(result.models).toEqual([]);
  });

  it("getModels sends x-openrouter-key header when apiKey provided", async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({ models: [] }) });
    await getModels("https://openrouter.ai/api/v1", "sk-or-v1-test-key");
    const callArgs = globalThis.fetch.mock.calls[0];
    expect(callArgs[1].headers["x-openrouter-key"]).toBe("sk-or-v1-test-key");
  });

  it("getModels does not send x-openrouter-key when apiKey omitted", async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({ models: [] }) });
    await getModels("http://localhost:8080/v1");
    const callArgs = globalThis.fetch.mock.calls[0];
    expect(callArgs[1].headers["x-openrouter-key"]).toBeUndefined();
  });
});

// Проверяем, что базовая функциональность работает с новым API_KEY поведением
describe("api/client with new API_KEY behavior", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  it("checkPath calls GET /api/validate-path with path param", async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({ valid: true }) });
    const result = await checkPath("/some/path");
    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining("/validate-path?path="), expect.any(Object));
    expect(result.valid).toBe(true);
  });
});
