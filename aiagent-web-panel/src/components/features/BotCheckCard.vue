<template>
  <Card>
    <template #header>
      <h2>Проверка подключения к Telegram-боту</h2>
    </template>
    <Button variant="success" full-width :disabled="checking || !hasToken" @click="checkBot">
      <span v-if="checking" class="btn-loading" />
      <span v-else>Проверить</span>
    </Button>

    <div v-if="!hasToken" class="status-text status-warning">
      Для подключения к боту нужно в настройках указать токен
    </div>

    <div v-else-if="checkState === 'error'" class="status-text status-error">
      Не удалось подключиться. Проверь токен бота
    </div>

    <template v-else-if="checkState === 'success' && botInfo">
      <a :href="botUrl" target="_blank" rel="noopener noreferrer" class="btn-open-bot"> Открыть бота </a>
      <div class="status-text status-success">{{ botInfo.first_name }} ({{ botInfo.id }})</div>
    </template>
  </Card>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import Card from "../ui/Card.vue";
import Button from "../ui/Button.vue";
import { useToast } from "@/composables/useToast";
import { getConfig } from "@/api/client";

const props = defineProps({
  token: { type: String, default: "" },
});

const { success, error: showError } = useToast();
const checking = ref(false);
const checkState = ref("idle");
const botInfo = ref(null);
const effectiveToken = ref("");
const envToken = ref("");

watch(
  () => props.token,
  (val) => {
    if (val) {
      effectiveToken.value = val.trim().replace(/[^\x00-\x7F]/g, "");
    } else {
      effectiveToken.value = "";
    }
  },
  { immediate: true }
);

const hasToken = computed(() => {
  return !!(effectiveToken.value || envToken.value);
});

const botUrl = computed(() => {
  if (!botInfo.value?.username) return "#";
  return `https://t.me/${botInfo.value.username}`;
});

onMounted(async () => {
  try {
    const data = await getConfig();
    envToken.value = data.config?.token || "";
  } catch {}
});

async function checkBot() {
  try {
    let token = effectiveToken.value || envToken.value;

    if (!token) {
      showError("Укажите токен в настройках");
      checkState.value = "error";
      botInfo.value = null;
      return;
    }

    checking.value = true;
    checkState.value = "loading";
    botInfo.value = null;

    const telegramResp = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: AbortSignal.timeout(10000),
    });

    const data = await telegramResp.json();

    if (data.ok) {
      botInfo.value = {
        id: data.result.id,
        first_name: data.result.first_name,
        username: data.result.username,
      };
      checkState.value = "success";
      success("Бот подключён");
    } else {
      throw new Error(data.description);
    }
  } catch (e) {
    checkState.value = "error";
    botInfo.value = null;
    showError(e.message || "Неизвестная ошибка");
  } finally {
    checking.value = false;
  }
}
</script>

<style scoped>
:deep(.card-header h2) {
  font-size: 11px;
}

.status-text {
  margin-top: 10px;
  font-size: 11px;
  text-align: center;
}

.status-success {
  color: var(--success);
}

.status-error {
  color: var(--error);
}

.status-warning {
  color: var(--text-muted);
}

.btn-open-bot {
  display: block;
  margin-top: 10px;
  padding: 8px 16px;
  background: var(--accent-primary);
  color: #ffffff;
  text-align: center;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
  transition: var(--transition);
}

.btn-open-bot:hover {
  background: var(--accent-hover);
  box-shadow: 0 0 12px var(--accent-glow);
}

.btn-loading {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
