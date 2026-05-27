/**
 * Unit-тесты для критических путей бэкенда.
 * Covers: safePath, parseToolCall, executeTool, session, logger
 */

import fs from "fs";
import path from "path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { safePath, parseToolCall } from "../lib/utils.js";
import { executeTool, getToolConfig, updateToolConfig, TOOLS, DEFAULT_TOOL_CONFIG } from "../lib/agent/executeTool.js";
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
  // Normalize an expected path for the current platform
  const normalize = (p) => path.resolve(p).replace(/\\/g, "/");

  it("allows relative paths within project", () => {
    expect(safePath("src/index.js", projectRoot)).toBe(normalize("/home/user/project/src/index.js"));
  });

  it("allows nested relative paths", () => {
    expect(safePath("src/components/Button.vue", projectRoot)).toBe(
      normalize("/home/user/project/src/components/Button.vue")
    );
  });

  it("rejects path traversal with ../", () => {
    expect(() => safePath("../../../etc/passwd", projectRoot)).toThrow("Path outside project is forbidden");
  });

  it("rejects absolute paths outside project", () => {
    expect(() => safePath("/etc/passwd", projectRoot)).toThrow("Path outside project is forbidden");
  });

  it("allows absolute paths within project", () => {
    expect(safePath("/home/user/project/src/file.js", projectRoot)).toBe(normalize("/home/user/project/src/file.js"));
  });

  it("normalizes Windows-style backslashes in input", () => {
    // Use real backslash chars, not JS escape sequences
    const backslashPath = ["src", "nested", "file.js"].join(path.sep);
    const result = safePath(backslashPath, projectRoot);
    expect(result.replace(/\\/g, "/")).toBe(normalize("/home/user/project/src/nested/file.js"));
  });

  it("handles dot-prefix paths", () => {
    expect(safePath("./src/file.js", projectRoot)).toBe(normalize("/home/user/project/src/file.js"));
  });

  it("rejects null-byte injection", () => {
    expect(() => safePath("src/file.js\0evil", projectRoot)).toThrow("null bytes");
  });

  it("handles empty string path", () => {
    expect(safePath("", projectRoot)).toBe(normalize("/home/user/project"));
  });

  // ── Windows-specific tests (skip on Unix) ─────────────────────────
  describe("Windows paths", () => {
    const isWin = process.platform === "win32";

    it("handles trailing backslash in projectRoot", () => {
      if (!isWin) return;
      const rootWithSlash = "E:\\Git\\agent-panel\\";
      const result = safePath("src", rootWithSlash);
      expect(result.replace(/\\/g, "/")).toContain("agent-panel/src");
    });

    it("handles mixed slashes in projectRoot", () => {
      if (!isWin) return;
      const mixedRoot = "E:/Git\\agent-panel";
      const result = safePath("src/file.js", mixedRoot);
      const normalized = result.replace(/\\/g, "/").toLowerCase();
      expect(normalized).toContain("agent-panel/src/file.js");
    });

    it("handles Windows drive-letter projectRoot", () => {
      if (!isWin) return;
      const winRoot = "E:\\Git\\agent-panel";
      const result = safePath("src/index.js", winRoot);
      expect(result.replace(/\\/g, "/")).toContain("agent-panel/src/index.js");
    });

    it("allows relative '.' path with Windows root", () => {
      if (!isWin) return;
      const winRoot = "E:\\Git\\agent-panel";
      const result = safePath(".", winRoot);
      expect(result.replace(/\\/g, "/")).toContain("agent-panel");
    });

    it("allows './src' path with Windows root", () => {
      if (!isWin) return;
      const winRoot = "E:\\Git\\agent-panel";
      const result = safePath("./src", winRoot);
      expect(result.replace(/\\/g, "/")).toContain("agent-panel/src");
    });

    it("blocks '../' outside Windows project root", () => {
      if (!isWin) return;
      const winRoot = "E:\\Git\\agent-panel";
      expect(() => safePath("..", winRoot)).toThrow("Path outside project is forbidden");
    });

    it("blocks path traversal to completely different drive", () => {
      if (!isWin) return;
      const winRoot = "E:\\Git\\agent-panel";
      expect(() => safePath("C:\\Windows\\system32", winRoot)).toThrow("Path outside project is forbidden");
    });

    it("allows path with drive-root projectRoot", () => {
      if (!isWin) return;
      const result = safePath("test/file.js", "E:\\");
      expect(result.replace(/\\/g, "/").toLowerCase()).toBe("e:/test/file.js");
    });
  });

  // ── Additional edge cases ─────────────────────────────────────────
  it("blocks absolute path outside Unix project", () => {
    expect(() => safePath("/etc/passwd", "/home/user/project")).toThrow("Path outside project is forbidden");
  });

  it("allows absolute path inside Unix project", () => {
    const result = safePath("/home/user/project/src/file.js", "/home/user/project");
    expect(result.replace(/\\/g, "/")).toBe(path.resolve("/home/user/project/src/file.js").replace(/\\/g, "/"));
  });

  it("handles deeply nested relative path", () => {
    expect(safePath("a/b/c/d/e.js", projectRoot)).toBe(normalize("/home/user/project/a/b/c/d/e.js"));
  });
});

