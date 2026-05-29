import { describe, it, expect } from "vitest";
import { formatValue, rejectReDoS, sanitizeCommand } from "../lib/agent/executeTool.js";

describe("formatValue", () => {
  it("formats null/undefined as N/A", () => {
    expect(formatValue(null)).toBe("N/A");
    expect(formatValue(undefined)).toBe("N/A");
  });

  it("formats primitives as themselves", () => {
    expect(formatValue("hello")).toBe("hello");
    expect(formatValue(42)).toBe(42);
    expect(formatValue(true)).toBe(true);
  });

  it("formats file/directory objects", () => {
    expect(formatValue({ name: "file.txt", type: "file" })).toBe("📄 file.txt");
    expect(formatValue({ name: "dir", isDirectory: true })).toBe("📁 dir");
  });

  it("formats arrays with depth limit", () => {
    const arr = ["a", "b", "c"];
    const result = formatValue(arr);
    expect(result).toBe("a\n  b\n  c");
  });

  it("returns item count for deeply nested arrays", () => {
    const arr = [[[["deep"]]]];
    const result = formatValue(arr);
    expect(result).toContain("[1 items]");
  });

  it("formats object entries", () => {
    const obj = { foo: "bar", num: 123 };
    const result = formatValue(obj);
    expect(result).toContain("foo");
    expect(result).toContain("bar");
    expect(result).toContain("num");
  });

  it("handles circular reference in object", () => {
    const obj = { name: "parent" };
    obj.self = obj;
    const result = formatValue(obj);
    expect(result).toContain("[Circular]");
  });

  it("handles circular reference in array", () => {
    const arr = [1, 2, 3];
    arr.push(arr);
    const result = formatValue(arr);
    expect(result).toContain("[Circular]");
  });

  it("handles two objects referencing each other (mutual cycle)", () => {
    const a = { name: "A" };
    const b = { name: "B" };
    a.ref = b;
    b.ref = a;
    const result = formatValue(a);
    expect(result).toContain("[Circular]");
  });
});

describe("rejectReDoS", () => {
  it("rejects (a+)+b", () => {
    expect(rejectReDoS("(a+)+b")).toBe(true);
  });

  it("rejects (a*)*", () => {
    expect(rejectReDoS("(a*)*")).toBe(true);
  });

  it("rejects ((a+)+)+ three-level nesting", () => {
    expect(rejectReDoS("((a+)+)+")).toBe(true);
  });

  it("rejects (a+)?b with optional outer quantifier", () => {
    expect(rejectReDoS("(a+)?b")).toBe(true);
  });

  it("rejects (a+){2,}b with range outer quantifier", () => {
    expect(rejectReDoS("(a+){2,}b")).toBe(true);
  });

  it("rejects ((b+))+ with propagated inner quantifier", () => {
    expect(rejectReDoS("((b+))+")).toBe(true);
  });

  it("rejects (?:a+)+b non-capturing group", () => {
    expect(rejectReDoS("(?:a+)+b")).toBe(true);
  });

  it("allows simple text TODO", () => {
    expect(rejectReDoS("TODO")).toBe(false);
  });

  it("allows (a|b)+c single-level alternation", () => {
    expect(rejectReDoS("(a|b)+c")).toBe(false);
  });

  it("allows (foo|bar) without outer quantifier", () => {
    expect(rejectReDoS("(foo|bar)")).toBe(false);
  });

  it("allows (a|b)? optional group without inner quantifier", () => {
    expect(rejectReDoS("(a|b)?")).toBe(false);
  });

  it("allows [a-z]+ char class", () => {
    expect(rejectReDoS("[a-z]+")).toBe(false);
  });

  it("allows .* simple star", () => {
    expect(rejectReDoS(".*")).toBe(false);
  });

  it("allows (a+)(b+) separate groups", () => {
    expect(rejectReDoS("(a+)(b+)")).toBe(false);
  });

  it("allows empty string", () => {
    expect(rejectReDoS("")).toBe(false);
  });
});

describe("sanitizeCommand", () => {
  it("allows simple commands", () => {
    expect(sanitizeCommand("echo hello").blocked).toBe(false);
    expect(sanitizeCommand("ls -la").blocked).toBe(false);
    expect(sanitizeCommand("cat file.txt").blocked).toBe(false);
    expect(sanitizeCommand("npm install").blocked).toBe(false);
    expect(sanitizeCommand("git status").blocked).toBe(false);
  });

  it("blocks semicolon chaining", () => {
    expect(sanitizeCommand("echo hello; rm -rf /").blocked).toBe(true);
    expect(sanitizeCommand("echo hello; cat /etc/passwd").blocked).toBe(true);
  });

  it("blocks && chaining", () => {
    expect(sanitizeCommand("echo hello && rm -rf /").blocked).toBe(true);
    expect(sanitizeCommand("npm install && rm -rf /").blocked).toBe(true);
  });

  it("blocks pipe", () => {
    expect(sanitizeCommand("echo hello | grep test").blocked).toBe(true);
    expect(sanitizeCommand("cat file | head -5").blocked).toBe(true);
  });

  it("blocks $() subshell", () => {
    expect(sanitizeCommand("echo $(whoami)").blocked).toBe(true);
    expect(sanitizeCommand("echo $(cat /etc/passwd)").blocked).toBe(true);
  });

  it("blocks backtick subshell", () => {
    expect(sanitizeCommand("echo `whoami`").blocked).toBe(true);
    expect(sanitizeCommand("echo `cat /etc/passwd`").blocked).toBe(true);
  });

  it("blocks redirect", () => {
    expect(sanitizeCommand("echo test > file.txt").blocked).toBe(true);
    expect(sanitizeCommand("echo test >> file.txt").blocked).toBe(true);
  });

  it("blocks input redirect", () => {
    expect(sanitizeCommand("cat < /etc/passwd").blocked).toBe(true);
  });

  it("blocks rm -rf /", () => {
    expect(sanitizeCommand("rm -rf /").blocked).toBe(true);
    expect(sanitizeCommand("rm -rf ~").blocked).toBe(true);
    expect(sanitizeCommand("rm -rf /home").blocked).toBe(true);
  });

  it("blocks Windows dangerous commands", () => {
    expect(sanitizeCommand("del /f /s /q").blocked).toBe(true);
    expect(sanitizeCommand("format C:").blocked).toBe(true);
  });

  it("blocks system power commands", () => {
    expect(sanitizeCommand("shutdown -r now").blocked).toBe(true);
    expect(sanitizeCommand("reboot").blocked).toBe(true);
    expect(sanitizeCommand("halt").blocked).toBe(true);
    expect(sanitizeCommand("poweroff").blocked).toBe(true);
  });

  it("blocks disk write commands", () => {
    expect(sanitizeCommand("mkfs /dev/sda").blocked).toBe(true);
    expect(sanitizeCommand("dd if=/dev/zero of=/dev/sda").blocked).toBe(true);
  });

  it("blocks fork bomb", () => {
    expect(sanitizeCommand(":(){ :|:& };:").blocked).toBe(true);
  });
});
