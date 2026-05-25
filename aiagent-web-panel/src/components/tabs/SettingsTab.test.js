import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import SettingsTab from "@/components/tabs/SettingsTab.vue";

describe("SettingsTab", () => {
  const defaultProps = {
    config: {
      token: "test-token",
      projectPath: "C:\\test",
      maxFileChars: 2000,
      maxHistoryPairs: 5,
      maxTokens: 4096,
      temperature: 0.1,
      timeout: 120000,
    },
    apiBases: [{ url: "http://test:8080/v1", connected: false }],
    availableModels: [{ id: "model-1", source: "test" }],
    modelName: "model-1",
    serverUrl: "http://test:8080/v1",
  };

  it("renders config fields from props", () => {
    const wrapper = mount(SettingsTab, { props: defaultProps });
    expect(wrapper.text()).toContain("TELEGRAM_TOKEN");
    expect(wrapper.text()).toContain("PROJECT_PATH");
    expect(wrapper.text()).toContain("MODEL_NAME");
  });

  it("renders available models in select", () => {
    const wrapper = mount(SettingsTab, { props: defaultProps });
    const select = wrapper.find("select");
    const options = select.findAll("option");
    expect(options.length).toBe(2);
    expect(options[0].text()).toContain("Выберите модель");
    expect(options[1].text()).toContain("model-1");
  });

  it("has save button", () => {
    const wrapper = mount(SettingsTab, { props: defaultProps });
    const saveBtn = wrapper.find("button");
    expect(saveBtn.exists()).toBe(true);
  });
});
