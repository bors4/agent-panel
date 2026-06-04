/**
 * execute tool: run a shell command with sanitization, timeout, and tracking.
 * @module tool/execute
 */
import crypto from "crypto";
import { spawn } from "child_process";
import { configDefaults } from "../../configDefaults.js";
import { sanitizeCommand } from "./sanitize.js";

/**
 * Активные дочерние процессы (длительные команды execute).
 * @type {Map<string, {child: ChildProcess, pid: number, taskId: string, command: string, startTime: number, status: string, stdout: string, stderr: string, exitCode: number|null, error: string|null, completedAt: number|null, expired?: boolean, promise?: Promise}>}
 */
export const activeProcesses = new Map();

/**
 * Resolve shell + args for a given command, with PowerShell detection on Windows.
 * @param {string} command
 * @param {boolean} isWin
 * @returns {{shell: string, shellArgs: string[]}}
 */
function resolveShell(command, isWin) {
  const trimmedCmd = command.trimStart();
  const isPwsh = /^powershell\b/i.test(trimmedCmd) || /^pwsh\b/i.test(trimmedCmd);

  if (isWin && isPwsh) {
    const pwshCmd = trimmedCmd
      .replace(/^(powershell|pwsh)\s+/i, "")
      .replace(/^(-command|-c)\s+/i, "")
      .trim()
      .replace(/^["'](.*)["']\s*$/, "$1");
    const pwshCheck = sanitizeCommand(pwshCmd);
    if (pwshCheck.blocked) {
      throw new Error(pwshCheck.reason);
    }
    return { shell: "powershell.exe", shellArgs: ["-NoLogo", "-NoProfile", "-Command", pwshCmd] };
  }

  if (isWin) {
    return { shell: "cmd.exe", shellArgs: ["/d", "/c", command] };
  }
  return { shell: "/bin/sh", shellArgs: ["-c", command] };
}

/**
 * @param {Object} args - {command, timeout}
 * @param {string} projectPath
 * @param {Object} [config] - {executeTimeout}
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function execute(args, projectPath, config = {}) {
  const taskId = crypto.randomUUID();
  const defaultTimeout = config.executeTimeout ?? configDefaults.executeTimeout;
  const timeoutSec =
    args.timeout !== undefined
      ? args.timeout > 0
        ? Math.min(args.timeout, 3600)
        : args.timeout === 0
          ? 0
          : 1
      : defaultTimeout;

  const cmdCheck = sanitizeCommand(args.command);
  if (cmdCheck.blocked) {
    return { success: false, error: cmdCheck.reason };
  }

  const isWin = process.platform === "win32";

  let child;
  try {
    const { shell, shellArgs } = resolveShell(args.command, isWin);
    child = spawn(shell, shellArgs, {
      cwd: projectPath,
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
      windowsVerbatimArguments: isWin,
    });
  } catch (e) {
    return { success: false, error: `Failed to spawn process: ${e.message}` };
  }

  const entry = {
    child,
    pid: child.pid,
    taskId,
    command: args.command,
    startTime: Date.now(),
    status: "running",
    stdout: "",
    stderr: "",
    exitCode: null,
    error: null,
  };
  activeProcesses.set(taskId, entry);

  entry.promise = new Promise((resolve) => {
    child.stdout.on("data", (data) => {
      entry.stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      entry.stderr += data.toString();
    });

    let timer;
    if (timeoutSec > 0) {
      timer = setTimeout(() => {
        if (process.platform === "win32") {
          child.kill();
        } else {
          child.kill("SIGTERM");
        }
        entry.status = "timeout";
        entry.completedAt = Date.now();
        resolve({
          stdout: entry.stdout.trim(),
          stderr: entry.stderr.trim(),
          exitCode: null,
          error: `Command timed out after ${timeoutSec}s`,
        });
      }, timeoutSec * 1000);
    }

    child.on("error", (err) => {
      clearTimeout(timer);
      entry.status = "error";
      entry.completedAt = Date.now();
      entry.error = err.message;
      resolve({ stdout: entry.stdout.trim(), stderr: entry.stderr.trim(), exitCode: 1, error: err.message });
    });

    child.on("close", (code, signal) => {
      clearTimeout(timer);
      entry.exitCode = code ?? (signal ? 1 : 0);
      entry.status = entry.exitCode === 0 ? "completed" : "failed";
      entry.completedAt = Date.now();
      resolve({ stdout: entry.stdout.trim(), stderr: entry.stderr.trim(), exitCode: entry.exitCode });
    });
  });

  entry.promise.then(() => {
    setTimeout(() => {
      entry.expired = true;
    }, 60000);
  });

  return {
    success: true,
    data: { taskId, pid: child.pid, status: "running", command: args.command },
  };
}
