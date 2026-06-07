/**
 * Composable для управления темой оформления.
 *
 * Архитектура:
 *   - readTheme() / applyTheme() — чистые функции (без Vue-зависимостей),
 *     можно вызывать ДО mount и даже в inline `<script>` в index.html.
 *   - useTheme() — Vue-обёртка с ref + watch для реактивного обновления.
 *
 * Применение темы:
 *   1. Inline `<script>` в index.html ставит `data-theme` до парсинга CSS → нет FOUC.
 *   2. useAppBoot.js вызывает applyTheme(readTheme()) в начале bootApp().
 *   3. useTheme() в App.vue синхронизирует тему при изменении через UI.
 * @module composables/useTheme
 */
import { ref, onMounted, onUnmounted, watch } from "vue";

export const VALID_THEMES = ["light", "dark", "system"];
const STORAGE_KEY = "app-theme";
const LEGACY_STORAGE_KEY = "theme";

/**
 * Прочитать сохранённую тему из localStorage.
 * Pure: можно вызвать из inline script (до загрузки Vue).
 * @returns {"light"|"dark"|"system"} — всегда валидное значение
 */
export function readTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (VALID_THEMES.includes(saved)) return saved;
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy === "light") return "light";
  } catch {
    /* ignore */
  }
  return "dark";
}

/**
 * Применить тему к DOM: установить `data-theme` атрибут на `<html>`.
 * "system" разрешается в "light"/"dark" по prefers-color-scheme.
 * Pure: работает без Vue.
 * @param {"light"|"dark"|"system"} value
 */
export function applyTheme(value) {
  let effective = value;
  if (value === "system" && typeof window !== "undefined" && window.matchMedia) {
    effective = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } else if (!VALID_THEMES.includes(value)) {
    effective = "dark";
  }
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", effective);
  }
}

let mq = null;
let initialized = false;

function onSystemChange() {
  applyTheme("system");
}

/**
 * Записать тему в localStorage (pure).
 * @param {"light"|"dark"|"system"} value
 */
export function writeTheme(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* ignore */
  }
}

/**
 * Vue-обёртка: ref + watch + реактивный setTheme/cycle.
 * Mount/unmount MediaQueryList listener для отслеживания системной темы.
 */
export function useTheme() {
  const theme = ref(readTheme());

  function setTheme(value) {
    theme.value = VALID_THEMES.includes(value) ? value : "dark";
  }

  function cycle() {
    const order = ["light", "dark", "system"];
    const i = order.indexOf(theme.value);
    setTheme(order[(i + 1) % order.length]);
  }

  if (!initialized && typeof window !== "undefined") {
    initialized = true;
    mq = window.matchMedia("(prefers-color-scheme: dark)");
    onMounted(() => {
      applyTheme(theme.value);
      mq.addEventListener("change", onSystemChange);
    });
    onUnmounted(() => {
      mq.removeEventListener("change", onSystemChange);
    });
  }

  watch(
    theme,
    (v) => {
      writeTheme(v);
      applyTheme(v);
    },
    { immediate: false }
  );

  return { theme, setTheme, cycle };
}
