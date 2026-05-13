# AI Agent Control Panel

Monorepo with Vue 3 frontend dashboard and Express/GrammY backend for controlling an AI agent via Telegram bot and REST API.

## Architecture

- **Backend** (`aiagent-be/`): Node.js + Express + GrammY
  - Telegram bot with message routing to AI model
  - REST API endpoints for status, logs, config management
  - Direct AI communication (no tool loop)
  - Agent tool loop with approval flow
- **Frontend** (`aiagent-web-panel/`): Vue 3 + Vite
  - Dashboard for monitoring agent activity
  - Real-time status, logs, and configuration controls

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

| Variable             | Default                              | Description                     |
| -------------------- | ------------------------------------ | ------------------------------- |
| `TELEGRAM_BOT_TOKEN` | (required)                           | Telegram bot token              |
| `PROJECT_PATH`       | `E:\Git\agent-panel`                 | Project context path            |
| `SERVER_URL`         | `http://192.168.1.101:1234/v1`       | AI model server URL             |
| `MODEL_NAME`         | `qwen3.5-2b`                         | Model identifier                |
| `SYSTEM_PROMPT`      | (empty)                              | Custom system prompt           |
| `API_PORT`           | `3000`                               | Backend API port               |
| `API_KEY`            | `agent-secret-key`                   | API key for frontend auth       |
| `MAX_TOKENS`         | `8192`                               | Max tokens per AI response      |
| `TEMPERATURE`        | `0.1`                                | AI response temperature         |
| `TIMEOUT`            | `120000`                             | Request timeout (ms)            |

## Development

- **Frontend dev server**: Port 5173 with `/api` proxy to backend (localhost:3000)
- **Backend API**: http://127.0.0.1:3000/api
- **Node version**: ^20.19.0 or >=22.12.0

## Build & Deploy

```bash
# Build frontend for production
npm run build

# Start backend in production mode
npm start
```

## API Endpoints

All endpoints require `x-api-key: agent-secret-key` header:

| Method | Endpoint              | Description                                      |
| ------ | --------------------- | ------------------------------------------------ |
| GET    | `/api/status`         | Server status, botStatus, stats (requests/tools/errors), uptime |
| GET    | `/api/logs?limit=N`   | Recent logs                                      |
| GET    | `/api/config`         | Current configuration                            |
| GET    | `/api/models`         | Fetch available models from AI server            |
| POST   | `/api/config`         | Update config (modelName, serverUrl, projectPath, systemPrompt, maxTokens, temperature, timeout) |
| POST   | `/api/start`          | Start Telegram bot                               |
| POST   | `/api/stop`           | Stop bot, reset stats, clear chat histories      |
| POST   | `/api/restart`        | Restart Telegram bot                             |
| POST   | `/api/chat`           | Direct chat with AI (accepts modelName, serverUrl, projectPath, systemPrompt) |
| GET    | `/api/tools`          | List tools with config (enabled, permission, exclude_paths) |
| POST   | `/api/tools`          | Update tool config (enabled, permission, exclude_paths) |
| POST   | `/api/agent/tool`     | Direct tool call by agent (name, args, projectPath) |

## Statistics

Stats are tracked and displayed in the dashboard:
- **Uptime**: Time since bot started (hh:mm:ss format)
- **Requests**: Number of AI requests made
- **Tools**: Tool executions (for future agent loop)
- **Errors**: Failed requests

Stats reset when bot is stopped.

## License

ISC
