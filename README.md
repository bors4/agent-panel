# AI Agent Control Panel

Monorepo with Vue 3 frontend dashboard and Express/GrammY backend for controlling an AI agent via Telegram bot and REST API.

## Architecture

- **Backend** (`aiagent-be/`): Node.js + Express + GrammY
  - Telegram bot with message routing to AI model
  - REST API endpoints for status, logs, config management
  - Direct AI communication (no tool loop)
  - Agent tool loop with approval flow
  - Voice message support: OGG → ffmpeg → whisper (local or remote ASR)
  - Structured logging with rotation
  - Account-based access control
- **Frontend** (`aiagent-web-panel/`): Vue 3 + Vite
  - Dashboard for monitoring agent activity
  - Real-time status, logs, and configuration controls
  - Tool management and account administration
  - Voice input with Web Speech API (default) or server ASR (opt-in)

## Quick Start

```bash
# Install dependencies (root level)
npm install

# Set secrets as environment variables (see below)
# Then run both frontend and backend concurrently
npm run dev
```

## Setting Environment Variables

Secrets (`TELEGRAM_BOT_TOKEN`, `API_KEY`, `VITE_API_KEY`) **must** be set as OS environment variables. They are **not** stored in `.env` to prevent accidental leaks.

### Windows (PowerShell)

```powershell
# Current session
$env:TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
$env:API_KEY="your-api-key"
$env:VITE_API_KEY="your-api-key"

# Permanent (User scope)
[System.Environment]::SetEnvironmentVariable("TELEGRAM_BOT_TOKEN", "your-telegram-bot-token", "User")
[System.Environment]::SetEnvironmentVariable("API_KEY", "your-api-key", "User")
[System.Environment]::SetEnvironmentVariable("VITE_API_KEY", "your-api-key", "User")
```

### Linux / macOS

```bash
# Current session
export TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
export API_KEY="your-api-key"
export VITE_API_KEY="your-api-key"

# Permanent — add to ~/.bashrc, ~/.zshrc, or ~/.profile
echo 'export TELEGRAM_BOT_TOKEN="your-telegram-bot-token"' >> ~/.bashrc
echo 'export API_KEY="your-api-key"' >> ~/.bashrc
echo 'export VITE_API_KEY="your-api-key"' >> ~/.bashrc
source ~/.bashrc
```

### Non-secret config (optional)

Copy `.env.example` to `.env` and customize non-secret values:

```bash
cp .env.example .env
```

## Environment Variables

**Secrets** (set as OS env vars, NOT in `.env`):

| Variable             | Default                        | Description                                                                     |
| -------------------- | ------------------------------ | ------------------------------------------------------------------------------- |
| `TELEGRAM_BOT_TOKEN` | (optional)                     | Telegram bot token (can also be set via web UI)                                 |
| `API_KEY`            | `agent-secret-key`             | API key for AI server authentication                                            |
| `VITE_API_KEY`       | (required)                     | Frontend API key for authorizing requests to backend                            |
| `OPENROUTER_API_KEY` | (optional)                     | API key for OpenRouter (falls back to `openrouterApiKey` config field)          |

**Non-secret config** (safe to keep in `.env`):

| Variable         | Default                        | Description                                                                     |
| ---------------- | ------------------------------ | ------------------------------------------------------------------------------- |
| `API_PORT`       | `3000`                         | Backend API port                                                                |
| `FFMPEG_PATH`    | (auto-detect)                  | Absolute path to `ffmpeg.exe` — required on Windows for Telegram voice OGG → WAV |
| `ASR_SERVER_URL` | (empty)                        | Remote ASR server URL (whisper.cpp `/inference`). Empty = use local whisper-cpp |
| `ASR_TIMEOUT`    | `120000`                       | ASR request timeout in ms                                                       |

All other settings (`SERVER_URL`, `MODEL_NAME`, `SYSTEM_PROMPT`, `MAX_TOKENS`, `TEMPERATURE`, `TIMEOUT`, `PROJECT_PATH`, `asrLanguage`, `chatMode`, etc.) have built-in defaults from `configDefaults.js` and are configured via the web UI (Settings tab).

## Development

- **Frontend dev server**: Port 5173 with `/api` proxy to backend (127.0.0.1:3000)
- **Backend API**: http://127.0.0.1:3000/api
- **Node version**: ^20.19.0 or >=22.12.0

