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

# Run both frontend and backend concurrently
npm run dev

# Backend only
npm run backend:dev

# Frontend only
npm run frontend:dev
```

## Environment Variables (`.env`)

| Variable             | Default                        | Description                                                                     |
| -------------------- | ------------------------------ | ------------------------------------------------------------------------------- |
| `TELEGRAM_BOT_TOKEN` | (required)                     | Telegram bot token                                                              |
| `PROJECT_PATH`       | (optional)                     | Project context path. If not set, must be configured via UI before starting bot |
| `SERVER_URL`         | `http://192.168.1.101:1234/v1` | AI model server URL                                                             |
| `MODEL_NAME`         | `qwen3.5-2b`                   | Model identifier                                                                |
| `SYSTEM_PROMPT`      | (empty)                        | Custom system prompt                                                            |
| `API_PORT`           | `3000`                         | Backend API port                                                                |
 | `VITE_API_KEY`        | (required)                   | Frontend API key. Must be set in `.env` or environment. No default. |
| `MAX_TOKENS`         | `8192`                         | Max tokens per AI response                                                      |
| `TEMPERATURE`        | `0.1`                          | AI response temperature                                                         |
| `TIMEOUT`            | `120000`                       | Request timeout (ms)                                                            |

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

- **Backend**: 114 tests covering safePath, parseToolCall, executeTool, accounts, agentLoop, logger, and API
- **Frontend**: 27 tests covering composables, stores, API client, ControlsCard, ChatTab, SettingsTab, and StatsCard

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
| GET    | `/api/accounts`        | List user accounts                          |
| POST   | `/api/accounts`        | Save user accounts                          |
| POST   | `/api/accounts/import` | Import accounts from JSON                   |
| POST   | `/api/agent/tool`      | Direct tool call by agent                   |

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
  - Root drive paths (e.g., `E:\`) allow access to all directories on that drive
  - Subdirectory paths (e.g., `E:\Git`) restrict to that directory and children only

## Statistics

Stats are tracked and displayed in the dashboard:

- **Uptime**: Time since bot started (seconds)
- **Requests**: Number of AI requests made
- **Tools**: Tool executions
- **Errors**: Failed requests
- **Token Usage**: Accumulated prompt, completion, total, and cached tokens across all AI requests

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
