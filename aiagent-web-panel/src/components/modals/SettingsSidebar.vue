<template>
  <nav class="settings-nav" aria-label="Settings sections">
    <div class="settings-nav__search">
      <svg
        class="settings-nav__search-icon"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        ref="searchInput"
        v-model="query"
        type="text"
        :placeholder="placeholder"
        class="settings-nav__input"
        @keydown.escape="onEsc"
        @keydown.enter="onEnter"
        @keydown.down.prevent="focusNext"
        @keydown.up.prevent="focusPrev"
      />
      <button v-if="query" class="settings-nav__clear" title="Clear" @click="clear">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>

    <div v-if="query" class="settings-nav__results">
      <div class="settings-nav__results-header">
        {{ filteredSections.length }} match{{ filteredSections.length === 1 ? "" : "es" }}
      </div>
      <button
        v-for="s in filteredSections"
        :key="s.id"
        ref="itemRefs"
        class="settings-nav__item settings-nav__item--result"
        :class="{ 'settings-nav__item--active': active === s.id }"
        @click="select(s.id)"
        @focus="active = s.id"
      >
        <component :is="s.icon" class="settings-nav__icon" />
        <span class="settings-nav__label">{{ s.label }}</span>
        <span v-if="s.description" class="settings-nav__desc">{{ s.description }}</span>
      </button>
      <div v-if="filteredSections.length === 0" class="settings-nav__empty">No matches</div>
    </div>

    <div v-else class="settings-nav__sections">
      <button
        v-for="s in sections"
        :key="s.id"
        class="settings-nav__item"
        :class="{ 'settings-nav__item--active': active === s.id }"
        @click="select(s.id)"
      >
        <component :is="s.icon" class="settings-nav__icon" />
        <span class="settings-nav__label">{{ s.label }}</span>
      </button>
    </div>
  </nav>
</template>

<script setup>
import { ref, computed, nextTick, h, onMounted } from "vue";

const IconSystem = () =>
  h(
    "svg",
    {
      width: 14,
      height: 14,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    },
    [
      h("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }),
      h("polyline", { points: "14 2 14 8 20 8" }),
      h("line", { x1: "16", y1: "13", x2: "8", y2: "13" }),
      h("line", { x1: "16", y1: "17", x2: "8", y2: "17" }),
    ]
  );
const IconParams = () =>
  h(
    "svg",
    {
      width: 14,
      height: 14,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    },
    [
      h("circle", { cx: 12, cy: 12, r: 3 }),
      h("path", {
        d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.36.15.68.4.93.71",
      }),
    ]
  );
const IconLimits = () =>
  h(
    "svg",
    {
      width: 14,
      height: 14,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    },
    [
      h("line", { x1: "4", y1: "9", x2: "20", y2: "9" }),
      h("line", { x1: "4", y1: "15", x2: "20", y2: "15" }),
      h("line", { x1: "10", y1: "3", x2: "8", y2: "21" }),
      h("line", { x1: "16", y1: "3", x2: "14", y2: "21" }),
    ]
  );
const IconBehavior = () =>
  h(
    "svg",
    {
      width: 14,
      height: 14,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    },
    [h("circle", { cx: 12, cy: 12, r: 10 }), h("polyline", { points: "12 6 12 12 16 14" })]
  );
const IconDisplay = () =>
  h(
    "svg",
    {
      width: 14,
      height: 14,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    },
    [
      h("rect", { x: "2", y: "3", width: "20", height: "14", rx: 2, ry: 2 }),
      h("line", { x1: "8", y1: "21", x2: "16", y2: "21" }),
      h("line", { x1: "12", y1: "17", x2: "12", y2: "21" }),
    ]
  );
const IconAppearance = () =>
  h(
    "svg",
    {
      width: 14,
      height: 14,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    },
    [
      h("circle", { cx: 12, cy: 12, r: 5 }),
      h("line", { x1: "12", y1: "1", x2: "12", y2: "3" }),
      h("line", { x1: "12", y1: "21", x2: "12", y2: "23" }),
      h("line", { x1: "4.22", y1: "4.22", x2: "5.64", y2: "5.64" }),
      h("line", { x1: "18.36", y1: "18.36", x2: "19.78", y2: "19.78" }),
      h("line", { x1: "1", y1: "12", x2: "3", y2: "12" }),
      h("line", { x1: "21", y1: "12", x2: "23", y2: "12" }),
      h("line", { x1: "4.22", y1: "19.78", x2: "5.64", y2: "18.36" }),
      h("line", { x1: "18.36", y1: "5.64", x2: "19.78", y2: "4.22" }),
    ]
  );
const IconTools = () =>
  h(
    "svg",
    {
      width: 14,
      height: 14,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    },
    [
      h("path", {
        d: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z",
      }),
    ]
  );
const IconAccounts = () =>
  h(
    "svg",
    {
      width: 14,
      height: 14,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    },
    [
      h("path", { d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" }),
      h("circle", { cx: 9, cy: 7, r: 4 }),
      h("path", { d: "M23 21v-2a4 4 0 0 0-3-3.87" }),
      h("path", { d: "M16 3.13a4 4 0 0 1 0 7.75" }),
    ]
  );
const IconAbout = () =>
  h(
    "svg",
    {
      width: 14,
      height: 14,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    },
    [
      h("circle", { cx: 12, cy: 12, r: 10 }),
      h("line", { x1: "12", y1: "16", x2: "12", y2: "12" }),
      h("line", { x1: "12", y1: "8", x2: "12.01", y2: "8" }),
    ]
  );

const props = defineProps({
  modelValue: { type: String, required: true },
});

const emit = defineEmits(["update:modelValue"]);

const query = ref("");
const searchInput = ref(null);
const itemRefs = ref([]);
const active = ref(props.modelValue);

const sections = [
  {
    id: "system-prompt",
    label: "System Prompt",
    icon: IconSystem,
    keywords: "prompt system instructions persona",
    description: "Edit system instructions",
  },
  {
    id: "parameters",
    label: "Parameters",
    icon: IconParams,
    keywords: "telegram token project path api model openrouter asr",
    description: "API, token, project path",
  },
  {
    id: "limits",
    label: "Limits",
    icon: IconLimits,
    keywords: "tokens history search files",
    description: "Context and search limits",
  },
  {
    id: "behavior",
    label: "Behavior",
    icon: IconBehavior,
    keywords: "agent stream temperature",
    description: "Agent behavior tuning",
  },
  {
    id: "display",
    label: "Display",
    icon: IconDisplay,
    keywords: "sound tokens verbose autosave",
    description: "UI feedback and UX",
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: IconAppearance,
    keywords: "theme dark light mode",
    description: "Theme and visuals",
  },
  {
    id: "tools",
    label: "Tools",
    icon: IconTools,
    keywords: "tools enabled permission paths",
    description: "Agent tools configuration",
  },
  {
    id: "accounts",
    label: "Accounts",
    icon: IconAccounts,
    keywords: "accounts roles telegram user system",
    description: "Telegram user accounts",
  },
  {
    id: "about",
    label: "About",
    icon: IconAbout,
    keywords: "version info help documentation",
    description: "Version and documentation",
  },
];

const placeholder = "Search settings (Ctrl+F)";

const filteredSections = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return [];
  return sections.filter((s) => {
    const haystack = `${s.label} ${s.keywords || ""} ${s.description || ""}`.toLowerCase();
    return haystack.includes(q);
  });
});

function select(id) {
  emit("update:modelValue", id);
  active.value = id;
  query.value = "";
  nextTick(() => searchInput.value?.focus());
}

function clear() {
  query.value = "";
  nextTick(() => searchInput.value?.focus());
}

function onEsc() {
  if (query.value) {
    query.value = "";
  } else {
    emit("update:modelValue", active.value);
  }
}

function onEnter() {
  if (filteredSections.value.length > 0) {
    select(filteredSections.value[0].id);
  }
}

function focusNext() {
  const idx = filteredSections.value.findIndex((s) => s.id === active.value);
  const next = idx < filteredSections.value.length - 1 ? idx + 1 : 0;
  active.value = filteredSections.value[next]?.id;
  nextTick(() => itemRefs.value[next]?.focus());
}

function focusPrev() {
  const idx = filteredSections.value.findIndex((s) => s.id === active.value);
  const prev = idx > 0 ? idx - 1 : filteredSections.value.length - 1;
  active.value = filteredSections.value[prev]?.id;
  nextTick(() => itemRefs.value[prev]?.focus());
}

onMounted(() => {
  nextTick(() => searchInput.value?.focus());
});
</script>

<style scoped>
.settings-nav {
  display: flex;
  flex-direction: column;
  width: 260px;
  flex-shrink: 0;
  background: var(--bg-1);
  border-right: 1px solid var(--border);
  overflow: hidden;
}

.settings-nav__search {
  position: relative;
  padding: 12px 12px 8px;
  flex-shrink: 0;
}

.settings-nav__search-icon {
  position: absolute;
  left: 22px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-3);
  pointer-events: none;
}

