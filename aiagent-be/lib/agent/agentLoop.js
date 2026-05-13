import { executeTool, getToolConfig, TOOLS } from "./executeTool.js";
import { parseToolCall } from "../utils.js";

export let config = {
  serverUrl: process.env.SERVER_URL || "http://192.168.1.101:1234/v1",
  modelName: process.env.MODEL_NAME || "qwen3.5-2b",
  projectPath: process.env.PROJECT_PATH || "E:\\Git\\agent-panel",
  apiKey: process.env.API_KEY || "agent-secret-key",
};

export function updateAgentConfig(newConfig) {
  Object.assign(config, newConfig);
}
export function getAgentConfig() {
  return { ...config };
}

function buildToolsDescription() {
  return Object.values(TOOLS)
    .map((t) => {
      const params = Object.entries(t.input_schema?.properties || {})
        .map(([name, info]) => "  " + name + ": " + (info.description || name))
        .join("\n");
      return t.name + ": " + t.description + "\n" + params;
    })
    .join("\n\n");
}

export function buildSystemMessage(
  projectPath,
  systemPrompt,
  useFunctionCalling,
) {
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

  if (systemPrompt) ctx += "\n" + systemPrompt;

  const td = buildToolsDescription();
  if (useFunctionCalling) {
    return ctx + td + "\n\nUse function calling.";
  } else {
    return (
      ctx +
      td +
      "\n\nUse: <tool_call><function>move</function><parameter=source>test.txt"
    );
  }
}

function extractBash(content) {
  const m = content.match(/`(?:bash|sh)?[\s\S]*?`/);
  return m ? m[0].replace(/`[a-z]*\n?/g, "").trim() : null;
}

export async function agentLoopStep(
  message,
  chatId,
  history = [],
  maxIterations = 5,
) {
  const toolConfig = getToolConfig();
  let messages = [
    {
      role: "system",
      content: buildSystemMessage(
        config.projectPath,
        config.systemPrompt,
        true,
      ),
    },
    ...history,
  ];
  if (message) messages.push({ role: "user", content: message });
  let iterations = 0,
    finalResponse = "",
    useFC = true;

  while (iterations < maxIterations) {
    iterations++;
    try {
      const body = {
        model: config.modelName,
        messages,
        max_tokens: config.maxTokens ?? 8192,
        temperature: config.temperature || 0.1,
      };
      if (useFC) {
        body.tools = Object.values(TOOLS)
          .filter((t) => toolConfig[t.name]?.enabled !== false)
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
      const resp = await fetch(config.serverUrl + "/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + config.apiKey,
        },
        body: JSON.stringify(body),
      });
      if (!resp.ok && useFC) {
        useFC = false;
        messages[0].content = buildSystemMessage(
          config.projectPath,
          config.systemPrompt,
          false,
        );
        continue;
      }
      if (!resp.ok) return { error: "AI error: " + resp.status };
      const data = await resp.json();
      const asst = data.choices?.[0]?.message;
      if (!asst) return { error: "Empty response" };
      const msg = data.choices?.[0]?.message;
      messages.push(msg);
      const content = msg?.content || "";

      if (asst.tool_calls?.length > 0) {
        for (const tc of asst.tool_calls) {
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
              content:
                "[TOOL APPROVAL REQUIRED] The user must approve: " +
                tn +
                "(" +
                JSON.stringify(ta) +
                ")",
            });
            return {
              requiresApproval: true,
              toolName: tn,
              args: ta,
              toolCallId: tc.id, // ← КРИТИЧНО: сохраняем ID от модели
              messages,
            };
          }
          const r = await executeTool(
            { name: tn, args: ta },
            { projectPath: config.projectPath },
          );
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
        const r = await executeTool(tc, { projectPath: config.projectPath });
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(r),
        });
        continue;
      }

      const bash = extractBash(content);
      if (bash && !useFC) {
        const r = await executeTool(
          { name: "execute", args: { command: bash } },
          { projectPath: config.projectPath },
        );
        messages.push({
          role: "tool",
          tool_call_id: tc?.id || `bash_${Date.now()}`,
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
  const finalMessages = messages.filter(
    (m) => !m.content?.includes("[TOOL APPROVAL REQUIRED]"),
  );
  return { response: finalResponse, messages: finalMessages };
}


