# AI Agent Control Panel

Monorepo with Vue 3 frontend dashboard and Express/GrammY backend for controlling an AI agent via Telegram bot and REST API.

## Architecture

- **Backend** (`aiagent-be/`): Node.js + Express + GrammY
  - Telegram bot with message routing to AI model
  - REST API endpoints for status, logs, config management
  - Direct AI communication (no tool loop)
  - Agent tool loop with approval flow
  - Structured logging with rotation
  - Account-based access control
- **Frontend** (`aiagent-web-panel/`): Vue 3 + Vite
  - Dashboard for monitoring agent activity
  - Real-time status, logs, and configuration controls
  - Tool management and account administration

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

All other settings (`SERVER_URL`, `MODEL_NAME`, `SYSTEM_PROMPT`, `MAX_TOKENS`, `TEMPERATURE`, `TIMEOUT`, `PROJECT_PATH`, etc.) have built-in defaults from `configDefaults.js` and are configured via the web UI (Settings tab).

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

- **Backend**: 165 tests covering safePath, parseToolCall, executeTool, accounts, agentLoop, logger, and API
- **Frontend**: 32 tests covering composables, stores, API client, ControlsCard, ChatTab, SettingsTab, and StatsCard

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
| POST   | `/api/config`          | Update config                               |
| POST   | `/api/start`           | Start Telegram bot                          |
| POST   | `/api/stop`            | Stop bot, reset stats, clear chat histories |
| POST   | `/api/restart`         | Restart Telegram bot                        |
| POST   | `/api/chat`            | Direct chat with AI                         |
| GET    | `/api/tools`           | List tools with config                      |
| POST   | `/api/tools`           | Update tool config                          |
| POST   | `/api/validate-path`   | Validate a file system path (used by frontend) |
| GET    | `/api/accounts`        | List user accounts                          |
| POST   | `/api/accounts`        | Save user accounts                          |
| POST   | `/api/accounts/import` | Import accounts from JSON                   |
| POST   | `/api/agent/tool`      | Direct tool call by agent                   |
| POST   | `/api/chat/continue`   | Continue agent loop after tool approval/denial |

## Runtime Details

- **WebSocket**: Real‑time updates (status, stats, logs, token usage) via `/ws`.
- **OpenRouter support**: Automatic OpenRouter headers (`Authorization: Bearer`, `HTTP-Referer`, `X-OpenRouter-Title`) when `SERVER_URL` contains `openrouter.ai`. API key configurable via UI (`openrouterApiKey`). The `/api/models` endpoint can use an `x-openrouter-key` header override for model discovery.
- **Chat mode**: When `chatMode` is true the system prompt is minimal and the agent ignores `projectPath`; enables pure conversation.
- **Auth middleware**: All API routes (except `/health`) require `x‑api‑key` header matching `VITE_API_KEY`.
- **`include_paths`**: No special root‑drive handling – paths are resolved relative to `projectPath` and must stay within that directory.

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
│   └── api.js             # API route handlers
├── lib/
│   ├── agent/
│   │   ├── agentLoop.js   # Agent loop with tool execution
│   │   └── executeTool.js # Tool implementations
│   ├── accounts.js        # Account management
│   ├── logger.js          # Structured logging with rotation
│   └── utils.js           # Path safety and tool call parsing
├── tests/                 # Backend tests (Vitest)
└── logs/                  # Application logs

aiagent-web-panel/
├── src/
│   ├── api/
│   │   └── client.js      # API client with reconnect logic
│   ├── components/        # Vue components
│   ├── composables/       # Vue composables (useAgent, useToast)
│   ├── stores/            # Pinia stores (settings)
│   └── styles/            # CSS styles
├── src/**/*.test.js       # Frontend tests (Vitest)
└── vite.config.js
```

## License

ISC
