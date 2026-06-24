/**
 * Accounts endpoints: GET list, POST save, POST import.
 * @module routes/accounts
 */
import { Router } from "express";
import { saveAccounts, getAccounts } from "../lib/accounts.js";

/**
 * @param {Object} deps
 * @param {Object} deps.config
 * @param {Function} deps.addLog
 * @returns {Router}
 */
export function createAccountsRouter(deps) {
  const router = Router();
  const { addLog } = deps;

  /**
   * GET /api/accounts — list all registered accounts.
   */
  router.get("/accounts", (_req, res) => {
    res.json({ success: true, accounts: getAccounts() });
  });

  /**
   * POST /api/accounts — save accounts list (overwrite).
   * Body: { accounts: [...] }
   */
  router.post("/accounts", (req, res) => {
    const accounts = req.body?.accounts;
    if (!Array.isArray(accounts)) {
      return res.status(400).json({ error: "accounts array required" });
    }
    saveAccounts(process.cwd(), accounts);
    addLog(`Accounts saved: ${accounts.length}`, "info");
    res.json({ success: true, count: accounts.length, accounts: getAccounts() });
  });

  /**
   * POST /api/accounts/import — import accounts from JSON string or accounts array.
   * Body: { json: string, merge?: boolean } | { accounts: Array, merge?: boolean }
   */
  router.post("/accounts/import", (req, res) => {
    const body = req.body || {};
    let parsed;
    if (body.json) {
      try {
        parsed = JSON.parse(body.json);
      } catch (e) {
        return res.status(400).json({ error: `Invalid JSON: ${e.message}` });
      }
    } else if (Array.isArray(body.accounts)) {
      parsed = body.accounts;
    } else {
      return res.status(400).json({ error: "json string or accounts array required" });
    }
    if (!Array.isArray(parsed)) {
      return res.status(400).json({ error: "Expected array of accounts" });
    }
    const merge = body.merge;
    if (merge) {
      const existing = getAccounts();
      const byUsername = new Map(existing.map((a) => [a.username, a]));
      for (const acc of parsed) byUsername.set(acc.username, acc);
      saveAccounts(process.cwd(), Array.from(byUsername.values()));
    } else {
      saveAccounts(process.cwd(), parsed);
    }
    addLog(`Accounts imported: ${parsed.length} (merge=${!!merge})`, "info");
    res.json({ success: true, count: getAccounts().length, accounts: getAccounts() });
  });

  return router;
}
