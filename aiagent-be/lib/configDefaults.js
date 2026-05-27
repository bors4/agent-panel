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
};