.settings-nav__input {
  width: 100%;
  padding: 7px 28px 7px 30px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-1);
  font-size: 12px;
  font-family: inherit;
  outline: none;
  transition: var(--t-fast);
}

.settings-nav__input::placeholder {
  color: var(--text-3);
}

.settings-nav__input:focus {
  border-color: var(--accent);
  box-shadow: var(--accent-glow);
}

.settings-nav__clear {
  position: absolute;
  right: 18px;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-xs);
  color: var(--text-3);
  transition: var(--t-fast);
}

.settings-nav__clear:hover {
  color: var(--text-1);
  background: var(--bg-3);
}

.settings-nav__sections,
.settings-nav__results {
  flex: 1;
  overflow-y: auto;
  padding: 4px 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.settings-nav__results-header {
  padding: 8px 10px 4px;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-3);
  font-weight: 600;
}

.settings-nav__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  color: var(--text-2);
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  width: 100%;
  cursor: pointer;
  transition: var(--t-fast);
}

.settings-nav__item:hover {
  background: var(--bg-2);
  color: var(--text-1);
}

.settings-nav__item--active {
  background: var(--accent-soft);
  color: var(--accent);
}

.settings-nav__item--active:hover {
  background: var(--accent-soft-2);
}

.settings-nav__item--result {
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  padding: 8px 10px;
}

.settings-nav__item--result .settings-nav__icon {
  align-self: flex-start;
  margin-top: 2px;
}

.settings-nav__item--result .settings-nav__label {
  font-size: 12px;
}

.settings-nav__item--result .settings-nav__desc {
  font-size: 10px;
  color: var(--text-3);
  font-weight: 400;
}

.settings-nav__item--result.settings-nav__item--active .settings-nav__desc {
  color: var(--accent);
  opacity: 0.7;
}

.settings-nav__icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.settings-nav__label {
  flex: 1;
}

.settings-nav__empty {
  padding: 16px 10px;
  text-align: center;
  font-size: 12px;
  color: var(--text-3);
  font-style: italic;
}
</style>
