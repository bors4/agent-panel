# TODO — Task List

&gt; **Легенда:** `[ ]` — не выполнено · `[x]` — выполнено · `[~]` — перенести
&gt; **Приоритеты:** `P0` 🔴 High · `P1` 🟡 Medium · `P2` 🟢 Low
&gt; Номер — `#1`… (отдельно в каждой группе). Ссылка: "P2 задача 4" = Low Priority → #4

&gt; **Прогресс: 11 / 18** | `P0: 3/4` · `P1: 2/7` · `P2: 7/7`

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

---

## 🟢 Low Priority (P2)

- [x] #1 `[docs]` Переименовать директорию `web-panel` → `agent-panel` и обновить все ссылки
- [x] #2 `[bug][ui]` Нужно исправить `color` для `chat-bubble`. Для светлой темы не виден. ✅ Исправлено: заменё
