/**
 * Express middleware: require X-API-Key header.
 * The /health endpoint is excluded from auth.
 * @module routes/middleware
 */
export function createAuthMiddleware(config, addLog) {
  return (req, res, next) => {
    if (req.path === "/health") return next();
    if (!config.apiKey) {
      addLog("API key not configured — auth disabled", "warning");
      return next();
    }
    const apiKey = req.headers["x-api-key"];
    if (!apiKey || apiKey !== config.apiKey) {
      addLog(`API auth failed: ${req.method} ${req.path} from ${req.ip}`, "warning");
      return res.status(401).json({ error: "Unauthorized: invalid or missing API key" });
    }
    next();
  };
}
