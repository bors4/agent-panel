<template>
  <Console :logs="logs" @clear="$emit('clear')" />
</template>

<script setup>
import Console from "../features/Console.vue";

defineProps({
  logs: { type: Array, default: () => [] },
});

defineEmits(["clear"]);
</script>
