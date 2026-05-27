import { describe, it, expect } from "vitest";
import { formatValue } from "../lib/agent/executeTool.js";

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
