/**
 * Async task helpers: wait, cancel, and list active execute tasks.
 * @module tasks
 */
import { activeProcesses } from "./execute.js";

/**
 * Дождаться завершения фоновой задачи (execute).
 * @param {string} taskId - ID задачи из executeTool
 * @returns {Promise<{success: boolean, data: {stdout: string, stderr: string, exitCode: number}, error?: string}>}
 */
export async function waitForTask(taskId) {
  const entry = activeProcesses.get(taskId);
  if (!entry) throw new Error(`Task ${taskId} not found or expired`);

  let result;
  if (entry.status === "running") {
    try {
      result = await entry.promise;
    } catch (err) {
      result = {
        stdout: entry.stdout.trim(),
        stderr: entry.stderr.trim(),
        exitCode: entry.exitCode || 1,
        error: err.message || "Task execution failed",
      };
    }
  } else {
    result = {
      stdout: entry.stdout.trim(),
      stderr: entry.stderr.trim(),
      exitCode: entry.exitCode,
      error: entry.error,
    };
  }

  return {
    success: result.exitCode === 0,
    data: {
      stdout: result.stdout || "",
      stderr: result.stderr || "",
      exitCode: result.exitCode,
    },
    error: result.exitCode !== 0 ? (result.error || `Command exited with code ${result.exitCode}`) : undefined,
  };
}

/**
 * Отменить запущенную задачу.
 * @param {string} taskId - ID задачи
 * @returns {boolean} true если задача была отменена
 */
export function cancelTask(taskId) {
  const entry = activeProcesses.get(taskId);
  if (!entry || entry.status !== "running") return false;
  if (process.platform === "win32") {
    entry.child.kill();
  } else {
    entry.child.kill("SIGTERM");
  }
  entry.status = "cancelled";
  entry.completedAt = Date.now();
  return true;
}

/**
 * Получить список активных задач.
 * @returns {Array<{taskId: string, pid: number, command: string, startTime: number, uptime: number}>}
 */
export function getActiveTasks() {
  const tasks = [];
  for (const [, entry] of activeProcesses) {
    if (entry.status === "running") {
      tasks.push({
        taskId: entry.taskId,
        pid: entry.pid,
        command: entry.command.substring(0, 100),
        startTime: entry.startTime,
        uptime: Date.now() - entry.startTime,
      });
    }
  }
  return tasks;
}
