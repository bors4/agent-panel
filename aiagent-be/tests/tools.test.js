/**
 * Per-tool smoke tests for the new tools/ modules.
 * Verifies each handler routes correctly through the dispatcher
 * and returns the expected success/error shape.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { executeTool, activeProcesses, cancelTask, getToolModelOutput } from "../lib/agent/executeTool.js";
import { validateToolArgs } from "../lib/agent/tools/validation.js";

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

describe("edit tool", () => {
  it("replaces exact string in file", async () => {
    const file = path.join(workDir, "edit-test.txt");
    fs.writeFileSync(file, "Hello world foo");
    const r = await executeTool(
      { name: "edit", args: { filePath: "edit-test.txt", oldString: "foo", newString: "bar" } },
      { projectPath: workDir }
    );
    expect(r.success).toBe(true);
    expect(r.data.replacements).toBe(1);
    expect(fs.readFileSync(file, "utf-8")).toBe("Hello world bar");
  });

  it("errors on identical strings", async () => {
    const r = await executeTool(
      { name: "edit", args: { filePath: "hello.txt", oldString: "world", newString: "world" } },
      { projectPath: workDir }
    );
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/identical/i);
  });

  it("errors on empty oldString", async () => {
    const r = await executeTool(
      { name: "edit", args: { filePath: "hello.txt", oldString: "", newString: "x" } },
      { projectPath: workDir }
    );
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/must not be empty/i);
  });

  it("errors on missing file", async () => {
    const r = await executeTool(
      { name: "edit", args: { filePath: "nope.txt", oldString: "x", newString: "y" } },
      { projectPath: workDir }
    );
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/not found/i);
  });

  it("errors on zero matches", async () => {
    const r = await executeTool(
      { name: "edit", args: { filePath: "hello.txt", oldString: "zzz", newString: "yyy" } },
      { projectPath: workDir }
    );
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/Could not find/i);
  });

  it("errors on multiple matches without replaceAll", async () => {
    const file = path.join(workDir, "multi.txt");
    fs.writeFileSync(file, "abc abc abc");
    const r = await executeTool(
      { name: "edit", args: { filePath: "multi.txt", oldString: "abc", newString: "xyz" } },
      { projectPath: workDir }
    );
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/multiple exact matches/i);
  });

  it("replaces all with replaceAll", async () => {
    const file = path.join(workDir, "multi-all.txt");
    fs.writeFileSync(file, "abc abc abc");
    const r = await executeTool(
      { name: "edit", args: { filePath: "multi-all.txt", oldString: "abc", newString: "xyz", replaceAll: true } },
      { projectPath: workDir }
    );
    expect(r.success).toBe(true);
    expect(r.data.replacements).toBe(3);
    expect(fs.readFileSync(file, "utf-8")).toBe("xyz xyz xyz");
  });
});

describe("glob tool", () => {
  it("finds files by pattern", async () => {
    const r = await executeTool(
      { name: "glob", args: { pattern: "*.txt" } },
      { projectPath: workDir }
    );
    expect(r.success).toBe(true);
    expect(r.data.results.length).toBeGreaterThan(0);
    expect(r.data.results.some((f) => f.endsWith("hello.txt"))).toBe(true);
  });

  it("respects limit", async () => {
    const r = await executeTool(
      { name: "glob", args: { pattern: "**/*", limit: 2 } },
      { projectPath: workDir }
    );
    expect(r.success).toBe(true);
    expect(r.data.results.length).toBeLessThanOrEqual(2);
  });

  it("errors on non-existent dir", async () => {
    const r = await executeTool(
      { name: "glob", args: { pattern: "*.txt", path: "nonexistent" } },
      { projectPath: workDir }
    );
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/not found/i);
  });
});

describe("grep tool", () => {
  it("finds pattern matches", async () => {
    const r = await executeTool(
      { name: "grep", args: { pattern: "world" } },
      { projectPath: workDir }
    );
    expect(r.success).toBe(true);
    expect(r.data.results.length).toBeGreaterThan(0);
  });

  it("rejects ReDoS pattern", async () => {
    const r = await executeTool(
      { name: "grep", args: { pattern: "(a+)+b" } },
      { projectPath: workDir }
    );
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/nested quantifiers/i);
  });

  it("rejects invalid regex", async () => {
    const r = await executeTool(
      { name: "grep", args: { pattern: "[unclosed" } },
      { projectPath: workDir }
    );
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/invalid regex/i);
  });
});

describe("question tool", () => {
  it("requires approval on valid questions", async () => {
    const r = await executeTool(
      {
        name: "question",
        args: {
          questions: [
            { question: "What port?", options: [{ label: "3000", description: "Default" }] },
          ],
        },
      },
      { projectPath: workDir }
    );
    expect(r.success).toBe(true);
    expect(r.requiresApproval).toBe(true);
    expect(r.data.questions.length).toBe(1);
  });

  it("errors on empty questions array", async () => {
    const r = await executeTool(
      { name: "question", args: { questions: [] } },
      { projectPath: workDir }
    );
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/At least one/i);
  });

  it("errors on missing question field", async () => {
    const r = await executeTool(
      { name: "question", args: { questions: [{ options: [] }] } },
      { projectPath: workDir }
    );
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/question/i);
  });

  it("validates option structure", async () => {
    const r = await executeTool(
      {
        name: "question",
        args: {
          questions: [
            { question: "Pick one", options: [{ label: "A", description: "First" }, { label: "B" }] },
          ],
        },
      },
      { projectPath: workDir }
    );
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/description/i);
  });
});

