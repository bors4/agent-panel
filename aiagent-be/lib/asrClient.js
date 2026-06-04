/**
 * Клиент для удалённого ASR сервера (whisper.cpp / faster-whisper).
 * Единая точка отправки multipart/form-data с WAV файлом и получением распознанного текста.
 * @module lib/asrClient
 */

import { URL } from "node:url";
import net from "node:net";
import fs from "node:fs";
import crypto from "node:crypto";

/**
 * Валидация URL ASR сервера. Защита от SSRF: блокирует loopback, link-local, metadata-сервисы.
 * Приватные LAN диапазоны (10.x, 172.16-31.x, 192.168.x) РАЗРЕШЕНЫ для dev-использования.
 * @param {string} raw - Сырой URL
 * @returns {string|null} Нормализованный URL (без trailing slash) или null если пустой
 * @throws {Error} Если URL невалиден или указывает на loopback/metadata сервис
 */
export function validateAsrUrl(raw) {
  if (!raw) return null;
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Invalid ASR URL");
  }
  if (!["http:", "https:"].includes(u.protocol)) {
    throw new Error("ASR URL must use http or https");
  }
  if (u.username || u.password) {
    throw new Error("ASR URL must not contain credentials");
  }
  // Для IPv6 URL hostname возвращается со скобками "[::1]" — убираем
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) {
    if (net.isIPv4(host)) {
      // Блокируем только loopback (127/8), any (0/8), link-local / metadata (169.254/16)
      if (/^(127\.|0\.|169\.254\.)/.test(host)) {
        throw new Error("ASR URL points to loopback or metadata service");
      }
    } else if (net.isIPv6(host)) {
      if (host === "::1" || host.startsWith("fe80:") || host === "::") {
        throw new Error("ASR URL points to loopback or link-local IPv6");
      }
    }
  } else {
    const lower = host.toLowerCase();
    if (
      lower === "localhost" ||
      lower.endsWith(".local") ||
      lower.endsWith(".internal") ||
      lower.endsWith(".localhost")
    ) {
      throw new Error("ASR URL points to a local hostname");
    }
  }
  return u.toString().replace(/\/$/, "");
}

/**
 * Валидация кода языка (ISO 639-1 или 639-3 + опционально регион).
 * @param {string} lang
 * @returns {string} Безопасное значение (по умолчанию "ru")
 */
export function sanitizeLanguage(lang) {
  if (typeof lang !== "string") return "ru";
  const trimmed = lang.trim();
  if (!/^[a-z]{2,3}(-[A-Z]{2})?$/.test(trimmed)) return "ru";
  return trimmed;
}

/**
 * Построить multipart/form-data body из файла + полей (без shell injection).
 * @param {Buffer} fileBuffer
 * @param {string} fileName
 * @param {string} fileType
 * @param {Object} fields - {language, response_format, temperature}
 * @returns {{body: Buffer, boundary: string}}
 */
export function buildMultipartBody(fileBuffer, fileName, fileType, fields) {
  const boundary = `----FormBoundary${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const parts = [];
  const safeName = String(fileName || "audio.wav").replace(/[\r\n"]/g, "_");
  const safeType = String(fileType || "audio/wav").replace(/[\r\n;]/g, "");
  parts.push(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${safeName}"\r\n` +
      `Content-Type: ${safeType}\r\n\r\n`
  );
  parts.push(fileBuffer);
  parts.push("\r\n");
  for (const [key, value] of Object.entries(fields)) {
    if (value == null) continue;
    const safeKey = String(key).replace(/[\r\n"]/g, "_");
    const safeVal = String(value).replace(/[\r\n]/g, "");
    parts.push(`--${boundary}\r\n` + `Content-Disposition: form-data; name="${safeKey}"\r\n\r\n` + `${safeVal}\r\n`);
  }
  parts.push(`--${boundary}--\r\n`);
  const body = Buffer.concat(parts.map((p) => (typeof p === "string" ? Buffer.from(p) : p)));
  return { body, boundary };
}

/**
 * Распознать речь из WAV файла через удалённый ASR сервер.
 * @param {Object} params
 * @param {string} params.wavPath - Путь к WAV файлу (16kHz mono)
 * @param {string} params.asrServerUrl - URL ASR сервера (уже валидированный)
 * @param {string} [params.language="ru"] - Код языка
 * @param {number} [params.timeoutMs] - Таймаут запроса (по умолчанию ASR_TIMEOUT env или 120000)
 * @param {AbortSignal} [params.signal] - Внешний signal для отмены
 * @returns {Promise<string>} Распознанный текст
 */
export async function transcribeViaAsrServer({ wavPath, asrServerUrl, language = "ru", timeoutMs, signal }) {
  if (!asrServerUrl) throw new Error("ASR server URL not configured");
  const safeLang = sanitizeLanguage(language);

  const fileBuffer = fs.readFileSync(wavPath);
  const { body, boundary } = buildMultipartBody(fileBuffer, "audio.wav", "audio/wav", {
    language: safeLang,
    response_format: "json",
    temperature: "0.0",
  });

  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", onExternalAbort, { once: true });
  }
  const timeout = timeoutMs ?? (parseInt(process.env.ASR_TIMEOUT) || 120000);
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  let response;
  try {
    response = await fetch(`${asrServerUrl}/inference`, {
      method: "POST",
      headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
    if (signal) signal.removeEventListener("abort", onExternalAbort);
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    const safeErr = String(errText).slice(0, 200);
    throw new Error(`ASR server ${response.status}: ${safeErr}`);
  }

  const result = await response.json().catch(() => ({}));
  return (result.text || "").trim();
}

/**
 * Проверить доступность ASR сервера (probe через GET /).
 * @param {string} asrServerUrl
 * @param {number} [timeoutMs=5000]
 * @returns {Promise<{reachable: boolean, status?: number}>}
 */
export async function probeAsrServer(asrServerUrl, timeoutMs = 5000) {
  if (!asrServerUrl) return { reachable: false };
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(`${asrServerUrl}/`, { method: "GET", signal: controller.signal });
    return { reachable: resp.ok, status: resp.status };
  } catch {
    return { reachable: false };
  } finally {
    clearTimeout(timeoutId);
  }
}
