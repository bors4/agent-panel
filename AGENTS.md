# AI Agent Control Panel — Quick Reference

## Architecture

**Monorepo (single package.json at root):**
- `aiagent-be/server.js` — Express + GrammY backend
- `aiagent-web-panel/` — Vue 3 frontend (Vite)

## Dev Commands

```bash
npm run dev          # Both frontend + backend
npm run frontend:dev # Frontend only (port 5173, /api proxies to :3000)
npm run backend:dev  # Backend only
npm run build        # Build frontend
npm start            # Start backend only
```

## Important Quirks

- **Vue beta**: Root package.json has Vue "beta" overrides. This is intentional, do not change.
- **Backend has no package.json**: All dependencies live in root `package.json`.
- **API URL**: Use `http://127.0.0.1:3000/api` (not `localhost`). Frontend proxy configured for this.
- **No linter/formatter**: Project does not use ESLint, Prettier, or TypeScript.

## API Client (Frontend)

- File: `aiagent-web-panel/src/api/client.js`
- Auth header: `x-api-key: agent-secret-key`
- All settings persisted to `localStorage` as `agent-config`

## Key Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/status` | botStatus, stats (requests/tools/errors), uptime |
| GET | `/api/logs?limit=N` | Recent agent logs |
| GET | `/api/config` | Current configuration |
| GET | `/api/models` | Fetch available models from AI server |
| POST | `/api/config` | Update config (modelName, serverUrl, projectPath, systemPrompt, maxTokens, temperature, timeout) |
| POST | `/api/start` | Start Telegram bot |
| POST | `/api/stop` | Stop bot, reset stats, clear chat histories |
| POST | `/api/restart` | Restart Telegram bot |
| POST | `/api/chat` | Direct chat with AI |
| GET | `/api/tools` | List tools with config (enabled, permission, exclude_paths) |
| POST | `/api/tools` | Update tool config (enabled, permission, exclude_paths) |
| POST | `/api/agent/tool` | Direct tool call by agent (name, args, projectPath) |

## Backend State

- `config` object: in-memory, persists no config files
  - `serverUrl`, `modelName`, `projectPath`, `systemPrompt`, `apiKey`
  - `maxTokens` (default 8192), `temperature` (default 0.1), `timeout` (default 120000ms)
- `chatHistories`: `Map<chatId, messages[]>` per Telegram user
- `agentLogs`: array of `{time, message, type}` with max 200 entries
- `stats`: `{requests, tools, errors}` — reset on `/api/stop`
- `pendingApprovals`: `Map<chatId, pendingTool>` — tools awaiting user confirmation

## System Prompt Construction

Every AI request includes:
```
You are an AI assistant in: {projectPath}

INSTRUCTIONS:
- Do NOT use absolute paths like "E:\..."
- Only access files relative to project path

{custom systemPrompt if set}
```

## Agent Tool Loop

1. AI model receives user message + system prompt
2. Model can respond with:
   - **Final answer** → returned to user
   - **Tool call** (function calling) → executed automatically if `permission: "always"`, or queued for approval if `permission: "ask"`
   - **XML-style tool call** → parsed by `parseToolCall()` in utils.js
3. Tool results are fed back to the model for follow-up
4. Maximum 5 iterations per message
5. If model requests approval → inline keyboard 👍/👎 sent to user

## Vue Component Patterns

- **Avoid**: `v-model` on props (causes recursive update warnings)
- **Use instead**: Local ref + `emit("update:modelValue", value)`
- **State**: Pinia store (`src/stores/`) + localStorage

## Agent Tools

Available tools for AI agent (execute, read, write files, etc.):
- `read` — Read file contents
- `write` — Create/overwrite file
- `search` — Search pattern in files
- `list_dir` — List directory contents
- `execute` — Run shell commands
- `create_dir` — Create directory
- `delete` — Delete file/directory
- `move` — Move/rename file
- `copy` — Copy file

Tool configuration per tool:
- `enabled` — true/false
- `permission` — "ask" (inline keyboard), "always" (auto), "deny"
- `exclude_paths` — ["node_modules", ".git", etc.]

## Bot Commands

`/start`, `/help`, `/model`, `/clear`, `/tools`

## Node Version

`^20.19.0 || >=22.12.0`