## Testing

```bash
# Run all tests
npm run test:all

# Backend tests only
npm run backend:test

# Frontend tests only
npm run frontend:test
```

- **Backend**: 352 tests covering safePath, parseToolCall, executeTool, accounts (incl. permission sanitisation), agentLoop (including result shape contract), asrClient (SSRF, sanitization, multipart), handleAgentResult, server, **module loadability (smoke)**, API endpoints, and per-sub-router factory units (config/asr/chat/admin)
- **Frontend**: 308 tests covering composables (useAgent, useToast, useVoiceInput, useWebSocket (incl. batched ring buffer), useToolsConfig, useAccounts, useSettingsForm, useAppConfig, useAppModels, useAppActions, useAppBoot, **useChatHistory, useChatToggles, useChatCancel, usePendingApproval**), API client, App, SettingsTab-related cards, ChatTab child components (**ChatHeader, MessageBubble, ChatInput, ConfirmDialog, ContextMenu**), StatsCard, ToolItem, AccountCard, ConfigCard, LimitsCard, BehaviorCard, DisplayCard, TabBar

## Documentation

```bash
# Generate JSDoc HTML documentation
npm run --prefix aiagent-web-panel docs:generate
```

Output goes to `docs/` directory — open `docs/index.html` in a browser.

## Build & Deploy

```bash
# Build frontend for production
npm run build

# Start backend in production mode
npm start
```

## API Endpoints

Most endpoints require `x-api-key` header with the value set in `VITE_API_KEY`. Only `/api/health` is public.

| Method | Endpoint               | Description                                 |
| ------ | ---------------------- | ------------------------------------------- |
| GET    | `/api/health`          | Health check (bot status, AI reachability)  |
| GET    | `/api/status`          | Server status, botStatus, stats, uptime     |
| GET    | `/api/logs?limit=N`    | Recent logs                                 |
| GET    | `/api/config`          | Current configuration                       |
| GET    | `/api/models`          | Fetch available models from AI server       |
| POST   | `/api/config`          | Update config (SSRF-validated for ASR URL)  |
| POST   | `/api/start`           | Start Telegram bot                          |
| POST   | `/api/stop`            | Stop bot, reset stats, clear chat histories |
| POST   | `/api/restart`         | Restart Telegram bot                        |
| POST   | `/api/chat`            | Direct chat with AI                         |
| POST   | `/api/chat/continue`   | Continue agent loop after tool approval/denial |
| POST   | `/api/chat/clean-text` | LLM-based cleanup of raw voice transcript    |
| GET    | `/api/asr/status`      | Probe remote ASR server reachability        |
| POST   | `/api/asr/transcribe`  | Transcribe audio (multer, max 25 MB)        |
| GET    | `/api/tools`           | List tools with config                      |
| POST   | `/api/tools`           | Update tool config                          |
| POST   | `/api/validate-path`   | Validate a file system path (used by frontend) |
| GET    | `/api/accounts`        | List user accounts                          |
| POST   | `/api/accounts`        | Save user accounts                          |
| POST   | `/api/accounts/import` | Import accounts from JSON                   |
| POST   | `/api/agent/tool`      | Direct tool call by agent                   |

## Runtime Details

- **WebSocket**: Real‑time updates (status, stats, logs, token usage, perfStats) via `/ws`.
- **OpenRouter support**: Automatic OpenRouter headers (`Authorization: Bearer`, `HTTP-Referer`, `X-OpenRouter-Title`) when `SERVER_URL` contains `openrouter.ai`. API key configurable via UI (`openrouterApiKey`). The `/api/models` endpoint can use an `x-openrouter-key` header override for model discovery.
- **Chat mode**: When `chatMode` is true the system prompt is minimal and the agent ignores `projectPath`; enables pure conversation.
- **Auth middleware**: All API routes (except `/health`) require `x‑api‑key` header matching `VITE_API_KEY`.
- **`include_paths`**: No special root‑drive handling – paths are resolved relative to `projectPath` and must stay within that directory.

## Voice Input

Voice messages are supported in both the Telegram bot and the web panel.

**Telegram bot:**

