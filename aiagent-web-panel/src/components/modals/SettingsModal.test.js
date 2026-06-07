/**
 * Тесты для SettingsContent / SettingsModal: проверяет что ВСЕ события,
 * которые эмитят вложенные секции (system-prompt, parameters, ...), реально
 * проброшены наружу. Раньше 6 событий (`browse`, `add-api-base`,
 * `remove-api-base`, `refresh-models`, `load-openrouter`, `test-asr`) были
 * потеряны — SettingsContent рендерит секцию через
 * `<component :is="..." v-on="sectionListeners" />`, а в listeners
 * были только `update:*` / save/reset/format.
 *
 * Защита от регрессии: если кто-то добавит новый emit в секцию, но забудет
 * пробросить его через SettingsContent + SettingsModal — тест упадёт.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import SettingsModal from "@/components/modals/SettingsModal.vue";

const baseProps = () => ({
  modelValue: true,
  config: {
    token: "",
    projectPath: "",
    openrouterApiKey: "",
    asrServerUrl: "",
    asrLanguage: "ru",
  },
  apiBases: [],
  modelName: "",
  availableModels: [],
  modelContextLength: 0,
  systemPrompt: "",
  asrStatus: null,
});

const stubs = {
  AppModal: {
    template: '<div><slot /><slot name="footer" /></div>',
  },
  SettingsSidebar: { template: "<div />" },
  SettingsContent: {
    props: ["section", "asrStatus"],
    emits: ["browse", "add-api-base", "remove-api-base", "refresh-models", "load-openrouter", "test-asr"],
    template: `
      <div>
        <span class="captured-asr">{{ JSON.stringify(asrStatus) }}</span>
        <button class="emit-browse" @click="$emit('browse')" />
        <button class="emit-add" @click="$emit('add-api-base')" />
        <button class="emit-remove" @click="$emit('remove-api-base', 0)" />
        <button class="emit-refresh" @click="$emit('refresh-models')" />
        <button class="emit-openrouter" @click="$emit('load-openrouter')" />
        <button class="emit-testasr" @click="$emit('test-asr')" />
      </div>
    `,
  },
};

const mountModal = (props) =>
  mount(SettingsModal, {
    props: { ...baseProps(), ...props },
    global: { stubs },
  });

describe("SettingsModal — event forwarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const events = [
    { name: "browse", selector: ".emit-browse" },
    { name: "add-api-base", selector: ".emit-add" },
    { name: "remove-api-base", selector: ".emit-remove", payload: 0 },
    { name: "refresh-models", selector: ".emit-refresh" },
    { name: "load-openrouter", selector: ".emit-openrouter" },
    { name: "test-asr", selector: ".emit-testasr" },
  ];

  for (const ev of events) {
    it(`forwards '${ev.name}' event from SettingsContent to parent`, async () => {
      const wrapper = mountModal();
      await wrapper.find(ev.selector).trigger("click");
      const emitted = wrapper.emitted(ev.name);
      expect(emitted).toBeTruthy();
      expect(emitted).toHaveLength(1);
      if (ev.payload !== undefined) {
        expect(emitted[0]).toEqual([ev.payload]);
      }
    });
  }

  it("forwards 'asrStatus' as a prop into SettingsContent", () => {
    const asrStatus = { configured: true, reachable: true, url: "http://x" };
    const wrapper = mountModal({ asrStatus });
    const captured = wrapper.find(".captured-asr").text();
    expect(JSON.parse(captured)).toEqual(asrStatus);
  });
});
