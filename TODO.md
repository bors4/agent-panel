# TODO — Task List

> **Легенда:** `[ ]` — не выполнено · `[x]` — выполнено · `[~]` — перенести
> **Приоритеты:** `P0` 🔴 High · `P1` 🟡 Medium · `P2` 🟢 Low
> Номер — `#1`… (отдельно в каждой группе).

> **Прогресс: 15 / 62** | `P0: 3/12` · `P1: 5/24` · `P2: 7/26`

---

## 🔴 High Priority (P0)

- [x] #1 `[bug][backend]` Когда модель пытается вызвать инструмент, например, `list_dir`, то бот отвечает как `qwen_test_bot: ❌ read failed: Path outside project is forbidden` ✅ Исправлено: `path.resolve()` вместо `path.join()`, нормализация `projectPath` при старте, 15 новых тестов

- [x] #2 `[bug][frontend]` При нажатии на кнопку «Рестарт» запрос к `http://127.0.0.1:3000/api/restart` висит в состоянии Pending. Рестарт происходит только после второго нажатия на кнопку

- [x] #3 `[tests]` Add unit tests for critical paths ✅ 44 теста: safePath, parseToolCall, executeTool, session, logger

- [ ] #4 `[bug][backend]` Ошибка `AI API error: 400` в `continueAfterApproval` после нескольких запросов к модели
  - **Симптом:** После выполнения инструмента `execute` и отправки результата обратно в AI, сервер возвращает 400
  - **Лог:** `finishReason: 'tool_calls', hasToolCalls: true, contentLen: 91` — модель возвращает одновременно `tool_calls` и `content`
  - **Возможные причины:**
    - `config.maxTokens` = 0 или NaN (`??` не ловит `0`/`NaN`)
    - `config.temperature` = 0 — недопустимо для модели
    - AI сервер (LM Studio) не поддерживает сообщения с `{ content: "...", tool_calls: [...] }` одновременно
    - Повторная отправка `tools` в запросе после того как модель уже решила вызвать инструмент
  - **Что делать:** добавить логирование request body, валидацию max_tokens/temperature, возможно не отправлять `tools` повторно при tool_calls

- [ ] #5 `[security][backend]` **Нет аутентификации API** — `x-api-key` никогда не проверяется на бэкенде
  - Добавить middleware в `routes/api.js`: проверять заголовок `x-api-key` против `config.apiKey` на всех маршрутах (кроме health)
  - Фронтенд уже отправляет заголовок — нужна только проверка на сервере

- [ ] #6 `[security][infra]` **Секреты в открытом виде в `.env`**
  - Файл содержит живой `GITHUB_PERSONAL_ACCESS_TOKEN`, `TELEGRAM_BOT_TOKEN`, `API_KEY`
  - **Немедленно:** отозвать GitHub PAT, ротировать Telegram токен
  - **Постоянно:** зашифровать `.env` через dotenvx или вынести secrets в переменные окружения ОС

- [ ] #7 `[security][backend]` **Command injection в `execute`**
  - На Windows `spawn` использует `cmd.exe` с shell-интерпретацией; PowerShell команды тоже исполняются через shell
  - Добавить allowlist разрешённых команд, валидацию, блокировку опасных паттернов (`rm -rf`, `del /f`, `format` и т.д.)

- [ ] #8 `[security][backend]` **Telegram bot token в ответе API**
  - `GET /api/config` возвращает `{ token: process.env.TELEGRAM_BOT_TOKEN }` — убрать из ответа

- [ ] #9 `[bug][backend]` **`safePath()` использует `.toLowerCase()` для сравнения путей — ломается на Linux**
  - На Linux файловая система чувствительна к регистру: `/home/User/file.txt` ≠ `/home/user/file.txt`
  - Использовать `.toLowerCase()` только на Windows (`process.platform === "win32"`)

- [ ] #10 `[bug][backend]` **Race condition в `loadAccounts()` между existsSync и readFileSync**
  - Если файл удалён между `fs.existsSync` и `fs.readFileSync` → `ENOENT` исключение
  - **Фикс:** убрать `existsSync`, обернуть `readFileSync` в try/catch с проверкой `e.code !== "ENOENT"`

