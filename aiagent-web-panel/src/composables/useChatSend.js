/**
 * Composable для основного send-флоу чата: agent mode (с тулзами) или direct chat
 * (с/без streaming). Управляет typing/streaming state, отменой, и persist result в messages.
 * @module composables/useChatSend
 */

import { ref, nextTick } from "vue";
import { directChat, directChatStream, agentChat, agentChatStream } from "@/api/client";

function genId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/**
 * Normalize token usage to canonical format { prompt, completion, total, cached }.
 * Handles both OpenAI format ({ prompt_tokens, ... }) and canonical.
 */
function normalizeUsage(usage) {
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
 * @param {{
 *   messages: import("vue").Ref<Array>,
 *   approvalMessages: import("vue").Ref<Array>,
 *   pendingToolCalls: import("vue").Ref<Array>,
 *   chatContainer: import("vue").Ref<HTMLElement|null>,
 *   cancel: ReturnType<typeof import("./useChatCancel").useChatCancel>,
 *   pending: ReturnType<typeof import("./usePendingApproval").usePendingApproval>,
 *   toggles: { agentMode: import("vue").Ref<boolean> },
 *   options: { modelName: string, serverUrl: string, projectPath: string, systemPrompt: string, streamEnabled: boolean, verbose: boolean, soundEnabled: boolean, soundVolume: number },
 *   emitWarning: (message: string) => void
 * }} deps
 */
export function useChatSend({
  messages,
  approvalMessages,
  pendingToolCalls,
  chatContainer,
  cancel,
  pending,
  toggles,
  options,
  emitWarning,
}) {
  const isTyping = ref(false);
  const isStreaming = ref(false);
  const streamingContent = ref("");
  const streamingReasoning = ref("");
  const reasoningDone = ref(false);

  const { send: playSend, receive: playReceive, setVolume, cleanup: cancelVoice } = options.sound;
  void setVolume;
  void cancelVoice;

  /**
   * Прокручивает контейнер сообщений вниз (после добавления/стриминга).
   */
  function scrollToBottom() {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    }
  }

  /**
   * Отправляет сообщение через agent loop (если agentMode=true) или direct chat.
   * @param {string} text
   * @param {(entry: { message: string, type: string }) => void} emitLog
   * @param {(usage: any) => void} emitTokenUsage
   */
  async function sendMessage(text, emitLog, emitTokenUsage) {
    if (!text.trim()) return;
    if (isTyping.value || isStreaming.value) return;

    // API-BASE guard: блокируем запрос, если в настройках не задан endpoint.
    // Покрывает случай, когда пользователь не настроил `apiBases` в Параметрах
    // и/или `serverUrl` остался пустым после `loadApiBases`.
    if (!options.serverUrl || !options.serverUrl.trim()) {
      const msg = "API-BASE не задан. Укажите его в разделе Параметры → API-BASE.";
      emitWarning?.(msg);
      emitLog({ message: `[ERROR] ${msg}`, type: "error" });
      return;
    }

    const controller = cancel.createController();
    const startTime = Date.now();

    messages.value.push({ role: "user", content: text });
    if (options.soundEnabled) playSend();
    isTyping.value = true;
    cancel.isCancelling.value = false;

    await nextTick();
    scrollToBottom();

    if (options.verbose) {
      emitLog({
        message: `[VERBOSE] Request → model: ${options.modelName}, server: ${options.serverUrl}`,
        type: "system",
      });
    }

    if (toggles.agentMode.value) {
      await sendAgentFlow(
        text,
        controller,
        (abortId) => cancel.attachAbortId(abortId),
        startTime,
        emitLog,
        emitTokenUsage
      );
    } else if (options.streamEnabled) {
      await sendStreamFlow(text, controller, startTime, emitLog, emitTokenUsage);
    } else {
      await sendDirectFlow(text, controller, startTime, emitLog, emitTokenUsage);
    }

    await nextTick();
    scrollToBottom();
  }

  /**
   * Agent loop: один вызов agentChat, обработка tool calls/results/approval.
   */
  async function sendAgentFlow(text, controller, attachAbortId, startTime, emitLog, emitTokenUsage) {
    const abortId = genId();
    attachAbortId(abortId);

    if (options.streamEnabled) {
      isTyping.value = false;
      isStreaming.value = true;
      streamingContent.value = "";
      streamingReasoning.value = "";
      reasoningDone.value = false;

      const botMsgIdx = messages.value.length;
      messages.value.push({ role: "bot", content: "", streaming: true, reasoning: "", reasoningExpanded: false });

      try {
        const result = await agentChatStream(
          {
            message: text,
            messages: messages.value
              .filter((m) => !m.type)
              .map((m) => ({ role: m.role === "bot" ? "assistant" : m.role, content: m.content })),
            accountName: "",
            projectPath: options.projectPath,
            serverUrl: options.serverUrl,
            modelName: options.modelName,
            systemPrompt: options.systemPrompt,
          },
          {
            onReasoning: (chunk, accumulated) => {
              streamingReasoning.value = accumulated;
              messages.value[botMsgIdx].reasoning = accumulated;
            },
            onReasoningDone: () => {
              reasoningDone.value = true;
            },
            onContent: (chunk, accumulated) => {
              streamingContent.value = accumulated;
              messages.value[botMsgIdx].content = accumulated;
              nextTick(() => scrollToBottom());
            },
          },
          controller.signal,
          abortId
        );

        isStreaming.value = false;
        if (options.soundEnabled) playReceive();

        if (result.error && !result.cancelled) {
          throw new Error(result.error);
        }

        if (result.cancelled) {
          messages.value[botMsgIdx].content = "🔴 Cancelled";
          messages.value[botMsgIdx].streaming = false;
          emitLog({ message: "Agent loop cancelled", type: "warning" });
          return;
        }

        if (result.reply) {
          messages.value[botMsgIdx].content = result.reply;
          messages.value[botMsgIdx].streaming = false;
          if (result.reasoning) {
            messages.value[botMsgIdx].reasoning = result.reasoning;
          }
          const normalized = normalizeUsage(result.tokenUsage);
          messages.value[botMsgIdx].usage = normalized;
          if (normalized) emitTokenUsage(normalized);
        }

        pending.addToolMessages(
          result.toolCalls,
          result.toolResults,
          result.requiresApproval,
          result.approvalToolName,
          result.approvalArgs,
          result.approvalToolCallId
        );

        approvalMessages.value = result.messages || [];
        pendingToolCalls.value = result.pendingToolCalls || [];

        const latency = Date.now() - startTime;
        if (options.verbose) {
          const toolCount = (result.toolCalls?.length || 0) + (result.toolResults?.length || 0);
          emitLog({
            message: `[VERBOSE] Agent loop (${latency}ms): ${result.reply?.substring(0, 100) || "empty"}, tools: ${toolCount}`,
            type: "success",
          });
        } else {
          emitLog({
            message: `Agent response (${latency}ms): ${result.reply?.substring(0, 100)}...`,
            type: "success",
          });
        }
      } catch (error) {
        const latency = Date.now() - startTime;
        isStreaming.value = false;
        if (error.name === "AbortError") {
          if (messages.value[botMsgIdx]?.streaming) {
            messages.value[botMsgIdx].content = "🔴 Cancelled";
            messages.value[botMsgIdx].streaming = false;
          }
          emitLog({ message: `Agent cancelled (${latency}ms)`, type: "warning" });
        } else {
          messages.value.push({ role: "bot", content: `❌ Ошибка: ${error.message}` });
          emitLog({ message: `Agent error (${latency}ms): ${error.message}`, type: "error" });
        }
      } finally {
        cancel.clearAbort(controller);
        cancel.clearAbortId(abortId);
      }
      return;
    }

    try {
      const result = await agentChat(
        {
          message: text,
          messages: messages.value
            .filter((m) => !m.type)
            .map((m) => ({ role: m.role === "bot" ? "assistant" : m.role, content: m.content })),
          accountName: "",
          projectPath: options.projectPath,
          serverUrl: options.serverUrl,
          modelName: options.modelName,
          systemPrompt: options.systemPrompt,
        },
        controller.signal,
        abortId
      );

      isTyping.value = false;
      if (options.soundEnabled) playReceive();

      if (!result.success) {
        throw new Error(result.error || "Agent loop failed");
      }

      if (result.cancelled) {
        messages.value.push({ role: "system", content: "🔴 Cancelled", type: "cancelled" });
        emitLog({ message: "Agent loop cancelled", type: "warning" });
        return;
      }

      if (result.reply) {
        const normalized = normalizeUsage(result.tokenUsage);
        messages.value.push({
          role: "bot",
          content: result.reply,
          reasoning: result.reasoning || "",
          reasoningExpanded: false,
          usage: normalized,
        });
        if (normalized) emitTokenUsage(normalized);
      }

      pending.addToolMessages(
        result.toolCalls,
        result.toolResults,
        result.requiresApproval,
        result.approvalToolName,
        result.approvalArgs,
        result.approvalToolCallId
      );

      approvalMessages.value = result.messages || [];
      pendingToolCalls.value = result.pendingToolCalls || [];

      const latency = Date.now() - startTime;
      if (options.verbose) {
        const toolCount = (result.toolCalls?.length || 0) + (result.toolResults?.length || 0);
        emitLog({
          message: `[VERBOSE] Agent loop (${latency}ms): ${result.reply?.substring(0, 100) || "empty"}, tools: ${toolCount}`,
          type: "success",
        });
      } else {
        emitLog({
          message: `Agent response (${latency}ms): ${result.reply?.substring(0, 100)}...`,
          type: "success",
        });
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      isTyping.value = false;
      if (error.name === "AbortError") {
        messages.value.push({ role: "bot", content: "🔴 Cancelled" });
        emitLog({ message: `Agent cancelled (${latency}ms)`, type: "warning" });
      } else {
        messages.value.push({ role: "bot", content: `❌ Ошибка: ${error.message}` });
        emitLog({ message: `Agent error (${latency}ms): ${error.message}`, type: "error" });
      }
    } finally {
      cancel.clearAbort(controller);
      cancel.clearAbortId(abortId);
    }
  }

  /**
   * Streaming direct chat: SSE chunks, обновление последнего bot-сообщения по мере прихода.
   */
  async function sendStreamFlow(text, controller, startTime, emitLog, emitTokenUsage) {
    isStreaming.value = true;
    isTyping.value = false;
    streamingContent.value = "";
    streamingReasoning.value = "";
    reasoningDone.value = false;

    const botMsgIdx = messages.value.length;
    messages.value.push({ role: "bot", content: "", streaming: true, reasoning: "", reasoningExpanded: false });

    let fullContent = "";
    let lastUsage = null;

    try {
      await directChatStream(
        {
          message: text,
          modelName: options.modelName,
          serverUrl: options.serverUrl,
          projectPath: options.projectPath,
          systemPrompt: options.systemPrompt,
        },
        {
          onReasoning: (_chunk, accumulated) => {
            streamingReasoning.value = accumulated;
            messages.value[botMsgIdx].reasoning = accumulated;
          },
          onReasoningDone: () => {
            reasoningDone.value = true;
          },
          onContent: (_chunk, accumulated) => {
            fullContent = accumulated;
            streamingContent.value = accumulated;
            messages.value[botMsgIdx].content = accumulated;
            nextTick(() => scrollToBottom());
          },
          onDone: (usage) => {
            const normalized = normalizeUsage(usage);
            lastUsage = normalized;
            messages.value[botMsgIdx].streaming = false;
            messages.value[botMsgIdx].usage = normalized;
            if (normalized) emitTokenUsage(normalized);
          },
          onError: (error) => {
            throw new Error(error);
          },
        },
        controller.signal
      );

      const latency = Date.now() - startTime;
      isStreaming.value = false;
      if (options.soundEnabled) playReceive();

      if (options.verbose) {
        emitLog({
          message: `[VERBOSE] Response ← model (${latency}ms): ${fullContent.substring(0, 100) || "empty"}`,
          type: "success",
        });
        if (lastUsage) {
          emitLog({
            message: `[VERBOSE] Tokens: prompt=${lastUsage.prompt_tokens}, completion=${lastUsage.completion_tokens}, total=${lastUsage.total_tokens}, cached=${lastUsage.prompt_tokens_details?.cached_tokens ?? "N/A"}`,
            type: "info",
          });
        }
      } else {
        emitLog({
          message: `Model response (${options.modelName}): ${fullContent.substring(0, 100)}...`,
          type: "success",
        });
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      isTyping.value = false;
      if (options.soundEnabled) playReceive();
      isStreaming.value = false;
      if (error.name === "AbortError") {
        const lastIdx = messages.value.length - 1;
        if (messages.value[lastIdx]?.streaming) {
          messages.value[lastIdx].content = "🔴 Cancelled";
          messages.value[lastIdx].streaming = false;
        } else {
          messages.value.push({ role: "bot", content: "🔴 Cancelled" });
        }
        emitLog({ message: `Chat cancelled (${latency}ms)`, type: "warning" });
      } else {
        messages.value.push({ role: "bot", content: `❌ Ошибка: ${error.message}` });
        emitLog({ message: `Chat error (${latency}ms): ${error.message}`, type: "error" });
      }
    } finally {
      cancel.clearAbort(controller);
    }
  }

  /**
   * Non-streaming direct chat: один запрос, ждём полный ответ.
   */
  async function sendDirectFlow(text, controller, startTime, emitLog, emitTokenUsage) {
    try {
      const data = await directChat(
        {
          message: text,
          modelName: options.modelName,
          serverUrl: options.serverUrl,
          projectPath: options.projectPath,
          systemPrompt: options.systemPrompt,
        },
        controller.signal
      );

      const latency = Date.now() - startTime;
      isTyping.value = false;

      const normalized = normalizeUsage(data.usage);
      const botMsg = {
        role: "bot",
        content: data.reply || "Пустой ответ",
        reasoning: data.reasoning || "",
        usage: normalized,
      };
      messages.value.push(botMsg);

      if (options.verbose) {
        emitLog({
          message: `[VERBOSE] Response ← model (${latency}ms): ${data.reply || "empty"}`,
          type: "success",
        });
        if (normalized) {
          emitLog({
            message: `[VERBOSE] Tokens: prompt=${normalized.prompt}, completion=${normalized.completion}, total=${normalized.total}, cached=${normalized.cached}`,
            type: "info",
          });
        }
      } else {
        emitLog({
          message: `Model response (${options.modelName}): ${data.reply?.substring(0, 100)}...`,
          type: "success",
        });
      }

      if (normalized) emitTokenUsage(normalized);
    } catch (error) {
      const latency = Date.now() - startTime;
      isTyping.value = false;
      if (options.soundEnabled) playReceive();
      if (error.name === "AbortError") {
        messages.value.push({ role: "bot", content: "🔴 Cancelled" });
        emitLog({ message: `Chat cancelled (${latency}ms)`, type: "warning" });
      } else {
        messages.value.push({ role: "bot", content: `❌ Ошибка: ${error.message}` });
        emitLog({ message: `Chat error (${latency}ms): ${error.message}`, type: "error" });
      }
    } finally {
      cancel.clearAbort(controller);
    }
  }

  /**
   * Re-send user message: cancel active, remove trailing context, переотправить.
   * @param {Object} msg — user-сообщение
   * @param {number} index — его индекс в messages
   * @param {(text: string) => void} sendFn — функция отправки
   */
  async function resendMessage(msg, index, sendFn) {
    if (cancel.abortController.value) {
      cancel.handleStop();
      let w = 0;
      while ((isTyping.value || isStreaming.value) && w < 40) {
        await new Promise((r) => setTimeout(r, 50));
        w++;
      }
    }
    messages.value.splice(index + 1);
    const text = msg.content;
    messages.value.splice(index, 1);
    await sendFn(text);
  }

  return {
    isTyping,
    isStreaming,
    sendMessage,
    resendMessage,
    scrollToBottom,
  };
}
