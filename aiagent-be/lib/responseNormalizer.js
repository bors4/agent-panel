/**
 * Response normalizer for different AI server formats.
 * Handles OpenAI, OpenRouter, llama.cpp, LM Studio, and other OpenAI-compatible servers.
 * @module lib/responseNormalizer
 */

/**
 * Detect server type from URL.
 * @param {string} serverUrl
 * @returns {string} "openrouter", "generic"
 */
export function detectServerType(serverUrl) {
  if (!serverUrl) return "generic";
  try {
    const url = new URL(serverUrl);
    const host = url.hostname.toLowerCase();
    if (host === "openrouter.ai" || host.endsWith(".openrouter.ai")) return "openrouter";
    if (host === "api.openai.com") return "openai";
    if (host === "api.deepseek.com") return "deepseek";
  } catch {}
  return "generic";
}

/**
 * Normalize usage to canonical format { prompt, completion, total, cached }.
 * Accepts:
 *   - OpenAI format: { prompt_tokens, completion_tokens, total_tokens, prompt_tokens_details?: { cached_tokens } }
 *   - Canonical format: { prompt, completion, total, cached }
 * @param {Object|null} usage
 * @returns {{ prompt: number, completion: number, total: number, cached: number }|null}
 */
export function normalizeUsage(usage) {
  if (!usage) return null;
  if (typeof usage.prompt === "number" && typeof usage.completion === "number") {
    return {
      prompt: usage.prompt,
      completion: usage.completion,
      total: usage.total ?? (usage.prompt + usage.completion),
      cached: usage.cached ?? 0,
    };
  }
  return {
    prompt: usage.prompt_tokens ?? 0,
    completion: usage.completion_tokens ?? 0,
    total: usage.total_tokens ?? ((usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0)),
    cached: usage.prompt_tokens_details?.cached_tokens ?? usage.cached ?? 0,
  };
}

/**
 * Create a stateful stream normalizer that extracts <think> tags from
 * delta.content on non-OpenRouter servers (llama.cpp, LM Studio, etc.)
 * where reasoning content is embedded in <think>...</think> tags.
 * @param {string} serverType
 * @returns {{ normalize: (chunk: Object) => Object }}
 */
export function createStreamNormalizer(serverType) {
  if (serverType === "openrouter") {
    return { normalize: (chunk) => chunk };
  }

  let buffer = "";
  let inThink = false;

  function normalize(chunk) {
    if (!chunk?.choices?.[0]?.delta) return chunk;
    const delta = chunk.choices[0].delta;
    if (!delta.content) return chunk;

    buffer += delta.content;
    delete delta.content;
    processBuffer(delta);

    return chunk;
  }

  function processBuffer(delta) {
    while (buffer.length > 0) {
      if (inThink) {
        const closeIdx = buffer.indexOf("</think>");
        if (closeIdx === -1) {
          delta.reasoning_content = (delta.reasoning_content || "") + buffer;
          buffer = "";
        } else {
          delta.reasoning_content = (delta.reasoning_content || "") + buffer.slice(0, closeIdx);
          buffer = buffer.slice(closeIdx + 8);
          inThink = false;
        }
      } else {
        const openIdx = buffer.indexOf("<think>");
        if (openIdx === -1) {
          delta.content = (delta.content || "") + buffer;
          buffer = "";
        } else {
          delta.content = (delta.content || "") + buffer.slice(0, openIdx);
          buffer = buffer.slice(openIdx + 7);
          inThink = true;
        }
      }
    }
  }

  return { normalize };
}
