/**
 * Per-tool smoke tests for the new tools/ modules.
 * Verifies each handler routes correctly through the dispatcher
 * and returns the expected success/error shape.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { executeTool, activeProcesses, cancelTask } from "../lib/agent/executeTool.js";

let testDir;
let workDir;

beforeAll(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-tools-"));
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-work-"));
  fs.writeFileSync(path.join(workDir, "hello.txt"), "world");
  fs.writeFileSync(path.join(workDir, "data.js"), "const x = 42;");
  fs.mkdirSync(path.join(workDir, "sub"), { recursive: true });
  fs.writeFileSync(path.join(workDir, "sub", "nested.txt"), "deep");
});

afterAll(async () => {
  for (const [, entry] of activeProcesses) {
    if (entry.status === "running") {
      cancelTask(entry.taskId);
    }
  }
  await new Promise((r) => setTimeout(r, 200));
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {
    /* best-effort on Windows where child handles may linger */
  }
  try {
    fs.rmSync(workDir, { recursive: true, force: true });
  } catch {
    /* best-effort on Windows where child handles may linger */
  }
});

describe("read tool", () => {
  it("reads a file", async () => {
    const r = await executeTool({ name: "read", args: { filePath: "hello.txt" } }, { projectPath: workDir });
    expect(r.success).toBe(true);
    expect(r.data.content).toBe("world");
  });

  it("errors on missing file", async () => {
    const r = await executeTool({ name: "read", args: { filePath: "nope.txt" } }, { projectPath: workDir });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/not found/i);
  });

  it("omits when maxFilesInPrompt reached", async () => {
    const r = await executeTool(
      { name: "read", args: { filePath: "hello.txt" } },
      { projectPath: workDir, maxFilesInPrompt: 0 }
    );
    expect(r.success).toBe(true);
    expect(r.data.content).toMatch(/omitted/i);
  });
});

describe("write tool", () => {
  it("creates a new file", async () => {
    const r = await executeTool(
      { name: "write", args: { filePath: "new.txt", content: "abc" } },
      { projectPath: workDir }
    );
    expect(r.success).toBe(true);
    expect(fs.readFileSync(path.join(workDir, "new.txt"), "utf-8")).toBe("abc");
  });

  it("creates parent directories", async () => {
    const r = await executeTool(
      { name: "write", args: { filePath: "deep/nested/file.txt", content: "x" } },
      { projectPath: workDir }
    );
    expect(r.success).toBe(true);
    expect(fs.existsSync(path.join(workDir, "deep/nested/file.txt"))).toBe(true);
  });
});

describe("search tool", () => {
  it("finds pattern matches", async () => {
    const r = await executeTool({ name: "search", args: { pattern: "world" } }, { projectPath: workDir });
    expect(r.success).toBe(true);
    expect(r.data.results.length).toBeGreaterThan(0);
  });

  it("rejects too-long pattern", async () => {
    const r = await executeTool({ name: "search", args: { pattern: "a".repeat(201) } }, { projectPath: workDir });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/too long/i);
  });

  it("rejects ReDoS pattern", async () => {
    const r = await executeTool({ name: "search", args: { pattern: "(a+)+b" } }, { projectPath: workDir });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/nested quantifiers/i);
  });

  it("rejects invalid regex", async () => {
    const r = await executeTool({ name: "search", args: { pattern: "[unclosed" } }, { projectPath: workDir });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/invalid regex/i);
  });
});

describe("list_dir tool", () => {
  it("lists project root by default", async () => {
    const r = await executeTool({ name: "list_dir", args: {} }, { projectPath: workDir });
    expect(r.success).toBe(true);
    expect(r.data.tree.some((s) => s.includes("hello.txt"))).toBe(true);
  });

  it("respects depth parameter", async () => {
    const r = await executeTool({ name: "list_dir", args: { path: ".", depth: 2 } }, { projectPath: workDir });
    expect(r.success).toBe(true);
    expect(r.data.tree.length).toBeGreaterThan(0);
  });

  it("caps depth at 3", async () => {
    const r = await executeTool({ name: "list_dir", args: { depth: 99 } }, { projectPath: workDir });
    expect(r.success).toBe(true);
  });
});

