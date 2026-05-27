# TODO — Task List

> **Легенда:** `[ ]` — не выполнено · `[x]` — выполнено
> **Приоритеты:** `P0` 🔴 High · `P1` 🟡 Medium · `P2` 🟢 Low · `P3` 🔵 Low-UI · `P4` ⚪ Wishlist
> Номер — `#1`… (отдельно в каждой группе).

> **Прогресс: 48 / 71** | `P0: 0/4` · `P1: 4/12` · `P2: 13/22` · `P3: 11/13` · `P4: 5/5`

---

## 🔴 High Priority (P0)

- [ ] #1 `[bug][backend]` Ошибка `AI API error: 400` в `continueAfterApproval` после нескольких запросов к модели
  - **Симптом:** После выполнения инструмента `execute` и отправки результата обратно в AI, сервер возвращает 400
  - **Лог:** `finishReason: 'tool_calls', hasToolCalls: true, contentLen: 91` — модель возвращает одновременно `tool_calls` и `content`
  - **Возможные причины:**
    - `config.maxTokens` = 0 или NaN (`??` не ловит `0`/`NaN`)
    - `config.temperature` = 0 — недопустимо для модели
    - AI сервер (LM Studio) не поддерживает сообщения с `{ content: "...", tool_calls: [...] }` одновременно
    - Повторная отправка `tools` в запросе после того как модель уже решила вызвать инструмент
  - **Что делать:** добавить логирование request body, валидацию max_tokens/temperature, не отправлять `tools` повторно при tool_calls

- [ ] #2 `[security][infra]` **Секреты в открытом виде в `.env`**
  - Файл содержит живой `GITHUB_PERSONAL_ACCESS_TOKEN`, `TELEGRAM_BOT_TOKEN`, `API_KEY`
  - **Немедленно:** отозвать GitHub PAT, ротировать Telegram токен
  - **Постоянно:** зашифровать `.env` через dotenvx или вынести в переменные окружения ОС

- [ ] #3 `[security][backend]` **Command injection в `execute`**
  - На Windows `spawn` использует `cmd.exe` с shell-интерпретацией; PowerShell команды тоже исполняются через shell
  - Добавить allowlist разрешённых команд, валидацию, блокировку опасных паттернов (`rm -rf`, `del /f`, `format` и т.д.)

