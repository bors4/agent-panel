/**
 * Тесты для sanitizeTelegramHtml() — Telegram HTML allowlist.
 *
 * Защита от регрессии:
 * - Whitelist-фильтр сохраняет только разрешённые теги: b, i, u, s, code, pre,
 *   tg-spoiler, a, strong, em, blockquote
 * - Всё остальное (включая произвольные <script>, <iframe>, ...), а также
 *   атрибуты disallowed-тегов экранируются в HTML-сущности
 * - <blockquote> (в т.ч. <blockquote expandable>) нужен для размышлений агента
 */

import { describe, it, expect } from "vitest";
import { sanitizeTelegramHtml } from "../lib/telegram/reply.js";

describe("sanitizeTelegramHtml", () => {
  describe("allowed tags (preserved as-is)", () => {
    it.each([
      ["<b>bold</b>", "<b>bold</b>"],
      ["<i>italic</i>", "<i>italic</i>"],
      ["<u>under</u>", "<u>under</u>"],
      ["<s>strike</s>", "<s>strike</s>"],
      ["<code>x</code>", "<code>x</code>"],
      ["<pre>block</pre>", "<pre>block</pre>"],
      ["<tg-spoiler>hidden</tg-spoiler>", "<tg-spoiler>hidden</tg-spoiler>"],
      ['<a href="https://x.io">link</a>', '<a href="https://x.io">link</a>'],
      ["<strong>x</strong>", "<strong>x</strong>"],
      ["<em>x</em>", "<em>x</em>"],
      ["<blockquote>x</blockquote>", "<blockquote>x</blockquote>"],
      ["<blockquote expandable>x</blockquote>", "<blockquote expandable>x</blockquote>"],
    ])("preserves %s", (input, expected) => {
      expect(sanitizeTelegramHtml(input)).toBe(expected);
    });
  });

  describe("disallowed tags (escaped to entities)", () => {
    it.each([
      ["<script>alert(1)</script>", "&lt;script&gt;alert(1)&lt;/script&gt;"],
      ["<iframe src='x'></iframe>", "&lt;iframe src='x'&gt;&lt;/iframe&gt;"],
      ["<details>x</details>", "&lt;details&gt;x&lt;/details&gt;"],
      ["<style>p{}</style>", "&lt;style&gt;p{}&lt;/style&gt;"],
      ["<img src=x>", "&lt;img src=x&gt;"],
      ["<unknown>x</unknown>", "&lt;unknown&gt;x&lt;/unknown&gt;"],
    ])("escapes %s", (input, expected) => {
      expect(sanitizeTelegramHtml(input)).toBe(expected);
    });
  });

  it("handles mixed content: keeps allowed tags, escapes the rest", () => {
    const input = "<b>💭 Reasoning</b>:\n<blockquote expandable>inner <b>bold</b> & <script>x</script></blockquote>";
    const output = sanitizeTelegramHtml(input);
    expect(output).toContain("<b>💭 Reasoning</b>");
    expect(output).toContain("<blockquote expandable>");
    expect(output).toContain("&lt;script&gt;x&lt;/script&gt;");
    expect(output).toContain("</blockquote>");
  });

  it("is case-insensitive for tag matching", () => {
    expect(sanitizeTelegramHtml("<B>x</B>")).toBe("<B>x</B>");
    expect(sanitizeTelegramHtml("<BlockQuote>x</BlockQuote>")).toBe("<BlockQuote>x</BlockQuote>");
  });

  it("leaves bare '<' and '>' (not in a tag) unchanged — only <tagname...> is escaped", () => {
    // Limitation: only complete tag syntax is escaped. Bare '<' / '>' pass through.
    // The reasoning embed path pre-escapes '<' before sanitization to avoid this.
    expect(sanitizeTelegramHtml("a < b > c")).toBe("a < b > c");
  });
});
