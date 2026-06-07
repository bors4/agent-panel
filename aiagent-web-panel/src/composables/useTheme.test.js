/**
 * Тесты для useTheme — split на чистые функции + composable.
 *
 * Защита от регрессии FOUC:
 * - readTheme() ДОЛЖНА возвращать валидное значение из любого состояния localStorage
 * - applyTheme() ДОЛЖНА установить data-theme на documentElement немедленно
 * - inline-скрипт в index.html дублирует эту логику — keep them in sync
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readTheme, applyTheme, writeTheme, useTheme, VALID_THEMES } from "@/composables/useTheme";

describe("useTheme — pure helpers", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  describe("readTheme()", () => {
    it("returns 'dark' as default when localStorage is empty", () => {
      expect(readTheme()).toBe("dark");
    });

    it("returns 'light' when localStorage has 'app-theme' = 'light'", () => {
      localStorage.setItem("app-theme", "light");
      expect(readTheme()).toBe("light");
    });

    it("returns 'system' when localStorage has 'app-theme' = 'system'", () => {
      localStorage.setItem("app-theme", "system");
      expect(readTheme()).toBe("system");
    });

    it("falls back to 'dark' when stored value is invalid", () => {
      localStorage.setItem("app-theme", "rainbow");
      expect(readTheme()).toBe("dark");
    });

    it("migrates from legacy 'theme' key when 'app-theme' is missing", () => {
      localStorage.setItem("theme", "light");
      expect(readTheme()).toBe("light");
    });

    it("prefers 'app-theme' over legacy 'theme' key", () => {
      localStorage.setItem("app-theme", "dark");
      localStorage.setItem("theme", "light");
      expect(readTheme()).toBe("dark");
    });

    it("returns 'dark' when localStorage throws (e.g. SecurityError)", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("SecurityError");
      });
      expect(readTheme()).toBe("dark");
    });
  });

  describe("applyTheme()", () => {
    it("sets data-theme='light' on documentElement when value is 'light'", () => {
      applyTheme("light");
      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    });

    it("sets data-theme='dark' on documentElement when value is 'dark'", () => {
      applyTheme("dark");
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    });

    it("resolves 'system' to 'dark' when prefers-color-scheme is dark", () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: true });
      applyTheme("system");
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    });

    it("resolves 'system' to 'light' when prefers-color-scheme is light", () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });
      applyTheme("system");
      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    });

    it("falls back to 'dark' when value is invalid", () => {
      applyTheme("rainbow");
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    });
  });

  describe("writeTheme()", () => {
    it("persists the value to localStorage", () => {
      writeTheme("light");
      expect(localStorage.getItem("app-theme")).toBe("light");
    });

    it("does not throw when localStorage is unavailable", () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("QuotaExceeded");
      });
      expect(() => writeTheme("light")).not.toThrow();
    });
  });

  describe("VALID_THEMES", () => {
    it("exposes the canonical list", () => {
      expect(VALID_THEMES).toEqual(["light", "dark", "system"]);
    });
  });
});

describe("useTheme — composable", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("returns a reactive theme ref initialised from localStorage", () => {
    localStorage.setItem("app-theme", "light");
    const { theme } = useTheme();
    expect(theme.value).toBe("light");
  });

  it("setTheme updates the ref and persists to localStorage", async () => {
    const { theme, setTheme } = useTheme();
    setTheme("light");
    expect(theme.value).toBe("light");
    await new Promise((r) => setTimeout(r, 0));
    expect(localStorage.getItem("app-theme")).toBe("light");
  });

  it("setTheme changes the DOM when wrapped in an effect scope", async () => {
    const { effectScope } = await import("vue");
    const scope = effectScope();
    scope.run(() => {
      const { setTheme } = useTheme();
      setTheme("light");
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    scope.stop();
  });

  it("setTheme rejects invalid values and falls back to 'dark'", () => {
    const { theme, setTheme } = useTheme();
    setTheme("rainbow");
    expect(theme.value).toBe("dark");
  });

  it("cycle() advances through light → dark → system → light", () => {
    localStorage.setItem("app-theme", "light");
    const { theme, cycle } = useTheme();
    expect(theme.value).toBe("light");
    cycle();
    expect(theme.value).toBe("dark");
    cycle();
    expect(theme.value).toBe("system");
    cycle();
    expect(theme.value).toBe("light");
  });
});
