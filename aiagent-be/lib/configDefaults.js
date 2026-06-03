/**
 * Значения конфигурации по умолчанию.
 * @type {Object}
 * @property {string} serverUrl - URL AI сервера по умолчанию
 * @property {string} projectPath - Путь к проекту (пустая строка — не задан)
 * @property {string} systemPrompt - Системный промпт (пустая строка — не задан)
 * @property {string} apiKey - Ключ авторизации API
 * @property {string} modelName - Имя модели по умолчанию
 * @property {number} maxTokens - Максимальное количество токенов в ответе (1024)
 * @property {number} temperature - Температура генерации (0.1)
 * @property {number} timeout - Таймаут запроса в мс (300000 = 5 минут)
 * @property {number} maxFileChars - Макс. символов при чтении файла (2000)
 * @property {number} maxHistoryPairs - Макс. пар сообщений в истории (5)
 * @property {number} maxSearchResults - Макс. результатов поиска (15)
 * @property {number} maxFilesInPrompt - Макс. файлов в промпте (2)
 * @property {number} maxSearchFileSize - Макс. размер файла для поиска в байтах (1048576 = 1 MB)
 * @property {boolean} stream - Потоковый вывод SSE (true)
 * @property {number} executeTimeout - Таймаут выполнения команд (72000 мс)
 * @property {boolean} insertUserAfterTool - Вставлять {role:"user", content:"Continue"} после tool-сообщений (true)
 * @property {boolean} chatMode - Режим простого чата без проектного контекста (false)
 * @property {string} openrouterApiKey - API ключ OpenRouter, опционально ("")
 */
export const configDefaults = {
  serverUrl: "http://192.168.1.101:8080/v1",
  projectPath: "",
  systemPrompt: "",
  apiKey: "agent-secret-key",
  modelName: "qwen3.5-2b",
  maxTokens: 1024,
  temperature: 0.1,
  timeout: 300000, // 5 минут (для code generation)
  maxFileChars: 2000,
  maxHistoryPairs: 5,
  maxSearchResults: 15,
  maxFilesInPrompt: 2,
  maxSearchFileSize: 1048576, // 1 MB
  stream: true,
  executeTimeout: 72000,
  insertUserAfterTool: true, // Для моделей с проблемным jinja (qwen и др.). Вставляет {role:"user", content:"Continue"} после tool-сообщений, чтобы шаблон не падал с "No user query found". Безопасно для OpenAI-совместимых моделей.
  chatMode: false, // Режим простого чата без проектного контекста
  openrouterApiKey: "", // API ключ OpenRouter (опционально)
  asrServerUrl: "", // URL ASR сервера (whisper.cpp / faster-whisper), опционально
  asrLanguage: "ru", // Язык распознавания (ISO 639-1, напр. "ru", "en", "de")
};
