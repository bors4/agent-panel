/**
 * Тесты для composable useAccounts.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useAccounts, ALL_TOOL_NAMES, ROLE_DEFAULTS } from "@/composables/useAccounts";
import * as client from "@/api/client";

vi.mock("@/composables/useToast", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

describe("useAccounts", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("exposes initial empty state", () => {
    const a = useAccounts();
    expect(a.accounts.value).toEqual([]);
    expect(a.accountSearch.value).toBe("");
    expect(a.filteredAccounts.value).toEqual([]);
  });

  it("ALL_TOOL_NAMES contains the canonical tool list", () => {
    expect(ALL_TOOL_NAMES).toContain("read");
    expect(ALL_TOOL_NAMES).toContain("execute");
    expect(ALL_TOOL_NAMES).toHaveLength(9);
  });

  it("ROLE_DEFAULTS gives system all permissions, guest only read", () => {
    expect(ROLE_DEFAULTS.system.execute).toBe(true);
    expect(ROLE_DEFAULTS.user.execute).toBeUndefined();
    expect(ROLE_DEFAULTS.guest).toEqual({ read: true });
  });

  it("fetchAccounts populates accounts on success", async () => {
    vi.spyOn(client, "getAccounts").mockResolvedValue({
      success: true,
      accounts: [{ username: "alice", role: "user" }],
    });
    const a = useAccounts();
    await a.fetchAccounts();
    expect(a.accounts.value).toHaveLength(1);
    expect(a.accounts.value[0].username).toBe("alice");
  });

  it("addAccount pushes a guest account with empty paths", () => {
    const a = useAccounts();
    a.addAccount();
    expect(a.accounts.value).toHaveLength(1);
    expect(a.accounts.value[0].role).toBe("guest");
    expect(a.accounts.value[0].include_paths).toEqual([]);
  });

  it("removeAccount splices the account on confirm", () => {
    const a = useAccounts();
    a.accounts.value = [{ username: "a" }, { username: "b" }];
    a.removeAccount(0);
    expect(a.accounts.value.map((x) => x.username)).toEqual(["b"]);
  });

  it("removeAccount is a no-op on cancel", () => {
    window.confirm.mockReturnValue(false);
    const a = useAccounts();
    a.accounts.value = [{ username: "a" }];
    a.removeAccount(0);
    expect(a.accounts.value).toHaveLength(1);
  });

  it("onRoleChange resets permissions to role defaults", () => {
    const a = useAccounts();
    a.accounts.value = [{ username: "x", role: "guest", permissions: { read: true } }];
    a.onRoleChange(0, "system");
    expect(a.accounts.value[0].role).toBe("system");
    expect(a.accounts.value[0].permissions.execute).toBe(true);
  });

  it("toggleAccountTool sets the flag and creates the permissions object if missing", () => {
    const a = useAccounts();
    a.accounts.value = [{ username: "x" }];
    a.toggleAccountTool(0, "read", true);
    expect(a.accounts.value[0].permissions.read).toBe(true);
  });

  it("addPath / removePath mutate include_paths", () => {
    const a = useAccounts();
    a.accounts.value = [{ username: "x", include_paths: [] }];
    a.addPath(0);
    a.accounts.value[0].include_paths[0] = "C:\\";
    expect(a.accounts.value[0].include_paths).toEqual(["C:\\"]);
    a.removePath(0, 0);
    expect(a.accounts.value[0].include_paths).toEqual([]);
  });

  it("filteredAccounts matches by username case-insensitively, stripping leading @", () => {
    const a = useAccounts();
    a.accounts.value = [{ username: "@Alice" }, { username: "bob" }];
    a.accountSearch.value = "ALI";
    expect(a.filteredAccounts.value.map((x) => x.username)).toEqual(["@Alice"]);
    a.accountSearch.value = "Bo";
    expect(a.filteredAccounts.value.map((x) => x.username)).toEqual(["bob"]);
    a.accountSearch.value = "";
    expect(a.filteredAccounts.value).toHaveLength(2);
  });

  it("getAccountIndex returns the index of a known account", () => {
    const a = useAccounts();
    const acct = { username: "x" };
    a.accounts.value = [acct];
    expect(a.getAccountIndex(acct)).toBe(0);
  });

  it("toggleAccountSettings flips the flag for an index", () => {
    const a = useAccounts();
    a.toggleAccountSettings(2);
    expect(a.accountSettingsExpanded.value[2]).toBe(true);
    a.toggleAccountSettings(2);
    expect(a.accountSettingsExpanded.value[2]).toBe(false);
  });

  it("saveAccounts sends the list and stores the server response", async () => {
    vi.spyOn(client, "postAccounts").mockResolvedValue({
      success: true,
      accounts: [{ username: "from-server" }],
    });
    const a = useAccounts();
    a.accounts.value = [{ username: "local" }];
    await a.saveAccounts();
    expect(a.accounts.value[0].username).toBe("from-server");
  });

  it("saveAccounts toasts error on API failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(client, "postAccounts").mockRejectedValue(new Error("boom"));
    const a = useAccounts();
    await a.saveAccounts();
  });

  it("handleImportFile parses JSON, posts accounts, resets file input", async () => {
    const file = new File([JSON.stringify({ accounts: [{ username: "imp" }] })], "accounts.json", {
      type: "application/json",
    });
    vi.spyOn(client, "postImportAccounts").mockResolvedValue({
      success: true,
      accounts: [{ username: "imp" }],
    });
    const a = useAccounts();
    const event = { target: { files: [file], value: "stale" } };
    await a.handleImportFile(event);
    expect(client.postImportAccounts).toHaveBeenCalledWith({ accounts: [{ username: "imp" }] });
    expect(a.accounts.value[0].username).toBe("imp");
    expect(event.target.value).toBe("");
  });

  it("handleImportFile rejects malformed JSON and surfaces a toast", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const file = new File(["not json"], "bad.json", { type: "application/json" });
    const a = useAccounts();
    const event = { target: { files: [file], value: "stale" } };
    await a.handleImportFile(event);
    expect(event.target.value).toBe("");
  });

  it("handleImportFile rejects payload where accounts is not an array", async () => {
    const file = new File([JSON.stringify({ accounts: "not-an-array" })], "bad.json", {
      type: "application/json",
    });
    const a = useAccounts();
    const event = { target: { files: [file], value: "stale" } };
    await a.handleImportFile(event);
    expect(a.accounts.value).toEqual([]);
  });
});
