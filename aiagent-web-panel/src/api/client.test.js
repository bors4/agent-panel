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
    global.fetch = vi.fn();
  });

  it("getAccounts calls GET /api/accounts", async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, accounts: [] }) });
    const result = await getAccounts();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/accounts"),
      expect.objectContaining({ headers: expect.objectContaining({ "x-api-key": expect.any(String) }) }),
    );
    expect(result.success).toBe(true);
  });

  it("postAccounts calls POST /api/accounts with payload", async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, accounts: [] }) });
    await postAccounts({ accounts: [{ username: "test" }] });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/accounts"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("test"),
      }),
    );
  });

  it("postImportAccounts calls POST /api/accounts/import", async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, accounts: [] }) });
    await postImportAccounts({ accounts: [{ username: "imported" }] });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/accounts/import"),
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("api/client models", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("getModels calls GET /api/models with serverUrl param", async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ models: [] }) });
    const result = await getModels("http://localhost:8080/v1");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/models?serverUrl="),
      expect.any(Object),
    );
    expect(result.models).toEqual([]);
  });
});

describe("api/client validate path", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("checkPath calls GET /api/validate-path with path param", async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ valid: true }) });
    const result = await checkPath("/some/path");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/validate-path?path="),
      expect.any(Object),
    );
    expect(result.valid).toBe(true);
  });
});
