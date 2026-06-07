/**
 * Тесты для AppTooltip:
 * - Teleport в body (escape overflow/transform)
 * - position: fixed (НЕ absolute)
 * - hover + focus показывают
 * - Escape скрывает
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { nextTick } from "vue";
import { mount } from "@vue/test-utils";
import AppTooltip from "@/components/ui/AppTooltip.vue";

const mounted = [];

function mountTT(options = {}) {
  const wrapper = mount(AppTooltip, {
    ...options,
    attachTo: document.body,
  });
  mounted.push(wrapper);
  return wrapper;
}

beforeEach(() => {
  document.body.querySelectorAll(".tooltip-content").forEach((el) => el.remove());
});

afterEach(() => {
  while (mounted.length) mounted.pop().unmount();
  document.body.querySelectorAll(".tooltip-content").forEach((el) => el.remove());
});

describe("AppTooltip", () => {
  it("renders nothing in document.body until shown", () => {
    mountTT({
      slots: { trigger: "<button>trig</button>", default: "Help" },
    });
    expect(document.body.querySelector(".tooltip-content")).toBeNull();
  });

  it("mounts the tooltip into document.body (Teleport) and uses position: fixed on mouseenter", async () => {
    const wrapper = mountTT({
      slots: { trigger: "<button>trig</button>", default: "Help" },
    });
    await wrapper.trigger("mouseenter");
    await nextTick();
    const tip = document.body.querySelector(".tooltip-content");
    expect(tip).not.toBeNull();
    expect(tip.parentElement).toBe(document.body);
    expect(tip.style.position).toBe("fixed");
    expect(tip.textContent.trim()).toBe("Help");
  });

  it("shows on focus and hides on blur", async () => {
    const wrapper = mountTT({
      slots: { trigger: '<button id="trig">trig</button>', default: "Focus text" },
    });
    await wrapper.trigger("focusin");
    await nextTick();
    expect(document.body.querySelector(".tooltip-content")).not.toBeNull();
    await wrapper.trigger("focusout");
    await nextTick();
    expect(document.body.querySelector(".tooltip-content")).toBeNull();
  });

  it("hides on Escape keydown", async () => {
    const wrapper = mountTT({
      slots: { trigger: "<button>trig</button>", default: "Esc text" },
    });
    await wrapper.trigger("mouseenter");
    await nextTick();
    expect(document.body.querySelector(".tooltip-content")).not.toBeNull();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await nextTick();
    expect(document.body.querySelector(".tooltip-content")).toBeNull();
  });

  it("removes the keydown listener on unmount", async () => {
    const wrapper = mountTT({
      slots: { trigger: "<button>trig</button>", default: "cleanup" },
    });
    await wrapper.trigger("mouseenter");
    await nextTick();
    wrapper.unmount();
    mounted.pop();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.body.querySelector(".tooltip-content")).toBeNull();
  });

  it("attaches role=tooltip for assistive tech", async () => {
    const wrapper = mountTT({
      slots: { trigger: "<button>trig</button>", default: "a11y" },
    });
    await wrapper.trigger("mouseenter");
    await nextTick();
    const tip = document.body.querySelector(".tooltip-content");
    expect(tip.getAttribute("role")).toBe("tooltip");
  });
});
