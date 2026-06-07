/**
 * Composable для проверки соединения с Telegram Bot API.
 *
 * Singleton: состояние (checking / checkState / botInfo / errorMessage)
 * шарится между всеми потребителями (ParametersSection в Settings).
 *
 * @module composables/useTelegramCheck
 */
import { ref } from "vue";

const checking = ref(false);
const checkState = ref("idle");
const botInfo = ref(null);
const errorMessage = ref("");

const TOKEN_SANITIZE_REGEX = /[^\x00-\x7F]/g;
const TIMEOUT_MS = 10000;

function sanitizeToken(t) {
  return (t || "").trim().replace(TOKEN_SANITIZE_REGEX, "");
}

export function useTelegramCheck() {
  async function checkBot(rawToken) {
    const token = sanitizeToken(rawToken);
    if (!token) {
      checkState.value = "error";
      errorMessage.value = "Токен пустой";
      botInfo.value = null;
      return null;
    }
    try {
      checking.value = true;
      checkState.value = "loading";
      botInfo.value = null;
      errorMessage.value = "";
      const resp = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const data = await resp.json();
      if (data?.ok) {
        botInfo.value = {
          id: data.result.id,
          first_name: data.result.first_name,
          username: data.result.username,
        };
        checkState.value = "success";
        errorMessage.value = "";
        return botInfo.value;
      }
      throw new Error(data?.description || "Telegram API error");
    } catch (e) {
      checkState.value = "error";
      errorMessage.value = e?.message || "Network error";
      botInfo.value = null;
      return null;
    } finally {
      checking.value = false;
    }
  }

  function reset() {
    checkState.value = "idle";
    botInfo.value = null;
    errorMessage.value = "";
  }

  return {
    checking,
    checkState,
    botInfo,
    errorMessage,
    checkBot,
    reset,
  };
}
