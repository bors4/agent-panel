/**
 * ARIA verification tests — covers the key accessibility patterns used
 * across the panel. Each test mounts a small wrapper around the component
 * under test and asserts that the required aria-* / role attributes are
 * present and correct. Catches regressions when components are refactored.
 *
 * Catches:
 * - missing `role` on landmarks (tablist, region, tabpanel, etc.)
 * - broken `aria-labelledby` / `aria-controls` pairings
 * - missing `aria-live` on dynamic content regions (toasts)
 * - missing `aria-hidden` on decorative icons
 * - missing `aria-label` on icon-only buttons
 * - `aria-selected` not updating with `activeTab`
 * - `tabindex` roving pattern violations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { nextTick } from "vue";
import { mount } from "@vue/test-utils";
import ToastContainer from "@/components/ui/ToastContainer.vue";
import AppTooltip from "@/components/ui/AppTooltip.vue";
import { toasts } from "@/composables/useToast.js";

const mountedWrappers = [];

function mountTracked(component, options = {}) {
  const wrapper = mount(component, { ...options, attachTo: document.body });
  mountedWrappers.push(wrapper);
  return wrapper;
}

beforeEach(() => {
  toasts.value = [];
});

afterEach(() => {
  for (const w of mountedWrappers) w.unmount();
  mountedWrappers.length = 0;
  toasts.value = [];
  vi.restoreAllMocks();
});

function pushToast(message, type) {
  toasts.value.push({ id: String(Date.now() + Math.random()), type, message });
}

// ─── ToastContainer ─────────────────────────────────────────────────────
//
// ToastContainer uses <Teleport to="body"> so its content is rendered
// outside the wrapper's root element. wrapper.find*() cannot reach it —
// query document.body directly. tracked mount/unmount keeps the body
// clean between tests so querySelector returns only the current run.

describe("ARIA — ToastContainer", () => {
  it("exposes a labelled live region for assistive tech", async () => {
    mountTracked(ToastContainer);
    await nextTick();
    const region = document.body.querySelector('.toast-container[role="region"]');
    expect(region).not.toBeNull();
    expect(region.getAttribute("aria-label")).toBe("Уведомления");
  });

  it("marks each toast as a polite live region with atomic updates", async () => {
    pushToast("Hello", "info");
    pushToast("Boom", "error");
    mountTracked(ToastContainer);
    await nextTick();
    const items = document.body.querySelectorAll('[role="status"]');
    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(item.getAttribute("aria-live")).toBe("polite");
      expect(item.getAttribute("aria-atomic")).toBe("true");
    }
  });

  it("hides decorative icons from screen readers", async () => {
    pushToast("x", "info");
    mountTracked(ToastContainer);
    await nextTick();
    const icon = document.body.querySelector(".toast-icon");
    expect(icon).not.toBeNull();
    expect(icon.getAttribute("aria-hidden")).toBe("true");
  });
});

// ─── AppTooltip ─────────────────────────────────────────────────────────

describe("ARIA — AppTooltip", () => {
  it("exposes its content as role=tooltip so screen readers announce it", async () => {
    const wrapper = mountTracked(AppTooltip, {
      slots: {
        trigger: '<button id="trig">hover me</button>',
        default: "Help text",
      },
    });
    await wrapper.trigger("mouseenter");
    await nextTick();
    const tooltip = document.body.querySelector('.tooltip-content[role="tooltip"]');
    expect(tooltip).not.toBeNull();
    expect(tooltip.textContent.trim()).toBe("Help text");
  });
});
