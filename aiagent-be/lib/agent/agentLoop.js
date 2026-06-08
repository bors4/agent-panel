/**
 * Agent loop — основной цикл взаимодействия AI модели с инструментами.
 * Поддерживает function calling и XML-style tool calls с fallback.
 * @module agentLoop
 */

import { executeTool, waitForTask, getToolConfig, getToolModelOutput } from "./executeTool.js";
import { parseToolCall } from "../utils.js";
import { isToolEnabledForAccount } from "../accounts.js";
import { configDefaults } from "../configDefaults.js";
import { parseStreamedResponse } from "../parseSSE.js";
import { logWarn, logError, logInfo } from "../logger.js";
import { getInstructionLoader } from "../instructionLoader.js";

/** Максимальное количество итераций (вызовов инструментов) за один запрос. */
export const MAX_AGENT_ITERATIONS = 5;

/**
 * Формирует текстовое описание доступных и недоступных инструментов для system prompt.
 * @param {Object|null} account - Аккаунт пользователя
 * @param {Object} globalToolConfig - Глобальная конфигурация инструментов
 * @returns {string} Описание инструментов
 */
function buildToolsDescription(account, globalToolConfig) {
  const enabled = [];
  const disabled = [];
  for (const [name, t] of Object.entries(globalToolConfig)) {
    const desc = name + ": " + (t.description || name);
    if (isToolEnabledForAccount(account, name, globalToolConfig)) {
      enabled.push(desc);
    } else {
      disabled.push(name);
    }
  }
  let result = "";
  if (enabled.length > 0) {
    result += "Available tools:\n" + enabled.join("\n");
  }
  if (disabled.length > 0) {
    if (result) result += "\n\n";
    result += "Unavailable tools (restricted):\n" + disabled.join(", ");
  }
  return result;
}

/**
 * Собирает system message для AI модели на основе конфигурации и аккаунта.
 * В режиме chatMode возвращает минимальный промпт без проектного контекста.
 * @param {string} projectPath - Путь к проекту
 * @param {string} systemPrompt - Кастомный system prompt
 * @param {boolean} useFunctionCalling - Использовать function calling (true) или XML-формат (false)
 * @param {Object|null} [account=null] - Аккаунт пользователя
 * @param {boolean} [chatMode=false] - Режим простого чата
 * @returns {string} Полный system prompt
 */
export function buildSystemMessage(projectPath, systemPrompt, useFunctionCalling, account = null, chatMode = false) {
  const toolConfig = getToolConfig();
  const td = buildToolsDescription(account, toolConfig);

  if (chatMode) {
    const parts = [];
    parts.push("You are a helpful AI assistant. Answer user questions directly without project context.");
    if (account) {
      let accountSection = "# Account\n\nRole: " + account.role;
      if (account.include_paths?.length > 0) {
        accountSection += "\nAllowed directories: " + account.include_paths.join(", ");
      }
      parts.push(accountSection);
    }
    if (systemPrompt) parts.push(systemPrompt);
    if (useFunctionCalling) {
      parts.push("Use function calling.");
    }
    return parts.join("\n\n") + "\n\n" + td;
  }

  const loader = getInstructionLoader();
  const basePrompt = loader.buildSystemPrompt({
    projectPath,
    systemPrompt,
    useFunctionCalling,
    account,
    toolConfig,
  });

  return basePrompt + "\n\n" + td;
}

/**
 * Извлекает bash-команду из блока с обратными кавычками.
 * Используется как fallback, когда function calling недоступен.
 * @param {string} content - Текст ответа модели
 * @returns {string|null} Извлечённая команда или null
 */
function extractBash(content) {
  const start = content.indexOf("`");
  if (start === -1) return null;
  let idx = start + 1;
  if (content.startsWith("bash", idx)) {
    idx += 4;
  } else if (content.startsWith("sh", idx)) {
    idx += 2;
  }
  if (content[idx] === "\n") idx++;
  const end = content.indexOf("`", idx);
  if (end === -1) return null;
  return content.slice(idx, end).trim();
}

/**
 * Выполнить инструмент и дождаться завершения (для execute — фоновой задачи).
 * @param {Object} toolCall - Вызов инструмента { name, args }
 * @param {Object} toolExecConfig - Конфигурация выполнения
 * @returns {Promise<Object>} Результат выполнения
 */
