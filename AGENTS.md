# AI Agent Control Panel — Quick Reference

## Architecture

**Monorepo (single root `package.json`):**

- `aiagent-be/server.js` — Express + GrammY entry point, owns the mutable `config` object
- `aiagent-be/routes/api.js` — Thin API route aggregator (54 LoC), mounts 11 sub-routers from `routes/`
- `aiagent-be/routes/{middleware,health,status,logs,tools,accounts,paths,admin,config,asr,chat}.js` — Sub-router factories, each takes `deps` (config, addLog, wsBroadcast, state, etc.) for testability
- `aiagent-be/lib/agent/` — Agent loop (`agentLoop.js`) + tool execution (`executeTool.js`)
- `aiagent-be/lib/asrClient.js` — SSRF-safe client for remote whisper.cpp ASR
- `aiagent-be/lib/whisper.js` — Local `whisper-cpp-node` ESM wrapper (fallback)
- `aiagent-be/lib/` — Logger, accounts, utils, configDefaults
- `aiagent-web-panel/` — Vue 3 + Vite + Pinia (separate `package.json`, deps inherited via root overrides)

## Dev Commands

| Command | What |
|---|---|
| `npm run dev` | Both frontend + backend (concurrently) |
| `npm run backend:dev` | Backend only (port 3000) |
| `npm run frontend:dev` | Frontend only (port 5173, `/api` → `127.0.0.1:3000`) |
| `npm run test:all` | All tests (352 backend + 308 frontend = 660 total) |
| `npm run backend:test` | Backend tests (Vitest, 7 files) |
| `npm run frontend:test` | Frontend tests (Vitest, 6 files — must run from `aiagent-web-panel/`) |
| `npm run lint` | ESLint flat config (0 errors, 0 warnings required) |
| `npm run lint:fix` | Auto-fix |
| `npm run format` | Prettier (js, vue, css, html only — `*.md` and `*.json` ignored) |

## Quirks & Gotchas

- **Vue beta overrides**: Root `package.json` has `"vue": "beta"` overrides — **do not change**.
- **Backend has no `package.json`**: All Express/GrammY deps (`express`, `grammy`, `ws`, `cors`, `multer`, `whisper-cpp-node`, etc.) live in root `package.json`.
- **ESM only**: `"type": "module"` everywhere — use `import`/`export`, never `require()`.
- **API URL**: Use `http://127.0.0.1:3000/api` (not `localhost`). Frontend proxy targets `127.0.0.1`.
- **Auth middleware**: `x-api-key` header sent by frontend and **required** on backend (except `/health`).
- **ESLint + Prettier**: Flat config in `eslint.config.js`, `.prettierrc` (printWidth 120, singleQuote false, trailingComma "es5"). `.prettierignore` excludes `*.md`, `*.json`. `no-empty` is `off`, `no-console` is `off`.
- **Node**: `^20.19.0 || >=22.12.0` (Node 20+ global fetch & AbortController).
- **postinstall**: Auto-runs `cd aiagent-web-panel && npm install` after root install.
- **OpenRouter support**: Detected by URL containing `"openrouter.ai"` — auto-switches to `Authorization: Bearer`, `HTTP-Referer`, `X-OpenRouter-Title` headers. API key configurable via UI (`openrouterApiKey`).
- **Chat mode**: `chatMode: false` by default. When enabled, system prompt is minimal and `projectPath` is ignored; uses `include_paths[0]` for file context.

## Config Flow

**Single mutable config object** — `config` is declared at `aiagent-be/server.js:657` and passed **by reference** to:

- The API aggregator (`routes/api.js`) + 11 sub-routers — reads + writes fields in `POST /api/config`
- `agentLoopStep(message, chatId, history, cfg, ...)` — `cfg` is the same reference
- Bot handlers — read directly via closure

Updates are direct field assignment (no `Object.assign`, no separate sync call). Because the object is shared by reference, changes made via `POST /api/config` are immediately visible to the agent loop and bot.

**`projectPath` priority** (App.vue onMounted):
1. `localStorage` `agent-config` → `POST /api/config` (overrides defaults)
2. If none → `GET /api/config` (returns current server config, from `configDefaults.js` or previous API update)
3. If still none → show warning, block bot start

