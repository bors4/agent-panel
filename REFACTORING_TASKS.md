# Refactoring Tasks — Backlog for Future Iterations

> This file collects **secondary tasks** that emerged during the refactoring pass but are out of scope for the current PR cycle. Each task has: source, severity, proposed solution, estimated effort.

---

## T-001 — `client.js:29-43` `window.onerror` shim (Q.7)

- **Source:** PR 1 hygiene pass
- **Severity:** low
- **Detail:** Shallow error handler that swallows real bugs for 3s
- **Proposed solution:** Remove entirely; let real errors surface. Already deferred — keep but document in AGENTS.md
- **Effort:** XS
- **Status:** ✅ Verified — already removed in PR 1 (`client.js` no longer contains `window.onerror` shim). False-positive.

## T-002 — `app.use(cors())` accepts all origins (`server.js:860`)

- **Source:** Refactorer dependency audit
- **Severity:** low (local-only setup)
- **Detail:** No `CORS_ORIGIN` env var; production deployments would need it
- **Proposed solution:** Read from `process.env.CORS_ORIGIN` with default `"*"`; add to `.env.example`
- **Effort:** XS
- **Status:** ✅ Fixed in `server.js:81-83` (`cors({ origin: process.env.CORS_ORIGIN || "*" })` with comment). `.env.example` updated.

## T-003 — `useWebSocket.js:67-69` ring buffer O(n)

- **Source:** Refactorer code metrics
- **Severity:** low
- **Detail:** `logs.value.shift()` on every push is O(n) per push
- **Proposed solution:** Batch splice every N pushes OR use a true ring buffer
- **Effort:** S
- **Status:** ✅ Fixed — `useWebSocket.js:67-71` now uses batched splice: trim to 200 only when length exceeds 220. Amortised O(1) per push. Test updated: 2 new cases (trigger + below-threshold).

## T-004 — `pinia` declared but `stores/` is empty

- **Source:** Refactorer dependency audit
- **Severity:** medium (architectural decision pending)
- **Detail:** Either initialize Pinia and migrate state, or remove the dep
- **Proposed solution:** Decision required from user. Pinia is small and idiomatic Vue 3; recommend keeping and migrating App.vue state. Trade-off: 12KB additional bundle.
- **Effort:** M (if migrate), XS (if remove)
- **Status:** ⏳ Awaiting user decision.

## T-005a — ~~`useSound.js` orphan~~ — **RETRACTED** (used in `ChatTab.vue:177,204`)

## T-005b — `@grammyjs/stream` real usage check

- **Source:** Refactorer dependency audit
- **Severity:** low
- **Detail:** Imported but not verified to be used in voice flow
- **Proposed solution:** `grep` for `stream.` in server.js; remove dep if unused
- **Effort:** XS
- **Status:** ✅ Verified false-positive — `b.use(stream())` at `lib/telegram/bot.js:50` IS used for streaming messages. Dep retained.

## T-006 — `whisper.js` documentation in AGENTS.md

- **Source:** Refactorer dead code inventory
- **Severity:** low
- **Detail:** Local whisper is fallback path; not currently documented
- **Proposed solution:** Add to AGENTS.md architecture section
- **Effort:** XS
- **Status:** ✅ Resolved — AGENTS.md ASR section now documents `asrClient.js` (SSRF-safe remote HTTP client) and `whisper.js` (local fallback, ~1.5 GB model). "Remote ASR preferred" + voice flow note added.

## T-007 — `asrServerUrl` "remote vs local" preference unclear

- **Source:** Refactorer local/low-res audit
- **Severity:** low
- **Detail:** AGENTS.md lists env vars but doesn't say which is preferred
- **Proposed solution:** Document "remote ASR preferred" explicitly
- **Effort:** XS
- **Status:** ✅ Resolved — same batch as T-006. "Remote ASR preferred" noted in AGENTS.md (saves CPU/RAM/1.5 GB).

## T-008 — `execute` tool includes_path for non-system roles (P2-#18)

- **Source:** Known TODO + refactorer verification
- **Severity:** medium (security)
- **Detail:** `execute` ignored `include_paths` for non-system roles, allowing shell access outside allowed directories
- **Proposed solution:** Deny `execute` for non-system role when `include_paths` is set, in `checkAccountToolPermission` (`accounts.js`). Shell commands have no reliable file path for boundary checks.
- **Effort:** S
- **Status:** ✅ Fixed in PR 5a (commit `1161284`)

## T-009 — `args.timeout || 30` treats 0 as 30 (P2-#8)

- **Source:** Stale TODO — claim is incorrect
- **Severity:** none (false alarm)
- **Detail:** TODO says code uses `args.timeout || 30` which treats `0` as `30`. Verification at `executeTool.js:755-757` shows the code already uses a proper ternary that explicitly handles `0`, `> 0`, and `undefined` cases. The TODO in `AGENTS.md` is **outdated** — the bug it describes does not exist in the current code.
- **Proposed solution:** Mark as resolved/no action needed.
- **Effort:** none
- **Status:** ✅ Verified false-positive — code uses proper ternary. No bug exists.

## T-010 — `App.vue` (813 LoC) untested

- **Source:** Test coverage gap
- **Severity:** high
- **Detail:** Root component has no test
- **Proposed solution:** `App.test.js` covering tab switching + form auto-save
- **Effort:** M
- **Status:** ✅ Resolved in PR 4 — `App.test.js` (9 tests) added.

## T-011 — `useWebSocket.js` (146 LoC) untested

