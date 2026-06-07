/**
 * Composable для модального окна логов.
 * @module composables/useLogsModal
 */
import { ref, onMounted, onUnmounted, watch } from "vue";

const isOpen = ref(false);
let initialized = false;

export function useLogsModal() {
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
    if (e.ctrlKey && e.key === "`") {
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
