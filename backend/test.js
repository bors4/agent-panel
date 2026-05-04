// test.js — AI-агент + Express API (FINAL CLEAN VERSION)
import fs from 'fs/promises';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

import cors from 'cors';
import express from 'express';
import { OpenAI } from 'openai';
import { Telegraf, Markup } from 'telegraf';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- НАСТРОЙКИ ---
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8615851636:AAE68i91BTch0naWJX9wl4ydL7GWVcsbkUM';
const PROJECT_PATH = 'E:\\Git\\test_project';
const SERVER_URL = 'http://192.168.1.103:8080/v1';
const MODEL_NAME = 'qwen2.5-coder-7b-instruct';
const API_PORT = 3000;
const API_KEY = process.env.API_KEY || 'agent-secret-key';

const MAX_FILE_CHARS = 2000;
const MAX_HISTORY_PAIRS = 5;
const MAX_SEARCH_RESULTS = 15;

// --- КЛИЕНТЫ ---
const ai = new OpenAI({ baseURL: SERVER_URL, apiKey: 'sk-no-key-required', timeout: 120000, maxRetries: 0 });
const bot = new Telegraf(TELEGRAM_TOKEN, { handlerTimeout: 180000 });
bot.telegram.webhookReply = false;

// --- ГЛОБАЛЬНОЕ СОСТОЯНИЕ ---
const agentState = {
  running: false,
  startTime: null,
  stats: { requests: 0, tools: 0, errors: 0 },
  logs: [],
  config: {
    projectPath: PROJECT_PATH,
    serverUrl: SERVER_URL,
    modelName: MODEL_NAME,
    maxFileChars: MAX_FILE_CHARS,
    maxHistoryPairs: MAX_HISTORY_PAIRS,
    maxSearchResults: MAX_SEARCH_RESULTS,
    systemPrompt: '',
  },
};

let isLaunching = false;
let isStopping = false;

// --- СЕССИИ ---
const sessions = new Map();

function getSession(chatId) {
  if (!sessions.has(chatId)) sessions.set(chatId, { history: [], pendingActions: new Map() });

  return sessions.get(chatId);
}

function addToHistory(chatId, role, content) {
  const s = getSession(chatId);
  s.history.push({ role, content });

  if (s.history.length > MAX_HISTORY_PAIRS * 2) s.history = s.history.slice(-MAX_HISTORY_PAIRS * 2);
}

// --- БЕЗОПАСНЫЙ ПУТЬ ---
function safePath(...args) {
  const joined = path.join(PROJECT_PATH, ...args);
  const normalized = path.normalize(joined).replace(/\\/g, '/');
  const projectNorm = PROJECT_PATH.replace(/\\/g, '/');
  if (!normalized.startsWith(projectNorm)) throw new Error('Доступ за пределы проекта запрещён');

  return normalized;
}

// --- ЛОГИРОВАНИЕ ---
function addLog(type, message) {
  const entry = { time: new Date().toISOString(), type, message };
  agentState.logs.push(entry);
  if (agentState.logs.length > 500) agentState.logs.shift();
  console.log(`[${entry.time}] [${type}] ${message}`);
}

// --- ИНСТРУМЕНТЫ ---
async function tool_createFile(filePath, content) {
  const safe = safePath(filePath);
  await fs.mkdir(path.dirname(safe), { recursive: true });
  await fs.writeFile(safe, content, 'utf8');
  agentState.stats.tools++;

  return `✅ Файл создан: ${filePath}`;
}

async function tool_deleteFile(filePath) {
  const safe = safePath(filePath);
  await fs.rm(safe, { force: true });
  agentState.stats.tools++;

  return `✅ Файл удалён: ${filePath}`;
}

async function tool_updateFile(filePath, content) {
  const safe = safePath(filePath);
  await fs.access(safe);
  await fs.writeFile(safe, content, 'utf8');
  agentState.stats.tools++;

  return `✅ Файл обновлён: ${filePath}`;
}

async function tool_readFile(filePath) {
  const safe = safePath(filePath);
  const content = await fs.readFile(safe, 'utf8');

  return content.length > MAX_FILE_CHARS ? content.substring(0, MAX_FILE_CHARS) + `\n\n[... обрезано]` : content;
}

