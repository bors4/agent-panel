# TODO — Task List

> **Легенда:** `[ ]` — не выполнено · `[x]` — выполнено
> **Приоритеты:** `P0` 🔴 High · `P1` 🟡 Medium · `P2` 🟢 Low
> Номер — `#1`… (отдельно в каждой группе). Ссылка: "P2 задача 4" = Low Priority → #4

> **Прогресс: 7 / 10** | `P0: 0/1` · `P1: 2/3` · `P2: 5/6`

---

## 🔴 High Priority (P0)

- [ ] #1 `[bug][backend]` Когда модель пытается вызвать инструмент, например, `list_dir`, то бот отвечает как `qwen_test_bot: ❌ read failed: Path outside project is forbidden`

  <details>
  <summary>Стектрейс</summary>

  ```
  [continueAfterApproval] Called: { toolName: 'list_dir', toolCallId: '998893157', args: { path: '.' } }
  [executeTool] Error in list_dir: Error: Path outside project is forbidden: e:/git/agent-panel
       at safePath (file:///E:/Git/agent-panel/aiagent-be/lib/utils.js:12:11)
       at executeTool (file:///E:/Git/agent-panel/aiagent-be/lib/agent/executeTool.js:500:13)
       at continueAfterApproval (file:///E:/Git/agent-panel/aiagent-be/server.js:523:26)
       at file:///E:/Git/agent-panel/aiagent-be/server.js:721:11
       at process.processTicksAndRejections (node:internal/modules/esm/loader:661:26)
  ```

  </details>

---

## 🟡 Medium Priority (P1)

- [ ] #1 `[bug][frontend]` При нажатии на кнопку «Рестарт» запрос к `http://127.0.0.1:3000/api/restart` висит в состоянии Pending. Рестарт происходит только после второго нажатия на кнопку

- [x] #2 `[tests]` Add unit tests for critical paths ✅ 44 теста: safePath, parseToolCall, executeTool, session, logger

- [x] #3 `[infra]` Improve logging and monitoring ✅ Добавлен logger.js с уровнями, ротацией, middleware requestLogger

---

## 🟢 Low Priority (P2)

- [x] #1 `[docs]` Переименовать директорию `web-panel` → `agent-panel` и обновить все ссылки

- [x] #2 `[bug][ui]` Нужно исправить `color` для `chat-bubble`. Для светлой темы не виден. ✅ Исправлено: заменён `var(--accent)` → `var(--accent-primary)`

- [x] #3 `[bug][frontend]` Исправить ошибку `client:510` — `[Vue warn]: Component emitted event "modelsUpdated"...`

  <details>
  <summary>Стектрейс</summary>

  ```
  (anonymous)  @  client:510
  (anonymous)  @  SettingsTab.vue:339
  ```

  </details>

  > Ошибка появляется при включении чекбокса **API-BASE** и обновлении списка моделей.

- [ ] #4 `[bug][ui]` При обновлении настроек появляется сразу два одинаковых уведомления. Если изменить настройки на вкладке «Быстрые настройки», то появляется два разных уведомления.

- [x] #5 `[bug][ui]` Для глобального поиска неправильно установлен `z-index`. ✅ Исправлено: z-index 10000

- [x] #6 `[ui]` Добавить контекстное меню для инструментов чата. Разместить "Очистить чат" в контекстном меню. Изменить стиль кнопки "Очистить чат". ✅ Выполнено: кнопка ☰→✕ с тремя кружками + выпадающее меню + диалог подтверждения

---

_Статус: 7 из 10 выполнено_ · _Last updated: 14.05.2026_