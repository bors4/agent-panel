# AI Agent Control Panel — Quick Reference

## Architecture

**Monorepo (single package.json at root):**
- `aiagent-be/server.js` — Express + GrammY backend entry point
- `aiagent-be/routes/api.js` — API route handlers (extracted from server.js)
- `aiagent-be/lib/` — Core modules (agent, tools, accounts, logger, sessions, utils)
- `aiagent-web-panel/` — Vue 3 frontend (Vite + Pinia)

## Dev Commands

```bash
npm run dev          # Both frontend + backend
npm run frontend:dev # Frontend only (port 5173, /api proxies to :3000)
npm run backend:dev  # Backend only (port 3000)
npm run build        # Build frontend
npm start            # Start backend only
npm run test:all     # Run all tests (89 backend + 22 frontend)
npm run backend:test # Backend tests only
npm run frontend:test # Frontend tests only
```

## Important Quirks

- **Vue beta**: Root package.json has Vue "beta" overrides. This is intentional, do not change.
- **Backend has no package.json**: All dependencies live in root `package.json`.
- **API URL**: Use `http://127.0.0.1:3000/api` (not `localhost`). Frontend proxy configured for this.
- **No linter/formatter**: Project does not use ESLint, Prettier, or TypeScript.
- **Node version**: `^20.19.0 || >=22.12.0`

## Config Flow (CRITICAL)

**Two config objects exist — they must stay in sync:**
1. `server.js` `config` — source of truth, passed to API router and Telegram bot handlers
2. `agentLoop.js` `config` — used by `agentLoopStep()` and `buildToolExecConfig()`

**Sync mechanism:**
- `server.js` calls `updateAgentConfig(config)` at startup to seed `agentLoop.js`
- `POST /api/config` updates `server.js` config, then calls `updateAgentConfig(config)` to sync
- `updateAgentConfig` uses `Object.assign` — both objects are separate but kept in sync

**projectPath priority on frontend startup (`App.vue` onMounted):**
1. Load `localStorage` (`agent-config`)
2. If `projectPath` exists in localStorage → `POST /api/config` to sync to backend (overrides `.env`)
3. If no `projectPath` in localStorage → load from backend (`GET /api/config`, falls back to `.env`)
4. If neither has `projectPath` → show warning, block bot start

**`.env` behavior:**
- `PROJECT_PATH` in `.env` is the initial default only
- `path.resolve("")` on Windows returns cwd — if `PROJECT_PATH` is empty, `server.js` sets `projectPath = ""` explicitly
- Once user saves a path via UI, it overrides `.env` via `POST /api/config`

## API Client (Frontend)

- File: `aiagent-web-panel/src/api/client.js`
- Auth header: `x-api-key: agent-secret-key`
- All settings persisted to `localStorage` as `agent-config`
- Built-in exponential backoff reconnect on connection loss

## Key Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/status` | botStatus, stats (requests/tools/errors), uptime, tokenUsage |
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
| GET | `/api/accounts` | List user accounts |
| POST | `/api/accounts` | Save user accounts |
| POST | `/api/accounts/import` | Import accounts from JSON |
| POST | `/api/agent/tool` | Direct tool call by agent (name, args, projectPath) |

## Backend State

- `config` object: in-memory, persists no config files
  - `serverUrl`, `modelName`, `projectPath`, `systemPrompt`, `apiKey`
  - `maxTokens` (default 8192), `temperature` (default 0.1), `timeout` (default 120000ms)
- `chatHistories`: `Map<chatId, messages[]>` per Telegram user
- `agentLogs`: array of `{time, message, type}` with max 200 entries
- `stats`: `{requests, tools, errors}` — reset on `/api/stop`
- `pendingApprovals`: `Map<chatId, pendingTool>` — tools awaiting user confirmation
- `tokenUsage`: `{prompt, completion, total, cached}` — accumulated across all AI requests

## System Prompt Construction

Every AI request includes:
```
You are AI assistant in: {projectPath}
IMPORTANT: Use ONLY RELATIVE paths!
  GOOD: "test.txt", "src/app.js"
  BAD: "E:\Git\test_project\file.txt"

Commands:
  write - create file (filePath RELATIVE, content)
  read - read file (filePath RELATIVE)
  ...

WINDOWS RULES:
- Wrap URLs with & in quotes
- Do NOT use jq. Use PowerShell
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

## Path Safety (`safePath` in utils.js)

- Resolves user paths relative to `projectRoot`
- Rejects paths outside project (traversal attacks)
- **Handles absolute paths**: if user passes absolute path, checks if it's within `projectRoot`
- Normalizes to forward slashes for comparison

## Account System

Users are authenticated by Telegram username. Accounts stored in `accounts.json` at project root.

**Roles:**
- `system` — full access to all tools
- `user` — read, write, search, list_dir, create_dir
- `guest` — read only

**Account fields:**
- `username` — Telegram username (with or without @)
- `role` — system/user/guest
- `permissions` — per-tool overrides
- `include_paths` — restrict file operations to specific directories
  - **Root drive paths** (e.g., `E:\`) allow access to all directories on that drive
  - Subdirectory paths (e.g., `E:\Git`) restrict to that directory and children only

## Agent Tools

Available tools: `read`, `write`, `search`, `list_dir`, `execute`, `create_dir`, `delete`, `move`, `copy`

Tool configuration per tool:
- `enabled` — true/false
- `permission` — "ask" (inline keyboard), "always" (auto), "deny"
- `exclude_paths` — ["node_modules", ".git", etc.]

## Bot Commands

`/start`, `/help`, `/model`, `/clear`, `/tools`

## Vue Component Patterns

- **Avoid**: `v-model` on props (causes recursive update warnings)
- **Use instead**: Local ref + `emit("update:modelValue", value)`
- **State**: Pinia store (`src/stores/`) + localStorage
- **SettingsTab**: Uses `configCopy` reactive + `watch(props.config)` with debounce (300ms auto-save)

## Testing

- **Backend**: Vitest in `aiagent-be/tests/` — 89 tests
  - `server.test.js` — safePath, parseToolCall, executeTool, session, logger
  - `accounts.test.js` — account management, permissions, roles
  - `agentLoop.test.js` — config, system message building
  - `utils.test.js` — utility functions
- **Frontend**: Vitest in `aiagent-web-panel/src/` — 22 tests
  - `useToast.test.js` — toast notifications
  - `settings.test.js` — Pinia store
  - `client.test.js` — API client connection state
  - `StatsCard.test.js` — token usage visualization

## Known Issues (see TODO.md)

- `continueAfterApproval` may return `AI API error: 400` after multiple tool calls — model sometimes returns both `content` and `tool_calls` simultaneously
- Context size calculation sums tokens manually instead of using server `usage` data
