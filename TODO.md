# TODO — Task List

> **Легенда:** `[ ]` — не выполнено · `[x]` — выполнено · `[~]` — перенести
> **Приоритеты:** `P0` 🔴 High · `P1` 🟡 Medium · `P2` 🟢 Low
> Номер — `#1`… (отдельно в каждой группе).

> **Прогресс: 12 / 33** | `P0: 3/8` · `P1: 3/13` · `P2: 6/12`

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

- [ ] #8 `[refactor][backend]` **Убрать дублирование config-объекта** между `server.js` и `agentLoop.js`
  - Передавать config как параметр в функции agentLoop вместо хранения копии; убрать `updateAgentConfig()`

- [ ] #9 `[perf][backend]` **Синхронный file I/O блокирует event loop**
  - Все `*Sync` операции в `executeTool.js` заменить на `fs.promises`

- [ ] #10 `[refactor][backend]` **Мёртвый код и зависимости**
  - `aiagent-be/lib/session.js` — импортирован но не используется; либо интегрировать, либо удалить
  - `aiagent-web-panel/src/stores/settings.js` — Pinia store не используется; либо интегрировать, либо удалить
  - `openai` в `package.json` — установлен, но нигде не импортирован (~1.5MB мусора); удалить

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

---

## 🟢 Low Priority (P2)

- [x] #1 `[docs]` Переименовать директорию `web-panel` → `agent-panel` и обновить все ссылки
- [x] #2 `[bug][ui]` Нужно исправить `color` для `chat-bubble`. Для светлой темы не виден. ✅ Исправлено: заменён

- [ ] #3 `[infra]` **Добавить ESLint + Prettier**
  - Нет никакого линтера/форматтера; код в разном стиле (кавычки, отступы, точки с запятой)

- [ ] #4 `[refactor][backend]` **Стандартизировать обрезку истории чата**
  - `server.js` режет до 20, `session.js` до 10, `agentLoop.js` через `maxHistoryPairs*2`
  - Выбрать единый лимит и единый механизм

- [ ] #5 `[refactor][backend]` **Graceful shutdown**
  - Добавить `process.on('SIGTERM')` и `process.on('SIGINT')` для остановки бота и закрытия Express

- [ ] #6 `[tests][backend]` **Интеграционные тесты API**
  - Добавить supertest для тестирования всех REST endpoints

- [ ] #7 `[tests][frontend]` **Компонентные тесты Vue**
  - Добавить тесты для SettingsTab, ChatTab, ControlsCard, StatsCard

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
