/**
 * Unit-тесты для критических путей бэкенда.
 * Covers: safePath, parseToolCall, executeTool, session, logger
 */

import fs from "fs";
import path from "path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { safePath, parseToolCall } from "../lib/utils.js";
import {
  executeTool,
  TOOLS,
  getToolConfig,
  updateToolConfig,
} from "../lib/agent/executeTool.js";
import {
  getSession,
  saveSession,
  cleanupOldSessions,
  clearSessions,
} from "../lib/session.js";
import * as logger from "../lib/logger.js";

// ─── Mock console ────────────────────────────────────────────────
const originalConsole = { ...console };
beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "debug").mockImplementation(() => {});
});

afterEach(() => {
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  console.debug = originalConsole.debug;
});

// ═════════════════════════════════════════════════════════════════
// safePath
// ═════════════════════════════════════════════════════════════════
describe("safePath", () => {
  const projectRoot = "/home/user/project";

  it("allows relative paths within project", () => {
    expect(safePath("src/index.js", projectRoot)).toBe(
      "/home/user/project/src/index.js"
    );
  });

  it("allows nested relative paths", () => {
    expect(safePath("src/components/Button.vue", projectRoot)).toBe(
      "/home/user/project/src/components/Button.vue"
    );
  });

  it("rejects path traversal with ../", () => {
    expect(() => safePath("../../../etc/passwd", projectRoot)).toThrow(
      "Path outside project is forbidden"
    );
  });

  it("rejects absolute paths outside project", () => {
    expect(() => safePath("/etc/passwd", projectRoot)).toThrow(
      "Path outside project is forbidden"
    );
  });

  it("allows absolute paths within project", () => {
    expect(safePath("/home/user/project/src/file.js", projectRoot)).toBe(
      "/home/user/project/src/file.js"
    );
  });

  it("normalizes Windows-style backslashes", () => {
    const result = safePath("src\\nested\\file.js", projectRoot);
    expect(result).toBe("/home/user/project/src/nested/file.js");
  });

  it("handles dot-prefix paths", () => {
    expect(safePath("./src/file.js", projectRoot)).toBe(
      "/home/user/project/src/file.js"
    );
  });

  it("rejects null-byte injection", () => {
    expect(() => safePath("src/file.js\0evil", projectRoot)).toThrow(
      "null bytes"
    );
  });

  it("handles empty string path", () => {
    expect(safePath("", projectRoot)).toBe(projectRoot);
  });
});

