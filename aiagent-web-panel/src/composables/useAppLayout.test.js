/**
 * Тесты для useAppLayout.
 *
 * Защита от регрессии: раньше composable возвращал
 * `statsCollapsed: state.value.statsCollapsed` — plain boolean, не ref.
 * После `toggleStats()` обновлялся `state.value`, но проп `statsCollapsed`
 * в потребителе оставался старым boolean → панель не сворачивалась.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("useAppLayout", () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("returns a reactive statsCollapsed (NOT a plain boolean)", async () => {
    const { useAppLayout } = await import("@/composables/useAppLayout");
    const { statsCollapsed } = useAppLayout();
    expect(statsCollapsed).toBeDefined();
    expect(typeof statsCollapsed).toBe("object");
    expect("value" in statsCollapsed).toBe(true);
    expect(statsCollapsed.value).toBe(false);
  });

  it("toggleStats() flips statsCollapsed reactively (the bug fix)", async () => {
    const { useAppLayout } = await import("@/composables/useAppLayout");
    const { statsCollapsed, toggleStats } = useAppLayout();
    expect(statsCollapsed.value).toBe(false);
    toggleStats();
    expect(statsCollapsed.value).toBe(true);
    toggleStats();
    expect(statsCollapsed.value).toBe(false);
  });

  it("setStatsCollapsed(true|false) overrides current state", async () => {
    const { useAppLayout } = await import("@/composables/useAppLayout");
    const { statsCollapsed, setStatsCollapsed } = useAppLayout();
    setStatsCollapsed(true);
    expect(statsCollapsed.value).toBe(true);
    setStatsCollapsed(false);
    expect(statsCollapsed.value).toBe(false);
    setStatsCollapsed("truthy");
    expect(statsCollapsed.value).toBe(true);
  });

  it("all consumers share the same state across calls (singleton)", async () => {
    const { useAppLayout } = await import("@/composables/useAppLayout");
    const a = useAppLayout();
    const b = useAppLayout();
    a.toggleStats();
    expect(b.statsCollapsed.value).toBe(true);
    b.toggleStats();
    expect(a.statsCollapsed.value).toBe(false);
  });
});
