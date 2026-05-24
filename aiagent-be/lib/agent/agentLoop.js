/**
 * Agent loop — основной цикл взаимодействия AI модели с инструментами.
 * Поддерживает function calling и XML-style tool calls с fallback.
 * @module agentLoop
 */

import { executeTool, getToolConfig } from "./executeTool.js";
import { parseToolCall } from "../utils.js";
import { isToolEnabledForAccount } from "../accounts.js";
import { configDefaults } from "../configDefaults.js";
import { parseStreamedResponse } from "../parseSSE.js";

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
 * Включает описание инструментов, правила работы и пути проекта.
 * @param {string} projectPath - Путь к проекту
 * @param {string} systemPrompt - Кастомный system prompt
 * @param {boolean} useFunctionCalling - Использовать function calling (true) или XML-формат (false)
 * @param {Object|null} [account=null] - Аккаунт пользователя
 * @returns {string} Полный system prompt
 */
export function buildSystemMessage(projectPath, systemPrompt, useFunctionCalling, account = null) {
  let ctx =
    "You are AI assistant in: " +
    projectPath +
    "\n" +
    "IMPORTANT: Use ONLY RELATIVE paths!\n" +
    '  GOOD: "test.txt", "src/app.js"\n' +
    '  BAD: "E:\\Git\\test_project\\file.txt"\n\n' +
    "Commands:\n" +
    "  write - create file (filePath RELATIVE, content)\n" +
    "  read - read file (filePath RELATIVE)\n" +
    "  move - rename/move (source RELATIVE, destination RELATIVE)\n" +
    "  delete - delete (path RELATIVE)\n" +
    '  list_dir - list (path RELATIVE like ".")\n' +
    "  execute - run command\n" +
    "WINDOWS RULES:\n" +
    '- Wrap URLs with & in quotes: curl -s "https://...&key=..."\n' +
    "- Do NOT use jq. Use PowerShell: curl ... | ConvertFrom-Json\n" +
    "- Prefer PowerShell for complex pipes\n";

  if (account) {
    ctx += "\n\nYour role: " + account.role + "\n";
    if (account.include_paths?.length > 0) {
      ctx += "Allowed directories: " + account.include_paths.join(", ") + "\n";
    }
  }

  if (systemPrompt) ctx += "\n" + systemPrompt;

  const td = buildToolsDescription(account, getToolConfig());
  if (useFunctionCalling) {
    return ctx + td + "\n\nUse function calling.";
  } else {
    return ctx + td + "\n\nUse: <tool_call><function>move</function><parameter=source>test.txt";
  }
}

/**
 * Извлекает bash-команду из блока с обратными кавычками.
 * Используется как fallback, когда function calling недоступен.
 * @param {string} content - Текст ответа модели
 * @returns {string|null} Извлечённая команда или null
 */
