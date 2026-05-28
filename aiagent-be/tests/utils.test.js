import fs from "fs";
import path from "path";
import os from "os";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { safePath, parseToolCall } from "../lib/utils.js";

describe("safePath", () => {
  it("allows paths within project", () => {
    const result = safePath("src/index.js", "E:/Project");
    expect(result).toBe("E:/Project/src/index.js");
  });

  it("rejects paths outside project", () => {
    expect(() => safePath("../../../etc/passwd", "E:/Project")).toThrow("Path outside project");
  });

  it("normalizes path separators", () => {
    const result = safePath("src/nested/file.js", "E:/Project");
    expect(result).toBe("E:/Project/src/nested/file.js");
  });

  it("handles absolute paths within project", () => {
    const result = safePath("E:/Project/src/file.js", "E:/Project");
    expect(result).toBe("E:/Project/src/file.js");
  });

  it("handles nested project paths", () => {
    const result = safePath("src/components/Button.vue", "E:/Project");
    expect(result).toBe("E:/Project/src/components/Button.vue");
  });

  it("rejects path traversal", () => {
    expect(() => safePath("src/../../../etc/passwd", "E:/Project")).toThrow("Path outside project");
  });
});

describe("safePath symlink protection", () => {
  let tmpDir;
  let canSymlink;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "safePath-symlink-"));
    const probe = path.join(tmpDir, "probe");
    try {
      fs.symlinkSync(__filename, probe);
      canSymlink = true;
      fs.unlinkSync(probe);
    } catch {
      canSymlink = false;
    }
  });

  afterAll(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function projectDir(name) {
    const p = path.join(tmpDir, name);
    fs.mkdirSync(p, { recursive: true });
    return p;
  }

  it("blocks symlink pointing outside project", () => {
    if (!canSymlink) return;
    const proj = projectDir("outside-link");
    const outDir = path.join(tmpDir, "outside-dir");
    fs.mkdirSync(outDir, { recursive: true });
    const secret = path.join(outDir, "secret.txt");
    fs.writeFileSync(secret, "data");
    const link = path.join(proj, "evil_link");
    fs.symlinkSync(secret, link);
    expect(() => safePath("evil_link", proj)).toThrow("Path outside project");
  });

  it("allows symlink pointing inside project", () => {
    if (!canSymlink) return;
    const proj = projectDir("inside-link");
    const real = path.join(proj, "real.txt");
    fs.writeFileSync(real, "content");
    const link = path.join(proj, "my_link");
    fs.symlinkSync(real, link);
    const result = safePath("my_link", proj);
    expect(result.replace(/\\/g, "/")).toContain("my_link");
  });

  it("allows non-existent deep path (parent walking)", () => {
    const proj = projectDir("nonexistent");
    const rel = "a/b/c/d/e/file.txt";
    const result = safePath(rel, proj);
    const norm = result.replace(/\\/g, "/");
    expect(norm.startsWith(proj.replace(/\\/g, "/"))).toBe(true);
    expect(norm).toContain(rel);
  });

  it("allows empty path for existing project root", () => {
    const proj = projectDir("empty-path");
    const result = safePath("", proj);
    const norm = result.replace(/\\/g, "/");
    expect(norm.endsWith("empty-path")).toBe(true);
  });
});

describe("parseToolCall", () => {
  it("parses JSON with arguments field", () => {
    const result = parseToolCall(
      '<tool_call>{"name":"write","arguments":{"filePath":"a.txt","content":"hi"}}</tool_call>'
    );
    expect(result).toEqual({
      name: "write",
      args: { filePath: "a.txt", content: "hi" },
      id: expect.any(String),
    });
  });

  it("parses tool tag with args field", () => {
    const result = parseToolCall('<tool>{"name":"delete","args":{"path":"old.js"}}</tool>');
    expect(result).toEqual({
      name: "delete",
      args: { path: "old.js" },
      id: expect.any(String),
    });
  });

  it("handles whitespace variations", () => {
    const result = parseToolCall('<tool_call>{"name":"search","args":{"pattern":"TODO"}}</tool_call>');
    expect(result).toEqual({
      name: "search",
      args: { pattern: "TODO" },
      id: expect.any(String),
    });
  });

  it("returns null for no match", () => {
    expect(parseToolCall("No tool call here")).toBeNull();
  });
});