- OGG voice messages are downloaded, converted to 16 kHz mono WAV via `ffmpeg`, then transcribed.
- Transcription uses the **remote ASR server** (`ASR_SERVER_URL`, whisper.cpp `/inference` endpoint) if set, otherwise falls back to local `whisper-cpp-node`.
- The transcript is passed to the same `agentLoopStep()` as text messages (no separate path).
- Limits: 5 min duration, 25 MB file size, OGG only. Errors are sanitized before display.
- The TTS cleaning step uses `/api/chat/clean-text` (LLM with `temperature: 0.1`) to fix punctuation, casing, and remove filler words from the raw whisper output.
- `ffmpeg` is auto-detected on PATH, or set explicitly via `FFMPEG_PATH` in `.env`.

**Web panel:**

- **Web Speech API** (browser-native, real-time) is the default mode — free, no server round-trip.
- **Server ASR** (opt-in via Settings tab) uploads the recorded blob to `/api/asr/transcribe` and uses the same remote ASR server as Telegram.
- 5 min auto-stop with `setTimeout` safety; `MediaRecorder` stream tracks are stopped synchronously to release the mic indicator.
- A TEST button in the Settings tab probes `/api/asr/status` to verify connectivity.

**SSRF protection:** `ASR_SERVER_URL` is validated server-side. Loopback (`127.0.0.0/8`, `::1`), link-local (`169.254.0.0/16`, `fe80::/10`), `0.0.0.0/8`, `localhost`, `.local`, `.internal`, embedded credentials, and non-HTTP(S) schemes are blocked. Private LAN ranges (`10/8`, `172.16-31/12`, `192.168/16`) are allowed for self-hosted ASR servers.

## Account System

Users are authenticated by Telegram username via `accounts.json` in the project root:

```json
{
  "accounts": [
    {
      "username": "@username",
      "role": "system",
      "permissions": { "read": true, "write": true, "execute": true },
      "include_paths": ["/allowed/path"]
    }
  ]
}
```

**Roles:**

- `system` — full access to all tools
- `user` — read, write, search, list_dir, create_dir
- `guest` — read only

**Permissions:**

- `permissions` — per-tool enable/disable
- `include_paths` — restrict file operations to specific directories

## Statistics

Stats are tracked and displayed in the dashboard:

- **Uptime**: Time since bot started (seconds)
- **Requests**: Number of AI requests made
- **Tools**: Tool executions
- **Errors**: Failed requests
- **Token Usage**: Accumulated prompt, completion, total, cached, and tokensCached across all AI requests

Stats reset when bot is stopped.

## Project Structure

```
aiagent-be/
├── server.js              # Express + GrammY entry point
├── routes/
│   ├── api.js             # Thin API aggregator (mounts sub-routers, applies auth)
│   ├── middleware.js      # x-api-key auth (excludes /health)
│   ├── health.js          # GET /api/health (no auth)
│   ├── status.js          # GET /api/status
│   ├── logs.js            # GET/DELETE /api/logs
│   ├── tools.js           # GET/POST /api/tools
│   ├── accounts.js        # GET/POST /api/accounts, /api/accounts/import
│   ├── paths.js           # GET /api/validate-path, /api/directories, /api/browse-folder
│   ├── admin.js           # /api/start, /api/stop, /api/restart, /api/agent/tool, /api/tasks
│   ├── config.js          # GET/POST /api/config, GET /api/models
│   ├── asr.js             # POST /api/asr/transcribe, GET /api/asr/status
│   └── chat.js            # POST /api/chat, /api/chat/cancel, /api/chat/continue, /api/chat/clean-text
├── lib/
│   ├── agent/
│   │   ├── agentLoop.js   # Agent loop with tool execution
│   │   └── executeTool.js # Tool implementations
│   ├── asrClient.js       # ASR server client (SSRF-safe, sanitized multipart)
│   ├── whisper.js         # whisper-cpp-node ESM wrapper
│   ├── accounts.js        # Account management
│   ├── logger.js          # Structured logging with rotation
│   └── utils.js           # Path safety and tool call parsing
├── tests/                 # Backend tests (Vitest, 352 tests)
└── logs/                  # Application logs

aiagent-web-panel/
├── src/
│   ├── api/
│   │   └── client.js      # API client with reconnect logic
│   ├── components/        # Vue components
│   ├── composables/       # Vue composables (useAgent, useToast, useVoiceInput)
│   ├── stores/            # Pinia stores (settings)
│   └── styles/            # CSS styles
├── src/**/*.test.js       # Frontend tests (Vitest, 34 tests)
└── vite.config.js
```

## License

ISC