function extractBash(content) {
  const m = content.match(/`(?:bash|sh)?[\s\S]*?`/);
  return m ? m[0].replace(/`[a-z]*\n?/g, "").trim() : null;
}

/**
 * Обрезать историю чата до указанного количества пар сообщений.
 * НЕ сохраняет system message — agentLoopStep добавляет его сам.
 * Фильтрует пустые assistant-сообщения для экономии контекста.
 * @param {Array} messages - Полный массив сообщений
 * @param {number} maxPairs - Максимальное количество пар
 * @returns {Array} Обрезанный массив
 */
function truncateHistory(messages, maxPairs) {
  if (!maxPairs || maxPairs <= 0) return messages;
  // Убираем system message — agentLoopStep сам добавит новый
  const nonSystem = messages.filter(
    (m) => m.role !== "system" && !(m.role === "assistant" && !m.content?.trim() && !m.tool_calls?.length)
  );
  const maxMsgs = maxPairs * 2;
  let startIdx = Math.max(0, nonSystem.length - maxMsgs);
  // Пропускаем orphan tool сообщения в начале
  while (startIdx < nonSystem.length && nonSystem[startIdx].role === "tool") {
    startIdx++;
  }
  return nonSystem.slice(startIdx);
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
    account,
    maxFileChars: cfg.maxFileChars,
    maxSearchResults: cfg.maxSearchResults,
    maxHistoryPairs: cfg.maxHistoryPairs,
    maxFilesInPrompt: cfg.maxFilesInPrompt,
    filesRead: 0,
  };
}

/**
 * Один шаг агентного цикла: отправляет запрос к AI модели и обрабатывает ответ.
 * Поддерживает до maxIterations итераций с tool calls.
 * @param {string} message - Сообщение пользователя
 * @param {string} chatId - ID чата Telegram
 * @param {Array} history - История сообщений
 * @param {Object} cfg - Конфигурация агента (из server.js)
 * @param {number} maxIterations - Максимальное число итераций (default: 5)
 * @param {Object|null} account - Аккаунт пользователя
 * @returns {Promise<Object>} Результат: { response?, error?, requiresApproval?, toolName?, args?, messages? }
 */
export async function agentLoopStep(message, chatId, history = [], cfg, maxIterations = MAX_AGENT_ITERATIONS, account = null) {
  const toolConfig = getToolConfig();
  let messages = [
    {
      role: "system",
      content: buildSystemMessage(cfg.projectPath, cfg.systemPrompt, true, account),
    },
    ...truncateHistory(history, cfg.maxHistoryPairs),
  ];
  if (message) messages.push({ role: "user", content: message });
  let iterations = 0,
    finalResponse = "",
    useFunctionCalling = true,
    accumulatedUsage = { prompt: 0, completion: 0, total: 0, cached: 0 };
  const toolExecConfig = buildToolExecConfig(account, cfg);

  while (iterations < maxIterations) {
    iterations++;
    try {
      const body = {
        model: cfg.modelName,
        messages,
        max_tokens: cfg.maxTokens ?? configDefaults.maxTokens,
        temperature: cfg.temperature ?? configDefaults.temperature,
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
      body.stream = true;
      const controller = new AbortController();
      const timeout = cfg.timeout ?? configDefaults.timeout;
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      let resp;
      try {
        resp = await fetch(cfg.serverUrl + "/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + cfg.apiKey,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
      if (!resp.ok && useFunctionCalling) {
        useFunctionCalling = false;
        messages[0].content = buildSystemMessage(cfg.projectPath, cfg.systemPrompt, false, account);
        continue;
      }
      if (!resp.ok) return { error: "AI error: " + resp.status };
      const { content: streamedContent, toolCalls: streamedToolCalls, usage } =
        await parseStreamedResponse(resp);
      const msg = {
        content: streamedContent || null,
        tool_calls: streamedToolCalls
          ? streamedToolCalls.map((tc) => ({
              id: tc.id,
              type: tc.type,
              function: {
                name: tc.function.name,
                arguments: tc.function.arguments,
              },
            }))
          : undefined,
      };
      if (!msg.content && !msg.tool_calls?.length) return { error: "Empty response" };
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
        for (const tc of msg.tool_calls) {
          const tn = tc.function.name;
          let ta;
          try {
            ta = JSON.parse(tc.function.arguments);
          } catch {
            return { error: "Invalid JSON in tool call" };
          }
          const ts = toolConfig[tn] || {};
          if (ts.permission === "ask") {
            messages.push({
              role: "assistant",
              content: "[TOOL APPROVAL REQUIRED] The user must approve: " + tn + "(" + JSON.stringify(ta) + ")",
            });
            return {
              requiresApproval: true,
              toolName: tn,
              args: ta,
              toolCallId: tc.id, // ← КРИТИЧНО: сохраняем ID от модели
              messages,
            };
          }
          const r = await executeTool({ name: tn, args: ta }, toolExecConfig);
          if (tn === "read" && r.success) toolExecConfig.filesRead++;
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(r),
          });
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
        const r = await executeTool(tc, toolExecConfig);
        if (tc.name === "read" && r.success) toolExecConfig.filesRead++;
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(r),
        });
        continue;
      }

      const bash = extractBash(content);
      if (bash && !useFunctionCalling) {
        const r = await executeTool({ name: "execute", args: { command: bash } }, toolExecConfig);
        messages.push({
          role: "tool",
          tool_call_id: `bash_${Date.now()}`,
          content: JSON.stringify(r),
        });
        continue;
      }

      finalResponse = content || "Empty response";
      break;
    } catch (e) {
      return { error: e.message };
    }
  }
  const finalMessages = messages.filter((m) => !m.content?.includes("[TOOL APPROVAL REQUIRED]"));
  return { response: finalResponse, messages: finalMessages, tokenUsage: accumulatedUsage };
}
