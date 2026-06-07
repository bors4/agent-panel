/**
 * Composable для управления аккаунтами Telegram (CRUD, поиск, импорт).
 * Дефолтные права по ролям (ROLE_DEFAULTS) применяются при создании и смене роли.
 * @module composables/useAccounts
 */

import { ref, computed } from "vue";
import { getAccounts, postAccounts, postImportAccounts } from "@/api/client";
import { useToast } from "@/composables/useToast";

const ROLE_DEFAULTS = {
  system: {
    read: true,
    write: true,
    search: true,
    list_dir: true,
    execute: true,
    create_dir: true,
    delete: true,
    move: true,
    copy: true,
  },
  user: { read: true, write: true, list_dir: true, search: true, create_dir: true },
  guest: { read: true },
};

const ALL_TOOL_NAMES = ["read", "write", "search", "list_dir", "execute", "create_dir", "delete", "move", "copy"];

export { ROLE_DEFAULTS, ALL_TOOL_NAMES };

export function useAccounts() {
  const { success: toastSuccess, error: toastError } = useToast();

  const accounts = ref([]);
  const accountSearch = ref("");
  const accountSettingsExpanded = ref({});
  const importFileInput = ref(null);

  const filteredAccounts = computed(() => {
    if (!accountSearch.value) return accounts.value;
    const q = accountSearch.value.toLowerCase().replace(/^@/, "");
    return accounts.value.filter((a) => a.username.toLowerCase().replace(/^@/, "").includes(q));
  });

  function getAccountIndex(acct) {
    return accounts.value.indexOf(acct);
  }

  function toggleAccountSettings(idx) {
    accountSettingsExpanded.value[idx] = !accountSettingsExpanded.value[idx];
  }

  async function fetchAccounts() {
    try {
      const data = await getAccounts();
      if (data?.success && Array.isArray(data.accounts)) {
        accounts.value = data.accounts;
      }
    } catch (error) {
      console.error("Failed to fetch accounts:", error);
    }
  }

  function addAccount() {
    accounts.value.push({
      username: "",
      role: "guest",
      permissions: { ...ROLE_DEFAULTS.guest },
      include_paths: [],
    });
  }

  function removeAccount(idx) {
    if (confirm("Удалить этот аккаунт?")) {
      accounts.value.splice(idx, 1);
    }
  }

  function onRoleChange(idx, role) {
    const account = accounts.value?.[idx];
    if (!account) return;
    account.role = role;
    account.permissions = { ...ROLE_DEFAULTS[role] };
  }

  function toggleAccountTool(idx, toolName, checked) {
    const account = accounts.value?.[idx];
    if (!account) return;
    if (!account.permissions) {
      account.permissions = {};
    }
    account.permissions[toolName] = checked;
  }

  function addPath(idx) {
    const account = accounts.value?.[idx];
    if (!account || !Array.isArray(account.include_paths)) return;
    account.include_paths.push("");
  }

  function removePath(idx, pi) {
    const account = accounts.value?.[idx];
    if (!account || !Array.isArray(account.include_paths)) return;
    account.include_paths.splice(pi, 1);
  }

  async function saveAccounts() {
    try {
      const data = await postAccounts({ accounts: accounts.value });
      if (data.success) {
        if (Array.isArray(data.accounts)) accounts.value = data.accounts;
        toastSuccess("Аккаунты сохранены");
      } else {
        toastError("Ошибка: " + (data.error || "Неизвестная ошибка"));
      }
    } catch (error) {
      console.error("Failed to save accounts:", error);
      toastError("Ошибка сохранения: " + error.message);
    }
  }

  function importAccounts() {
    importFileInput.value?.click();
  }

  async function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const imported = parsed.accounts || [];
      if (!Array.isArray(imported)) {
        toastError("Неверный формат: ожидается массив accounts");
        return;
      }
      const data = await postImportAccounts({ accounts: imported });
      if (data.success) {
        if (Array.isArray(data.accounts)) accounts.value = data.accounts;
        toastSuccess(`Импортировано ${accounts.value.length} аккаунтов`);
      } else {
        toastError("Ошибка импорта: " + (data.error || "Неизвестная ошибка"));
      }
    } catch (error) {
      console.error("Failed to import accounts:", error);
      toastError("Ошибка импорта: " + error.message);
    }
    event.target.value = "";
  }

  return {
    accounts,
    accountSearch,
    accountSettingsExpanded,
    importFileInput,
    filteredAccounts,
    getAccountIndex,
    toggleAccountSettings,
    fetchAccounts,
    addAccount,
    removeAccount,
    onRoleChange,
    toggleAccountTool,
    addPath,
    removePath,
    saveAccounts,
    importAccounts,
    handleImportFile,
  };
}
