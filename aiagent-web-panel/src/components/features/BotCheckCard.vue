<template>
  <Card>
    <template #header>
      <h3 class="mono-label">COM://LINK</h3>
    </template>

    <div class="comm">
      <Button variant="primary" full-width :disabled="checking || !hasToken" :loading="checking" @click="checkBot">
        {{ checking ? "SCANNING" : hasToken ? "TEST SIGNAL" : "NO TOKEN" }}
      </Button>

      <div v-if="!hasToken" class="comm__msg comm__msg--warn">NO TOKEN — SET IN CONFIG</div>

      <div v-else-if="checkState === 'error'" class="comm__msg comm__msg--err">! CONNECTION FAILED</div>

      <template v-else-if="checkState === 'success' && botInfo">
        <div class="comm__success">
          <span class="comm__status">
            <span class="comm__dot" />
            ONLINE
          </span>
          <span class="comm__name">{{ botInfo.first_name }}</span>
          <span class="comm__id">ID: {{ botInfo.id }}</span>
        </div>
        <a :href="botUrl" target="_blank" rel="noopener noreferrer" class="comm__link"> [ OPEN CHANNEL ] </a>
      </template>
    </div>
  </Card>
</template>

<script setup>
import { ref, computed } from "vue";
import Card from "../ui/Card.vue";
import Button from "../ui/Button.vue";
import { useToast } from "@/composables/useToast";

const props = defineProps({ token: { type: String, default: "" } });

const { success, error: showError } = useToast();
const checking = ref(false);
const checkState = ref("idle");
const botInfo = ref(null);

const effectiveToken = computed(() => (props.token ? props.token.trim().replace(/[^\x00-\x7F]/g, "") : ""));
const hasToken = computed(() => !!effectiveToken.value);
const botUrl = computed(() => (botInfo.value?.username ? `https://t.me/${botInfo.value.username}` : "#"));

async function checkBot() {
  try {
    const token = effectiveToken.value;
    if (!token) {
      showError("Set token in Settings");
      checkState.value = "error";
      botInfo.value = null;
      return;
    }
    checking.value = true;
    checkState.value = "loading";
    botInfo.value = null;

    const resp = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: AbortSignal.timeout(10000),
    });
    const data = await resp.json();

    if (data.ok) {
      botInfo.value = { id: data.result.id, first_name: data.result.first_name, username: data.result.username };
      checkState.value = "success";
      success("Channel open");
    } else {
      throw new Error(data.description);
    }
  } catch (e) {
    checkState.value = "error";
    botInfo.value = null;
    showError(e.message || "Unknown error");
  } finally {
    checking.value = false;
  }
}
</script>

<style scoped>
.mono-label {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.65rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-muted);
}

.comm {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.comm__msg {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-align: center;
  padding: 6px;
}
.comm__msg--warn {
  color: var(--text-muted);
}
.comm__msg--err {
  color: var(--error);
}

.comm__success {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px;
  background: rgba(16, 185, 129, 0.06);
  border: 1px solid rgba(16, 185, 129, 0.15);
  clip-path: polygon(
    0 3px,
    3px 0,
    calc(100% - 3px) 0,
    100% 3px,
    100% calc(100% - 3px),
    calc(100% - 3px) 100%,
    3px 100%,
    0 calc(100% - 3px)
  );
}

.comm__status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--success);
}

.comm__dot {
  width: 6px;
  height: 6px;
  background: var(--success);
  clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
  animation: commPulse 2s ease-in-out infinite;
}

.comm__name {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-primary);
}

.comm__id {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.55rem;
  color: var(--text-muted);
}

.comm__link {
  display: block;
  text-align: center;
  padding: 7px 14px;
  background: rgba(42, 127, 255, 0.06);
  border: 1px solid var(--accent);
  color: var(--accent);
  font-family: "JetBrains Mono", monospace;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  text-decoration: none;
  clip-path: polygon(
    0 3px,
    3px 0,
    calc(100% - 3px) 0,
    100% 3px,
    100% calc(100% - 3px),
    calc(100% - 3px) 100%,
    3px 100%,
    0 calc(100% - 3px)
  );
  transition: var(--transition);
}
.comm__link:hover {
  background: var(--accent);
  color: var(--space-black);
  box-shadow: var(--glow-accent-sm);
}

@keyframes commPulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}
</style>
