import { Router } from "express";
import { webfetch } from "../lib/agent/tools/webfetch.js";

export function createFetchRouter() {
  const router = Router();

  router.post("/fetch", async (req, res) => {
    try {
      const { url, format, timeout } = req.body;
      if (!url) return res.status(400).json({ error: "URL is required" });

      const result = await webfetch({ url, format, timeout });
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({
        success: true,
        url: result.data.url,
        contentType: result.data.contentType,
        format: result.data.format,
        content: result.data.content,
        size: result.data.size,
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}
