/**
 * Обёртка над whisper-cpp-node для ESM.
 * Использует createRequire для импорта CJS модуля.
 * @module lib/whisper
 */

import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const require = createRequire(import.meta.url);

/** @type {ReturnType<typeof createRequire>|null} */
let whisperAddon = null;

/**
 * Лениво загружает whisper-cpp-node addon.
 * @returns {object} whisper addon (createWhisperContext, transcribeAsync, etc.)
 */
function getAddon() {
  if (!whisperAddon) {
    whisperAddon = require("whisper-cpp-node");
  }
  return whisperAddon;
}

/** Кэш контекста Whisper для повторных вызовов */
let cachedContext = null;
let cachedModelPath = null;

/**
 * Получить или создать WhisperContext с кэшированием.
 * Автоматически скачивает модель, если она не найдена.
 * @param {string} modelPath - Путь к ggml модели (или имя файла)
 * @returns {import("whisper-cpp-node").WhisperContext}
 */
export function getWhisperContext(modelPath) {
  if (cachedContext && cachedModelPath === modelPath) {
    return cachedContext;
  }

  // Освобождаем старый контекст при смене модели (предотвращает утечку VRAM)
  if (cachedContext && cachedModelPath !== modelPath) {
    try { cachedContext.free(); } catch {}
    cachedContext = null;
    cachedModelPath = null;
  }

  const addon = getAddon();
  const resolvedPath = resolveModelPath(modelPath);

  cachedContext = addon.createWhisperContext({
    model: resolvedPath,
    use_gpu: true,
    no_prints: true,
  });
  cachedModelPath = modelPath;

  return cachedContext;
}

/**
 * Освободить кэшированный контекст.
 */
export function freeWhisperContext() {
  if (cachedContext) {
    cachedContext.free();
    cachedContext = null;
    cachedModelPath = null;
  }
}

/**
 * Распознать речь из WAV файла (16kHz mono).
 * @param {string} wavPath - Путь к WAV файлу
 * @param {string} [modelPath="large-v3-turbo"] - Имя модели или путь
 * @param {string} [language="ru"] - Код языка
 * @returns {Promise<string>} Распознанный текст
 */
export async function transcribeFile(wavPath, modelPath = "large-v3-turbo", language = "ru") {
  const addon = getAddon();
  const ctx = getWhisperContext(modelPath);

  const result = await addon.transcribeAsync(ctx, {
    fname_inp: wavPath,
    language,
    n_threads: Math.min(os.cpus().length, 8),
    no_timestamps: true,
    no_context: true,
    suppress_blank: true,
    suppress_nst: true,
  });

  return result.segments.map((s) => s.text).join("").trim();
}

/**
 * Распознать речь из PCM буфера (Float32Array, 16kHz mono).
 * @param {Float32Array} pcmData - PCM данные
 * @param {string} [modelPath="large-v3-turbo"] - Имя модели или путь
 * @param {string} [language="ru"] - Код языка
 * @returns {Promise<string>} Распознанный текст
 */
export async function transcribeBuffer(pcmData, modelPath = "large-v3-turbo", language = "ru") {
  const addon = getAddon();
  const ctx = getWhisperContext(modelPath);

  const result = await addon.transcribeAsync(ctx, {
    pcmf32: pcmData,
    language,
    n_threads: Math.min(os.cpus().length, 8),
    no_timestamps: true,
    no_context: true,
    suppress_blank: true,
    suppress_nst: true,
  });

  return result.segments.map((s) => s.text).join("").trim();
}

/**
 * Получить список доступных GPU устройств.
 * @returns {import("whisper-cpp-node").GpuDevice[]}
 */
export function getGpuDevices() {
  return getAddon().getGpuDevices();
}

/**
 * Разрешить путь к модели.
 * Если передано только имя (например "large-v3-turbo"),
 * ищет в стандартных путях whisper.cpp.
 * @param {string} modelOrPath
 * @returns {string} Абсолютный путь к модели
 */
function resolveModelPath(modelOrPath) {
  if (fs.existsSync(modelOrPath)) return modelOrPath;

  const baseName = modelOrPath.includes(".") ? modelOrPath : `ggml-${modelOrPath}.bin`;

  const candidates = [
    path.join(process.cwd(), "models", baseName),
    path.join(process.cwd(), "aiagent-be", "models", baseName),
    path.join(os.homedir(), ".cache", "whisper", baseName),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  throw new Error(
    `Whisper model not found: ${modelOrPath}. Searched: ${candidates.join(", ")}. ` +
    `Download with: npx whisper-cpp-node download ${modelOrPath}`
  );
}

// Освобождаем GPU/VRAM ресурсы при завершении процесса
const shutdownHandler = () => {
  if (cachedContext) {
    try { cachedContext.free(); } catch {}
    cachedContext = null;
    cachedModelPath = null;
  }
};
process.once("beforeExit", shutdownHandler);
process.once("SIGTERM", shutdownHandler);
process.once("SIGINT", shutdownHandler);
