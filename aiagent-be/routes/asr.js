/**
 * ASR endpoints: POST /api/asr/transcribe, GET /api/asr/status.
 * @module routes/asr
 */
import { Router } from "express";
import fs from "fs";
import os from "os";
import path from "path";
import multer from "multer";
import { sanitizeLanguage, transcribeViaAsrServer as transcribeAsr, probeAsrServer } from "../lib/asrClient.js";

/**
 * @param {Object} deps
 * @param {Object} deps.config
 * @param {Function} deps.addLog
 * @returns {Router}
 */
export function createAsrRouter(deps) {
  const router = Router();
  const { config, addLog } = deps;

  const asrUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 },
  });

  /**
   * POST /api/asr/transcribe — proxy to remote ASR server.
   * Accepts multipart/form-data with field "file" (audio) and optional "language".
   */
  router.post("/asr/transcribe", asrUpload.single("file"), async (req, res) => {
    try {
      const asrUrl = config.asrServerUrl;
      if (!asrUrl) {
        return res.status(400).json({ error: "ASR server URL not configured" });
      }
      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided (field 'file' missing)" });
      }

      const language = sanitizeLanguage(req.body?.language || config.asrLanguage);
      const tmpFile = path.join(os.tmpdir(), `asr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.wav`);
      await fs.promises.writeFile(tmpFile, req.file.buffer);

      let text;
      try {
        text = await transcribeAsr({ wavPath: tmpFile, asrServerUrl: asrUrl, language });
      } finally {
        try {
          await fs.promises.unlink(tmpFile);
        } catch {}
      }

      res.json({ text });
    } catch (error) {
      addLog(`ASR transcribe error: ${error.message}`, "error");
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "Audio file too large (max 25 MB)" });
      }
      if (/^ASR server \d+/.test(error.message || "")) {
        return res.status(502).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/asr/status — probe ASR server reachability.
   */
  router.get("/asr/status", async (_req, res) => {
    const asrUrl = config.asrServerUrl;
    if (!asrUrl) {
      return res.json({ configured: false, reachable: false, url: "" });
    }
    const probe = await probeAsrServer(asrUrl, 5000);
    res.json({ configured: true, reachable: probe.reachable, url: asrUrl, status: probe.status });
  });

  return router;
}