async function executeToolAndWait(toolCall, toolExecConfig) {
  const r = await executeTool(toolCall, toolExecConfig);
  if (r.data?.taskId) {
    return await waitForTask(r.data.taskId);
  }
  return r;
}

/**
 * Обрезать историю чата до указанного количества пар сообщений.
 * НЕ сохраняет system message — agentLoopStep добавляет его сам.
 * Фильтрует пустые assistant-сообщения для экономии контекста.
 * @param {Array} messages - Полный массив сообщений
 * @param {number} maxPairs - Максимальное количество пар
 * @returns {Array} Обрезанный массив
 */
function filterOutEmptyAssistant(messages) {
  return messages.filter((m) => !(m.role === "assistant" && !m.content?.trim() && !m.tool_calls?.length));
}

function truncateHistory(messages, maxPairs) {
  if (!maxPairs || maxPairs <= 0) return messages;
  // Убираем system message — agentLoopStep сам добавит новый
  const nonSystem = filterOutEmptyAssistant(
    messages.filter((m) => m.role !== "system" && !m.content?.includes("[TOOL APPROVAL REQUIRED]"))
  );
  const maxMsgs = maxPairs * 2;
  let startIdx = Math.max(0, nonSystem.length - maxMsgs);
  // Найти ближайший user перед startIdx
  // История должна начинаться с user (или быть пустой)
  while (startIdx > 0 && nonSystem[startIdx].role !== "user") {
    startIdx--;
  }
  // Если не нашли user - начинаем с 0
  if (nonSystem[startIdx]?.role !== "user") {
    startIdx = 0;
  }
  // Пропускаем orphan tool сообщения в начале
  while (startIdx < nonSystem.length && nonSystem[startIdx].role === "tool") {
    startIdx++;
  }
  return nonSystem.slice(startIdx);
}

function validateAndFixHistory(messages) {
  // Находим первое сообщение после system
  const firstNonSystem = messages.find((m) => m.role !== "system");

  if (!firstNonSystem) {
    // Нет сообщений кроме system - добавляем пустой user
    messages.push({ role: "user", content: "." });
    return messages;
  }

  if (firstNonSystem.role !== "user") {
    // Первое сообщение не user - добавляем placeholder в начало
    const systemIdx = messages.findIndex((m) => m.role === "system");
    messages.splice(systemIdx + 1, 0, {
      role: "user",
      content: "Continue from where we left off.",
    });
  }

  // Проверяем пары assistant(tool_call) → tool(result)
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    if (msg.role === "assistant" && msg.tool_calls?.length > 0) {
      // Ищем следующее сообщение - должно быть tool с соответствующим tool_call_id
      const nextMsg = messages[i + 1];

      if (!nextMsg || nextMsg.role !== "tool") {
        // Нет tool-результата - добавляем placeholder
        messages.splice(i + 1, 0, {
          role: "tool",
          tool_call_id: msg.tool_calls[0].id,
          content: JSON.stringify({ error: "Tool execution was interrupted" }),
        });
      }
    }
  }

  return messages;
}

/**
 * Формирует конфигурацию для executeTool на основе аккаунта и глобальной конфигурации.
 * @param {Object|null} account - Аккаунт пользователя
 * @param {Object} cfg - Глобальная конфигурация агента
 * @returns {Object} Конфигурация выполнения инструмента
 */
function buildToolExecConfig(account, cfg) {
  return {
    projectPath: cfg.projectPath,
    chatMode: cfg.chatMode || false,
    account,
    maxFileChars: cfg.maxFileChars,
    maxSearchResults: cfg.maxSearchResults,
    maxSearchFileSize: cfg.maxSearchFileSize,
    maxHistoryPairs: cfg.maxHistoryPairs,
    maxFilesInPrompt: cfg.maxFilesInPrompt,
    executeTimeout: cfg.executeTimeout,
    filesRead: 0,
  };
}

