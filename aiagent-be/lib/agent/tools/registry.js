/**
 * Tool registry: definitions, default config, and mutable runtime config store.
 * @module registry
 */

/** Значения конфигурации инструмента по умолчанию. */
export const DEFAULT_TOOL_CONFIG = {
  enabled: true,
  permission: "ask",
  exclude_paths: [],
};

/**
 * Определения всех доступных инструментов AI агента.
 * Каждый инструмент содержит name, description, category, examples и input_schema.
 * @type {Object.<string, {name: string, description: string, category: string, examples: string[], input_schema: Object}>}
 */
export const TOOLS = {
  read: {
    name: "read",
    description: "Read file contents from the project directory",
    category: "file",
    examples: ['<tool>{"name": "read", "args": {"filePath": "src/main.js"}}</tool>'],
    input_schema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "Path to file relative to project",
        },
      },
      required: ["filePath"],
    },
  },
  write: {
    name: "write",
    description: "Create or overwrite a file with content",
    category: "file",
    examples: ['<tool>{"name": "write", "args": {"filePath": "output.txt", "content": "Hello World"}}</tool>'],
    input_schema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "Path to file relative to project",
        },
        content: {
          type: "string",
          description:
            "Raw file content saved as-is. Match format to file extension (.json -> JSON, .html -> HTML, .js -> JS, etc.). Do NOT wrap in response objects like {success, data, content}.",
        },
      },
      required: ["filePath", "content"],
    },
  },
  search: {
    name: "search",
    description: "Search for pattern in all files recursively",
    category: "search",
    examples: ['<tool>{"name": "search", "args": {"pattern": "TODO", "include": "*.js"}}</tool>'],
    input_schema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Regex pattern to search" },
        include: { type: "string", description: "File filter, e.g. *.js" },
      },
      required: ["pattern"],
    },
  },
  list_dir: {
    name: "list_dir",
    description: "List directory contents as flat list",
    category: "file",
    examples: ['<tool>{"name": "list_dir", "args": {"path": ".", "depth": 1}}</tool>'],
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Directory path relative to project",
        },
        depth: { type: "number", description: "Max depth (1-3)" },
      },
    },
  },
  execute: {
    name: "execute",
    description:
      "Execute a shell command. Error output (stderr) is returned on failure — learn from it. Prefer simple, direct commands.",
    category: "system",
    examples: ['<tool>{"name": "execute", "args": {"command": "npm install", "timeout": 60}}</tool>'],
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command to execute. Prefer simple one-line commands." },
        timeout: {
          type: "number",
          description: "Timeout in seconds (max 120)",
        },
      },
      required: ["command"],
    },
  },
  create_dir: {
    name: "create_dir",
    description: "Create a new directory",
    category: "file",
    examples: ['<tool>{"name": "create_dir", "args": {"path": "new-folder"}}</tool>'],
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Directory path relative to project",
        },
      },
      required: ["path"],
    },
  },
  delete: {
    name: "delete",
    description: "Delete a file or directory",
    category: "file",
    examples: ['<tool>{"name": "delete", "args": {"path": "temp/file.txt"}}</tool>'],
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to file or directory" },
      },
      required: ["path"],
    },
  },
  move: {
    name: "move",
    description: "Move or rename a file or directory",
    category: "file",
    examples: ['<tool>{"name": "move", "args": {"source": "old.txt", "destination": "new.txt"}}</tool>'],
    input_schema: {
      type: "object",
      properties: {
        source: { type: "string", description: "Source path" },
        destination: { type: "string", description: "Destination path" },
      },
      required: ["source", "destination"],
    },
  },
  copy: {
    name: "copy",
    description: "Copy a file",
    category: "file",
    examples: ['<tool>{"name": "copy", "args": {"source": "file.txt", "destination": "file.bak"}}</tool>'],
    input_schema: {
      type: "object",
      properties: {
        source: { type: "string", description: "Source file path" },
        destination: { type: "string", description: "Destination file path" },
      },
      required: ["source", "destination"],
    },
  },
  edit: {
    name: "edit",
    description: "Replace exact text in one file. Requires oldString to match exactly including whitespace and indentation.",
    category: "file",
    examples: [
      '<tool>{"name": "edit", "args": {"filePath": "src/main.js", "oldString": "console.log(1)", "newString": "console.log(2)"}}</tool>',
    ],
    input_schema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to file relative to project" },
        oldString: { type: "string", description: "Exact text to replace" },
        newString: { type: "string", description: "Replacement text" },
        replaceAll: { type: "boolean", description: "Replace all occurrences (default false)" },
      },
      required: ["filePath", "oldString", "newString"],
    },
  },
  glob: {
    name: "glob",
    description: "Find files by glob pattern in the project directory. Returns sorted relative file paths.",
    category: "search",
    examples: [
      '<tool>{"name": "glob", "args": {"pattern": "**/*.js", "limit": 50}}</tool>',
      '<tool>{"name": "glob", "args": {"pattern": "src/**/*.css", "path": "src"}}</tool>',
    ],
    input_schema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Glob pattern to match files against (e.g., **/*.js, src/**/*.{ts,tsx})" },
        path: { type: "string", description: "Relative directory to search (defaults to project root)" },
        limit: { type: "number", description: "Maximum results to return (default 200)" },
      },
      required: ["pattern"],
    },
  },
  grep: {
    name: "grep",
    description: "Search file contents by regex within the project. Returns file paths, line numbers, and line previews.",
    category: "search",
    examples: [
      '<tool>{"name": "grep", "args": {"pattern": "TODO|FIXME", "include": "*.js", "limit": 30}}</tool>',
    ],
    input_schema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Regex pattern to search for" },
        include: { type: "string", description: 'File glob filter, e.g. "*.js" or "*.{ts,tsx}"' },
        path: { type: "string", description: "Relative directory to search (defaults to project root)" },
        limit: { type: "number", description: "Maximum matches to return (default 50)" },
      },
      required: ["pattern"],
    },
  },
  question: {
    name: "question",
    description:
      "Ask the user questions during execution. Use to gather preferences, clarify requests, or get decisions. Supports text input, multiple choice, and multi-select.",
    category: "interaction",
    examples: [
      '<tool>{"name": "question", "args": {"questions": [{"question": "What port?", "header": "Port", "options": [{"label": "3000", "description": "Default"}]}]}}</tool>',
    ],
    input_schema: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          description: "Questions to ask the user",
          items: {
            type: "object",
            properties: {
              question: { type: "string", description: "The question text" },
              header: { type: "string", description: "Short label (max 30 chars)" },
              options: {
                type: "array",
                description: "Available choices (omit for free-text input)",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string", description: "Display text" },
                    description: { type: "string", description: "Explanation of choice" },
                  },
                  required: ["label", "description"],
                },
              },
              multiple: { type: "boolean", description: "Allow selecting multiple choices" },
            },
            required: ["question"],
          },
        },
      },
      required: ["questions"],
    },
  },
  websearch: {
    name: "websearch",
    description: "Search the web for current information. Returns title, snippet, and URL for each result.",
    category: "web",
    examples: [
      '<tool>{"name": "websearch", "args": {"query": "latest stable Node.js version", "numResults": 5}}</tool>',
    ],
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query (max 400 chars)" },
        numResults: { type: "number", description: "Number of results (1-20, default 10)" },
      },
      required: ["query"],
    },
  },
  webfetch: {
    name: "webfetch",
    description: "Fetch content from an HTTP or HTTPS URL and return as text, markdown, or HTML.",
    category: "web",
    examples: [
      '<tool>{"name": "webfetch", "args": {"url": "https://example.com", "format": "markdown"}}</tool>',
    ],
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The HTTP or HTTPS URL to fetch" },
        format: {
          type: "string",
          enum: ["text", "markdown", "html"],
          description: "Return format (default: markdown)",
        },
        timeout: { type: "number", description: "Timeout in seconds (max 120, default 30)" },
      },
      required: ["url"],
    },
  },
  skill: {
    name: "skill",
    description: "Load a specialized skill from the .agents/skills/ directory. Returns the skill content and references to its files.",
    category: "system",
    examples: [
      '<tool>{"name": "skill", "args": {"name": "design-taste-frontend"}}</tool>',
    ],
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "The name of the skill to load" },
      },
      required: ["name"],
    },
  },
  todowrite: {
    name: "todowrite",
    description: "Create and maintain a structured task list for the current session. Track progress across steps.",
    category: "system",
    examples: [
      '<tool>{"name": "todowrite", "args": {"todos": [{"content": "Fix bug", "status": "in_progress", "priority": "high"}]}}</tool>',
    ],
    input_schema: {
      type: "object",
      properties: {
        todos: {
          type: "array",
          description: "Task list with content, status, and priority",
          items: {
            type: "object",
            properties: {
              content: { type: "string", description: "Description of the task" },
              status: {
                type: "string",
                enum: ["pending", "in_progress", "completed", "cancelled"],
                description: "Task status",
              },
              priority: {
                type: "string",
                enum: ["high", "medium", "low"],
                description: "Priority level",
              },
            },
            required: ["content", "status", "priority"],
          },
        },
      },
      required: ["todos"],
    },
  },
};

