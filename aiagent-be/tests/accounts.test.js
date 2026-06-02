/**
 * Тесты для модуля управления аккаунтами.
 */

import path from "path";
import fs from "fs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  loadAccounts,
  saveAccounts,
  getAccounts,
  getAccountByUsername,
  getRoleDefaultPermissions,
  checkAccountToolPermission,
  isToolEnabledForAccount,
} from "../lib/accounts.js";

const testDir = path.resolve("/tmp/vitest-accounts-test");

beforeEach(() => {
  try {
    fs.mkdirSync(testDir, { recursive: true });
  } catch {}
  // Reset module state by writing empty accounts file
  fs.writeFileSync(path.join(testDir, "accounts.json"), JSON.stringify({ accounts: [] }), "utf-8");
  loadAccounts(testDir);
});

afterEach(() => {
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {}
});

describe("loadAccounts / saveAccounts", () => {
  it("saves and loads accounts from accounts.json", () => {
    const accounts = [{ username: "@testuser", role: "user", permissions: { read: true } }];
    saveAccounts(testDir, accounts);
    loadAccounts(testDir);
    const loaded = getAccounts();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].username).toBe("@testuser");
  });

  it("does nothing when projectPath is empty", () => {
    const before = getAccounts().length;
    saveAccounts("", [{ username: "@x" }]);
    // Should not crash and accounts should remain unchanged
    expect(getAccounts().length).toBe(before);
  });

  it("handles missing accounts.json gracefully", () => {
    const emptyDir = path.join(testDir, "empty");
    fs.mkdirSync(emptyDir, { recursive: true });
    // Should not crash when loading from dir without accounts.json
    expect(() => loadAccounts(emptyDir)).not.toThrow();
  });
});

describe("getAccountByUsername", () => {
  beforeEach(() => {
    saveAccounts(testDir, [
      { username: "@alice", role: "system", permissions: {} },
      { username: "bob", role: "user", permissions: {} },
    ]);
  });

  it("finds account with @ prefix", () => {
    const account = getAccountByUsername("@alice");
    expect(account).not.toBeNull();
    expect(account.role).toBe("system");
  });

  it("finds account without @ prefix", () => {
    const account = getAccountByUsername("alice");
    expect(account).not.toBeNull();
  });

  it("returns null for unknown username", () => {
    expect(getAccountByUsername("@unknown")).toBeNull();
  });

  it("returns null for empty username", () => {
    expect(getAccountByUsername("")).toBeNull();
    expect(getAccountByUsername(null)).toBeNull();
  });
});

describe("getRoleDefaultPermissions", () => {
  it("system role has all tools", () => {
    const perms = getRoleDefaultPermissions("system");
    expect(perms.read).toBe(true);
    expect(perms.execute).toBe(true);
    expect(perms.delete).toBe(true);
  });

  it("user role has limited tools", () => {
    const perms = getRoleDefaultPermissions("user");
    expect(perms.read).toBe(true);
    expect(perms.write).toBe(true);
    expect(perms.execute).toBeUndefined();
  });

  it("guest role has only read", () => {
    const perms = getRoleDefaultPermissions("guest");
    expect(perms.read).toBe(true);
    expect(perms.write).toBeUndefined();
  });

  it("unknown role defaults to guest", () => {
    const perms = getRoleDefaultPermissions("unknown");
    expect(perms.read).toBe(true);
    expect(perms.write).toBeUndefined();
  });
});

describe("checkAccountToolPermission", () => {
  it("allows when no account", () => {
    const result = checkAccountToolPermission(null, "read", {}, testDir);
    expect(result.allowed).toBe(true);
  });

  it("denies when tool explicitly false in permissions", () => {
    const account = { permissions: { read: false } };
    const result = checkAccountToolPermission(account, "read", {}, testDir);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("not available");
  });

  it("allows when tool not in permissions", () => {
    const account = { permissions: { write: true } };
    const result = checkAccountToolPermission(account, "read", {}, testDir);
    expect(result.allowed).toBe(true);
  });

  it("checks include_paths for file tools", () => {
    const account = {
      permissions: { read: true },
      include_paths: [path.join(testDir, "allowed")],
    };
    fs.mkdirSync(path.join(testDir, "allowed"), { recursive: true });

    const result = checkAccountToolPermission(account, "read", { filePath: "allowed/file.txt" }, testDir);
    expect(result.allowed).toBe(true);
  });

  it("denies path outside include_paths", () => {
    const account = {
      permissions: { read: true },
      include_paths: [path.join(testDir, "allowed")],
    };

    const result = checkAccountToolPermission(account, "read", { filePath: "../forbidden/file.txt" }, testDir);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("not in allowed");
  });

  it("denies traversal with multiple ../ segments", () => {
    const account = {
      permissions: { read: true },
      include_paths: [path.join(testDir, "allowed")],
    };

    const result = checkAccountToolPermission(account, "read", { filePath: "../../etc/passwd" }, testDir);
    expect(result.allowed).toBe(false);
  });

  it("denies path that starts with include_paths prefix but is outside", () => {
    const account = {
      permissions: { read: true },
      include_paths: [path.join(testDir, "all")],
    };

    const result = checkAccountToolPermission(account, "read", { filePath: "allowed/file.txt" }, testDir);
    expect(result.allowed).toBe(false);
  });

  it("allows path with trailing separator containment", () => {
    const account = {
      permissions: { read: true },
      include_paths: [testDir],
    };

    const result = checkAccountToolPermission(account, "read", { filePath: "subdir/file.txt" }, testDir);
    expect(result.allowed).toBe(true);
  });

  it("skips include_paths check for execute tool", () => {
    const account = {
      permissions: { execute: true },
      include_paths: [path.join(testDir, "allowed")],
    };

    const result = checkAccountToolPermission(account, "execute", { command: "echo hello" }, testDir);
    expect(result.allowed).toBe(true);
  });
});

describe("isToolEnabledForAccount", () => {
  it("returns true when both global and account allow", () => {
    const account = { permissions: { read: true } };
    const globalConfig = { read: { enabled: true } };
    expect(isToolEnabledForAccount(account, "read", globalConfig)).toBe(true);
  });

  it("returns false when globally disabled", () => {
    const account = { permissions: { read: true } };
    const globalConfig = { read: { enabled: false } };
    expect(isToolEnabledForAccount(account, "read", globalConfig)).toBe(false);
  });

  it("returns false when account denies", () => {
    const account = { permissions: { read: false } };
    const globalConfig = { read: { enabled: true } };
    expect(isToolEnabledForAccount(account, "read", globalConfig)).toBe(false);
  });

  it("returns true when no account (global only)", () => {
    const globalConfig = { read: { enabled: true } };
    expect(isToolEnabledForAccount(null, "read", globalConfig)).toBe(true);
  });

  it("returns true when no config entry", () => {
    const account = { permissions: { read: true } };
    expect(isToolEnabledForAccount(account, "read", {})).toBe(true);
  });
});