- [ ] #11 `[bug][backend]` **Fetch-запросы к AI API не имеют таймаута**
  - `agentLoop.js`, `server.js`, `api.js` — нет `AbortSignal`/`AbortController`
  - Если AI-сервер завис, запрос висит бесконечно, бот блокируется
  - **Фикс:** вынести `fetchWithTimeout(url, options, timeoutMs)` с `AbortController`

- [ ] #12 `[security][backend]` **Path traversal в `checkAccountToolPermission` через `include_paths`**
  - `accounts.js:73-89`: `path.resolve(projectPath, "../../../Windows")` обходит проверку
  - `include_paths` с корнем диска (`E:\`) пропускает любой путь на этом диске
  - **Фикс:** добавить проверку вхождения пути в `projectPath` через `path.relative()`

---

## 🟡 Medium Priority (P1)

- [x] #1 `[ui][frontend]` Перенести кнопку "Обновить модели" и разместить возле поля "Model_Name" ✅
  - *Приоритет: P2*

- [x] #2 `[infra]` Improve logging and monitoring ✅ Добавлен logger.js с уровнями, ротацией, middleware requestLogger

- [ ] #3 `[ui][frontend]` Добавить отдельную кнопку для сохранения `PROJECT_PATH`
  - Сейчас сохранение происходит автоматически через debounce (300ms)
  - Нужно добавить явную кнопку "Сохранить путь" рядом с полем PROJECT_PATH в SettingsTab
  - Убрать debounce для этого поля, сделать сохранение только по кнопке

- [ ] #4 `[ui][frontend]` Добавить тултипы для параметров настроек
  - PROJECT_PATH — путь к рабочей директории проекта
  - TELEGRAM_TOKEN — токен бота из @BotFather
  - API-BASE — URL AI сервера (LM Studio / OpenAI совместимый)
  - Model_Name — имя модели для запросов
  - MaxTokens, Temperature, Timeout, MaxFileChars, MaxHistoryPairs, MaxSearchResults, MaxFilesInPrompt

- [ ] #5 `[ui][frontend]` Исправить отображение текста тултипа для "Инструменты агента"
  - Текст тултипа обрезается или не виден полностью
  - Проверить z-index, max-width, overflow для tooltip контейнера

- [ ] #6 `[ui][frontend]` Разместить прогресс-бары для карточки "Контекст модели" под круговой диаграммой
  - Сейчас прогресс-бары и диаграмма могут конфликтовать по расположению
  - Переместить прогресс-бары ниже диаграммы, улучшить адаптивность

- [ ] #7 `[bug][backend]` Пересмотреть подсчёт размера контекста
  - Сейчас токены суммируются вручную из всех запросов
  - Нужно брать данные из `usage` ответа сервера модели (`usage.prompt_tokens`, `usage.completion_tokens`)
  - Убедиться что `usage.prompt_tokens_details.cached_tokens` корректно обрабатывается
  - Добавить отображение контекстного окна модели (если доступно через `/v1/models`)

- [x] #8 `[refactor][backend]` **Убрать дублирование config-объекта** между `server.js` и `agentLoop.js` ✅
  - Config передаётся параметром в `agentLoopStep()` и `buildToolExecConfig()`
  - Удалены `updateAgentConfig()`, `getAgentConfig()`, module-level `config` из `agentLoop.js`

- [ ] #9 `[perf][backend]` **Синхронный file I/O блокирует event loop**
  - Все `*Sync` операции в `executeTool.js` заменить на `fs.promises`

- [x] #10 `[refactor][backend]` **Мёртвый код и зависимости** ✅
  - Удалён `aiagent-be/lib/session.js` (никем не используется)
  - Удалён `aiagent-web-panel/src/stores/settings.js` (Pinia store не используется)
  - Удалён `openai` из `package.json` (~1.5MB мусора)

- [ ] #11 `[refactor][backend]` **Дублирование аккумуляции token usage** в 5 местах
  - Вынести в `accumulateTokenUsage(target, usage)` в utils.js

- [ ] #12 `[security][backend]` **Нет валидации ввода на config/tools endpoints**
  - `POST /api/config`: проверять типы (URL, number), диапазоны (temperature 0-2, maxTokens > 0), формат
  - `POST /api/tools`: проверять `permission` ∈ {"ask","always","deny"}, `enabled` ∈ boolean
  - `POST /api/accounts`: проверять структуру аккаунтов

- [x] #13 `[feature][infra]` **WebSocket вместо 5-секундного polling** ✅
  - Добавлен `ws` пакет, WebSocket сервер на порту 3000, heartbeat каждые 30с
  - Фронтенд: `useWebSocket.js` composable с автопереподключением, uptime ticker
  - Убран polling из `useAgent.js` и `App.vue`
  - Бэкенд: `wsBroadcast` при статусе, логах, stats, tokenUsage изменениях

- [ ] #14 `[feature][backend]` **Асинхронное выполнение длительных команд (`execute`)**
  - **Проблема:** wdio E2E тесты могут выполняться часами; фиксированный таймаут (120с) недостаточен
  - **Симптомы:**
    - `Command timed out after 30s` — дефолтный таймаут слишком мал
    - `answerCallbackQuery: query is too old` — callback query протухает пока команда выполняется
    - Бот заблокирован пока `spawn` не завершится
  - **Предлагаемое решение:**
    1. Запускать `execute` **асинхронно** — не блокировать callback handler
    2. Сохранять активные процессы в `Map<taskId, { child, stdout, stderr, status }>`
    3. Сразу отвечать пользователю: `"⏳ Команда запущена (ID: task-1). Результат будет отправлен по завершении."`
    4. По завершении процесса — отправить результат в Telegram через `bot.api.sendMessage(chatId, result)`
    5. Добавить команду `/tasks` — список активных задач
    6. Добавить команду `/cancel <taskId>` — отмена задачи
    7. Таймаут по умолчанию: configurable (например 2 часа), `timeout: 0` = без лимита
  - **Изменения:**
    - `server.js`: `activeTasks` Map, `/tasks` endpoint, `/cancel` endpoint
    - `executeTool.js`: `executeAsync()` — возвращает taskId, не ждёт завершения
    - Telegram bot: обработчики `/tasks`, `/cancel`
    - `agentLoop.js`: передача `chatId` в `buildToolExecConfig` для обратного уведомления

- [ ] #15 `[security][backend]` **Symlink path traversal в `safePath()`**
  - Добавить `fs.realpathSync()` для разрешения симлинков перед проверкой пути

- [ ] #16 `[bug][frontend]` **Ответ модели теряется при смене вкладки или перезагрузке страницы в ChatTab**
  - **Корень:** `ChatTab.vue` рендерится через `v-if` — при смене вкладки компонент уничтожается
  - `watch(messages, ...)` автоматически останавливается Vue 3 при unmount, поэтому bot response не сохраняется в localStorage
  - `sendMessage()` не вызывает `saveChatHistory()` после получения ответа — полагается только на watch
  - Нет `AbortController` для отмены in-flight запроса при уходе со вкладки
  - **Фикс:** добавить `onUnmounted` с `AbortController`; вызывать `saveChatHistory()` явно после `directChat()`; рассмотреть `<KeepAlive>` или `v-show` вместо `v-if`

- [ ] #17 `[feature][backend][frontend]` **Добавить вызов инструментов в веб-панели (`/api/chat`)**
  - Сейчас `POST /api/chat` — прямой прокси к AI модели без `tools[]`, `tool_choice`, function calling
  - Системный промпт — 2 строки на русском без единого упоминания инструментов
  - **Фикс:** интегрировать `agentLoopStep()` в `/api/chat`; добавить tool definitions; передавать account/permissions; унифицировать system prompt с Telegram bot
  - На фронтенде: добавить отображение tool calls (выполняется/одобрить/отклонить) и результатов в чате

- [ ] #18 `[security][backend]` **`updateAgentConfig()` — Object.assign без защиты от prototype pollution**
  - `Object.assign(config, newConfig)` — уязвим к `__proto__` / `constructor`
  - **Фикс:** использовать `Object.keys(newConfig).forEach(k => { if (k in config) config[k] = newConfig[k]; })`

- [ ] #19 `[security][backend]` **Все команды Telegram доступны без аккаунта**
  - `/start`, `/help`, `/model`, `/clear`, `/tools` работают для любого пользователя
  - При этом `bot.on("message")` блокирует неизвестных — несоответствие модели безопасности

- [ ] #20 `[bug][backend]` **`args.timeout || 30` — некорректная обработка timeout=0 и NaN**
  - Если модель передаст `timeout: 0` → станет 30 (должно означать "без лимита")
  - Если `timeout: "abc"` → `NaN` → `setTimeout(NaN)` никогда не сработает
  - **Фикс:** `Number.isFinite(args.timeout) && args.timeout > 0 ? args.timeout : 30`

- [ ] #21 `[bug][backend]` **Двойной вызов `getToolConfig()` в `continueAfterApproval`**
  - `server.js:552-553`: дважды вызывается `getToolConfig()`, race condition при смене конфига
  - **Фикс:** вызвать один раз, сохранить результат в переменную

- [ ] #22 `[bug][backend]` **JSON.parse без обработки undefined/null в tool_calls модели**
  - `agentLoop.js:191-194`, `server.js:546-549`: `JSON.parse(tc.function.arguments)` — если `arguments = undefined`, падает с TypeError
  - `catch` без параметра — теряется стек ошибки
  - **Фикс:** добавить проверку `arguments`, логировать ошибку в `catch(e)`

- [ ] #23 `[bug][backend]` **Нет валидации `projectPath` на существование при обновлении через API**
  - `api.js:138-141`: любой путь принимается без проверки, что директория существует
  - Если указать несуществующий путь, все Telegram-запросы падают с `"Project path not configured"`
  - **Фикс:** `fs.existsSync` + `fs.statSync.isDirectory()` с `400 Bad Request`

- [ ] #24 `[bug][backend]` **`useFunctionCalling` fallback не отличает 400 от 500**
  - `agentLoop.js:165-169`: при любой ошибке `!resp.ok` код считает, что model "не поддерживает FC"
  - Если сервер вернул 500, retry с отключенным FC бесполезен — та же 500 повторится
  - **Фикс:** fallback только при `resp.status === 400`, иначе сразу `return`

---

## 🟢 Low Priority (P2)

- [x] #1 `[docs]` Переименовать директорию `web-panel` → `agent-panel` и обновить все ссылки
- [x] #2 `[bug][ui]` Нужно исправить `color` для `chat-bubble`. Для светлой темы не виден. ✅ Исправлено: заменён

- [x] #3 `[infra]` **Добавить ESLint + Prettier** ✅
  - Flat config (`eslint.config.js`), `.prettierrc`, scripts: `lint`, `lint:fix`, `format`, `format:check`
  - Backend: Node.js globals; Frontend: Browser globals
  - 0 errors, 35 warnings (unused vars — existing code)

- [ ] #4 `[refactor][backend]` **Стандартизировать обрезку истории чата**
  - `server.js` режет до 20, `session.js` до 10, `agentLoop.js` через `maxHistoryPairs*2`
  - Выбрать единый лимит и единый механизм

- [ ] #5 `[refactor][backend]` **Graceful shutdown**
  - Добавить `process.on('SIGTERM')` и `process.on('SIGINT')` для остановки бота и закрытия Express

- [x] #6 `[tests][backend]` **Интеграционные тесты API** ✅
  - Добавлен `supertest`, 25 тестов для всех REST endpoints в `tests/api.test.js`

- [x] #7 `[tests][frontend]` **Компонентные тесты Vue** ✅
  - Добавлены тесты: ControlsCard (6), ChatTab (4), SettingsTab (3), StatsCard (5)

- [ ] #8 `[feature][backend]` **Rate limiting**
  - Добавить `express-rate-limit` на чувствительные endpoints (`/api/chat`, `/api/agent/tool`, `/api/config`)

- [ ] #9 `[perf][backend]` **Ограничение размера файлов при поиске**
  - `searchDirectory()` читает каждый файл полностью в память — добавить `maxFileSize`, пропускать бинарные файлы

- [ ] #10 `[feature][backend]` **Explicit save button для PROJECT_PATH**
  - Убрать debounce (300ms auto-save), добавить кнопку "Сохранить путь"

- [ ] #11 `[feature][backend]` **Prometheus /health endpoint**
  - Добавить `GET /api/health` для мониторинга (бот запущен, AI server reachable)

- [ ] #12 `[feature][backend]` **Очистка старых сессий**
  - `chatHistories` никогда не очищается — добавить периодическую чистку (1 час без активности)

- [ ] #13 `[bug][backend]` **`/api/status` возвращает `uptime` дважды**
  - `uptime` есть и в `stats`, и на корневом уровне ответа — убрать дублирование

- [ ] #14 `[refactor][backend]` **Магическое число `5` для `maxIterations`**
  - Вынести в константу `const MAX_AGENT_ITERATIONS = 5;`

- [ ] #15 `[security][frontend]` **Hardcoded API key на фронтенде**
  - `"x-api-key": "agent-secret-key"` в ToolsTab.vue и client.js хардкожен
  - Если изменить `API_KEY` в `.env`, фронтенд перестанет работать
  - Вынести в константу/env-переменную Vite

- [ ] #16 `[perf][frontend]` **`BotCheckCard.vue` — `watch` с `{ immediate: true }` вызывает фильтрацию token на каждый триггер**
  - `token.replace(/[^\x00-\x7F]/g, "")` вызывается при быстром наборе 10+ раз/сек
  - Добавить debounce (300ms)

- [x] #17 `[refactor][backend]` **`let shell, shellArgs` → const внутри блоков** ✅
  - В `executeTool.js` переписано на тернарник с `const { shell, shellArgs }`

- [x] #18 `[refactor][backend]` **`useFC` → `useFunctionCalling`** ✅
  - Переименовано 5 вхождений в `agentLoop.js`

- [ ] #19 `[style][backend]` **`let finalResponse = ""`, `let useFC = true` — объединить с другими `let` в один statement**

- [ ] #20 `[style][backend]` **`addLog` внутри `updateStatus` — косвенная рекурсия логирования**
  - `updateStatus` сам вызывает `addLog`, в который передаётся лог — запутывает

- [ ] #21 `[perf][frontend]` **`BASE_URL` хардкод в `client.js`**
  - Для production должно быть конфигурируемым через Vite env-переменную

- [ ] #22 `[style][frontend]` **Смесь относительных (`/api/accounts`) и абсолютных URL в ToolsTab.vue**
  - За прокси на production может сломаться; унифицировать через `BASE_URL`

- [ ] #23 `[bug][frontend]` **Черновик "⏳ Analyzing request..." не удаляется после ответа**
  - `server.js:320,350-356`: `sendDraft` отправляет черновик, но он никогда не редактируется/удаляется
  - Пользователь видит два сообщения: "⏳..." и ответ
  - **Фикс:** сохранять msgId черновика и удалять перед ответом, либо убрать `sendDraft`

- [ ] #24 `[perf][backend]` **ReDoS-потенциал в `extractBash()`**
  - `agentLoop.js:70-73`: `content.match(/\`(?:bash|sh)?[\s\S]*?\`/)` — backtracking при большом content
  - **Фикс:** использовать `indexOf` вместо regex

- [ ] #25 `[refactor][backend]` **`TOOLS` определение и конфигурация разделены**
  - `executeTool.js`: `TOOLS` (строки 44-182) — схема, `toolConfig` — runtime-конфиг
  - `getToolConfig()` вынужден merge-ить две структуры
  - **Фикс:** объединить `enabled`/`permission`/`exclude_paths` в `TOOLS` как единый источник

- [ ] #26 `[perf][backend]` **`formatValue()` рекурсия без защиты от циклических ссылок**
  - `executeTool.js:255-285`: рекурсивный обход без защиты от circular ref
  - Если модель вернёт объект с циклической ссылкой → `RangeError: Maximum call stack size exceeded`
  - **Фикс:** добавить `Set` для отслеживания посещённых объектов