/**
 * Текущая конфигурация инструментов (мутабельная, инициализируется при старте).
 * @type {Object.<string, {enabled: boolean, permission: string, exclude_paths: string[]}>}
 */
export const toolConfig = {};

for (const name of Object.keys(TOOLS)) {
  toolConfig[name] = { ...DEFAULT_TOOL_CONFIG };
}

/** @type {Object|null} */
let cachedConfig = null;
/** @type {boolean} */
let configDirty = true;

/**
 * Обновить конфигурацию конкретного инструмента.
 * @param {string} name - Название инструмента
 * @param {Object} settings - Новые настройки (enabled, permission, exclude_paths)
 */
export function updateToolConfig(name, settings) {
  if (!toolConfig[name]) {
    toolConfig[name] = { ...DEFAULT_TOOL_CONFIG };
  }
  const blockedKeys = ["__proto__", "constructor", "prototype"];
  for (const key of Object.keys(settings)) {
    if (!blockedKeys.includes(key)) {
      toolConfig[name][key] = settings[key];
    }
  }
  configDirty = true;
}

/**
 * Получить полную конфигурацию всех инструментов.
 * Сливает DEFAULT_TOOL_CONFIG с текущими настройками и метаданными из TOOLS.
 * Результат кэшируется до следующего updateToolConfig.
 * @returns {Object.<string, Object>} Конфигурация всех инструментов
 */
export function getToolConfig() {
  if (!configDirty && cachedConfig) return cachedConfig;
  const config = {};
  for (const [name, tool] of Object.entries(TOOLS)) {
    config[name] = {
      ...DEFAULT_TOOL_CONFIG,
      ...(toolConfig[name] || {}),
      name: tool.name,
      description: tool.description,
      category: tool.category,
      examples: tool.examples,
      input_schema: tool.input_schema,
    };
  }
  configDirty = false;
  cachedConfig = config;
  return config;
}