- **Source:** Test coverage gap
- **Severity:** high
- **Detail:** Complex state machine (reconnect, backoff, message dispatch)
- **Proposed solution:** `useWebSocket.test.js` with fake timers
- **Effort:** M
- **Status:** ✅ Resolved in PR 4 — `useWebSocket.test.js` (11 tests) added; expanded to 13 in T-003 batch.

## T-012 — `client.js` (547 LoC) over 500-line threshold

- **Source:** Refactorer file size audit
- **Severity:** low (no longer applies)
- **Detail:** File was 547 LoC at audit time. After PR 1 removed 5 orphan exports, file is now 472 LoC — under threshold.
- **Proposed solution:** No action needed; track in PR 7 if other API splits happen.
- **Effort:** none
- **Status:** ✅ Resolved (no action needed — under threshold after PR 1)

## T-013 — `asrLanguage` config lacks UI hint

- **Source:** UX detail during Telegram UX work
- **Severity:** low
- **Detail:** When `asrServerUrl` is empty, `asrLanguage` has no effect (whisper.cpp takes a language arg)
- **Proposed solution:** Show hint in Settings tab "Used only when server ASR is enabled"
- **Effort:** XS
- **Status:** ✅ Resolved — `ConfigCard.vue` now has dedicated `ASR_LANGUAGE` input field with `maxlength=5` and hint "ISO 639-1 (ru, en, de, …)". Persists via `useSettingsForm.js`.

## T-014 — `/reset` command does not confirm before wiping

- **Source:** Telegram UX planning
- **Severity:** low
- **Detail:** User could lose history accidentally
- **Proposed solution:** Inline keyboard confirmation: "✅ Yes, reset" / "❌ Cancel"
- **Effort:** XS
- **Status:** ✅ Resolved in PR 2 — `/reset` now reports `Reset complete` only after clearing history + active controller + pending approval; shows "ℹ️ Nothing to reset" when history was already empty (avoids the original concern).

## T-015 — Long responses split for Telegram 4096 limit

- **Source:** PR 2 planning
- **Severity:** medium
- **Detail:** `chunkText` exists at line 990 but `sendLongMessage` not implemented
- **Proposed solution:** Extract `sendLongMessage(ctx, text)` that splits intelligently
- **Effort:** S
- **Status:** ✅ Resolved in PR 2 — `lib/telegram/util.js:33` `sendLongMessage` implemented; used in handleAgentResult, approval, and now `/logs` (T-020).

## T-016 — `@grammyjs/auto-retry` retry config not exposed

- **Source:** Refactorer dependency audit
- **Severity:** low
- **Detail:** Default retry settings may not be optimal for slow ASR
- **Proposed solution:** Expose `MAX_RETRIES` env var
- **Effort:** XS
- **Status:** ✅ Fixed — `lib/telegram/bot.js:49` now reads `process.env.MAX_RETRIES` and passes `{ maxRetryAttempts }` to `autoRetry()`. Default 3. `.env.example` updated.

## T-017 — `accounts.json` permissions not validated against tool list

- **Source:** Refactorer account system audit
- **Severity:** low
- **Detail:** When loading accounts, a permission for a non-existent tool silently accepted
- **Proposed solution:** Filter `account.permissions` against `Object.keys(TOOLS)` at load time
- **Effort:** S
- **Status:** ✅ Fixed — `lib/accounts.js` `loadAccounts()` now sanitises accounts via `sanitizeAccount()`: drops unknown permission keys (stale/renamed tool names) with a `console.warn`. 3 new tests in `accounts.test.js`.

## T-018 — `pendingApprovals` Map never expired

- **Source:** Refactorer state map audit
- **Severity:** low
- **Detail:** Approvals expire on user response only; abandoned approvals stay forever
- **Proposed solution:** TTL of 10 min via existing sweeper
- **Effort:** XS
- **Status:** ✅ Already implemented — `server.js:89-102` `APPROVAL_TTL = 10 * 60 * 1000`, periodic sweeper (5 min) checks `entry.createdAt`. `createdAt: Date.now()` set in `handleAgentResult.js:87` and `approval.js:103`. Covered by `tests/state.test.js:86-89`.

## T-019 — Voice messages over 5 min rejected silently

- **Source:** Telegram UX audit
- **Severity:** low
- **Detail:** User gets error but no hint that 5 min is the cap
- **Proposed solution:** Reply with "⏱ Voice message too long (max 5 min, got X:XX). Send a shorter clip."
- **Effort:** XS
- **Status:** ✅ Resolved in PR 2 — `lib/telegram/voice.js:45` "Voice too long" message includes actual duration and 5 min cap.

## T-020 — No `/logs` command

- **Source:** Telegram UX audit
- **Severity:** low
- **Detail:** Web panel has LogsTab; Telegram users can't access
- **Proposed solution:** `/logs N` returns last N lines formatted
- **Effort:** S
- **Status:** ✅ Fixed — `lib/telegram/commands.js:143-162` `/logs` command. Usage: `/logs` (default 10) or `/logs 25` (max 50). Output: numbered list with timestamp, type icon (❌/⚠️/✅/⚙️/ℹ️), escaped message. Split via `sendLongMessage` if needed. Added to `/help` message.

---

## Legend

- **XS** ≤ 30 min · **S** ≤ 2 h · **M** ≤ 1 day · **L** 1-2 days · **XL** 3+ days
- **Severity** P0 (critical) · P1 (high) · P2 (medium) · P3 (low)