/**
 * Один шаг агентного цикла: отправляет запрос к AI модели и обрабатывает ответ.
 * Поддерживает до maxIterations итераций с tool calls.
 * Для OpenRouter: автодетект по cfg.serverUrl (содержит "openrouter.ai"),
 * использует cfg.openrouterApiKey с кастомными заголовками (HTTP-Referer, X-OpenRouter-Title);
 * иначе использует cfg.apiKey.
 * @param {string} message - Сообщение пользователя
 * @param {string} chatId - ID чата Telegram
 * @param {Array} history - История сообщений
 * @param {Object} cfg - Конфигурация агента (из server.js)
 * @param {string} cfg.serverUrl - URL AI сервера
 * @param {string} cfg.modelName - Имя модели
 * @param {string} cfg.apiKey - API ключ (для локального сервера)
 * @param {string} cfg.openrouterApiKey - API ключ OpenRouter (опционально)
 * @param {number} cfg.maxTokens - Макс. токенов ответа
 * @param {number} cfg.temperature - Температура генерации
 * @param {number} cfg.timeout - Таймаут запроса (мс)
 * @param {boolean} cfg.stream - Использовать SSE
 * @param {boolean} cfg.insertUserAfterTool - Вставлять "Continue" после tool
 * @param {string} cfg.projectPath - Путь к проекту
 * @param {string} cfg.systemPrompt - Системный промпт
 * @param {boolean} cfg.chatMode - Режим простого чата
 * @param {number} maxIterations - Максимальное число итераций (default: 5)
 * @param {Object|null} account - Аккаунт пользователя
 * @param {Function} [onProgress] - Колбэк прогресса: ({ type: 'content'|'tool'|'response'|'error', ... })
 * @param {AbortSignal} [abortSignal] - Внешний сигнал отмены (из Telegram /cancel или фронтенда)
 * @returns {Promise<Object>} Результат: { response?, error?, requiresApproval?, toolName?, args?, messages?, tokenUsage?, timings?, cancelled? }
 */
