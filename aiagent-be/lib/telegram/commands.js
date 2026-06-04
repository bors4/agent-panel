/**
 * Telegram bot command handlers: /start, /help, /status, /model, /clear,
 * /reset, /tools, /tasks, /cancel, /mode.
 * @module telegram/commands
 */
import { TOOLS } from "../agent/executeTool.js";
import { cancelTask, getActiveTasks } from "../agent/executeTool.js";
import { chatHistories, activeAgentControllers, pendingApprovals, config, runtime, stats, tokenUsage } from "../state.js";
import { addLog, updateStatus } from "./log.js";
import { replyMsg, REPLY_OPTS } from "./reply.js";

/**
 * Register all command handlers on a Bot instance.
 * @param {Object} b - GrammY Bot instance
 */
export function registerCommands(b) {
  b.command("start", (ctx) => {
    if (config.modelName === "Имя модели") {
      ctx.reply("⚠️ Модель не выбрана. Настройте модель в веб-интерфейсе.", REPLY_OPTS);
      return;
    }
    updateStatus("running", "Работает");
    const asrInfo = config.asrServerUrl ? `🎤 ASR: ${config.asrServerUrl} (${config.asrLanguage || "ru"})` : "🎤 ASR: local whisper";
    ctx.reply(
      `🤖 <b>AI Agent active!</b>\n\n` +
        `Model: <code>${config.modelName}</code>\n` +
        `Server: <code>${config.serverUrl}</code>\n` +
        `${asrInfo}\n` +
        `Mode: <b>${config.chatMode ? "chat" : "project"}</b>\n\n` +
        `Type /help for commands.`,
      REPLY_OPTS
    );
  });

  b.command("help", (ctx) => {
    ctx.reply(
      `📖 <b>Commands</b>\n\n` +
        `/start — Welcome + current config\n` +
        `/status — Bot state, model, tokens, tools\n` +
        `/help — This message\n` +
        `/model — Current model + server\n` +
        `/tools — Tools available for you\n` +
        `/tasks — Active background tasks\n` +
        `/reset — Clear conversation history\n` +
        `/cancel — Cancel current request\n` +
        `/mode chat|project — Switch context mode\n\n` +
        `💬 Text and 🎤 voice messages are both supported.`,
      REPLY_OPTS
    );
  });

  b.command("status", (ctx) => {
    const uptime = runtime.startTime ? Math.floor((Date.now() - runtime.startTime) / 1000) : 0;
    const hh = Math.floor(uptime / 3600);
    const mm = Math.floor((uptime % 3600) / 60);
    const ss = uptime % 60;
    const uptimeStr = `${hh}h ${mm}m ${ss}s`;
    const totalTools = Object.keys(TOOLS).length;
    ctx.reply(
      `🤖 <b>Agent Panel — Status</b>\n\n` +
        `Bot: ${config.botStatus || "idle"}\n` +
        `Model: <code>${config.modelName}</code>\n` +
        `Mode: <b>${config.chatMode ? "chat" : "project"}</b>\n` +
        `ASR: ${config.asrServerUrl ? `<code>${config.asrServerUrl}</code>` : "local whisper"}\n` +
        `Tools: ${totalTools} available\n` +
        `Stats: ${stats.requests} requests, ${stats.tools} tool calls, ${stats.errors} errors\n` +
        `Tokens: ${tokenUsage.total} total (${tokenUsage.prompt} prompt, ${tokenUsage.completion} completion)\n` +
        `Uptime: ${uptimeStr}`,
      REPLY_OPTS
    );
  });

  b.command("model", (ctx) => {
    ctx.reply(
      `Model: <code>${config.modelName}</code>\nServer: <code>${config.serverUrl}</code>\nASR: <code>${config.asrServerUrl || "local whisper"}</code>`,
      REPLY_OPTS
    );
  });

  b.command("clear", (ctx) => {
    chatHistories.delete(ctx.chat.id.toString());
    ctx.reply("🗑️ History cleared!", REPLY_OPTS);
  });

  b.command("reset", (ctx) => {
    const chatId = ctx.chat.id.toString();
    const had = chatHistories.has(chatId);
    chatHistories.delete(chatId);
    const controller = activeAgentControllers.get(chatId);
    if (controller && !controller.signal.aborted) {
      controller.abort();
      activeAgentControllers.delete(chatId);
    }
    const pending = pendingApprovals.get(chatId);
    if (pending) pendingApprovals.delete(chatId);
    if (!had) {
      ctx.reply("ℹ️ Nothing to reset — history was already empty.", REPLY_OPTS);
    } else {
      ctx.reply("✅ <b>Reset complete.</b>\n• History cleared\n• Active request cancelled\n• Pending approval removed", REPLY_OPTS);
    }
  });

  b.command("tools", (ctx) => {
    const account = ctx.account;
    const toolList = Object.entries(TOOLS)
      .map(([name, tool]) => {
        const enabled = account.permissions?.[name] !== false;
        const icon = enabled ? "✅" : "❌";
        return `${icon} <b>${name}</b>: ${tool.description}`;
      })
      .join("\n");
    ctx.reply(`📦 Tools for @${ctx.chat.username} (${account.role}):\n\n${toolList}`, REPLY_OPTS);
  });

  b.command("tasks", (ctx) => {
    const tasks = getActiveTasks();
    if (tasks.length === 0) {
      ctx.reply("No active tasks.", REPLY_OPTS);
      return;
    }
    const lines = tasks.map((t) => {
      const uptime = Math.floor(t.uptime / 1000);
      return `• <code>${t.taskId.substring(0, 8)}</code> <b>${t.command}</b> (${uptime}s)`;
    });
    ctx.reply(`⏳ Active tasks:\n${lines.join("\n")}`, REPLY_OPTS);
  });

  b.command("cancel", async (ctx) => {
    const chatId = ctx.chat.id.toString();
    const text = ctx.message?.text || "";
    const parts = text.trim().split(/\s+/);
    const taskIdArg = parts[1];

    const agentController = activeAgentControllers.get(chatId);
    if (agentController && !agentController.signal.aborted) {
      agentController.abort();
      if (activeAgentControllers.get(chatId) === agentController) {
        activeAgentControllers.delete(chatId);
      }
      const tasks = getActiveTasks();
      const killed = tasks.filter((t) => cancelTask(t.taskId));
      const tail = killed.length > 0 ? `\nKilled ${killed.length} subprocess task(s).` : "";
      await replyMsg(ctx, `❌ Cancelled.${tail}`);
      return;
    }

    const pending = pendingApprovals.get(chatId);
    if (pending) {
      pendingApprovals.delete(chatId);
      await replyMsg(ctx, `❌ Cancelled pending approval for ${pending.toolName}.`);
      return;
    }

    if (taskIdArg) {
      const tasks = getActiveTasks();
      const match = tasks.find((t) => t.taskId.startsWith(taskIdArg));
      if (!match) {
        await replyMsg(ctx, `❌ Task not found: ${taskIdArg}`);
        return;
      }
      if (cancelTask(match.taskId)) {
        await replyMsg(ctx, `❌ Cancelled task <code>${match.taskId.substring(0, 8)}</code>`);
      } else {
        await replyMsg(ctx, `⚠️ Task ${taskIdArg} is no longer running.`);
      }
      return;
    }

    await replyMsg(ctx, "No active request to cancel.");
  });

  b.command("mode", (ctx) => {
    const text = ctx.message?.text || "";
    const parts = text.trim().split(/\s+/);
    const mode = parts[1];
    if (mode === "chat") {
      config.chatMode = true;
      ctx.reply("✅ Chat mode enabled. No project context.", REPLY_OPTS);
    } else if (mode === "project") {
      config.chatMode = false;
      ctx.reply("✅ Project mode enabled.", REPLY_OPTS);
    } else {
      ctx.reply(
        `Current mode: <b>${config.chatMode ? "chat" : "project"}</b>\n\nUsage: /mode chat | /mode project`,
        REPLY_OPTS
      );
    }
  });

  // Silence unused import warning
  void addLog;
}
