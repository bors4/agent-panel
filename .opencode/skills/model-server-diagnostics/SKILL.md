---
name: get-model-response
description: >-
  Universal skill for getting a response from the AI model (llama.cpp / OpenAI-compatible
  server). Use whenever you need to test model availability, diagnose empty/short responses,
  verify model performance, compare models, or debug connectivity issues between the panel
  and the AI server. Covers model listing, selection (fastest model first), direct curl tests,
  panel API tests, and diagnostic escalation when the response is empty or corrupted.
---

# Get Model Response

## Architecture

```
User message
  → Telegram / Web UI
    → aiagent-be/lib/agent/agentLoop.js    (agent loop, with tools)
    → aiagent-be/routes/api.js              (direct chat, no tools)
    → aiagent-be/server.js                  (continueAfterApproval)
      → fetch("{serverUrl}/chat/completions")
```

- AI server: `{serverUrl}` (default `http://192.168.1.101:8080/v1`)
- Panel server: `http://127.0.0.1:3000`
- Frontend: `http://localhost:5173`

## Trigger Keywords

Use this skill when:

- User asks to "test the model", "check the model", "get a response"
- User reports empty/white-space-only model responses
- User reports "модель не отвечает" or "пустой ответ"
- `finish_reason: "stop"` with `completion_tokens < 3` (EOS loop)
- `"text must be non-empty"` Telegram error
- `"Empty response"` or `"Ответ модели обрезан"` in panel
- Streaming returns 2-3 tokens then stops
- Logs show `response=` empty after `agentLoopStep`
- Need to compare performance between models
- Need to verify a new model loads correctly

## Step 1 — List Available Models

Get the model list from the AI server to see what's available:

```bash
curl -s --max-time 10 "{serverUrl}/models"
```

Look for `.gguf` filenames or model IDs in the response.

**Selection priority (fastest first):**
1. **4B** models (best speed/quality balance for this hardware)
2. **2B** models (fastest, good for quick tests)
3. **7B–9B** models (slower but more capable)
4. Any other available model

If the server URL is unknown, get the current config first:

```bash
curl -s "http://127.0.0.1:3000/api/config" \
  -H "x-api-key: agent-secret-key"
```

Extract `serverUrl` and `modelName` from the response. Take a note of the exact model name — you'll use it in the next steps.

## Step 2 — Direct Query to AI Server

Replace `{serverUrl}` and `{modelName}` with values from Step 1.

### Test A: Standard chat completion

```bash
curl -s --max-time 60 -X POST "{serverUrl}/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model":"{modelName}",
    "messages":[{"role":"user","content":"Hi in 3 words"}],
    "max_tokens":100,
    "temperature":0.4
  }'
```

**Expected:** `"content": "Hi there!"` (or similar) with ~3+ tokens. Some models may use `reasoning_content` instead of `content` — check both fields.

### Test B: Raw completion (bypasses chat template)

Use this when Test A returns empty and you suspect a template or `reasoning_format` issue:

```bash
curl -s --max-time 60 -X POST "{serverUrl}/v1/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model":"{modelName}",
    "prompt":"<|im_start|>user\nHi in 3 words<|im_end|>\n<|im_start|>assistant\n",
    "max_tokens":100,
    "temperature":0.4
  }'
```

If this works but Test A doesn't, the problem is in the chat template or `reasoning_format` setting on the server.

### Test C: Stream mode

```bash
curl -s --max-time 60 -X POST "{serverUrl}/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model":"{modelName}",
    "messages":[{"role":"user","content":"Hi in 3 words"}],
    "max_tokens":100,
    "temperature":0.4,
    "stream":true
  }' | head -20
```

### Test D: With `ignore_eos` (detects corrupted model)

```bash
curl -s --max-time 60 -X POST "{serverUrl}/v1/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model":"{modelName}",
    "prompt":"<|im_start|>user\nHi in 3 words<|im_end|>\n<|im_start|>assistant\n",
    "max_tokens":100,
    "temperature":0.4,
    "ignore_eos":true
  }'
```

**Expected:** Some coherent text (may be weird but readable).
**Corrupted model:** Gibberish or repetitive garbage.

## Step 3 — Query via Panel `/api/chat`

This tests the full path (backend → AI server) that the frontend and Telegram bot use:

```bash
curl -s --max-time 60 -X POST "http://127.0.0.1:3000/api/chat" \
  -H "Content-Type: application/json" \
  -H "x-api-key: agent-secret-key" \
  -d '{
    "message":"Hi in 3 words",
    "modelName":"{modelName}",
    "serverUrl":"{serverUrl}"
  }'
```

For stream mode (matches what the frontend does when SSE is enabled):

```bash
curl -s --max-time 60 -X POST "http://127.0.0.1:3000/api/chat" \
  -H "Content-Type: application/json" \
  -H "x-api-key: agent-secret-key" \
  -d '{
    "message":"Hi in 3 words",
    "modelName":"{modelName}",
    "serverUrl":"{serverUrl}",
    "stream":true
  }'
```