**`.env`**: `PROJECT_PATH` is **NOT** read from `.env` by the backend. Initial value is `""` from `configDefaults.js`. Set `projectPath` via the web UI Settings tab. Once saved, it persists in the server runtime config.

**ASR env vars** (non-secret, safe in `.env`):
- `FFMPEG_PATH` — absolute path to `ffmpeg.exe` (auto-detected on PATH otherwise)
- `ASR_SERVER_URL` — remote whisper.cpp `/inference` URL. **Remote ASR preferred** — lower CPU/RAM, no model file download (saves ~1.5 GB on disk). Empty = local `whisper-cpp-node` fallback (model `large-v3-turbo`).
- `ASR_TIMEOUT` — ASR request timeout in ms (default `120000`)

**ASR architecture:**
- `aiagent-be/lib/asrClient.js` — SSRF-safe HTTP client for remote whisper.cpp server (POST multipart audio to `/inference`)
- `aiagent-be/lib/whisper.js` — Local `whisper-cpp-node` ESM wrapper (fallback only — CPU-intensive, ~1.5 GB model download)
- Voice input flow always goes through `agentLoopStep()` — same path as text, no separate route

## Voice Input

Supported in both Telegram bot and web panel. Same `agentLoopStep()` as text — no separate path.

**Telegram bot** (`server.js` `b.on("message:voice")`):
1. Hard limits: 5 min duration, 25 MB file size, OGG mime only
2. Download → unique tmp file IDs (`crypto.randomBytes(4)`)
3. `ffmpeg -i in.ogg -ar 16000 -ac 1 -f wav out.wav` via `execFile` (no shell)
4. Whisper: remote ASR if `ASR_SERVER_URL` set, else `whisper-cpp-node` (model `large-v3-turbo`)
5. Transcript → `agentLoopStep(transcript, ...)` — same path as text
6. All tmp files cleaned in `try/finally`
7. Whisper errors logged server-side, generic message to user (no path/token leak)

**Web panel** (`useVoiceInput.js` composable):
- **Web Speech API** (browser-native, real-time) — default mode, free
- **Server ASR** (opt-in via Settings tab) — uploads recorded blob to `/api/asr/transcribe`
- 5 min auto-stop via `setTimeout` (`MAX_RECORDING_MS`)
- `MediaRecorder` stream tracks stopped synchronously in `cancel()` and `onstop` to release mic indicator
- Language fallback: `options.language` → `navigator.language` → `"ru-RU"`
- `transcribeAudio(blob, lang, signal)` and `cleanText(text, signal)` accept `AbortSignal`

**SSRF protection** (`validateAsrUrl` in `asrClient.js`):
- Blocks: loopback (`127/8`, `::1`), link-local (`169.254/16`, `fe80:/10`), `0/8`, `localhost`, `.local`, `.internal`, embedded credentials, non-HTTP(S) schemes
- Allows: public IPs + private LAN (`10/8`, `172.16-31/12`, `192.168/16`) for self-hosted ASR
- Applied to `POST /api/config` when `asrServerUrl` is set

**LLM cleaning** (`/api/chat/clean-text`): LLM call with `temperature: 0.1` to fix punctuation, casing, and remove filler words from raw whisper output.

## WebSocket

Backend: `ws` server on `/ws`, 30s heartbeat, `wsBroadcast(type, data)`.
Frontend: `useWebSocket.js` composable — auto-reconnect with exponential backoff.

**Event types**: `status`, `stats`, `log`, `tokenUsage`, `perfStats`.

`useAgent.js` relies entirely on WebSocket + initial HTTP state load (no polling).

## Agent Loop — `agentLoopStep()` Result Shapes

`agentLoopStep()` can return 4 distinct result shapes. **All consumers MUST check in this order**:

1. `result.cancelled === true` — user pressed `/cancel` (or aborted); contains `response: "Cancelled"`
2. `result.requiresApproval === true` — tool needs `ask` permission; contains `toolName`, `args`, `messages`, `toolCallId`. **NO `response` field** — consumers must NOT call `result.response.replace()`.
3. `result.error` is truthy — contains error string, no `response` field
4. `result.response` is defined and not `"continue"` — final answer (with optional `reasoning`, `messages`, `tokenUsage`, `timings`)
5. `result.response === "continue"` — agent wants another iteration (recursion handled internally by `handleAgentResult`)

