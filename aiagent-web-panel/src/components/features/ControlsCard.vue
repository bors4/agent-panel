<template>
  <Card>
    <template #header>
      <h3 class="mono-label">SYS://CONTROLS</h3>
    </template>
    <div class="controls">
      <Button
        variant="primary"
        full-width
        :disabled="isRunning || !projectPath"
        @click="$emit('start')"
      >
        [ LAUNCH ]
      </Button>
      <div class="controls__row">
        <Button
          variant="danger"
          :disabled="!isRunning || !projectPath"
          @click="$emit('stop')"
        >
          [ HALT ]
        </Button>
        <Button
          variant="ghost"
          :disabled="!isRunning || !projectPath"
          @click="$emit('restart')"
        >
          [ REBOOT ]
        </Button>
      </div>
    </div>
  </Card>
</template>

<script setup>
import Card from "../ui/Card.vue";
import Button from "../ui/Button.vue";

defineProps({ isRunning: Boolean, projectPath: String });
defineEmits(["start", "stop", "restart"]);
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

.controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.controls__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
</style>
