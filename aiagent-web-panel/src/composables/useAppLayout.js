/**
 * Composable для layout-state (collapsed stats panel и т.п.).
 * @module composables/useAppLayout
 */
import { ref, computed, watch } from "vue";

const STORAGE_KEY = "app-layout";
const DEFAULT_STATE = { statsCollapsed: false };

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return { ...DEFAULT_STATE, ...saved };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

const state = ref(loadState());

watch(
  state,
  (v) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
    } catch {
      /* ignore */
    }
  },
  { deep: true }
);

export function useAppLayout() {
  function toggleStats() {
    state.value.statsCollapsed = !state.value.statsCollapsed;
  }

  function setStatsCollapsed(v) {
    state.value.statsCollapsed = !!v;
  }

  return {
    statsCollapsed: computed(() => state.value.statsCollapsed),
    toggleStats,
    setStatsCollapsed,
  };
}
