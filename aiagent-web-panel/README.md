# aiagent-web-panel

Vue 3 + Vite dashboard for the AI Agent Control Panel. See [root README](../README.md) for full documentation.

## Features

- Real-time agent status, logs, token usage, and performance stats over WebSocket
- Configurable AI server, model, system prompt, temperature, and tool permissions (Settings tab)
- Chat tab with streaming responses, collapsible reasoning block, and message resend
- **Voice input** — Web Speech API (browser-native, default) or server ASR (opt-in)
- Account management and tool permission editor
- Sound effects (toggle in Settings)

## Dev

```sh
npm run dev      # Vite dev server on port 5173
npm run build    # Production build
npm run test     # Vitest (54 tests)
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```
