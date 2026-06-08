import { logWarn } from "../../logger.js";

const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const DEFAULT_TIMEOUT_SECONDS = 30;
const MAX_TIMEOUT_SECONDS = 120;

function stripHtml(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export async function webfetch(args) {
  const url = args.url;
  if (!url) {
    return { success: false, error: "URL is required" };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return { success: false, error: "URL must use http:// or https://" };
    }
  } catch {
    return { success: false, error: "Invalid URL" };
  }

  const format = args.format || "markdown";
  const timeout = Math.min(args.timeout || DEFAULT_TIMEOUT_SECONDS, MAX_TIMEOUT_SECONDS);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout * 1000);

    let response;
    try {
      response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: format === "html"
            ? "text/html,application/xhtml+xml"
            : format === "text"
              ? "text/plain,text/html"
              : "text/html,text/markdown,text/plain",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      return { success: false, error: `Fetch failed: HTTP ${response.status}` };
    }

    const contentType = response.headers.get("content-type") || "";
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_BYTES) {
      return { success: false, error: "Response too large" };
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_RESPONSE_BYTES) {
      return { success: false, error: "Response too large" };
    }

    let text = new TextDecoder().decode(buffer);
    let output = text;
    const mime = contentType.split(";")[0]?.trim().toLowerCase() || "";

    if (mime && !mime.startsWith("text/") && mime !== "application/json" && !mime.endsWith("+json") && mime !== "application/xml" && !mime.endsWith("+xml")) {
      return { success: false, error: `Unsupported content type: ${mime}` };
    }

    if (mime.includes("text/html")) {
      if (format === "markdown") {
        const { default: TurndownService } = await import("turndown");
        const turndown = new TurndownService({
          headingStyle: "atx",
          hr: "---",
          bulletListMarker: "-",
          codeBlockStyle: "fenced",
          emDelimiter: "*",
        });
        turndown.remove(["script", "style", "meta", "link"]);
        output = turndown.turndown(text);
      } else if (format === "text") {
        output = stripHtml(text);
      }
    }

    return {
      success: true,
      data: { url, contentType, format, content: output, size: buffer.byteLength },
    };
  } catch (e) {
    if (e.name === "AbortError") {
      return { success: false, error: "Request timed out" };
    }
    logWarn(`[webfetch] Error fetching ${url}: ${e.message}`);
    return { success: false, error: `Fetch failed: ${e.message}` };
  }
}

export function toModelOutput(result) {
  if (!result.success) return `Fetch failed: ${result.error}`;
  const total = result.data.content.length;
  if (total <= 3000) return result.data.content;
  const head = result.data.content.slice(0, 1500);
  const tail = result.data.content.slice(-500);
  return `${head}\n\n[... ${total - 2000} chars omitted. Total content: ${total} chars. Use webfetch again with a more specific URL or use search/filter patterns to find what you need.]\n\n...${tail}`;
}