async function tool_listFiles(dir = '.') {
  const safe = safePath(dir);
  const entries = await fs.readdir(safe, { withFileTypes: true });

  return entries
    .filter((e) => !['.git', 'node_modules', 'venv', '__pycache__', 'dist', 'build'].includes(e.name))
    .slice(0, 30)
    .map((e) => (e.isDirectory() ? `📁 ${e.name}/` : `📄 ${e.name}`))
    .join('\n');
}

async function tool_searchCode(query, dir = '.') {
  const safe = safePath(dir);
  const results = [];
  const q = query.toLowerCase();

  async function scan(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const e of entries) {
      if (results.length >= MAX_SEARCH_RESULTS) return;
      const full = path.join(currentDir, e.name);

      if (e.isDirectory() && !['.git', 'node_modules', 'venv', '__pycache__'].includes(e.name)) {
        await scan(full);
      } else if (
        ['.js', '.ts', '.json', '.md', '.feature', '.yaml', '.yml', '.css', '.html'].includes(
          path.extname(e.name).toLowerCase()
        )
      ) {
        try {
          (await fs.readFile(full, 'utf8')).split('\n').forEach((line, idx) => {
            if (line.toLowerCase().includes(q) && results.length < MAX_SEARCH_RESULTS) {
              results.push(`${path.relative(PROJECT_PATH, full)}:${idx + 1} | ${line.trim()}`);
            }
          });
        } catch {}
      }
    }
  }

  await scan(safe);

  return results.length ? `🔍 Найдено:\n${results.join('\n')}` : '❌ Совпадений не найдено.';
}

// --- ПАРСЕР ---
function parseToolCall(text) {
  const match = text.match(/<tool>([\s\S]*?)<\/tool>/i);
  if (!match) return null;

  try {
    const raw = match[1]
      .trim()
      .replace(/^```json\s*|\s*```$/g, '')
      .trim();
    if (!raw.startsWith('{')) return null;
    const parsed = JSON.parse(raw);

    return { name: parsed.name, args: parsed.args || parsed.parameters || parsed.arguments || {} };
  } catch {
    return null;
  }
}

async function executeTool(toolCall) {
  const { name, args } = toolCall;

  switch (name) {
    case 'createFile':
      return await tool_createFile(args.filePath, args.content);
    case 'deleteFile':
      return await tool_deleteFile(args.filePath);
    case 'updateFile':
      return await tool_updateFile(args.filePath, args.content);
    case 'readFile':
      return await tool_readFile(args.filePath);
    case 'listFiles':
      return await tool_listFiles(args.dir || '.');
    case 'searchCode':
      return await tool_searchCode(args.query, args.dir || '.');
    default:
      throw new Error(`Неизвестный инструмент: ${name}`);
  }
}

// --- ПРОМПТ ---
function buildSystemPrompt() {
  const c = agentState.config;

  return (
    agentState.config.systemPrompt ||
    `Ты — AI-агент для работы с файловой системой и кодом.
Проект: ${c.projectPath.replace(/\\/g, '/')}
🔧 ИНСТРУМЕНТЫ: <tool>{"name":"...","args":{...}}</tool>
createFile | updateFile | deleteFile | readFile | listFiles | searchCode
❗ ПРАВИЛА:
1. Перед изменением файла ВСЕГДА сначала читай файл через readFile.
2. updateFile требует ПОЛНЫЙ код файла.
3. Если просят отредактировать → читай файл → сразу вызывай updateFile.
4. Внутри <tool> только JSON. Никакого кода или пояснений.
5. Отвечай кратко.`
  );
}

async function sendLongMessage(ctx, text) {
  if (text.length <= 4000) return ctx.reply(text);
  for (let i = 0; i < text.length; i += 4000) await ctx.reply(text.slice(i, i + 4000));
}

// --- ЗАПУСК БОТА (startPolling вместо launch) ---
async function startBot() {
  try {
    await bot.telegram.getMe();
    console.log('✅ Токен валиден, бот:', (await bot.telegram.getMe()).username);
    bot.startPolling({
      allowedUpdates: ['message', 'callback_query', 'edited_message'],
      timeout: 30,
      dropPendingUpdates: true,
    });
    console.log('✅ Polling запущен');

    return true;
  } catch (e) {
    console.error('❌ Ошибка запуска бота:', e.message);
    console.error('   Код:', e.code);
    console.error('   Описание:', e.response?.description);

    return false;
  }
}

