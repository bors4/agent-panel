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
npm run lint         # ESLint check (0 errors, ~35 warnings)
npm run lint:fix     # ESLint auto-fix
npm run format       # Prettier format (js, vue, css, html only)
npm run format:check # Prettier check (CI)
```

## Important Quirks

- **Vue beta**: Root package.json has Vue "beta" overrides. This is intentional, do not change.
- **Backend has no package.json**: All dependencies live in root `package.json`.
- **API URL**: Use `http://127.0.0.1:3000/api` (not `localhost`). Frontend proxy configured for this.
- **ESLint + Prettier**: Flat config (`eslint.config.js`), `.prettierrc`. Backend uses Node globals, frontend uses Browser globals. `.prettierignore` excludes `*.md`, `*.json` — no noisy formatting in docs or config files.
- **Node version**: `^20.19.0 || >=22.12.0`
- **ESM only**: `"type": "module"` — use `import/export`, not `require()`
- **postinstall**: `npm install` auto-runs `cd aiagent-web-panel && npm install`

## WebSocket (replaces polling)

- Backend: `ws` server on `/ws`, heartbeat every 30s, `wsBroadcast(type, data)` in `server.js`
- Frontend: `useWebSocket.js` composable — auto-reconnect with exponential backoff, uptime ticker
- Event types: `status`, `stats`, `log`, `tokenUsage`
- `useAgent.js` no longer polls; relies entirely on WebSocket + initial HTTP state load
- Vite HMR overlay disabled to prevent false error popups during dev

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

| Method | Endpoint               | Purpose                                                                                          |
| ------ | ---------------------- | ------------------------------------------------------------------------------------------------ |
| GET    | `/api/status`          | botStatus, stats (requests/tools/errors), uptime, tokenUsage                                     |
| GET    | `/api/logs?limit=N`    | Recent agent logs                                                                                |
| GET    | `/api/config`          | Current configuration                                                                            |
| GET    | `/api/models`          | Fetch available models from AI server                                                            |
| POST   | `/api/config`          | Update config (modelName, serverUrl, projectPath, systemPrompt, maxTokens, temperature, timeout) |
| POST   | `/api/start`           | Start Telegram bot                                                                               |
| POST   | `/api/stop`            | Stop bot, reset stats, clear chat histories                                                      |
| POST   | `/api/restart`         | Restart Telegram bot                                                                             |
| POST   | `/api/chat`            | Direct chat with AI                                                                              |
| GET    | `/api/tools`           | List tools with config (enabled, permission, exclude_paths)                                      |
| POST   | `/api/tools`           | Update tool config (enabled, permission, exclude_paths)                                          |
| GET    | `/api/accounts`        | List user accounts                                                                               |
| POST   | `/api/accounts`        | Save user accounts                                                                               |
| POST   | `/api/accounts/import` | Import accounts from JSON                                                                        |
| POST   | `/api/agent/tool`      | Direct tool call by agent (name, args, projectPath)                                              |

## Backend State

- `config` object: in-memory, persists no config files
  - `serverUrl`, `modelName`, `projectPath`, `systemPrompt`, `apiKey`
  - `maxTokens` (default 8192), `temperature` (default 0.1), `timeout` (default 120000ms)
- `chatHistories`: `Map<chatId, messages[]>` per Telegram user — **system messages are filtered out** before storage
- `agentLogs`: array of `{time, message, type}` with max 200 entries
- `stats`: `{requests, tools, errors}` — reset on `/api/stop`
- `pendingApprovals`: `Map<chatId, pendingTool>` — tools awaiting user confirmation
- `tokenUsage`: `{prompt, completion, total, cached}` — accumulated across all AI requests

## System Prompt Construction

Every AI request includes a fresh system message prepended by `agentLoopStep()` or `continueAfterApproval()`:

- `truncateHistory()` **does NOT** return system messages — they are always prepended fresh
- `chatHistories` stores messages **without** system messages (filtered on write)
- `continueAfterApproval` builds its own system message before each AI call

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

## Execute Tool (Windows)

- **`cwd`**: Always uses `projectPath`, NOT `account.include_paths`
- **Shell**: PowerShell commands run via `powershell.exe` directly; all others via `cmd.exe /d /c`
- **No `chcp 65001`**: Causes crash on some Windows systems — removed
- **Exit codes**: `success: false` when `exitCode !== 0` (not always `true`)
- **Default timeout**: 30s — long-running commands (e.g. E2E tests) will timeout. See TODO #14 for async execution plan

## Callback Handling

- `answerCallbackQuery` must be called **immediately** on button click, before any async work
- Otherwise Telegram returns "query is too old" error
- `continueAfterApproval` runs asynchronously with `.catch()` error handler

## Vue Component Patterns

- **Avoid**: `v-model` on props (causes recursive update warnings)
- **Use instead**: Local ref + `emit("update:modelValue", value)`
- **State**: Pinia store (`src/stores/`) + localStorage
- **SettingsTab**: Uses `configCopy` reactive + `watch(props.config)` with debounce (300ms auto-save)
