# TODO — Task List

&gt; **Легенда:** `[ ]` — не выполнено · `[x]` — выполнено · `[~]` — перенести
&gt; **Приоритеты:** `P0` 🔴 High · `P1` 🟡 Medium · `P2` 🟢 Low
&gt; Номер — `#1`… (отдельно в каждой группе). Ссылка: "P2 задача 4" = Low Priority → #4

&gt; **Прогресс: 11 / 11** | `P0: 1/1` · `P1: 3/3` · `P2: 7/7`

---

## 🔴 High Priority (P0)

- [x] #1 `[bug][backend]` Когда модель пытается вызвать инструмент, например, `list_dir`, то бот отвечает как `qwen_test_bot: ❌ read failed: Path outside project is forbidden` ✅ Исправлено: `path.resolve()` вместо `path.join()`, нормализация `projectPath` при старте, 15 новых тестов

- [x] #2 `[bug][frontend]` При нажатии на кнопку «Рестарт» запрос к `http://127.0.0.1:3000/api/restart` висит в состоянии Pending. Рестарт происходит только после второго нажатия на кнопку

- [x] #3 `[tests]` Add unit tests for critical paths ✅ 44 теста: safePath, parseToolCall, executeTool, session, logger

---

## 🟡 Medium Priority (P1)

- [x] #1 `[ui][frontend]` Перенести кнопку "Обновить модели" и разместить возле поля "Model_Name" ✅
  - *Приоритет: P2*

- [x] #4 `[infra]` Improve logging and monitoring ✅ Добавлен logger.js с уровнями, ротацией, middleware requestLogger

---

## 🟢 Low Priority (P2)

- [x] #1 `[docs]` Переименовать директорию `web-panel` → `agent-panel` и обновить все ссылки
- [x] #2 `[bug][ui]` Нужно исправить `color` для `chat-bubble`. Для светлой темы не виден. ✅ Исправлено: заменё
