/**
 * Парсинг SSE (Server-Sent Events) из ответа fetch с stream: true.
 * @module parseSSE
 */

/**
 * Разбирает SSE-поток из fetch Response.
 *
 * @param {Response} response - fetch Response с stream: true
 * @param {Object} [callbacks] - Опциональные колбэки для real-time уведомлений
 * @param {Function} [callbacks.onContent] - Вызывается при каждом новом content чанке (chunk, accumulated)
 * @param {Function} [callbacks.onToolCall] - Вызывается при tool_call (toolCallIndex, toolCallDelta)
 * @param {Function} [callbacks.onFinish] - Вызывается при получении finish_reason (finishReason)
 * @param {Function} [callbacks.onUsage] - Вызывается при получении usage (usage)
 * @param {Function} [callbacks.onTimings] - Вызывается при получении timings от llama.cpp (timings c injected tokens_cached)
 * @returns {Promise<{content: string, toolCalls: Array|null, finishReason: string|null, usage: Object|null, timings: Object|null, tokensCached: number}>}
 */
export async function parseStreamedResponse(response, callbacks = {}) {
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`AI API error: ${response.status} ${text}`);
  }

  const reader = response.body.getReader();
  if (!reader) {
    throw new Error("Response body is not readable");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  /** @type {Object.<number, {index: number, id?: string, type?: string, function?: {name?: string, arguments?: string}}>} */
  const toolCallAccum = {};
  let finishReason = null;
  let usage = null;
  let timings = null;
  let tokensCached = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      // Последняя строка может быть неполной — оставляем в буфере
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;

        const raw = trimmed.slice(6);
        if (raw === "[DONE]") continue;

        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch {
          continue;
        }

        const choices = parsed.choices;

        // Usage может приходить отдельным SSE-ивентом без choices (llama.cpp)
        if (parsed.usage) {
          usage = parsed.usage;
          callbacks.onUsage?.(parsed.usage);
        }

        // tokens_cached — общий размер KV-кэша (top-level или __verbose)
        if (parsed.tokens_cached !== undefined) {
          tokensCached = parsed.tokens_cached;
        } else if (parsed.__verbose?.tokens_cached !== undefined) {
          tokensCached = parsed.__verbose.tokens_cached;
        }

        // llama.cpp иногда отправляет timings в том же чанке или в последнем чанке
        if (parsed.timings) {
          timings = { ...parsed.timings, tokens_cached: tokensCached };
          callbacks.onTimings?.(timings);
        }

        // LM Studio: stats в финальном чанке (draft info)
        if (parsed.stats) {
          if (!timings) timings = {};
          timings.draft_n = Math.max(timings.draft_n || 0, parsed.stats.total_draft_tokens_count || 0);
          timings.draft_n_accepted = Math.max(timings.draft_n_accepted || 0, parsed.stats.accepted_draft_tokens_count || 0);
          callbacks.onTimings?.(timings);
        }

        if (!choices || !choices[0]) continue;
        const delta = choices[0].delta || {};
        const finish = choices[0].finish_reason;

        if (delta.content) {
          content += delta.content;
          callbacks.onContent?.(delta.content, content);
        } else if (delta.reasoning_content) {
          content += delta.reasoning_content;
          callbacks.onContent?.(delta.reasoning_content, content);
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index;
            if (!toolCallAccum[idx]) {
              toolCallAccum[idx] = { index: idx };
            }
            if (tc.id) toolCallAccum[idx].id = tc.id;
            if (tc.type) toolCallAccum[idx].type = tc.type;
            if (tc.function) {
              if (!toolCallAccum[idx].function) toolCallAccum[idx].function = {};
              if (tc.function.name) toolCallAccum[idx].function.name = tc.function.name;
              if (tc.function.arguments !== undefined) {
                toolCallAccum[idx].function.arguments =
                  (toolCallAccum[idx].function.arguments || "") + tc.function.arguments;
              }
            }
            callbacks.onToolCall?.(idx, tc);
          }
        }

        if (finish) {
          finishReason = finish;
          callbacks.onFinish?.(finish);
        }
      }
    }
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new Error(`SSE parse error: ${err.message}`, { cause: err });
  }

  // Обработка оставшегося буфера
  if (buffer.trim()) {
    const trimmed = buffer.trim();
    if (trimmed.startsWith("data: ")) {
      const raw = trimmed.slice(6);
      if (raw !== "[DONE]") {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.usage) usage = parsed.usage;
          if (parsed.tokens_cached !== undefined) {
            tokensCached = parsed.tokens_cached;
          } else if (parsed.__verbose?.tokens_cached !== undefined) {
            tokensCached = parsed.__verbose.tokens_cached;
          }
          if (parsed.timings) {
            timings = { ...parsed.timings, tokens_cached: tokensCached };
          }
          if (parsed.stats) {
            if (!timings) timings = {};
            timings.draft_n = (timings.draft_n || 0) + (parsed.stats.total_draft_tokens_count || 0);
            timings.draft_n_accepted = (timings.draft_n_accepted || 0) + (parsed.stats.accepted_draft_tokens_count || 0);
          }
        } catch {
          // ignore
        }
      }
    }
  }

  // Сборка tool_calls
  const indices = Object.keys(toolCallAccum)
    .map(Number)
    .sort((a, b) => a - b);
  const toolCalls =
    indices.length > 0
      ? indices.map((idx) => {
          const tc = toolCallAccum[idx];
          return {
            id: tc.id || `call_${idx}`,
            type: tc.type || "function",
            function: {
              name: tc.function?.name || "",
              arguments: tc.function?.arguments || "{}",
            },
          };
        })
      : null;

  return { content, toolCalls, finishReason, usage, timings, tokensCached };
}
