/**
 * Path helpers endpoints: validate-path, directories, browse-folder.
 * @module routes/paths
 */
import { Router } from "express";
import fs from "fs";
import path from "path";

/**
 * @param {Object} deps
 * @param {Object} deps.config
 * @returns {Router}
 */
export function createPathsRouter(deps) {
  const router = Router();
  const { config } = deps;

  /**
   * GET /api/validate-path?path=... — verify directory exists, optionally within projectPath.
   */
  router.get("/validate-path", async (req, res) => {
    const checkPath = req.query.path;
    if (!checkPath) return res.status(400).json({ valid: false, error: "Path parameter required" });
    try {
      const projectRoot = config.projectPath;
      if (projectRoot) {
        const resolved = path.resolve(checkPath);
        const normalizedResolved = resolved.replace(/\\/g, "/").toLowerCase();
        const normalizedRoot = path.resolve(projectRoot).replace(/\\/g, "/").toLowerCase();
        const rootPrefix =
          normalizedRoot === "/" ? "/" : normalizedRoot.endsWith("/") ? normalizedRoot : normalizedRoot + "/";
        if (normalizedResolved !== normalizedRoot && !normalizedResolved.startsWith(rootPrefix)) {
          return res.status(403).json({ valid: false, error: "Path outside project directory" });
        }
      }
      const stat = await fs.promises.stat(path.resolve(checkPath));
      res.json({ valid: stat.isDirectory() });
    } catch {
      res.json({ valid: false });
    }
  });

  /**
   * GET /api/directories?path=... — list subdirectories.
   */
  router.get("/directories", async (req, res) => {
    const targetPath = req.query.path || "";
    try {
      let resolved = targetPath;
      if (!resolved) {
        resolved = process.env.HOME || process.env.USERPROFILE || (process.platform === "win32" ? "C:\\" : "/");
      }
      const stat = await fs.promises.stat(resolved);
      if (!stat.isDirectory()) {
        return res.json({ path: resolved, directories: [] });
      }
      const entries = await fs.promises.readdir(resolved, { withFileTypes: true });
      const directories = entries
        .filter((e) => e.isDirectory() && !e.name.startsWith("."))
        .map((e) => ({ name: e.name, path: path.join(resolved, e.name) }))
        .sort((a, b) => a.name.localeCompare(b.name));
      res.json({ path: resolved, directories });
    } catch {
      res.json({ path: targetPath, directories: [] });
    }
  });

  /**
   * GET /api/browse-folder — open native OS folder picker.
   */
  router.get("/browse-folder", async (_req, res) => {
    const { execFile } = await import("child_process");
    const { promisify } = await import("util");
    const execFileAsync = promisify(execFile);

    try {
      let selectedPath = null;
      if (process.platform === "win32") {
        const ps = [
          "Add-Type -AssemblyName System.Windows.Forms;",
          "$f = New-Object System.Windows.Forms.FolderBrowserDialog;",
          "$f.Description = 'Select project directory';",
          "$f.ShowNewFolderButton = $true;",
          "if ($f.ShowDialog() -eq 'OK') { $f.SelectedPath }",
        ].join(" ");
        const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-Command", ps], { timeout: 120000 });
        selectedPath = stdout.trim();
      } else if (process.platform === "darwin") {
        const script = 'tell application "Finder" to set p to POSIX path of (choose folder)\nreturn p';
        const { stdout } = await execFileAsync("osascript", ["-e", script], { timeout: 120000 });
        selectedPath = stdout.trim();
      } else {
        const { stdout } = await execFileAsync(
          "zenity",
          ["--file-selection", "--directory", "--title=Select project directory"],
          { timeout: 120000 }
        );
        selectedPath = stdout.trim();
      }

      if (selectedPath) res.json({ path: selectedPath });
      else res.json({ path: null });
    } catch (e) {
      if (e.killed || e.signal === "SIGTERM" || e.code === 1) {
        res.json({ path: null });
      } else {
        res.status(500).json({ error: "Failed to open folder picker: " + e.message });
      }
    }
  });

  return router;
}
