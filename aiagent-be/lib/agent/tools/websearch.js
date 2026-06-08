import { logWarn } from "../../logger.js";

const DDG_URL = "https://html.duckduckgo.com/html";

function parseDdgResults(html) {
  const results = [];
  const resultRegex = /<a rel="nofollow" class="result__a" href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = resultRegex.exec(html)) !== null) {
    const url = match[1].replace(/&amp;/g, "&");
    const title = match[2].replace(/<[^>]*>/g, "").trim();
    const snippet = match[3].replace(/<[^>]*>/g, "").trim();
    if (url && title) {
      results.push({ title, url, snippet });
    }
  }
  return results;
}

export async function websearch(args) {
  const query = args.query;
  if (!query || !query.trim()) {
    return { success: false, error: "Query is required" };
  }
  if (query.length > 400) {
    return { success: false, error: "Query too long (max 400 chars)" };
  }

  const numResults = Math.min(args.numResults || 10, 20);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let response;
    try {
      response = await fetch(DDG_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ q: query }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      return { success: false, error: `Search failed: HTTP ${response.status}` };
    }

    const html = await response.text();
    const results = parseDdgResults(html).slice(0, numResults);

    return {
      success: true,
      data: { results, total: results.length, query },
    };
  } catch (e) {
    if (e.name === "AbortError") {
      return { success: false, error: "Search timed out" };
    }
    logWarn(`[websearch] Error: ${e.message}`);
    return { success: false, error: `Search failed: ${e.message}` };
  }
}

export function toModelOutput(result) {
  if (!result.success) return `Web search failed: ${result.error}`;
  if (result.data.results.length === 0) return "No search results found. Try a different query.";
  const lines = result.data.results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet}\n   ${r.url}`);
  return lines.join("\n\n");
}
