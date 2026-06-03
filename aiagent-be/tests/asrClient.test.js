/**
 * Тесты для lib/asrClient.js (SSRF protection, language sanitization, multipart).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateAsrUrl, sanitizeLanguage, buildMultipartBody, transcribeViaAsrServer, probeAsrServer } from "../lib/asrClient.js";

describe("validateAsrUrl", () => {
  it("returns null for empty input", () => {
    expect(validateAsrUrl("")).toBeNull();
    expect(validateAsrUrl(null)).toBeNull();
    expect(validateAsrUrl(undefined)).toBeNull();
  });

  it("accepts public HTTPS URL", () => {
    expect(validateAsrUrl("https://asr.example.com:8081")).toBe("https://asr.example.com:8081");
    expect(validateAsrUrl("https://asr.example.com:8081/")).toBe("https://asr.example.com:8081");
  });

  it("accepts private LAN IP (10.x, 172.16-31.x, 192.168.x)", () => {
    expect(validateAsrUrl("http://192.168.1.103:8081")).toBe("http://192.168.1.103:8081");
    expect(validateAsrUrl("http://10.0.0.5:8081")).toBe("http://10.0.0.5:8081");
    expect(validateAsrUrl("http://172.20.0.1:8081")).toBe("http://172.20.0.1:8081");
  });

  it("rejects non-http(s) protocols", () => {
    expect(() => validateAsrUrl("ftp://asr.example.com")).toThrow(/http or https/);
    expect(() => validateAsrUrl("file:///etc/passwd")).toThrow(/http or https/);
  });

  it("rejects URLs with credentials", () => {
    expect(() => validateAsrUrl("https://user:pass@asr.example.com")).toThrow(/credentials/);
  });

  it("rejects localhost", () => {
    expect(() => validateAsrUrl("http://localhost:8081")).toThrow(/local/);
  });

  it("rejects 127.0.0.1 loopback", () => {
    expect(() => validateAsrUrl("http://127.0.0.1:8081")).toThrow(/loopback/);
  });

  it("rejects 0.0.0.0 (any-address)", () => {
    expect(() => validateAsrUrl("http://0.0.0.0:8081")).toThrow(/loopback/);
  });

  it("rejects 169.254.x.x link-local / AWS metadata", () => {
    expect(() => validateAsrUrl("http://169.254.169.254/latest")).toThrow(/metadata/);
  });

  it("rejects IPv6 loopback ::1", () => {
    expect(() => validateAsrUrl("http://[::1]:8081")).toThrow(/loopback/);
  });

  it("rejects .local hostnames", () => {
    expect(() => validateAsrUrl("http://asr.local:8081")).toThrow(/local/);
  });

  it("rejects invalid URLs", () => {
    expect(() => validateAsrUrl("not a url")).toThrow(/Invalid/);
  });
});

describe("sanitizeLanguage", () => {
  it("accepts valid 2-letter codes", () => {
    expect(sanitizeLanguage("ru")).toBe("ru");
    expect(sanitizeLanguage("en")).toBe("en");
    expect(sanitizeLanguage("de")).toBe("de");
  });

  it("accepts 3-letter codes", () => {
    expect(sanitizeLanguage("rus")).toBe("rus");
  });

  it("accepts region codes", () => {
    expect(sanitizeLanguage("en-US")).toBe("en-US");
    expect(sanitizeLanguage("pt-BR")).toBe("pt-BR");
  });

  it("falls back to 'ru' for invalid input", () => {
    expect(sanitizeLanguage("")).toBe("ru");
    expect(sanitizeLanguage(null)).toBe("ru");
    expect(sanitizeLanguage(undefined)).toBe("ru");
    expect(sanitizeLanguage(123)).toBe("ru");
    expect(sanitizeLanguage("ru RU")).toBe("ru");
    expect(sanitizeLanguage("en_US")).toBe("ru");
    expect(sanitizeLanguage("../../../etc")).toBe("ru");
    expect(sanitizeLanguage("verylongstring")).toBe("ru");
  });
});

describe("buildMultipartBody", () => {
  it("produces valid multipart body with boundary", () => {
    const buffer = Buffer.from("RIFFfake wav data");
    const { body, boundary } = buildMultipartBody(buffer, "test.wav", "audio/wav", { language: "ru" });
    const str = body.toString();
    expect(str).toContain(`--${boundary}\r\n`);
    expect(str).toContain(`Content-Disposition: form-data; name="file"; filename="test.wav"\r\n`);
    expect(str).toContain(`Content-Type: audio/wav\r\n`);
    expect(str).toContain("RIFFfake wav data");
    expect(str).toContain(`name="language"\r\n\r\nru\r\n`);
    expect(str).toContain(`--${boundary}--\r\n`);
  });

  it("sanitizes CRLF in filename (prevents header injection)", () => {
    const buffer = Buffer.from("data");
    const { body } = buildMultipartBody(buffer, 'evil\r\nX-Injected: yes', "audio/wav", {});
    const str = body.toString();
    // CRLF should be replaced with underscores
    expect(str).not.toContain("evil\r\nX-Injected");
    expect(str).toMatch(/filename="evil__X-Injected: yes"/);
  });

  it("sanitizes CRLF in Content-Type", () => {
    const buffer = Buffer.from("data");
    const { body } = buildMultipartBody(buffer, "x.wav", "audio/wav\r\nX-Bad: 1", {});
    const str = body.toString();
    expect(str).not.toMatch(/audio\/wav\r\nX-Bad/);
  });

  it("skips null/undefined field values", () => {
    const buffer = Buffer.from("data");
    const { body } = buildMultipartBody(buffer, "x.wav", "audio/wav", { lang: null, temp: undefined, ok: "yes" });
    const str = body.toString();
    expect(str).not.toContain('name="lang"');
    expect(str).not.toContain('name="temp"');
    expect(str).toContain('name="ok"');
  });

  it("sanitizes CRLF in field values", () => {
    const buffer = Buffer.from("data");
    const { body } = buildMultipartBody(buffer, "x.wav", "audio/wav", { lang: "ru\r\nX-Evil: 1" });
    const str = body.toString();
    expect(str).not.toContain("ru\r\nX-Evil");
  });
});

describe("transcribeViaAsrServer", () => {
  let tmpWav;
  let fetchMock;

  beforeEach(() => {
    tmpWav = path.join(os.tmpdir(), `test-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);
    fs.writeFileSync(tmpWav, Buffer.from("RIFFfake"));
    fetchMock = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchMock.mockRestore();
    try { fs.unlinkSync(tmpWav); } catch {}
  });

  it("throws when asrServerUrl is empty", async () => {
    await expect(transcribeViaAsrServer({ wavPath: tmpWav, asrServerUrl: "" })).rejects.toThrow(/not configured/);
  });

  it("POSTs to {asrUrl}/inference with multipart body", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ text: "hello" }) });
    await transcribeViaAsrServer({ wavPath: tmpWav, asrServerUrl: "http://asr:8081" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://asr:8081/inference",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": expect.stringMatching(/^multipart\/form-data; boundary=/),
        }),
      })
    );
  });

  it("returns text from successful response", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ text: "  распознанный  " }) });
    const result = await transcribeViaAsrServer({ wavPath: tmpWav, asrServerUrl: "http://asr:8081" });
    expect(result).toBe("распознанный");
  });

  it("returns empty string when response has no text field", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    const result = await transcribeViaAsrServer({ wavPath: tmpWav, asrServerUrl: "http://asr:8081" });
    expect(result).toBe("");
  });

  it("returns empty string when response.json() throws", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => { throw new Error("bad json"); } });
    const result = await transcribeViaAsrServer({ wavPath: tmpWav, asrServerUrl: "http://asr:8081" });
    expect(result).toBe("");
  });

  it("throws with status and truncated body when ASR returns non-ok", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => "x".repeat(500) });
    await expect(transcribeViaAsrServer({ wavPath: tmpWav, asrServerUrl: "http://asr:8081" })).rejects.toThrow(
      /ASR server 500/
    );
  });

  it("truncates large error body to 200 chars", async () => {
    const big = "x".repeat(1000);
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => big });
    try {
      await transcribeViaAsrServer({ wavPath: tmpWav, asrServerUrl: "http://asr:8081" });
    } catch (e) {
      // Error message should not contain 1000 x's
      const xCount = (e.message.match(/x/g) || []).length;
      expect(xCount).toBeLessThanOrEqual(220);
    }
  });

  it("uses empty body text when response.text() rejects", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, text: async () => { throw new Error("read fail"); } });
    await expect(transcribeViaAsrServer({ wavPath: tmpWav, asrServerUrl: "http://asr:8081" })).rejects.toThrow(
      /ASR server 503: $/
    );
  });

  it("defaults invalid language to 'ru'", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ text: "x" }) });
    await transcribeViaAsrServer({ wavPath: tmpWav, asrServerUrl: "http://asr:8081", language: "invalid" });
    const callBody = fetchMock.mock.calls[0][1].body;
    expect(callBody.toString()).toMatch(/name="language"\r\n\r\nru\r\n/);
  });

  it("accepts valid language", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ text: "x" }) });
    await transcribeViaAsrServer({ wavPath: tmpWav, asrServerUrl: "http://asr:8081", language: "en-US" });
    const callBody = fetchMock.mock.calls[0][1].body;
    expect(callBody.toString()).toMatch(/name="language"\r\n\r\nen-US\r\n/);
  });

  it("aborts request via external signal", async () => {
    const externalController = new AbortController();
    fetchMock.mockImplementation(() => {
      return new Promise((_, reject) => {
        // Listen for abort
        externalController.signal.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    });
    const promise = transcribeViaAsrServer({
      wavPath: tmpWav,
      asrServerUrl: "http://asr:8081",
      signal: externalController.signal,
    });
    externalController.abort();
    await expect(promise).rejects.toThrow();
  });
});

describe("probeAsrServer", () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it("returns reachable=false when URL is empty", async () => {
    const result = await probeAsrServer("");
    expect(result.reachable).toBe(false);
  });

  it("returns reachable=true on 2xx response", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    const result = await probeAsrServer("http://asr:8081");
    expect(result.reachable).toBe(true);
    expect(result.status).toBe(200);
  });

  it("returns reachable=false on 500 response (no false positives)", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    const result = await probeAsrServer("http://asr:8081");
    expect(result.reachable).toBe(false);
  });

  it("returns reachable=false on network error", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    const result = await probeAsrServer("http://asr:8081");
    expect(result.reachable).toBe(false);
  });

  it("returns reachable=false on abort/timeout", async () => {
    fetchMock.mockImplementation(() => new Promise((_, reject) => {
      setTimeout(() => {
        const err = new Error("aborted");
        err.name = "AbortError";
        reject(err);
      }, 100);
    }));
    const result = await probeAsrServer("http://asr:8081", 50);
    expect(result.reachable).toBe(false);
  });
});