// ═════════════════════════════════════════════════════════════════
// parseToolCall
// ═════════════════════════════════════════════════════════════════
describe("parseToolCall", () => {
  it("parses JSON tool call with arguments field", () => {
    const result = parseToolCall('{"name":"write","arguments":{"filePath":"a.txt","content":"hi"}}');
    expect(result).toEqual({
      name: "write",
      args: { filePath: "a.txt", content: "hi" },
      id: expect.any(String),
    });
  });

  it("parses nested JSON objects correctly", () => {
    const result = parseToolCall('{"name":"search","arguments":{"filter":{"type":"file"},"pattern":"TODO"}}');
    expect(result).toEqual({
      name: "search",
      args: { filter: { type: "file" }, pattern: "TODO" },
      id: expect.any(String),
    });
  });

  it("parses <tool> JSON format", () => {
    const result = parseToolCall('<tool>{"name":"delete","args":{"path":"old.js"}}</tool>');
    expect(result).toEqual({
      name: "delete",
      args: { path: "old.js" },
      id: expect.any(String),
    });
  });

  it("handles whitespace variations", () => {
    const result = parseToolCall(' {"name":"search","args":{"pattern":"TODO"}} ');
    expect(result).toEqual({
      name: "search",
      args: { pattern: "TODO" },
      id: expect.any(String),
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
    const result = await executeTool({ name: "read", args: { filePath: "test.txt" } }, { projectPath: testDir });
    expect(result.success).toBe(true);
    expect(result.data.content).toBe("hello world");
  });

  it("returns error for non-existent file", async () => {
    const result = await executeTool({ name: "read", args: { filePath: "nonexistent.txt" } }, { projectPath: testDir });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("creates and writes a new file", async () => {
    const result = await executeTool(
      { name: "write", args: { filePath: "new.txt", content: "test content" } },
      { projectPath: testDir }
    );
    expect(result.success).toBe(true);
    expect(fs.readFileSync(path.join(testDir, "new.txt"), "utf-8")).toBe("test content");
  });

  it("creates parent directories if needed", async () => {
    const result = await executeTool(
      { name: "write", args: { filePath: "deep/nested/file.txt", content: "nested" } },
      { projectPath: testDir }
    );
    expect(result.success).toBe(true);
    expect(fs.readFileSync(path.join(testDir, "deep/nested/file.txt"), "utf-8")).toBe("nested");
  });

  it("lists directory contents", async () => {
    fs.mkdirSync(path.join(testDir, "subdir"), { recursive: true });
    fs.writeFileSync(path.join(testDir, "file1.txt"), "a");
    fs.writeFileSync(path.join(testDir, "subdir", "file2.txt"), "b");

    const result = await executeTool({ name: "list_dir", args: { path: ".", depth: 2 } }, { projectPath: testDir });
    expect(result.success).toBe(true);
    expect(result.data.tree).toBeInstanceOf(Array);
    expect(result.data.tree.length).toBeGreaterThan(0);
  });

  it("rejects paths outside project", async () => {
    const result = await executeTool({ name: "read", args: { filePath: "/etc/passwd" } }, { projectPath: testDir });
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
    const result = await executeTool({ name: "nonexistent_tool", args: {} }, { projectPath: testDir });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Unknown tool");
  });
});

// ═════════════════════════════════════════════════════════════════
// getToolConfig / updateToolConfig
// ═════════════════════════════════════════════════════════════════
describe("toolConfig", () => {
  beforeEach(() => {
    // Reset toolConfig to defaults before each test
    for (const name of Object.keys(TOOLS)) {
      updateToolConfig(name, { ...DEFAULT_TOOL_CONFIG });
    }
  });

  it("getToolConfig returns all 9 tools with schema fields", () => {
    const config = getToolConfig();
    const names = Object.keys(config);
    expect(names).toContain("read");
    expect(names).toContain("write");
    expect(names).toContain("search");
    expect(names).toContain("list_dir");
    expect(names).toContain("execute");
    expect(names).toContain("create_dir");
    expect(names).toContain("delete");
    expect(names).toContain("move");
    expect(names).toContain("copy");
    expect(names.length).toBe(9);
  });

  it("each tool config includes input_schema, description, category, examples", () => {
    const config = getToolConfig();
    for (const [name, tool] of Object.entries(config)) {
      expect(tool).toHaveProperty("name", name);
      expect(tool).toHaveProperty("description");
      expect(tool).toHaveProperty("category");
      expect(tool).toHaveProperty("examples");
      expect(tool).toHaveProperty("input_schema");
      expect(tool).toHaveProperty("enabled", true);
      expect(tool).toHaveProperty("permission", "ask");
      expect(tool).toHaveProperty("exclude_paths");
      expect(Array.isArray(tool.exclude_paths)).toBe(true);
    }
  });

  it("updateToolConfig overrides enabled and permission", () => {
    updateToolConfig("read", { enabled: false, permission: "deny" });
    const config = getToolConfig();
    expect(config.read.enabled).toBe(false);
    expect(config.read.permission).toBe("deny");
    // Schema fields unchanged
    expect(config.read.description).toBeTruthy();
    expect(config.read.input_schema).toBeTruthy();
  });

  it("updateToolConfig merges exclude_paths", () => {
    updateToolConfig("write", { exclude_paths: ["node_modules", ".git"] });
    const config = getToolConfig();
    expect(config.write.exclude_paths).toContain("node_modules");
    expect(config.write.exclude_paths).toContain(".git");
    expect(config.write.exclude_paths.length).toBe(2);
  });

  it("updateToolConfig does not affect other tools", () => {
    updateToolConfig("delete", { enabled: false });
    const config = getToolConfig();
    expect(config.delete.enabled).toBe(false);
    expect(config.read.enabled).toBe(true);
    expect(config.write.enabled).toBe(true);
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