export async function agentLoopStep(
  message,
  chatId,
  history = [],
  cfg,
  maxIterations = MAX_AGENT_ITERATIONS,
  account = null,
  onProgress = null,
  abortSignal = null
) {
  const toolConfig = getToolConfig();
  let messages = [
    {
      role: "system",
      content: buildSystemMessage(cfg.projectPath, cfg.systemPrompt, true, account, cfg.chatMode),
    },
    ...truncateHistory(history, cfg.maxHistoryPairs),
  ];

  if (message && message.trim()) {
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== "user" || lastMsg.content !== message) {
      messages.push({ role: "user", content: message });
    }
  }

  messages = validateAndFixHistory(messages);
  let iterations = 0,
    finalResponse = "",
    finalReasoning = "",
    useFunctionCalling = true,
    accumulatedUsage = { prompt: 0, completion: 0, total: 0, cached: 0 },
    latestTimings = null,
    firstTokenMs,
    totalMs;
  const toolExecConfig = buildToolExecConfig(account, cfg);
  let currentTemperature = cfg.temperature ?? configDefaults.temperature;
  let emptyRetries = 0;

  if (!cfg.serverUrl) {
    return { error: "AI server URL is not configured. Set it in the panel settings." };
  }

  while (iterations < maxIterations) {
    iterations++;
    if (abortSignal?.aborted) {
      return {
        response: "Cancelled",
        reasoning: finalReasoning,
        cancelled: true,
        messages,
        tokenUsage: accumulatedUsage,
        timings: latestTimings,
      };
    }

    // Estimate total chars; log warning before LLM call.
    const totalChars = messages.reduce((sum, m) => sum + (m.content?.length || 0) + (m.tool_calls ? JSON.stringify(m.tool_calls).length : 0), 0);
    logInfo(`agentLoop iteration ${iterations}: ${messages.length} messages, ~${Math.round(totalChars / 4)} estimated tokens (${totalChars} chars)`, {});

    try {
      const body = {
        model: cfg.modelName,
        messages,
        max_tokens: cfg.maxTokens ?? configDefaults.maxTokens,
        temperature: currentTemperature,
      };
      if (useFunctionCalling) {
        body.tools = Object.values(toolConfig)
          .filter((t) => isToolEnabledForAccount(account, t.name, toolConfig))
          .map((t) => ({
            type: "function",
            function: {
              name: t.name,
              description: t.description,
              parameters: t.input_schema,
            },
          }));
        body.tool_choice = "auto";
      }
      body.stream = cfg.stream ?? false;
      const controller = new AbortController();
      const timeout = cfg.timeout ?? configDefaults.timeout;
      let timeoutId = setTimeout(() => controller.abort(), timeout);
      // Объединяем таймаут и внешний сигнал отмены
      const fetchSignal = abortSignal ? AbortSignal.any([controller.signal, abortSignal]) : controller.signal;
      const isOpenRouter = cfg.serverUrl.includes("openrouter.ai");
      const loopHeaders = { "Content-Type": "application/json" };
      if (isOpenRouter) {
        loopHeaders["Authorization"] = "Bearer " + (cfg.openrouterApiKey || "");
        loopHeaders["HTTP-Referer"] = "https://agent-panel.local";
        loopHeaders["X-OpenRouter-Title"] = "AI Agent Panel";
      } else {
        loopHeaders["Authorization"] = "Bearer " + cfg.apiKey;
      }
      let resp;
      try {
        resp = await fetch(cfg.serverUrl + "/chat/completions", {
          method: "POST",
          headers: loopHeaders,
          body: JSON.stringify(body),
          signal: fetchSignal,
        });
      } catch (e) {
        clearTimeout(timeoutId);
        if (e.name === "AbortError") {
          if (abortSignal?.aborted) {
            return {
              response: "Cancelled",
              reasoning: finalReasoning,
              cancelled: true,
              messages,
              tokenUsage: accumulatedUsage,
              timings: latestTimings,
            };
          }
          return { error: "Request timed out. Generate a shorter response or increase the timeout setting." };
        }
        throw e;
      }
      if (!resp.ok && useFunctionCalling && resp.status === 400) {
        clearTimeout(timeoutId);
        useFunctionCalling = false;
        messages[0].content = buildSystemMessage(cfg.projectPath, cfg.systemPrompt, false, account, cfg.chatMode);
        continue;
      }
      if (!resp.ok) {
        clearTimeout(timeoutId);
        return { error: "AI error: " + resp.status };
      }
      let msg, usage;
      if (body.stream) {
        try {
          const t0 = performance.now();
          firstTokenMs = 0;
          const {
            content,
            reasoningContent,
            toolCalls,
            usage: u,
            timings: t,
          } = await parseStreamedResponse(resp, {
            onContent: (chunk, accumulated) => {
              if (!firstTokenMs) firstTokenMs = performance.now() - t0;
              // Per-chunk timeout reset — длинные генерации не обрываются
              clearTimeout(timeoutId);
              timeoutId = setTimeout(() => controller.abort(), timeout);
              onProgress?.({ type: "content", chunk, accumulated });
            },
            onReasoning: (chunk, accumulated) => {
              if (!firstTokenMs) firstTokenMs = performance.now() - t0;
              clearTimeout(timeoutId);
              timeoutId = setTimeout(() => controller.abort(), timeout);
              onProgress?.({ type: "reasoning", chunk, accumulated });
            },
            onReasoningDone: () => {
              onProgress?.({ type: "reasoning_done" });
            },
            onToolCall: (idx, tc) => {
              onProgress?.({ type: "tool_call_delta", index: idx, delta: tc });
            },
            onFinish: (reason) => {
              onProgress?.({ type: "finish", reason });
            },
          }, cfg.serverUrl);
          totalMs = performance.now() - t0;
          usage = u;
          if (t) latestTimings = t;
          finalReasoning = reasoningContent || "";
          msg = {
            role: "assistant",
            content: content || null,
            tool_calls: toolCalls
              ? toolCalls.map((tc) => ({
                  id: tc.id,
                  type: tc.type,
                  function: {
                    name: tc.function.name,
                    arguments: tc.function.arguments,
                  },
                }))
              : undefined,
          };
        } catch (e) {
          if (e.name === "AbortError") {
            if (abortSignal?.aborted) {
              return {
                response: "Cancelled",
                reasoning: finalReasoning,
                cancelled: true,
                messages,
                tokenUsage: accumulatedUsage,
                timings: latestTimings,
              };
            }
            return { error: "Generation timed out. Try again or increase the timeout setting." };
          }
          throw e;
        } finally {
          clearTimeout(timeoutId);
        }
      } else {
        clearTimeout(timeoutId);
        const data = await resp.json();
        const asst = data.choices?.[0]?.message;
        if (!asst) return { error: "AI error: empty response" };
        msg = asst;
        finalReasoning = asst.reasoning_content || "";
        usage = data.usage;
        if (data.timings) {
          const tc = data.tokens_cached ?? data.__verbose?.tokens_cached ?? 0;
          latestTimings = { ...data.timings, tokens_cached: tc };
        }
      }
      if (!msg.content?.trim() && !msg.tool_calls?.length) {
        const reasoningTc = finalReasoning?.includes("<tool_call>") ? parseToolCall(finalReasoning) : null;
        if (reasoningTc) {
          msg.content = finalReasoning;
          logWarn(`[agentLoop] Promoted reasoning_content to content (detected tool call: ${reasoningTc.name})`);
        } else {
          emptyRetries++;
          logWarn(
            `[agentLoop] Empty response #${emptyRetries}: msg keys=${Object.keys(msg).join(",")}, tool_calls=${msg.tool_calls ? "set(" + msg.tool_calls.length + ")" : "none"}, content="${(msg.content || "").slice(0, 80)}"`
          );
          if (emptyRetries > 2) {
            return {
              error: "Model returned empty responses repeatedly. Check model configuration or increase max tokens.",
            };
          }
          currentTemperature = Math.min(currentTemperature + 0.3, 0.99);
          continue;
        }
      }
      emptyRetries = 0;
      if (!usage && (msg.content || msg.tool_calls?.length)) {
        if (latestTimings?.prompt_n) {
          usage = {
            prompt_tokens: latestTimings.prompt_n || 0,
            completion_tokens: latestTimings.predicted_n || 0,
            total_tokens: (latestTimings.prompt_n || 0) + (latestTimings.predicted_n || 0),
            prompt_tokens_details: {
              cached_tokens: latestTimings.cache_n || 0,
            },
          };
        } else {
          logWarn("[agentLoop] No usage or timings from model; estimating via char count");
          const completionText = msg.content || "";
          const completionTokens = Math.ceil(completionText.length / 4);
          const promptText = messages
            .map((m) => {
              const c = m.content || "";
              const tc = m.tool_calls ? JSON.stringify(m.tool_calls) : "";
              return c + tc;
            })
            .join(" ");
          const promptTokens = Math.ceil(promptText.length / 4);
          usage = {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: promptTokens + completionTokens,
          };
        }
      }
      if (usage) {
        accumulatedUsage.prompt += usage.prompt_tokens || 0;
        accumulatedUsage.completion += usage.completion_tokens || 0;
        accumulatedUsage.total += usage.total_tokens || 0;
        if (usage.prompt_tokens_details?.cached_tokens !== undefined) {
          accumulatedUsage.cached += usage.prompt_tokens_details.cached_tokens;
        }
      }
      messages.push(msg);
      const content = msg?.content || "";

      if (msg.tool_calls?.length > 0) {
        for (let tcIdx = 0; tcIdx < msg.tool_calls.length; tcIdx++) {
          const tc = msg.tool_calls[tcIdx];
          const tn = tc.function.name;
          let ta;

          // Validate arguments exist before parsing
          if (tc.function.arguments == null) {
            return { error: "Tool call arguments are missing or null" };
          }

          try {
            ta = JSON.parse(tc.function.arguments);
          } catch (e) {
            logError(`Failed to parse tool arguments for ${tn}: ${e.message}`);
            return { error: "Invalid JSON in tool call arguments" };
          }
          const ts = toolConfig[tn] || {};
          if (ts.permission === "ask") {
            const remaining = msg.tool_calls.slice(tcIdx + 1).map((rtc) => ({
              id: rtc.id,
              name: rtc.function.name,
              args: (() => {
                try {
                  return JSON.parse(rtc.function.arguments);
                } catch {
                  return {};
                }
              })(),
            }));
            messages.push({
              role: "assistant",
              content: "[TOOL APPROVAL REQUIRED] The user must approve: " + tn + "(" + JSON.stringify(ta) + ")",
            });
            return {
              requiresApproval: true,
              toolName: tn,
              args: ta,
              toolCallId: tc.id,
              messages,
              pendingToolCalls: remaining.length > 0 ? remaining : undefined,
            };
          }
          onProgress?.({ type: "tool", toolName: tn, args: ta });
          const r = await executeToolAndWait({ name: tn, args: ta }, toolExecConfig);
          if (tn === "read" && r.success) toolExecConfig.filesRead++;
          let toolContent = getToolModelOutput(tc.function.name, r);
          if (toolContent.length > 10000) {
            toolContent = toolContent.slice(0, 10000) + `\n\n[... tool content truncated, ${toolContent.length - 10000} more chars]`;
          }
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: toolContent,
          });
          if (cfg.insertUserAfterTool) {
            messages.push({ role: "user", content: "Continue" });
            const recentUserMessages = messages
              .slice(-5)
              .filter((m) => m.role === "user" && m.content === "Continue").length;
            if (recentUserMessages >= 3) {
              break;
            }
          }
        }
        continue;
      }

      const tc = parseToolCall(content);
      if (tc) {
        const ts = toolConfig[tc.name] || {};
        if (ts.permission === "ask")
          return {
            requiresApproval: true,
            toolName: tc.name,
            args: tc.args,
            messages,
          };
        onProgress?.({ type: "tool", toolName: tc.name, args: tc.args });
        const r = await executeToolAndWait(tc, toolExecConfig);
        if (tc.name === "read" && r.success) toolExecConfig.filesRead++;
        let toolContent = getToolModelOutput(tc.name, r);
        if (toolContent.length > 10000) {
          toolContent = toolContent.slice(0, 10000) + `\n\n[... tool content truncated, ${toolContent.length - 10000} more chars]`;
        }
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: toolContent,
        });
        if (cfg.insertUserAfterTool) {
          messages.push({ role: "user", content: "Continue" });
          const recentUserMessages = messages
            .slice(-5)
            .filter((m) => m.role === "user" && m.content === "Continue").length;
          if (recentUserMessages >= 3) {
            break;
          }
        }
        continue;
      }

      const bash = extractBash(content);
      if (bash && !useFunctionCalling) {
        onProgress?.({ type: "tool", toolName: "execute", args: { command: bash } });
        const r = await executeToolAndWait({ name: "execute", args: { command: bash } }, toolExecConfig);
        let toolContent = getToolModelOutput("execute", r);
        if (toolContent.length > 10000) {
          toolContent = toolContent.slice(0, 10000) + `\n\n[... tool content truncated, ${toolContent.length - 10000} more chars]`;
        }
        messages.push({
          role: "tool",
          tool_call_id: `bash_${Date.now()}`,
          content: toolContent,
        });
        if (cfg.insertUserAfterTool) {
          messages.push({ role: "user", content: "Continue" });
          // Prevent infinite loops: stop if too many consecutive tool-inserted user messages
          const recentUserMessages = messages
            .slice(-5)
            .filter((m) => m.role === "user" && m.content === "Continue").length;
          if (recentUserMessages >= 3) {
            break;
          }
        }
        continue;
      }

      finalResponse = content || "Empty response";
      onProgress?.({ type: "response", response: finalResponse });
      break;
    } catch (e) {
      return { error: e.message };
    }
  }
  if (!finalResponse) finalResponse = "Empty response";
  const finalMessages = messages.filter((m) => !m.content?.includes("[TOOL APPROVAL REQUIRED]"));

  // Fallback: estimate timings from char count when server doesn't provide them
  if (!latestTimings?.prompt_n && finalResponse && finalResponse !== "Empty response") {
    const promptText = messages
      .map((m) => (m.content || "") + (m.tool_calls ? JSON.stringify(m.tool_calls) : ""))
      .join(" ");
    const promptTokens = Math.ceil(promptText.length / 4);
    const predictedTokens = Math.ceil(finalResponse.length / 4);
    latestTimings = {
      prompt_n: promptTokens,
      predicted_n: predictedTokens,
      prompt_ms: Math.round(firstTokenMs || totalMs || 0),
      predicted_ms: firstTokenMs ? Math.round((totalMs || 0) - firstTokenMs) : 0,
      prompt_per_second: firstTokenMs ? promptTokens / (firstTokenMs / 1000) : 0,
      predicted_per_second: firstTokenMs ? predictedTokens / (((totalMs || 0) - firstTokenMs) / 1000) : 0,
      tokens_cached: 0,
      draft_n: latestTimings?.draft_n || 0,
      draft_n_accepted: latestTimings?.draft_n_accepted || 0,
      draft_acceptance_rate: 0,
      ...(latestTimings || {}),
    };
  }

  return {
    response: finalResponse,
    reasoning: finalReasoning,
    messages: finalMessages,
    tokenUsage: accumulatedUsage,
    timings: latestTimings,
  };
}