## Step 4 — Interpret Results

### Response fields to examine

| Field | Location | What it tells you |
|-------|----------|-------------------|
| `content` | `choices[0].message` | Final model output (empty → problem) |
| `reasoning_content` | `choices[0].message` | Deepseek reasoning (if enabled on server) |
| `finish_reason` | `choices[0]` | `"stop"` = normal, `"length"` = truncated |
| `completion_tokens` | `usage` | How many tokens the model generated |
| `prompt_tokens_details.cached_tokens` | `usage` | Cache hit count (0 = cold start) |
| `tokens_cached` | root or `__verbose` | Total KV-cache size on server |
| `timings.prompt_n` | root | Prompt token count (processing) |
| `timings.predicted_n` | root | Generated token count |
| `timings.cache_n` | root | Per-request cache hits |
| `timings.prompt_per_second` | root | Prompt processing speed (t/s) |
| `timings.predicted_per_second` | root | Generation speed (t/s) |
| `timings.draft_n` / `draft_n_accepted` | root | Speculative decoding stats |
| `timings.prompt_ms` / `predicted_ms` | root | Time spent in each phase (ms) |

### `completion_tokens` quick guide

| Tokens | `finish_reason` | Meaning |
|--------|-----------------|---------|
| 2-3 | `"stop"` | EOS loop — model hit end-of-sequence. Corrupted quantization or `reasoning_format` conflict. |
| 2-3 | `"length"` | `max_tokens` too low or model is stuck in a loop. |
| ≥ 3 | `"stop"` | Normal generation (may still be too short — try raising temperature). |
| ~ `max_tokens` | `"length"` | Response was truncated. Increase `max_tokens`. |

## Step 5 — If Response is Empty

### Increase temperature

Default 0.1 is too low for many models. Try 0.4–0.7:

```bash
curl -X POST "http://127.0.0.1:3000/api/config" \
  -H "Content-Type: application/json" \
  -H "x-api-key: agent-secret-key" \
  -d '{"temperature": 0.5}'
```

Then re-run Step 2 or Step 3.

### Check `reasoning_format`

If the AI server has `reasoning_format: deepseek` enabled:
- All output goes to `reasoning_content` in SSE stream mode
- At low temperatures the model may generate empty "thinking" and EOS
- Run Step 2 Test B (raw completion) to bypass
- Fix: restart llama.cpp without `--reasoning-format deepseek` or change to `--reasoning-format none`

### Stream mode issues

If model works with `stream: false` but fails with `stream: true`:
- Grammar + streaming + reasoning format can conflict
- Set `stream: false` in panel config
- Or update llama.cpp server

### Corrupted model file

If Steps A–D all fail (even `ignore_eos` produces garbage):
1. Delete the corrupted GGUF file
2. Download a fresh copy (prefer Q4_K_M or Q5_K_M quantization)
3. Update model name in panel config

## Root Causes (by frequency)

1. **Corrupted model quantization** (~60%) — Model file itself is broken. Generates 2 tokens then EOS at ANY temperature. `ignore_eos: true` produces garbage. **Fix:** Re-download or re-quantize.

2. **`reasoning_format: deepseek` forced server-side** (~25%) — Server adds `<think>\n` prefix that the model doesn't handle well at low temperature. **Fix:** Higher temperature (≥ 0.4) or disable deepseek on server.

3. **Temperature too low** (~10%) — Default 0.1 causes degenerate (empty) output. **Fix:** `POST /api/config {"temperature": 0.4–0.7}`.

4. **Grammar + streaming conflict** (~5%) — `stream: true` + grammar + reasoning format = EOS at 2-3 tokens. **Fix:** Set `stream: false`.

## Code Paths

| File | Line(s) | What |
|------|---------|------|
| `aiagent-be/routes/api.js` | 302–451 | `/api/chat` — direct chat endpoint (dual SSE/JSON modes) |
| `aiagent-be/lib/parseSSE.js` | 1–156 | SSE stream parser with callbacks (content, usage, timings, token_cached) |
| `aiagent-be/lib/agent/agentLoop.js` | 192–305 | Sends fetch to AI server, empty-response retry with +0.3 temperature |
| `aiagent-be/lib/agent/agentLoop.js` | 276–305 | Temperature bump on empty content |
| `aiagent-be/server.js` | 95–110 | `buildPerfStats()` — normalizes timings into perfStats format |
| `aiagent-be/server.js` | 555–737 | `continueAfterApproval` — second model call after tool approval |
| `aiagent-be/lib/configDefaults.js` | — | Defaults: `temperature: 0.1`, `stream: false`, `timeout: 300000` |

## Retry Mechanism in `agentLoop.js`

When the model returns empty/whitespace-only content:
1. `currentTemperature` bumps by +0.3 (cap 1.0)
2. Loop continues up to `MAX_AGENT_ITERATIONS` (5)
3. If all retries exhausted, returns `"Empty response"` as final text

**Note:** Temperature bumps will NOT help if the model file is corrupted — it will keep returning 2 tokens at ANY temperature.
