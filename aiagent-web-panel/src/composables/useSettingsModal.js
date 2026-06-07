/**
 * Composable для модального окна настроек.
 * @module composables/useSettingsModal
 */
import { ref, onMounted, onUnmounted, watch } from "vue";

const isOpen = ref(false);
let initialized = false;

export function useSettingsModal() {
  function open() {
    isOpen.value = true;
  }

  function close() {
    isOpen.value = false;
  }

  function toggle() {
    isOpen.value = !isOpen.value;
  }

  function onKeydown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === ",") {
      e.preventDefault();
      toggle();
      return;
    }
    if (e.key === "Escape" && isOpen.value) {
      e.preventDefault();
      close();
    }
  }

  if (!initialized) {
    initialized = true;
    onMounted(() => {
      document.addEventListener("keydown", onKeydown);
    });
    onUnmounted(() => {
      document.removeEventListener("keydown", onKeydown);
    });
  }

  watch(isOpen, (open) => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  });

  return { isOpen, open, close, toggle };
}
