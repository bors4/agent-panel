import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ControlsCard from "@/components/features/ControlsCard.vue";

describe("ControlsCard", () => {
  it("renders start button enabled when isRunning is false and projectPath is set", () => {
    const wrapper = mount(ControlsCard, {
      props: { isRunning: false, projectPath: "/test" },
    });
    const startBtn = wrapper.findAll("button")[0];
    expect(startBtn.attributes("disabled")).toBeUndefined();
  });

  it("disables start button when isRunning is true", () => {
    const wrapper = mount(ControlsCard, {
      props: { isRunning: true, projectPath: "/test" },
    });
    const startBtn = wrapper.findAll("button")[0];
    expect(startBtn.attributes("disabled")).toBeDefined();
  });

  it("disables all buttons when projectPath is empty", () => {
    const wrapper = mount(ControlsCard, {
      props: { isRunning: false, projectPath: "" },
    });
    const buttons = wrapper.findAll("button");
    buttons.forEach((btn) => {
      expect(btn.attributes("disabled")).toBeDefined();
    });
  });

  it("emits start event on start button click", async () => {
    const wrapper = mount(ControlsCard, {
      props: { isRunning: false, projectPath: "/test" },
    });
    const startBtn = wrapper.findAll("button")[0];
    await startBtn.trigger("click");
    expect(wrapper.emitted("start")).toBeDefined();
  });

  it("emits stop event on stop button click", async () => {
    const wrapper = mount(ControlsCard, {
      props: { isRunning: true, projectPath: "/test" },
    });
    const stopBtn = wrapper.findAll("button")[1];
    await stopBtn.trigger("click");
    expect(wrapper.emitted("stop")).toBeDefined();
  });

  it("emits restart event on restart button click", async () => {
    const wrapper = mount(ControlsCard, {
      props: { isRunning: true, projectPath: "/test" },
    });
    const buttons = wrapper.findAll("button");
    const restartBtn = buttons[buttons.length - 1];
    await restartBtn.trigger("click");
    expect(wrapper.emitted("restart")).toBeDefined();
  });
});