- [ ] #4 `[security][backend]` **Path traversal в `checkAccountToolPermission` через `include_paths`**
  - `accounts.js:73-89`: `path.resolve(projectPath, "../../../Windows")` обходит проверку
  - `include_paths` с корнем диска (`E:\`) пропускает любой путь на этом диске
  - **Фикс:** добавить проверку вхождения пути в `projectPath` через `path.relative()`

---

## 🟡 Medium Priority (P1)

- [ ] #1 `[security][backend]` **Нет аутентификации API** — `x-api-key` никогда не проверяется на бэкенде
  - Добавить middleware в `routes/api.js`: проверять заголовок `x-api-key` против `config.apiKey` на всех маршрутах (кроме health)
  - Фронтенд уже отправляет заголовок — нужна только проверка на сервере

- [x] #2 `[security][backend]` **Telegram bot token в ответе API**
  - `GET /api/config` возвращал `{ token: process.env.TELEGRAM_BOT_TOKEN }` — убрано, возвращается `hasToken: boolean`

- [ ] #3 `[bug][backend]` **`safePath()` использует `.toLowerCase()` для сравнения путей — ломается на Linux**
  - На Linux файловая система чувствительна к регистру: `/home/User/file.txt` ≠ `/home/user/file.txt`
  - Использовать `.toLowerCase()` только на Windows (`process.platform === "win32"`)

- [x] #4 `[bug][backend]` **Fetch-запросы к AI API не имеют таймаута**
  - `agentLoop.js`, `server.js`, `api.js` — `AbortController` + таймаут добавлены во всех трёх файлах

- [ ] #5 `[bug][frontend]` **Ответ модели теряется при смене вкладки или перезагрузке страницы в ChatTab**
  - **Корень:** `ChatTab.vue` рендерится через `v-if` — при смене вкладки компонент уничтожается
  - `watch(messages, ...)` останавливается при unmount, `sendMessage()` не вызывает `saveChatHistory()` после ответа
  - **Фикс:** вызывать `saveChatHistory()` явно после `directChat()`; рассмотреть `<KeepAlive>` или `v-show` вместо `v-if`

- [ ] #6 `[security][backend]` **`updateAgentConfig()` — Object.assign без защиты от prototype pollution**
  - `Object.assign(config, newConfig)` — уязвим к `__proto__` / `constructor`
  - **Фикс:** использовать `Object.keys(newConfig).forEach(k => { if (k in config) config[k] = newConfig[k]; })`

- [ ] #7 `[security][backend]` **Все команды Telegram доступны без аккаунта**
  - `/start`, `/help`, `/model`, `/clear`, `/tools` работают для любого пользователя
  - При этом `bot.on("message")` блокирует неизвестных — несоответствие модели безопасности

- [ ] #8 `[bug][backend]` **JSON.parse без обработки undefined/null в tool_calls модели**
  - `agentLoop.js:191-194`, `server.js:546-549`: `JSON.parse(tc.function.arguments)` — если `arguments = undefined`, падает с TypeError
  - `catch` без параметра — теряется стек ошибки
  - **Фикс:** добавить проверку `arguments`, логировать ошибку в `catch(e)`

- [ ] #9 `[feature][backend]` **Режим "простого чата" без проектного контекста**
  - Возможность отключить проектный контекст — агент работает как обычный чат-бот
  - Системный промпт не отправляется (или заменяется на минимальный)
  - `projectPath` игнорируется, доступ к инструментам через `include_paths` аккаунта
  - Telegram-команда `/mode chat` / `/mode project`, переключатель в веб-панели
  - `agentLoop.js`: при `chatMode=true` — минимальный system prompt, `safePath` по `include_paths`
  - `executeTool.js`: cwd = корень диска или `include_paths[0]` вместо `projectPath`

- [x] #10 `[bug][backend]` **`temperature || 0.1` — невозможно установить temperature=0**
  - Заменён `||` на `??` в `agentLoop.js`, `!== undefined` в `api.js` — temperature=0 теперь работает

- [x] #11 `[cleanup][backend]` **`console.log` в production-коде**
  - `server.js:435,523,604`: заменить на `addLog()`/`logInfo()`
  - `executeTool.js:446`: `console.log(\`[executeTool] name=${name}, args=${JSON.stringify(args)}...\`)` — args могут содержать секреты
  - **Фикс:** заменить на `logInfo()`, маскировать `args`

- [ ] #12 `[feature][backend][frontend]` **Поддержка моделей через OpenRouter**
  - OpenRouter предоставляет единый API к 300+ моделям (Claude, Gemini, GPT, DeepSeek, Mistral и др.)
  - **Бэкенд:** добавить в `config` поле `openrouterApiKey`; в `agentLoop.js` определить провайдера по URL (если `serverUrl` содержит `openrouter` → использовать OpenRouter-формат запроса)
  - **Фронтенд:** добавить кнопку "Загрузить модели из OpenRouter" рядом с полем Model_Name (аналогично кнопке обновления моделей для LM Studio)
  - **Нюансы:** OpenRouter требует заголовок `HTTP-Referer` (можно `https://agent-panel.local`) и `X-Title`; модели возвращаются через `GET /v1/models`; стоимость токенов отличается от локальных моделей
  - `GET /api/models` должен уметь переключаться между LM Studio и OpenRouter по типу `serverUrl`

---

## 🟢 Low Priority (P2)

- [x] #1 `[ui][frontend]` Добавить отдельную кнопку для сохранения `PROJECT_PATH`
  - Убрать debounce (300ms auto-save), добавить явную кнопку "Сохранить путь" рядом с полем

- [x] #2 `[bug][backend]` Пересмотреть подсчёт размера контекста
  - Брать данные из `usage` ответа сервера модели (`usage.prompt_tokens`, `usage.completion_tokens`)
  - Убедиться что `usage.prompt_tokens_details.cached_tokens` корректно обрабатывается
  - Добавить отображение контекстного окна модели (если доступно через `/v1/models`)

- [x] #3 `[perf][backend]` **Синхронный file I/O блокирует event loop**
  - Все `*Sync` операции в `executeTool.js` заменить на `fs.promises`

- [ ] #4 `[bug][backend]` **Race condition в `loadAccounts()` между existsSync и readFileSync**
  - Если файл удалён между `fs.existsSync` и `fs.readFileSync` → `ENOENT` исключение
  - **Фикс:** убрать `existsSync`, обернуть `readFileSync` в try/catch с проверкой `e.code !== "ENOENT"`

- [ ] #5 `[feature][backend]` **Асинхронное выполнение длительных команд (`execute`)**
  - Запускать `execute` асинхронно, не блокировать callback handler
  - Активные процессы в `Map<taskId, {...}>`, команды `/tasks`, `/cancel`
  - Таймаут по умолчанию configurable (например 2 часа), `timeout: 0` = без лимита

- [ ] #6 `[security][backend]` **Symlink path traversal в `safePath()`**
  - Добавить `fs.realpathSync()` для разрешения симлинков перед проверкой пути

- [ ] #7 `[feature][backend][frontend]` **Добавить вызов инструментов в веб-панели (`/api/chat`)**
  - Интегрировать `agentLoopStep()` в `/api/chat`; добавить tool definitions; передавать account/permissions
  - Фронтенд: отображение tool calls (выполняется/одобрить/отклонить) и результатов в чате

- [x] #8 `[bug][backend]` **`args.timeout || 30` — некорректная обработка timeout=0 и NaN**
  - Исправлен: `args.timeout != null ? Math.min(Math.max(args.timeout, 1), 3600) : 30`

- [x] #9 `[bug][backend]` **Двойной вызов `getToolConfig()` в `continueAfterApproval`**
  - Исправлен: `getToolConfig()` вызывается один раз, результат сохранён в `mergedToolConfig` (server.js:630)
  - Задача закрыта в рамках P3-13 (рефакторинг TOOLS)

- [x] #10 `[bug][backend]` **Нет валидации `projectPath` на существование при обновлении через API**
  - `api.js:138-141`: любой путь принимается без проверки, что директория существует
  - **Фикс:** `fs.existsSync` + `fs.statSync.isDirectory()` с `400 Bad Request`

- [x] #11 `[bug][backend]` **`useFunctionCalling` fallback не отличает 400 от 500**
  - `agentLoop.js:165-169`: при любой ошибке `!resp.ok` код считает, что model "не поддерживает FC"
  - **Фикс:** fallback только при `resp.status === 400`, иначе сразу `return`

- [x] #12 `[feature][frontend]` **Черновик "⏳ Analyzing request..." не удаляется после ответа**
  - `server.js`: `deleteMessage()` добавлен в 3 места — ошибка, лимит итераций, внешний catch
  - Финальный ответ обновляет черновик через `editDraftMessage`

- [x] #13 `[perf][backend]` **`formatValue()` рекурсия без защиты от циклических ссылок**
  - `executeTool.js:255-285`: рекурсивный обход без защиты от circular ref → `RangeError`
  - **Фикс:** добавить `Set` для отслеживания посещённых объектов

- [x] #14 `[security][frontend]` **Hardcoded API key на фронтенде**
  - `"x-api-key": "agent-secret-key"` в ToolsTab.vue и client.js — если изменить `API_KEY` в `.env`, фронтенд перестанет работать
  - Вынести в env-переменную Vite

- [ ] #15 `[security][backend]` **ReDoS-потенциал в `new RegExp(pattern, "gi")` при поиске**
  - `executeTool.js:494`: лимит 200 символов есть, но паттерн типа `(a+)+b` даёт экспоненциальное backtracking
  - **Фикс:** добавить таймаут на выполнение regex (5с), обернуть в try/catch

- [x] #16 `[perf][backend]` **`getToolConfig()` создаёт новые объекты на каждый вызов**
  - `configDirty` + `cachedConfig`: инвалидация в `updateToolConfig`, повторное использование в `getToolConfig`
  - Все 6 точек вызова читают, не мутируют — кэш безопасен

- [x] #17 `[bug][frontend]` **`loadApiBases()` прямой fetch к AI-серверу — CORS-ошибка на другом origin**
  - Исправлен: `loadApiBases()` проксирует через `/api/models?serverUrl=...` на бэкенде
  - Фикс выполнен в рамках P2-2.3 (контекстное окно модели)

- [x] #18 `[security][backend]` **`checkAccountToolPermission` execute игнорирует `include_paths`**
  - `accounts.js:99`: убрано исключение `toolName !== "execute"` — `include_paths` теперь применяется ко всем инструментам, включая execute

- [x] #19 `[bug][backend]` **parseToolCall не возвращает id для Format 2 (JSON) и Format 3 (<tool>)**
  - `utils.js:108,124`: только Format 1 генерирует `id: "parsed_..."`. JSON и `<tool>` возвращают `{ name, args }` без id
  - `server.js:793`, `agentLoop.js:376`: `xmlTc.id` / `tc.id` = `undefined` → модель может не сопоставить результат с вызовом
  - **Фикс:** добавить генерацию `id` во все три формата

- [x] #20 `[feature][backend]` **Очистка просроченных pendingApprovals (TTL)**
  - `createdAt: Date.now()` в обоих `.set()` + `APPROVAL_TTL` (10 мин) в cleanup interval
  - Удаляются те же интервалом 5 мин, что и rateLimitMap

- [x] #21 `[bug][backend]` **Сетевая ошибка в `/api/chat` до `response.ok` маскируется TypeError**
  - `api.js:390`: guard `if (!response)` перед `response.ok` — вместо TypeError возвращает "AI server unreachable"
  - Тест: проверяет внятное сообщение при сетевой ошибке, без `undefined`/`TypeError`

- [x] #22 `[bug][backend]` **safePath ломается при projectRoot = корень диска (двойной слеш)**
  - `utils.js:40`: `normalizedRoot.endsWith("/")` вместо безусловного `+ "/"`
  - `server.test.js`: добавлен тест для `PROJECT_PATH=E:\`

---

## 🔵 Low-UI / Perf / Style (P3)

- [x] #1 `[ui][frontend]` Отменено. Добавить тултипы для параметров настроек
  - PROJECT_PATH, TELEGRAM_TOKEN, API-BASE, Model_Name, MaxTokens, Temperature, Timeout, MaxFileChars, MaxHistoryPairs, MaxSearchResults, MaxFilesInPrompt

- [x] #2 `[ui][frontend]` Исправить отображение текста тултипа для "Инструменты агента"
  - Создан `AppTooltip.vue` — переиспользуемый компонент (#trigger + default slot)
  - `Card.vue`: `overflow: hidden` перенесён с `.card` на `.card-body`; `z-index: 2` на `.card-header`
  - `ToolsTab.vue`: тултип через `<AppTooltip>`, список инструментов в одну колонку, настройки сворачиваются

- [x] #3 `[ui][frontend]` Разместить прогресс-бары для карточки "Контекст модели" под круговой диаграммой
  - `.token-chart-row`: `flex-direction: row` → `column`, отцентрирован
  - `.token-bars`: добавлен `width: 100%` для полной ширины
  - Адаптивность улучшена: на узком сайдбаре (300px) полосы не сжимаются

- [x] #4 `[refactor][backend]` **Стандартизировать обрезку истории чата**
  - Все `.slice(-20)` и `.slice(-10)` в `server.js` заменены на `-(config.maxHistoryPairs * 2)`
  - 5 точек: approval, error, final answer, post-tool-execution, denied tool

- [x] #5 `[refactor][backend]` Отменён **Graceful shutdown + heartbeatInterval handle**
  - `server.js:728`: `setInterval` без переменной — невозможно очистить при shutdown
  - Добавить `process.on('SIGTERM')` и `process.on('SIGINT')`: сохранить `const heartbeatInterval = setInterval(...)`, `clearInterval(heartbeatInterval)`, остановка бота, закрытие Express

- [x] #6 `[feature][backend]` **Rate limiting**
  - In-memory rate limiter (10 запросов/мин на chatId) для Telegram-сообщений

- [x] #7 `[perf][backend]` **Ограничение размера файлов при поиске**
  - `searchDirectory()` читает каждый файл полностью в память — добавить `maxFileSize`, пропускать бинарные файлы

- [x] #8 `[feature][backend]` Отменена **Очистка старых сессий**
  - `chatHistories` никогда не очищается — добавить периодическую чистку (1 час без активности)

- [x] #9 `[perf][frontend]` **`BotCheckCard.vue` — watch с `{ immediate: true }` вызывает фильтрацию токена на каждый триггер**
  - Заменён `watch` + `ref` на `computed` — мемоизация, пересчёт только при реальном изменении `props.token`
  - `watch` убран из импорта

- [x] #10 `[perf][frontend]` **`BASE_URL` хардкод в `client.js`**
  - `VITE_API_BASE_URL` env-переменная добавлена как fallback для `BASE_URL`

- [x] #11 `[style][frontend]` **Смесь относительных (`/api/accounts`) и абсолютных URL в ToolsTab.vue**
  - Все raw `fetch("/api/...")` вызовы вынесены в `client.js`:
    - ToolsTab.vue: `/api/accounts`, `/api/accounts/import` → `getAccounts()`, `postAccounts()`, `postImportAccounts()`
    - App.vue: `/api/models?serverUrl=` → `getModels(serverUrl)`
    - SettingsTab.vue: `/api/validate-path?path=` → `checkPath(path)`
  - Хардкод `"agent-secret-key"` убран из этих компонентов
  - В `client.js` добавлен `VITE_API_BASE_URL` env fallback

- [x] #12 `[perf][backend]` **ReDoS-потенциал в `extractBash()`**
  - `agentLoop.js:70-73`: `content.match(/⁠\`(?:bash|sh)?[\s\S]*?\`⁠/)` — backtracking при большом content
  - **Фикс:** использовать `indexOf` вместо regex

- [x] #13 `[refactor][backend]` **`TOOLS` определение и конфигурация разделены**
  - `getToolConfig()` теперь включает `input_schema`, `name`, `category` — единый источник
  - `executeTool.js`: добавлен seed при старте (`toolConfig` инициализируется для всех 9 инструментов)
  - `agentLoop.js`: убран прямой обход `TOOLS`, чтение из `getToolConfig()`
  - `server.js`: `continueAfterApproval` кеширует `getToolConfig()` (3 вызова → 1)
  - `ToolsTab.vue`: `input_schema` удаляется перед POST
  - 5 новых тестов: all tools present, schema fields, override, merge paths, isolation

---

## ⚪ Wishlist / Trivial (P4)

- [x] #1 `[feature][backend]` Prometheus `/health` endpoint
  - Добавить `GET /api/health` для мониторинга (бот запущен, AI server reachable)
  - Реализован в `routes/api.js`: проверка botStatus + AI server (`/v1/models` c 5s timeout)
  - Статусы: `healthy`, `degraded` (бот idle), `unhealthy` (AI недоступен)
  - 4 теста в `api.test.js`, lint clean

- [x] #2 `[bug][backend]` **`/api/status` возвращает `uptime` дважды**
  - `routes/api.js`: убран `uptime` из `stats`-объекта; убран `uptime: 0` из wsBroadcast("stats") при stop
  - `useAgent.js`: чтение `uptime` с корневого уровня ответа (`statusData.uptime`)

- [x] #3 `[refactor][backend]` **Магическое число `5` для `maxIterations`**
  - Вынесено в `export const MAX_AGENT_ITERATIONS = 5` (`agentLoop.js:11`)
  - Импортировано и используется в `server.js` (строки 323, 407)

- [x] #4 `[style][backend]` **Объединить разрозненные `let` в один statement**
  - `utils.js:50-51`: `let depth = 0, i = startIdx` ✅
  - Остальные `let` уже были объединены или разделены кодом/комментариями

- [x] #5 `[style][backend]` **`addLog` внутри `updateStatus` — односторонняя зависимость, не рекурсия**
  - Исследование показало: `updateStatus` → `addLog` (чистый вызов, цикла нет)
  - Решение A: без изменений, поведение ожидаемое и документированное

---

## ✅ Выполнено

> Сводка: 15 задач закрыто в предыдущих итерациях.

- `[bug][backend]` `path.resolve()` вместо `path.join()`, нормализация `projectPath` при старте, 15 новых тестов
- `[bug][frontend]` Рестарт — двойное нажатие ✅ убран дубль
- `[tests]` Unit tests: safePath, parseToolCall, executeTool, session, logger — 44 теста
- `[ui][frontend]` Кнопка "Обновить модели" перенесена к полю Model_Name
- `[infra]` Logger.js с уровнями, ротацией, middleware requestLogger
- `[refactor][backend]` Config передаётся параметром в `agentLoopStep()` — дублирование убрано
- `[refactor][backend]` Мёртвый код: удалены `session.js`, `settings.js` (Pinia), `openai` из package.json
- `[feature][infra]` WebSocket вместо 5-сек polling, heartbeat 30с, `useWebSocket.js`
- `[docs]` `web-panel` → `agent-panel`, все ссылки обновлены
- `[bug][ui]` `chat-bubble` цвет для светлой темы
- `[infra]` ESLint + Prettier — flat config, 0 errors
- `[tests][backend]` Интеграционные тесты API — supertest, 25 тестов
- `[tests][frontend]` Компонентные тесты Vue — ControlsCard, ChatTab, SettingsTab, StatsCard
- `[refactor][backend]` `let shell, shellArgs` → `const` внутри блоков
- `[refactor][backend]` `useFC` → `useFunctionCalling`
- `[feature][backend]` Prometheus `/health` endpoint — `GET /api/health` с проверкой botStatus + AI server reachable
