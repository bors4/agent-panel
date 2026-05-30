<template>
  <Card>
    <template #header>
      <h3 class="mono-label">CTL://QUICK</h3>
    </template>
    <div class="quick-settings">
      <ToggleSwitch
        :model-value="settings.autoSave"
        label="AUTO SAVE"
        @update:model-value="updateSetting('autoSave', $event)"
      />
      <ToggleSwitch
        :model-value="settings.verbose"
        label="VERBOSE"
        @update:model-value="updateSetting('verbose', $event)"
      />
      <ToggleSwitch
        :model-value="settings.autoStart"
        label="AUTO START"
        @update:model-value="updateSetting('autoStart', $event)"
      />
      <ToggleSwitch
        :model-value="settings.showTokens"
        label="SHOW TOKENS"
        @update:model-value="updateSetting('showTokens', $event)"
      />
    </div>
  </Card>
</template>

<script setup>
import Card from "../ui/Card.vue";
import ToggleSwitch from "../ui/ToggleSwitch.vue";

const props = defineProps({
  settings: { type: Object, required: true },
});

const emit = defineEmits(["save"]);

const updateSetting = (key, value) => {
  emit("save", { ...props.settings, [key]: value });
};
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

.quick-settings {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
</style>