// ═════════════════════════════════════════════════════════════════
// parseToolCall
// ═════════════════════════════════════════════════════════════════
describe("parseToolCall", () => {
  it("parses JSON tool call with arguments field", () => {
    const result = parseToolCall(
      '{"name":"write","arguments":{"filePath":"a.txt","content":"hi"}}'
    );
    expect(result).toEqual({
      name: "write",
      args: { filePath: "a.txt", content: "hi" },
    });
  });

  it("parses nested JSON objects correctly", () => {
    const result = parseToolCall(
      '{"name":"search","arguments":{"filter":{"type":"file"},"pattern":"TODO"}}'
    );
    expect(result).toEqual({
      name: "search",
      args: { filter: { type: "file" }, pattern: "TODO" },
    });
  });

  it("parses <tool> JSON format", () => {
    const result = parseToolCall(
      '<tool>{"name":"delete","args":{"path":"old.js"}}</tool>'
    );
    expect(result).toEqual({
      name: "delete",
      args: { path: "old.js" },
    });
  });

  it("handles whitespace variations", () => {
    const result = parseToolCall(
      ' {"name":"search","args":{"pattern":"TODO"}} '
    );
    expect(result).toEqual({
      name: "search",
      args: { pattern: "TODO" },
    });
  });

  it("returns null for plain text (no tool call)", () => {
    expect(parseToolCall("Hello, how are you?")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(parseToolCall("")).toBeNull();
    expect(parseToolCall(null)).toBeNull();
    expect(parseToolCall(undefined)).toBeNull();
  });

  it("handles malformed JSON gracefully", () => {
    const result = parseToolCall('{"name":"test","args":{broken}');
    expect(result).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════
// executeTool — async!
// ═════════════════════════════════════════════════════════════════
describe("executeTool", () => {
  const testDir = path.resolve("/tmp/vitest-execute-tool-test");

  beforeEach(() => {
    try {
      fs.mkdirSync(testDir, { recursive: true });
    } catch {}
  });

  afterEach(() => {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {}
  });

  it("reads existing file", async () => {
    const filePath = path.join(testDir, "test.txt");
    fs.writeFileSync(filePath, "hello world", "utf-8");
    const result = await executeTool(
      { name: "read", args: { filePath: "test.txt" } },
      { projectPath: testDir }
    );
    expect(result.success).toBe(true);
    expect(result.data.content).toBe("hello world");
  });

  it("returns error for non-existent file", async () => {
    const result = await executeTool(
      { name: "read", args: { filePath: "nonexistent.txt" } },
      { projectPath: testDir }
    );
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("creates and writes a new file", async () => {
    const result = await executeTool(
      { name: "write", args: { filePath: "new.txt", content: "test content" } },
      { projectPath: testDir }
    );
    expect(result.success).toBe(true);
    expect(
      fs.readFileSync(path.join(testDir, "new.txt"), "utf-8")
    ).toBe("test content");
  });

  it("creates parent directories if needed", async () => {
    const result = await executeTool(
      { name: "write", args: { filePath: "deep/nested/file.txt", content: "nested" } },
      { projectPath: testDir }
    );
    expect(result.success).toBe(true);
    expect(
      fs.readFileSync(path.join(testDir, "deep/nested/file.txt"), "utf-8")
    ).toBe("nested");
  });

  it("lists directory contents", async () => {
    fs.mkdirSync(path.join(testDir, "subdir"), { recursive: true });
    fs.writeFileSync(path.join(testDir, "file1.txt"), "a");
    fs.writeFileSync(path.join(testDir, "subdir", "file2.txt"), "b");

    const result = await executeTool(
      { name: "list_dir", args: { path: ".", depth: 2 } },
      { projectPath: testDir }
    );
    expect(result.success).toBe(true);
    expect(result.data.tree).toBeInstanceOf(Array);
    expect(result.data.tree.length).toBeGreaterThan(0);
  });

  it("rejects paths outside project", async () => {
    const result = await executeTool(
      { name: "read", args: { filePath: "/etc/passwd" } },
      { projectPath: testDir }
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("outside project");
  });

  it("runs shell commands", async () => {
    const result = await executeTool(
      { name: "execute", args: { command: 'echo "test"', timeout: 10 } },
      { projectPath: testDir }
    );
    expect(result.success).toBe(true);
    expect(result.data.stdout).toContain("test");
  });

  it("returns error for unknown tool", async () => {
    const result = await executeTool(
      { name: "nonexistent_tool", args: {} },
      { projectPath: testDir }
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("Unknown tool");
  });
});

// ═════════════════════════════════════════════════════════════════
// Session management
// ═════════════════════════════════════════════════════════════════
describe("session", () => {
  afterEach(() => {
    clearSessions();
  });

  it("creates session on first access", () => {
    const session = getSession("test-chat-1");
    expect(session).toBeDefined();
    expect(session.history).toEqual([]);
    expect(session.pendingActions).toBeDefined();
  });

  it("returns same session for same chatId", () => {
    const s1 = getSession("chat-1");
    const s2 = getSession("chat-1");
    expect(s1).toBe(s2);
  });

  it("creates different sessions for different chatIds", () => {
    const s1 = getSession("chat-1");
    const s2 = getSession("chat-2");
    expect(s1).not.toBe(s2);
  });

  it("saves messages to history", () => {
    saveSession("chat-save", { role: "user", content: "hello" });
    const session = getSession("chat-save");
    expect(session.history.length).toBe(1);
    expect(session.history[0]).toEqual({ role: "user", content: "hello" });
  });

  it("caps history at MAX_HISTORY_PAIRS * 2", () => {
    for (let i = 0; i < 15; i++) {
      saveSession("chat-cap", { role: "user", content: `msg${i}` });
    }
    const session = getSession("chat-cap");
    // MAX_HISTORY_PAIRS = 5, so max 10 entries
    expect(session.history.length).toBe(10);
  });
});

// ═════════════════════════════════════════════════════════════════
// Logger
// ═════════════════════════════════════════════════════════════════
describe("logger", () => {
  it("logInfo does not throw", () => {
    expect(() => logger.logInfo("test info message")).not.toThrow();
  });

  it("logWarn does not throw", () => {
    expect(() => logger.logWarn("test warning", { extra: "data" })).not.toThrow();
  });

  it("logError does not throw", () => {
    expect(() => logger.logError("test error", new Error("boom"))).not.toThrow();
  });

  it("logDebug does not throw", () => {
    expect(() => logger.logDebug("test debug")).not.toThrow();
  });

  it("requestLogger middleware sets requestId and calls next", () => {
    const req = {
      method: "GET",
      originalUrl: "/test",
      ip: "127.0.0.1",
      get: () => "test-agent",
    };
    const res = {
      statusCode: 200,
      on: (event, cb) => {
        if (event === "finish") cb();
      },
    };
    const next = vi.fn();
    logger.requestLogger(req, res, next);
    expect(req.requestId).toBeDefined();
    expect(typeof req.requestId).toBe("string");
    expect(req.requestId.length).toBeGreaterThan(0);
    expect(next).toHaveBeenCalled();
  });
});