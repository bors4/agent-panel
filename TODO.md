# TODO — Task List

> **Легенда:** `[ ]` — не выполнено · `[x]` — выполнено · Номер — `#1`…`#9`
>
> **Прогресс: 3 / 9** | `High: 0/1` · `Medium: 0/3` · `Low: 3/5`

---

## 🔴 High Priority

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
       at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
  ```

  </details>

---

## 🟡 Medium Priority

- [ ] #2 `[bug][frontend]` При нажатии на кнопку «Рестарт» запрос к `http://127.0.0.1:3000/api/restart` висит в состоянии Pending. Рестарт происходит только после второго нажатия на кнопку

- [ ] #3 `[tests]` Add unit tests for critical paths

- [ ] #4 `[infra]` Improve logging and monitoring

---

## 🟢 Low Priority

- [x] #5 `[docs]` Переименовать директорию `web-panel` → `agent-panel` и обновить все ссылки

- [x] #6 `[bug][ui]` Нужно исправить `color` для `chat-bubble`. Для светлой темы не виден. ✅ Исправлено: заменён `var(--accent)` → `var(--accent-primary)`

- [x] #7 `[bug][frontend]` Исправить ошибку `client:510` — `[Vue warn]: Component emitted event "modelsUpdated"...`

  <details>
  <summary>Стектрейс</summary>

  ```
  (anonymous)  @  client:510
  (anonymous)  @  SettingsTab.vue:339
  ```

  </details>

  > Ошибка появляется при включении чекбокса **API-BASE** и обновлении списка моделей.

- [ ] #8 `[bug][ui]` При обновлении настроек появляется сразу два одинаковых уведомления. Если изменить настройки на вкладке «Быстрые настройки», то появляется два разных уведомления.

- [ ] #9 `[bug][ui]` Для глобального поиска неправильно установлен `z-index`.

- [x] #10 `[ui]` Добавить контекстное меню для инструментов чата. Разместить "Очистить чат" в контекстном меню. Изменить стиль кнопки "Очистить чат". ✅ Выполнено: кнопка ☰ с выпадающим меню + диалог подтверждения, убрана кнопка из панели вкладок

---

_Статус: 1 из 9 выполнено_ · _Last updated: 13.05.2026_