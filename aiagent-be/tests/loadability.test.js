/**
 * Smoke tests for module loadability.
 *
 * Catches ESM import errors that slip past the unit-test suite (which mocks
 * `initBot`/`createApiRouter` and therefore never actually loads the bot
 * module graph). If any telegram/* file has a wrong import path, this test
 * surfaces the SyntaxError at boot-time.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("../lib/telegram/bot.js", () => ({
  initBot: vi.fn(() => null),
}));

vi.mock("../routes/api.js", () => ({
  createApiRouter: vi.fn(() => (req, res, next) => next()),
}));

describe("module loadability", () => {
  it("loads server.js without ESM import errors", async () => {
    await expect(import("../server.js")).resolves.toBeDefined();
  });

  it("loads lib/telegram/bot.js without ESM import errors", async () => {
    const { initBot } = await import("../lib/telegram/bot.js");
    expect(typeof initBot).toBe("function");
  });

  it("loads lib/telegram/commands.js without ESM import errors", async () => {
    const { registerCommands } = await import("../lib/telegram/commands.js");
    expect(typeof registerCommands).toBe("function");
  });

  it("loads lib/telegram/approval.js without ESM import errors", async () => {
    const { continueAfterApproval } = await import("../lib/telegram/approval.js");
    expect(typeof continueAfterApproval).toBe("function");
  });
});
