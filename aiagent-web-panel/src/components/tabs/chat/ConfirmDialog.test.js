/**
 * Тесты для ConfirmDialog.
 */

import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ConfirmDialog from "@/components/tabs/chat/ConfirmDialog.vue";

describe("ConfirmDialog", () => {
  it("renders nothing when visible=false", () => {
    const wrapper = mount(ConfirmDialog, { props: { visible: false } });
    expect(wrapper.find(".confirm-overlay").exists()).toBe(false);
  });

  it("renders overlay + dialog when visible=true", () => {
    const wrapper = mount(ConfirmDialog, { props: { visible: true, message: "Are you sure?" } });
    expect(wrapper.find(".confirm-overlay").exists()).toBe(true);
    expect(wrapper.find(".confirm-dialog").exists()).toBe(true);
    expect(wrapper.text()).toContain("Are you sure?");
  });

  it("uses default confirm/cancel labels", () => {
    const wrapper = mount(ConfirmDialog, { props: { visible: true } });
    expect(wrapper.text()).toContain("Ок");
    expect(wrapper.text()).toContain("Отмена");
  });

  it("uses custom labels when provided", () => {
    const wrapper = mount(ConfirmDialog, {
      props: { visible: true, confirmLabel: "Yes!", cancelLabel: "No!" },
    });
    expect(wrapper.text()).toContain("Yes!");
    expect(wrapper.text()).toContain("No!");
  });

  it("emits confirm on confirm button click", async () => {
    const wrapper = mount(ConfirmDialog, { props: { visible: true } });
    await wrapper.find(".confirm-btn.confirm").trigger("click");
    expect(wrapper.emitted("confirm")).toBeTruthy();
  });

  it("emits cancel on cancel button click", async () => {
    const wrapper = mount(ConfirmDialog, { props: { visible: true } });
    await wrapper.find(".confirm-btn.cancel").trigger("click");
    expect(wrapper.emitted("cancel")).toBeTruthy();
  });

  it("emits cancel on overlay background click", async () => {
    const wrapper = mount(ConfirmDialog, { props: { visible: true } });
    await wrapper.find(".confirm-overlay").trigger("click");
    expect(wrapper.emitted("cancel")).toBeTruthy();
  });
});
