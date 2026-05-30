# AI Agent Control Panel — Quick Reference

## Architecture

**Monorepo (single root `package.json`):**

- `aiagent-be/server.js` — Express + GrammY entry point
- `aiagent-be/routes/api.js` — API route factory, called from `server.js`
- `aiagent-be/lib/agent/` — Agent loop + tool execution
- `aiagent-be/lib/` — Logger, accounts, utils
- `aiagent-web-panel/` — Vue 3 + Vite + Pinia (separate `package.json`, deps inherited via root overrides)

## Dev Commands

| Command | What |
|---|---|
| `npm run dev` | Both frontend + backend (concurrently) |
| `npm run backend:dev` | Backend only (port 3000) |
| `npm run frontend:dev` | Frontend only (port 5173, `/api` → `127.0.0.1:3000`) |
| `npm run test:all` | All tests (165 backend + 32 frontend = 197 total) |
| `npm run backend:test` | Backend tests (Vitest, 6 files) |
| `npm run frontend:test` | Frontend tests (Vitest, 6 files) |
| `npm run lint` | ESLint flat config (0 errors, 0 warnings) |
| `npm run lint:fix` | Auto-fix |
| `npm run format` | Prettier (js, vue, css, html only) |

## Quirks & Gotchas

- **Vue beta overrides**: Root `package.json` has `"vue": "beta"` overrides — **do not change**.
- **Backend has no `package.json`**: All Express/GrammY deps live in root `package.json`.
- **ESM only**: `"type": "module"` everywhere — use `import`/`export`, never `require()`.
- **API URL**: Use `http://127.0.0.1:3000/api` (not `localhost`). Frontend proxy targets `127.0.0.1`.
- **Auth middleware added**: `x-api-key` header is sent by frontend and **required** on backend (except `/health`).
- **ESLint + Prettier**: Flat config in `eslint.config.js`, `.prettierrc` (printWidth 120, singleQuote false). `.prettierignore` excludes `*.md`, `*.json`. `no-empty` is `off`, `no-console` is `off`.
- **Node**: `^20.19.0 || >=22.12.0` (Node 20+ global fetch & AbortController).
- **postinstall**: Auto-runs `cd aiagent-web-panel && npm install`.
- **OpenRouter support**: Detected by URL containing `"openrouter.ai"` — auto-switches to `Authorization: Bearer`, `HTTP-Referer`, `X-OpenRouter-Title` headers. API key configurable via UI (`openrouterApiKey`).
- **Chat mode**: `chatMode: false` by default. When enabled, system prompt is minimal and `projectPath` is ignored; uses `include_paths[0]` for file context.

## Config Flow (CRITICAL)

**Two separate config objects must stay in sync:**
1. `server.js:config` — source of truth, passed to API router & bot handlers
2. `agentLoop.js:config` — used by `agentLoopStep()` and `buildToolExecConfig()`

**Sync**: `server.js` calls `updateAgentConfig(config)` at startup and after `POST /api/config`. Uses `Object.assign`.

**`projectPath` priority** (App.vue onMounted):
1. `localStorage` `agent-config` → `POST /api/config` (overrides defaults)
2. If none → `GET /api/config` (returns current server config, from `configDefaults.js` or previous API update)
3. If still none → show warning, block bot start

**`.env`**: `PROJECT_PATH` is NOT read from `.env` by the backend. The initial value is `""` from `configDefaults.js`. Set `projectPath` via the web UI Settings tab. Once saved, it persists in the server runtime config.

## WebSocket

- Backend: `ws` server on `/ws`, 30s heartbeat, `wsBroadcast(type, data)`
- Frontend: `useWebSocket.js` composable — auto-reconnect with exponential backoff
- Events: `status`, `stats`, `log`, `tokenUsage`
- `useAgent.js` relies entirely on WebSocket + initial HTTP state load (no polling)

## Agent Tool Loop

1. AI model receives user message + fresh system prompt (always prepended, not stored in history)
2. Model responds with: **final answer**, **function call** (auto or "ask" approval), or **XML-style** (`parseToolCall()`)
3. Tool results fed back; max **5 iterations** per message
4. `answerCallbackQuery` must be called **immediately** before any async work (Telegram 30s timeout)

## Path Safety (`safePath` in `utils.js`)

- Resolves relative to `projectRoot`, rejects traversal (`path.relative()` check)
- Absolute paths allowed only if within `projectRoot`
- `.toLowerCase()` normalization **on Windows only** (Linux: case-sensitive)
- Symlinks resolved via `fs.realpathSync()` (recursive parent-walk for non-existent paths)

## Execute Tool (Windows)

- **cwd**: Always `projectPath`, **not** `account.include_paths`
- **Shell**: PowerShell via `powershell.exe` directly; everything else via `cmd.exe /d /c`
- **No `chcp 65001`**: Removed (crashes some Windows systems)
- **Exit codes**: `success: false` when `exitCode !== 0`
- **Default timeout**: 30s (no async execution yet — see TODO #14)
- **Timeout=0** bug: `args.timeout || 30` treats `0` as 30 (see TODO P2-#8)

## Account System

Storage: `accounts.json` at project root. Auth by Telegram username.

Roles: `system` (all), `user` (read/write/search/list_dir/create_dir), `guest` (read only).

Per-tool overrides via `permissions` object. `include_paths` restricts file operations.

**Known bug**: `execute` tool ignores `include_paths` for non-system roles (see TODO P2-#18).

## Config Defaults

| Field | Default | Note |
|---|---|---|---|
| maxTokens | 1024 | `parseInt() ||` — NaN/0 falls to default |
| temperature | 0.1 | `||` operator — can set 0 (fixed) |
| timeout | 300000ms | |
| maxFileChars | 2000 | |
| maxHistoryPairs | 5 | |
| maxSearchResults | 15 | |
| maxFilesInPrompt | 2 | |
| maxSearchFileSize | 1048576 (1 MB) | |
| stream | true | SSE streaming enabled by default |
| insertUserAfterTool | true | Inserts "Continue" after tool messages |
| chatMode | false | Minimal system prompt, no projectPath |

## Vue Component Patterns

- **No `v-model` on props**: Use local ref + `emit("update:modelValue", value)`
- **State**: Pinia store (`src/stores/`) + `localStorage` (`agent-config` key)
- **SettingsTab**: `configCopy` reactive + `watch` with 300ms debounce auto-save
- **Vite HMR overlay**: Disabled (prevents false error popups)
- **Dead files removed**: `session.js`, `settings.js` (Pinia store), `openai` package

## API Endpoints

All under `/api` (public: `/health`):

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | Bot status + AI server reachability, no auth |
| GET | `/status` | botStatus, stats, uptime, tokenUsage |
| GET | `/config` | Current config (secrets stripped; returns `hasToken: boolean`) |
| POST | `/config` | Update config fields |
| GET | `/models` | Fetch models from AI server |
| POST | `/chat` | Direct AI chat (no agent loop) |
| POST | `/chat/continue` | Continue agent loop after tool approval/denial |
| GET/POST | `/tools` | List/update tool config |
| GET/POST | `/accounts` | List/save accounts |
| POST | `/accounts/import` | Import accounts from JSON |
| POST | `/agent/tool` | Direct tool execution |
| POST | `/validate-path` | Validate file system path |
| GET | `/logs` | Recent logs (`?limit=N`) |
| DELETE | `/logs` | Clear logs |
| POST | `/start` | Start Telegram bot |
| POST | `/stop` | Stop bot, reset stats & histories |
| POST | `/restart` | Restart bot |