// --- TELEGRAM HANDLERS ---
bot.on('text', async (ctx) => {
  const userQuery = ctx.message.text;
  const chatId = ctx.chat.id;

  try {
    await ctx.sendChatAction('typing');
    addToHistory(chatId, 'user', userQuery);
    const session = getSession(chatId);
    const historyMessages = session.history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-MAX_HISTORY_PAIRS * 2);
    const messages = [
      { role: 'system', content: buildSystemPrompt() },
      ...historyMessages,
      { role: 'user', content: userQuery },
    ];
    const response = await ai.chat.completions.create({
      model: agentState.config.modelName,
      messages,
      temperature: 0.1,
      max_tokens: 1024,
    });
    const replyText = response.choices[0].message.content;
    addToHistory(chatId, 'assistant', replyText);
    const toolCall = parseToolCall(replyText);

    if (toolCall) {
      const actionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      session.pendingActions.set(actionId, toolCall);
      const kb = Markup.inlineKeyboard([
        Markup.button.callback('✅ Выполнить', `exec:${actionId}`),
        Markup.button.callback('❌ Отмена', `cancel:${actionId}`),
      ]);
      const cleanReply = replyText.replace(/<tool>[\s\S]*?<\/tool>/gi, '').trim();
      const msg = cleanReply || `🔧 Запрос: ${toolCall.name}`;
      await ctx.reply(`${msg}\n\`\`\`json\n${JSON.stringify(toolCall.args, null, 2)}\n\`\`\``, kb);

      return;
    }

    await sendLongMessage(ctx, replyText);
    agentState.stats.requests++;
  } catch (error) {
    console.error(error);
    agentState.stats.errors++;
    await ctx.reply(error?.message?.includes('timed out') ? '⏱ Таймаут' : `❌ ${error.message}`);
  }
});

bot.action(/^exec:(.+)/, async (ctx) => {
  const actionId = ctx.match[1];
  const chatId = ctx.chat.id;
  const session = getSession(chatId);
  const toolCall = session.pendingActions.get(actionId);
  if (!toolCall) return ctx.answerCbQuery('❌ Не найдено');

  try {
    await ctx.answerCbQuery('⏳ Выполняю...');
    const result = await executeTool(toolCall);

    if (toolCall.name === 'readFile' && result) {
      const filePath = toolCall.args.filePath;
      const needsEdit = /edit|change|update|fix|add|remove|delete|редактир|измени|исправь|добавь|удали/i.test(
        ctx.callbackQuery.message.text?.split('\n')[0] || ''
      );

      if (needsEdit) {
        const followUp = `Файл "${filePath}" прочитан:\n\`\`\`\n${result}\n\`\`\`\nЗадача: "${ctx.callbackQuery.message.text?.split('\n')[0] || 'отредактируй'}"\nВерни updateFile с ПОЛНЫМ кодом в <tool>...</tool>`;
        const autoResp = await ai.chat.completions.create({
          model: agentState.config.modelName,
          messages: [
            { role: 'system', content: buildSystemPrompt() },
            { role: 'user', content: followUp },
          ],
          temperature: 0.1,
          max_tokens: 2048,
        });
        const updateTool = parseToolCall(autoResp.choices[0].message.content);

        if (updateTool?.name === 'updateFile' && updateTool.args?.content) {
          const newId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
          session.pendingActions.set(newId, { ...updateTool, _originalPath: filePath, _originalContent: result });
          const kb = Markup.inlineKeyboard([
            Markup.button.callback('✅ Применить', `exec:${newId}`),
            Markup.button.callback('❌ Отменить', `cancel:${newId}`),
          ]);
          const preview =
            updateTool.args.content.length > 400
              ? updateTool.args.content.slice(0, 400) + '\n...'
              : updateTool.args.content;
          await ctx.reply(`📝 Предложение для \`${filePath}\`:\n\`\`\`javascript\n${preview}\n\`\`\``, kb);
          session.pendingActions.delete(actionId);

          return;
        }
      }

      await ctx.reply(`📄 \`${filePath}\`:\n\`\`\`\n${result}\n\`\`\``);
      session.pendingActions.delete(actionId);

      return;
    }

    await ctx.reply(`✅ Готово:\n\`\`\`\n${result}\n\`\`\``);
  } catch (e) {
    console.error('Ошибка exec:', e);
    await ctx.reply(`❌ ${e.message}`);
  } finally {
    session.pendingActions.delete(actionId);
  }
});