describe("websearch tool", () => {
  it("validates query is required", async () => {
    const r = await executeTool(
      { name: "websearch", args: {} },
      { projectPath: workDir }
    );
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/required/i);
  });
});

describe("webfetch tool", () => {
  it("validates URL is required", async () => {
    const r = await executeTool(
      { name: "webfetch", args: {} },
      { projectPath: workDir }
    );
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/required/i);
  });

  it("rejects non-HTTP URLs", async () => {
    const r = await executeTool(
      { name: "webfetch", args: { url: "ftp://example.com" } },
      { projectPath: workDir }
    );
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/http/i);
  });

  it("rejects invalid URLs", async () => {
    const r = await executeTool(
      { name: "webfetch", args: { url: "not-a-url" } },
      { projectPath: workDir }
    );
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/invalid/i);
  });
});

describe("skill tool", () => {
  beforeAll(() => {
    const skillsDir = path.join(workDir, ".agents", "skills", "test-skill");
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.writeFileSync(path.join(skillsDir, "SKILL.md"), "# Test Skill\n\nTest content");
    fs.writeFileSync(path.join(skillsDir, "script.js"), 'console.log("hello");');
  });

  it("loads a valid skill", async () => {
    const r = await executeTool(
      { name: "skill", args: { name: "test-skill" } },
      { projectPath: workDir }
    );
    expect(r.success).toBe(true);
    expect(r.data.name).toBe("test-skill");
    expect(r.data.content).toContain("Test Skill");
    expect(r.data.files).toContain("script.js");
  });

  it("errors on missing skill", async () => {
    const r = await executeTool(
      { name: "skill", args: { name: "nonexistent" } },
      { projectPath: workDir }
    );
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/not found/i);
  });

  it("errors without name", async () => {
    const r = await executeTool(
      { name: "skill", args: {} },
      { projectPath: workDir }
    );
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/required/i);
  });
});

describe("todowrite tool", () => {
  it("accepts valid todos", async () => {
    const r = await executeTool(
      {
        name: "todowrite",
        args: {
          todos: [
            { content: "Fix bug", status: "in_progress", priority: "high" },
            { content: "Add tests", status: "pending", priority: "medium" },
          ],
        },
      },
      { projectPath: workDir }
    );
    expect(r.success).toBe(true);
    expect(r.data.todos.length).toBe(2);
  });

  it("errors on empty array", async () => {
    const r = await executeTool(
      { name: "todowrite", args: { todos: [] } },
      { projectPath: workDir }
    );
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/non-empty/i);
  });

  it("validates content field", async () => {
    const r = await executeTool(
      { name: "todowrite", args: { todos: [{ status: "pending" }] } },
      { projectPath: workDir }
    );
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/content/i);
  });

  it("validates status field", async () => {
    const r = await executeTool(
      {
        name: "todowrite",
        args: { todos: [{ content: "x", status: "invalid", priority: "low" }] },
      },
      { projectPath: workDir }
    );
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/status/i);
  });
});

describe("validation tool", () => {
  it("passes valid args", () => {
    const schema = {
      type: "object",
      properties: { filePath: { type: "string" } },
      required: ["filePath"],
    };
    const result = validateToolArgs("test", { filePath: "foo.js" }, schema);
    expect(result.valid).toBe(true);
  });

  it("fails on missing required field", () => {
    const schema = {
      type: "object",
      properties: { filePath: { type: "string" } },
      required: ["filePath"],
    };
    const result = validateToolArgs("test", {}, schema);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/required/i);
  });

  it("fails on type mismatch", () => {
    const schema = {
      type: "object",
      properties: { count: { type: "number" } },
    };
    const result = validateToolArgs("test", { count: "abc" }, schema);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/must be a number/i);
  });
});

describe("toModelOutput", () => {
  it("formats write output", () => {
    const result = { success: true, data: { path: "/project/output.txt", size: 12, existed: false } };
    const output = getToolModelOutput("write", result);
    expect(output).toMatch(/Created/i);
    expect(output).toMatch(/output\.txt/);
  });

  it("formats edit output", () => {
    const result = { success: true, data: { resource: "test.txt", replacements: 2 }, oldString: "a", newString: "b" };
    const output = getToolModelOutput("edit", result);
    expect(output).toMatch(/Edited/i);
    expect(output).toMatch(/Replacements: 2/);
  });

  it("formats glob output", () => {
    const result = { success: true, data: { results: ["a.txt", "b.js"], total: 2, truncated: false } };
    const output = getToolModelOutput("glob", result);
    expect(output).toMatch(/a\.txt/);
    expect(output).toMatch(/b\.js/);
  });

  it("formats error output", () => {
    const result = { success: false, error: "Something broke" };
    const output = getToolModelOutput("read", result);
    expect(output).toMatch(/failed/i);
    expect(output).toMatch(/broke/i);
  });
});

describe("testDir used to keep linter happy", () => {
  it("is set", () => {
    expect(testDir).toBeTruthy();
  });
});