**Unified result handling**: both voice and text Telegram handlers call the same `handleAgentResult(ctx, chatId, result, account, draftMsgId, abortSignal)` function in `server.js:1135`. This function checks the shapes in order, saves to `pendingApprovals` for case #2, updates `chatHistories` from `result.messages` for case #4, and recurses for case #5.

**Do NOT duplicate this logic inline** — the previous voice handler had a 50-line `.then()` block that only checked `error`/`cancelled` and crashed on `requiresApproval` (TypeError on `result.response.replace()`). 4 regression tests in `agentLoop.test.js` cover all 4 shapes.

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
- **Timeout=0 bug**: `args.timeout || 30` treats `0` as 30 (see TODO P2-#8)

## Account System

Storage: `accounts.json` at project root. Auth by Telegram username.

Roles: `system` (all), `user` (read/write/search/list_dir/create_dir), `guest` (read only).

Per-tool overrides via `permissions` object. `include_paths` restricts file operations.

**Known bug**: `execute` tool ignores `include_paths` for non-system roles (see TODO P2-#18).

## Config Defaults

| Field | Default | Note |
|---|---|---|
| maxTokens | 1024 | `parseInt() ||` — NaN/0 falls to default |
| temperature | 0.1 | `isNaN()` guard — can set 0 |
| timeout | 300000ms | |
| maxFileChars | 2000 | |
| maxHistoryPairs | 5 | |
| maxSearchResults | 15 | |
| maxFilesInPrompt | 2 | |
| maxSearchFileSize | 1048576 (1 MB) | |
| stream | true | SSE streaming enabled by default |
| insertUserAfterTool | true | Inserts "Continue" after tool messages (works around qwen jinja issue) |
| chatMode | false | Minimal system prompt, no projectPath |
| asrServerUrl | "" | Empty = use local whisper-cpp-node |
| asrLanguage | "ru" | ISO 639-1 code |

## Vue Component Patterns

- **No `v-model` on props**: Use local ref + `emit("update:modelValue", value)`
- **State**: Composables (`src/composables/` — `useAgent`, `useToast`, `useSound`, `useVoiceInput`, `useWebSocket`, `useToolsConfig`, `useAccounts`, `useSettingsForm`, `useAppConfig`, `useAppModels`, `useAppActions`, `useAppBoot`, `useChatHistory`, `useChatToggles`, `useChatCancel`, `usePendingApproval`, `useChatSend`) + `localStorage` (`agent-config` key). The `src/stores/` directory is currently empty.
- **SettingsTab**: `configCopy` reactive + `watch` with 300ms debounce auto-save
- **Vite HMR overlay**: Disabled (prevents false error popups)
- **Frontend tests**: Must be run from `aiagent-web-panel/` (not repo root) — `npx vitest run` from there picks up the local `vitest.config.js` with the `@` alias.

## API Endpoints

All under `/api`. Public: `/health`. All others require `x-api-key` header.

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | Bot status + AI server reachability, no auth |
| GET | `/status` | botStatus, stats, uptime, tokenUsage |
| GET | `/config` | Current config (secrets stripped; returns `hasToken: boolean`) |
| POST | `/config` | Update config fields (SSRF-validated for `asrServerUrl`) |
| GET | `/models` | Fetch models from AI server |
| POST | `/chat` | Direct AI chat (no agent loop) |
| POST | `/chat/continue` | Continue agent loop after tool approval/denial |
| POST | `/chat/clean-text` | LLM-based cleanup of voice transcript |
| GET | `/asr/status` | Probe remote ASR server reachability |
| POST | `/asr/transcribe` | Transcribe audio (multer, max 25 MB) |
| GET/POST | `/tools` | List/update tool config |
| GET/POST | `/accounts` | List/save accounts |
| POST | `/accounts/import` | Import accounts from JSON |
| POST | `/agent/tool` | Direct tool execution |
| POST | `/validate-path` | Validate file system path (used by frontend) |
| GET | `/logs` | Recent logs (`?limit=N`) |
| DELETE | `/logs` | Clear logs |
| POST | `/start` | Start Telegram bot |
| POST | `/stop` | Stop bot, reset stats & histories |
| POST | `/restart` | Restart bot |