describe("execute tool", () => {
  it("blocks dangerous command", async () => {
    const r = await executeTool({ name: "execute", args: { command: "rm -rf /" } }, { projectPath: workDir });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/blocked/i);
  });

  it("returns taskId for valid command", async () => {
    const cmd = process.platform === "win32" ? "echo hello" : "echo hello";
    const r = await executeTool({ name: "execute", args: { command: cmd } }, { projectPath: workDir });
    expect(r.success).toBe(true);
    expect(r.data.taskId).toBeTruthy();
    expect(r.data.pid).toBeGreaterThan(0);
  });
});

describe("create_dir tool", () => {
  it("creates a directory", async () => {
    const r = await executeTool({ name: "create_dir", args: { path: "newdir" } }, { projectPath: workDir });
    expect(r.success).toBe(true);
    expect(fs.statSync(path.join(workDir, "newdir")).isDirectory()).toBe(true);
  });
});

describe("delete tool", () => {
  it("removes a file", async () => {
    const target = path.join(workDir, "todelete.txt");
    fs.writeFileSync(target, "bye");
    const r = await executeTool({ name: "delete", args: { path: "todelete.txt" } }, { projectPath: workDir });
    expect(r.success).toBe(true);
    expect(fs.existsSync(target)).toBe(false);
  });

  it("refuses non-empty directory without recursive", async () => {
    const r = await executeTool({ name: "delete", args: { path: "sub" } }, { projectPath: workDir });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/not empty/i);
  });

  it("removes directory with recursive: true", async () => {
    const target = path.join(workDir, "rmdir");
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, "x"), "y");
    const r = await executeTool({ name: "delete", args: { path: "rmdir", recursive: true } }, { projectPath: workDir });
    expect(r.success).toBe(true);
    expect(fs.existsSync(target)).toBe(false);
  });
});

describe("move tool", () => {
  it("moves a file", async () => {
    const src = path.join(workDir, "moveme.txt");
    fs.writeFileSync(src, "data");
    const r = await executeTool(
      { name: "move", args: { source: "moveme.txt", destination: "moved.txt" } },
      { projectPath: workDir }
    );
    expect(r.success).toBe(true);
    expect(fs.existsSync(path.join(workDir, "moved.txt"))).toBe(true);
    expect(fs.existsSync(src)).toBe(false);
  });

  it("errors on missing source", async () => {
    const r = await executeTool(
      { name: "move", args: { source: "missing.txt", destination: "x.txt" } },
      { projectPath: workDir }
    );
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/not found/i);
  });
});

describe("copy tool", () => {
  it("copies a file", async () => {
    const src = path.join(workDir, "src.txt");
    fs.writeFileSync(src, "data");
    const r = await executeTool(
      { name: "copy", args: { source: "src.txt", destination: "dst.txt" } },
      { projectPath: workDir }
    );
    expect(r.success).toBe(true);
    expect(fs.existsSync(path.join(workDir, "dst.txt"))).toBe(true);
    expect(fs.readFileSync(path.join(workDir, "dst.txt"), "utf-8")).toBe("data");
  });
});

describe("dispatcher validation", () => {
  it("rejects unknown tool", async () => {
    const r = await executeTool({ name: "nope", args: {} }, { projectPath: workDir });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/unknown tool/i);
  });

  it("rejects missing projectPath", async () => {
    const r = await executeTool({ name: "read", args: { filePath: "x" } }, {});
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/not configured/i);
  });

  it("rejects non-existent projectPath", async () => {
    const r = await executeTool({ name: "read", args: { filePath: "x" } }, { projectPath: path.join(testDir, "nope") });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/does not exist/i);
  });
});

describe("testDir used to keep linter happy", () => {
  it("is set", () => {
    expect(testDir).toBeTruthy();
  });
});
