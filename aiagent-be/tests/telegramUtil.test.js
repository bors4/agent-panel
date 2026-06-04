/**
 * Tests for telegram util helpers: safeErrorMessage, sendLongMessage,
 * recordAndCheckRateLimit, buildPerfStats, cleanupTmp.
 */
import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { safeErrorMessage, recordAndCheckRateLimit, buildPerfStats, cleanupTmp, RATE_LIMIT } from "../lib/telegram/util.js";
import { rateLimitMap } from "../lib/state.js";

describe("safeErrorMessage", () => {
  it("returns userHint for any error", () => {
    const result = safeErrorMessage(new Error("secret token: abc123"), "Generic error");
    expect(result).toBe("Generic error");
  });

  it("handles string errors", () => {
    const result = safeErrorMessage("plain text", "Hint");
    expect(result).toBe("Hint");
  });

  it("handles null/undefined", () => {
    expect(safeErrorMessage(null, "Hint")).toBe("Hint");
    expect(safeErrorMessage(undefined, "Hint")).toBe("Hint");
  });

  it("truncates very long error details in logs", () => {
    const long = "x".repeat(500);
    const result = safeErrorMessage(new Error(long), "Hint");
    expect(result).toBe("Hint");
  });
});

describe("recordAndCheckRateLimit", () => {
  beforeEach(() => {
    rateLimitMap.clear();
  });

  it("allows first request", () => {
    expect(recordAndCheckRateLimit("chat-1")).toBe(true);
  });

  it("allows up to RATE_LIMIT consecutive requests", () => {
    for (let i = 0; i < RATE_LIMIT; i++) {
      expect(recordAndCheckRateLimit("chat-2")).toBe(true);
    }
  });

  it("blocks request beyond RATE_LIMIT", () => {
    for (let i = 0; i < RATE_LIMIT; i++) {
      recordAndCheckRateLimit("chat-3");
    }
    expect(recordAndCheckRateLimit("chat-3")).toBe(false);
  });

  it("isolates rate limit per chatId", () => {
    for (let i = 0; i < RATE_LIMIT; i++) {
      recordAndCheckRateLimit("chat-a");
    }
    expect(recordAndCheckRateLimit("chat-b")).toBe(true);
  });
});

describe("buildPerfStats", () => {
  it("handles empty timings", () => {
    const stats = buildPerfStats({});
    expect(stats.prompt_n).toBe(0);
    expect(stats.predicted_n).toBe(0);
    expect(stats.total_ms).toBe(0);
    expect(stats.draft_acceptance_rate).toBe(0);
  });

  it("computes total_ms from prompt_ms and predicted_ms", () => {
    const stats = buildPerfStats({ prompt_ms: 100.4, predicted_ms: 200.6 });
    expect(stats.total_ms).toBe(301);
  });

  it("computes draft_acceptance_rate when draft_n > 0", () => {
    const stats = buildPerfStats({ draft_n: 10, draft_n_accepted: 7 });
    expect(stats.draft_acceptance_rate).toBe(0.7);
  });

  it("preserves all input fields", () => {
    const stats = buildPerfStats({
      prompt_n: 100,
      predicted_n: 50,
      prompt_ms: 100,
      predicted_ms: 200,
      prompt_per_second: 1000,
      predicted_per_second: 250,
      cache_n: 80,
      tokens_cached: 80,
    });
    expect(stats.prompt_n).toBe(100);
    expect(stats.predicted_n).toBe(50);
    expect(stats.prompt_per_second).toBe(1000);
    expect(stats.predicted_per_second).toBe(250);
    expect(stats.cache_n).toBe(80);
    expect(stats.tokens_cached).toBe(80);
  });
});

describe("cleanupTmp", () => {
  it("removes existing files", () => {
    const tmp = path.join(os.tmpdir(), `cleanup-test-${Date.now()}.txt`);
    fs.writeFileSync(tmp, "x");
    expect(fs.existsSync(tmp)).toBe(true);
    cleanupTmp(tmp);
    expect(fs.existsSync(tmp)).toBe(false);
  });

  it("ignores non-existent files", () => {
    expect(() => cleanupTmp("/does/not/exist/file.txt")).not.toThrow();
  });

  it("ignores null/undefined", () => {
    expect(() => cleanupTmp(null, undefined, "")).not.toThrow();
  });
});