bot.action(/^cancel:(.+)/, async (ctx) => {
  const actionId = ctx.match[1];
  const chatId = ctx.chat.id;
  getSession(chatId).pendingActions.delete(actionId);
  await ctx.answerCbQuery('Отменено');
  await ctx.editMessageText(ctx.callbackQuery.message.message_id, '❌ Действие отменено');
});

// --- EXPRESS API ---
const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const checkApiKey = (req, res, next) => {
  const key = req.headers['x-api-key'] || req.query.key;
  if (key !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
};

app.get('/api/status', (req, res) => {
  res.json({
    running: agentState.running,
    launching: isLaunching,
    stopping: isStopping,
    uptime: agentState.running && agentState.startTime ? Date.now() - agentState.startTime : 0,
    stats: { ...agentState.stats },
    config: { ...agentState.config },
  });
});

app.get('/api/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  res.json(agentState.logs.slice(-limit).reverse());
});

app.post('/api/config', checkApiKey, async (req, res) => {
  try {
    const { systemPrompt, modelName, maxFileChars, maxHistoryPairs, maxSearchResults, projectPath, serverUrl } =
      req.body;
    if (systemPrompt !== undefined) agentState.config.systemPrompt = systemPrompt;
    if (modelName) agentState.config.modelName = modelName;
    if (maxFileChars) agentState.config.maxFileChars = parseInt(maxFileChars);
    if (maxHistoryPairs) agentState.config.maxHistoryPairs = parseInt(maxHistoryPairs);
    if (maxSearchResults) agentState.config.maxSearchResults = parseInt(maxSearchResults);
    if (projectPath) agentState.config.projectPath = projectPath;
    if (serverUrl) agentState.config.serverUrl = serverUrl;
    addLog('info', '🔧 Конфигурация обновлена через API');
    res.json({ success: true, config: { ...agentState.config } });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/start', checkApiKey, async (req, res) => {
  if (isLaunching) return res.json({ launching: true, message: 'Запуск уже выполняется...' });
  if (agentState.running) return res.json({ running: true, message: 'Уже запущен' });
  if (isStopping) return res.status(409).json({ error: 'Подождите завершения остановки' });

  try {
    isLaunching = true;
    addLog('system', '🚀 Запуск через API...');

    // 🔥 ИСПОЛЬЗУЕМ startPolling ВМЕСТО launch()
    startBot()
      .then((success) => {
        if (success) {
          agentState.running = true;
          agentState.startTime = Date.now();
          addLog('success', '✓ Агент запущен (polling)');
        }

        isLaunching = false;
      })
      .catch((err) => {
        isLaunching = false;
        agentState.running = false;
        addLog('error', `❌ Ошибка: ${err.message}`);
      });

    res.json({ success: true, launching: true, message: 'Запуск инициирован' });
  } catch (e) {
    isLaunching = false;
    addLog('error', `❌ Ошибка: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/stop', checkApiKey, async (req, res) => {
  if (isStopping) return res.json({ stopping: true, message: 'Остановка уже выполняется...' });
  if (!agentState.running) return res.json({ running: false, message: 'Уже остановлен' });
  if (isLaunching) return res.status(409).json({ error: 'Подождите завершения запуска' });

  try {
    isStopping = true;
    addLog('warning', '⏹️ Остановка через API...');
    await bot.stop('api-stop');
    agentState.running = false;
    agentState.startTime = null;
    isStopping = false;
    addLog('system', 'Агент остановлен');
    res.json({ success: true, running: false });
  } catch (e) {
    isStopping = false;
    addLog('error', `❌ Ошибка остановки: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/restart', checkApiKey, async (req, res) => {
  if (isLaunching || isStopping) return res.status(409).json({ error: 'Дождитесь завершения текущей операции' });

  try {
    addLog('info', '🔄 Перезапуск через API...');

    if (agentState.running) {
      isStopping = true;
      await bot.stop('api-restart');
      await new Promise((r) => setTimeout(r, 1000));
      isStopping = false;
      agentState.running = false;
    }

    isLaunching = true;
    startBot()
      .then((success) => {
        if (success) {
          agentState.running = true;
          agentState.startTime = Date.now();
          addLog('success', '✓ Агент перезапущен');
        }

        isLaunching = false;
      })
      .catch((err) => {
        isLaunching = false;
        addLog('error', `❌ Ошибка перезапуска: ${err.message}`);
      });
    res.json({ success: true, launching: true, message: 'Перезапуск инициирован' });
  } catch (e) {
    isLaunching = false;
    isStopping = false;
    addLog('error', `❌ Ошибка: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/chat', checkApiKey, async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  try {
    const history = agentState.config._testHistory || [];
    const messages = [
      { role: 'system', content: buildSystemPrompt() },
      ...history.slice(-10),
      { role: 'user', content: message },
    ];
    const resp = await ai.chat.completions.create({
      model: agentState.config.modelName,
      messages,
      temperature: 0.1,
      max_tokens: 512,
    });
    const reply = resp.choices[0].message.content;
    history.push({ role: 'user', content: message }, { role: 'assistant', content: reply });
    agentState.config._testHistory = history;
    agentState.stats.requests++;
    res.json({ reply, stats: { ...agentState.stats } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'новый.html'));
});

// --- ЗАПУСК ---
(async () => {
  await fs.access(PROJECT_PATH).catch(() => {
    console.error('❌ Папка не найдена');
    process.exit(1);
  });

  if (!TELEGRAM_TOKEN || TELEGRAM_TOKEN === 'ВАШ_ТОКЕН') {
    console.error('❌ Нет токена');
    process.exit(1);
  }

  agentState.config.systemPrompt = buildSystemPrompt();

  app.listen(API_PORT, '127.0.0.1', () => {
    console.log(`🌐 Веб-панель: http://127.0.0.1:${API_PORT}`);
    console.log(`🔑 API-ключ: ${API_KEY}`);
    addLog('system', `API-сервер запущен на порту ${API_PORT}`);
  });

  try {
    console.log('🔥 Прогрев модели...');
    await ai.chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 10,
    });
    console.log('✓ Модель готова');
  } catch (e) {
    console.warn('⚠️ Прогрев:', e.message);
  }

  if (process.env.AUTO_START === 'true') {
    try {
      await startBot();
      agentState.running = true;
      agentState.startTime = Date.now();
      console.log('✓ Агент запущен (AUTO_START)');
      addLog('success', '✓ Агент запущен автоматически');
    } catch (e) {
      console.error('❌ Автозапуск:', e.message);
    }
  } else {
    console.log('⏳ Агент остановлен. Запустите через веб-панель.');
  }
})();

process.once('SIGINT', async () => {
  addLog('system', '🛑 Получен SIGINT');
  if (agentState.running) await bot.stop('SIGINT');
  process.exit(0);
});
process.once('SIGTERM', async () => {
  addLog('system', '🛑 Получен SIGTERM');
  if (agentState.running) await bot.stop('SIGTERM');
  process.exit(0);
});

// // network-test.js
// import https from 'https';

// console.log('🔍 Проверка соединения с Telegram API...');

// const req = https.request(
//   'https://api.telegram.org/bot8615851636:AAE68i91BTch0naWJX9wl4ydL7GWVcsbkUM/getMe',
//   {
//     method: 'GET',
//     timeout: 10000,
//   },
//   (res) => {
//     let data = '';
//     res.on('data', (chunk) => (data += chunk));
//     res.on('end', () => {
//       console.log('✅ Ответ получен:', data.slice(0, 200));
//     });
//   }
// );

// req.on('error', (e) => {
//   console.error('❌ Ошибка соединения:', e.message);
//   console.error('   Код:', e.code); // ECONNREFUSED, ETIMEDOUT, ENOTFOUND, etc.
// });

// req.on('timeout', () => {
//   console.error('⏱ Таймаут соединения');
//   req.destroy();
// });

// req.end();

// // Фолбэк таймаут
// setTimeout(() => {
//   console.log('🔚 Скрипт завершён');
//   process.exit(0);
// }, 15000);
